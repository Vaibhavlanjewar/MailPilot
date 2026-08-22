import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
} from 'react-native-webrtc';
import { auth } from '../../services/firebase';
import api from '../../services/api';
import { colors } from '../../theme/colors';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CONNECT_TIMEOUT_MS = 20_000;
const RECONNECT_GRACE_MS = 6_000;
const MAX_RECOVERY_ATTEMPTS = 3;

type Status =
  | 'checking'
  | 'scheduled'
  | 'waiting'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'error';

const STATUS_LABEL: Record<Status, string> = {
  checking: 'Preparing…',
  scheduled: 'Not started',
  waiting: 'Waiting for the other person',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  connected: 'Live',
  error: 'Problem',
};

const STATUS_COLOR: Partial<Record<Status, string>> = {
  connected: colors.success,
  connecting: colors.warning,
  reconnecting: colors.warning,
  waiting: colors.warning,
  error: colors.danger,
};

function rateConnection(rtt: number | null, loss: number) {
  if (rtt == null) return null;
  if (rtt < 0.15 && loss < 0.03) return { label: 'Good', bars: 3, color: colors.success };
  if (rtt < 0.35 && loss < 0.08) return { label: 'Fair', bars: 2, color: colors.warning };
  return { label: 'Poor', bars: 1, color: colors.danger };
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function wsBase() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
  const url = new URL(apiUrl);
  return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`;
}

/**
 * Some devices reject a combined video+audio request outright even though
 * each works alone (another app holding the mic, a device-specific
 * constraint failure). Falling back preserves at least an audio-only call
 * instead of failing the join entirely.
 */
async function getBestAvailableStream(): Promise<{ stream: MediaStream; hasVideo: boolean; hasAudio: boolean }> {
  try {
    const stream = (await mediaDevices.getUserMedia({ video: true, audio: true })) as unknown as MediaStream;
    return { stream, hasVideo: true, hasAudio: true };
  } catch {
    // fall through
  }
  try {
    const stream = (await mediaDevices.getUserMedia({ video: false, audio: true })) as unknown as MediaStream;
    return { stream, hasVideo: false, hasAudio: true };
  } catch {
    // fall through
  }
  const stream = (await mediaDevices.getUserMedia({ video: true, audio: false })) as unknown as MediaStream;
  return { stream, hasVideo: true, hasAudio: false };
}

export default function MockInterviewRoomScreen({ route, navigation }: any) {
  const code: string = route.params.code;

  const [status, setStatus] = useState<Status>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingInfo, setPendingInfo] = useState<{ title?: string; joinOpensAt?: string } | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerName, setPeerName] = useState('');
  const [devices, setDevices] = useState({ hasVideo: true, hasAudio: true });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState<{ label: string; bars: number; color: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isInitiatorRef = useRef(false);
  const connectTimeoutRef = useRef<any>(null);
  const reconnectTimerRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const recoveryAttemptsRef = useRef(0);
  const sessionIdRef = useRef(0);
  const createPeerConnectionRef = useRef<() => any>(() => null);

  const shareUrl = `jobpilot://mock-interview/${code}`;

  const cleanup = useCallback(() => {
    clearTimeout(connectTimeoutRef.current);
    clearTimeout(reconnectTimerRef.current);
    pcRef.current?.close();
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t: any) => t.stop());
  }, []);

  const attemptRecovery = useCallback(() => {
    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      setStatus('error');
      setErrorMessage(
        "Lost the connection and couldn't get it back. Try a different network — a phone hotspot usually works."
      );
      return;
    }
    recoveryAttemptsRef.current += 1;
    setStatus('reconnecting');

    if (!isInitiatorRef.current) return; // the other side drives the re-offer
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    (async () => {
      try {
        pcRef.current?.close();
        const pc = createPeerConnectionRef.current();
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        wsRef.current!.send(JSON.stringify({ type: 'offer', sdp: offer }));
      } catch {
        setStatus('error');
        setErrorMessage('Could not re-establish the connection. Please rejoin the room.');
      }
    })();
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.onicecandidate = (e: any) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
      }
    };

    pc.ontrack = (e: any) => {
      let assembled = remoteStreamRef.current;
      if (!assembled) {
        assembled = new MediaStream();
        remoteStreamRef.current = assembled;
      }
      const track = e.track;
      const already = assembled.getTracks().some((t: any) => t.id === track.id);
      if (!already) assembled.addTrack(track);
      setRemoteStream(assembled);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      if (state === 'connected') {
        clearTimeout(connectTimeoutRef.current);
        clearTimeout(reconnectTimerRef.current);
        recoveryAttemptsRef.current = 0;
        setStatus('connected');
        setConnectedAt((prev) => prev ?? Date.now());
        return;
      }

      if (state === 'disconnected') {
        setStatus('reconnecting');
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (pcRef.current?.connectionState !== 'connected') attemptRecovery();
        }, RECONNECT_GRACE_MS);
        return;
      }

      if (state === 'failed') {
        clearTimeout(reconnectTimerRef.current);
        attemptRecovery();
      }
    };

    localStreamRef.current?.getTracks().forEach((track: any) => pc.addTrack(track, localStreamRef.current));
    pcRef.current = pc;
    pendingCandidatesRef.current = [];
    remoteStreamRef.current = null;
    return pc;
  }, [attemptRecovery]);

  createPeerConnectionRef.current = createPeerConnection;

  async function flushPendingCandidates(pc: any) {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore malformed/stale candidates
      }
    }
  }

  const startCall = useCallback(
    async (mySession: number) => {
      try {
        const room = await api.get(`/mock-interview/rooms/${code}`);
        if (sessionIdRef.current !== mySession) return;

        if (!room.data.room.canJoinNow) {
          setPendingInfo({ title: room.data.room.title, joinOpensAt: room.data.room.joinOpensAt });
          setStatus('scheduled');
          return;
        }
        if (room.data.room.isFull) {
          setStatus('error');
          setErrorMessage('This room already has two participants.');
          return;
        }

        try {
          const { data } = await api.get('/mock-interview/ice-servers');
          if (data.iceServers?.length) iceServersRef.current = data.iceServers;
        } catch {
          iceServersRef.current = FALLBACK_ICE_SERVERS;
        }
        if (sessionIdRef.current !== mySession) return;

        const { stream, hasVideo, hasAudio } = await getBestAvailableStream();
        if (sessionIdRef.current !== mySession) {
          stream.getTracks().forEach((t: any) => t.stop());
          return;
        }

        setDevices({ hasVideo, hasAudio });
        setCamOn(hasVideo);
        setMicOn(hasAudio);
        localStreamRef.current = stream;
        setLocalStream(stream);

        const token = await auth?.currentUser?.getIdToken();
        if (!token || sessionIdRef.current !== mySession) return;

        const ws = new WebSocket(`${wsBase()}/ws/mock-interview?room=${code}&token=${token}`);
        if (sessionIdRef.current !== mySession) {
          ws.close();
          return;
        }
        wsRef.current = ws;

        ws.onopen = () => setStatus('waiting');

        ws.onmessage = async (event: any) => {
          const msg = JSON.parse(event.data);

          if (msg.type === 'error') {
            setStatus('error');
            setErrorMessage(msg.message);
            return;
          }

          if (msg.type === 'joined') {
            isInitiatorRef.current = msg.isInitiator;
            if (msg.peerName) setPeerName(msg.peerName);
            return;
          }

          if (msg.type === 'peer-joined') {
            setPeerName(msg.peerName || '');
            setStatus('connecting');
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = setTimeout(() => {
              if (pcRef.current?.connectionState !== 'connected') {
                setStatus('error');
                setErrorMessage('Connection timed out. Try rejoining, or a different network.');
              }
            }, CONNECT_TIMEOUT_MS);

            if (!msg.youAreInitiator) return;

            pcRef.current?.close();
            const pc = createPeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
            return;
          }

          if (msg.type === 'offer') {
            setStatus('connecting');
            clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = setTimeout(() => {
              if (pcRef.current?.connectionState !== 'connected') {
                setStatus('error');
                setErrorMessage('Connection timed out. Try rejoining, or a different network.');
              }
            }, CONNECT_TIMEOUT_MS);

            pcRef.current?.close();
            const pc = createPeerConnection();
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            await flushPendingCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
            return;
          }

          if (msg.type === 'answer') {
            const pc = pcRef.current;
            await pc?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            if (pc) await flushPendingCandidates(pc);
            return;
          }

          if (msg.type === 'ice-candidate') {
            const pc = pcRef.current;
            if (!pc?.remoteDescription) {
              pendingCandidatesRef.current.push(msg.candidate);
              return;
            }
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch {
              // ignore malformed/stale candidates
            }
            return;
          }

          if (msg.type === 'peer-left') {
            setStatus('waiting');
            setPeerName('');
            setConnectedAt(null);
            setElapsed(0);
            recoveryAttemptsRef.current = 0;
            clearTimeout(connectTimeoutRef.current);
            clearTimeout(reconnectTimerRef.current);
            setRemoteStream(null);
            remoteStreamRef.current = null;
            pcRef.current?.close();
            pcRef.current = null;
            pendingCandidatesRef.current = [];
          }
        };

        ws.onerror = () => {
          setStatus('error');
          setErrorMessage('Connection to the signaling server failed.');
        };
      } catch (err: any) {
        setStatus('error');
        if (err?.name === 'NotAllowedError' || /permission/i.test(err?.message || '')) {
          setErrorMessage('Camera/microphone permission was denied — allow access and rejoin.');
        } else if (err?.name === 'NotFoundError') {
          setErrorMessage('No camera or microphone was found on this device.');
        } else {
          setErrorMessage(err?.message || 'Could not start the call.');
        }
      }
    },
    [code, createPeerConnection]
  );

  useEffect(() => {
    const mySession = ++sessionIdRef.current;
    startCall(mySession);
    return () => {
      sessionIdRef.current++;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!connectedAt) return undefined;
    const tick = () => setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [connectedAt]);

  useEffect(() => {
    if (status !== 'connected') {
      setQuality(null);
      return undefined;
    }
    let lastLost = 0;
    let lastReceived = 0;

    const sample = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let rtt: number | null = null;
        let lost = 0;
        let received = 0;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') rtt = report.currentRoundTripTime;
          }
          if (report.type === 'inbound-rtp' && !report.isRemote) {
            lost += report.packetsLost || 0;
            received += report.packetsReceived || 0;
          }
        });
        const deltaLost = Math.max(0, lost - lastLost);
        const deltaReceived = Math.max(0, received - lastReceived);
        lastLost = lost;
        lastReceived = received;
        const loss = deltaReceived > 0 ? deltaLost / (deltaLost + deltaReceived) : 0;
        setQuality(rateConnection(rtt, loss));
      } catch {
        // stats are advisory
      }
    };
    sample();
    const timer = setInterval(sample, 4000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'scheduled') return undefined;
    const timer = setInterval(() => startCall(sessionIdRef.current), 30_000);
    return () => clearInterval(timer);
  }, [status, startCall]);

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  function leaveRoom() {
    cleanup();
    navigation.goBack();
  }

  async function copyLink() {
    await Clipboard.setStringAsync(shareUrl);
    Toast.show({ type: 'success', text1: 'Room code link copied.' });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Live Practice Room</Text>
          <View style={styles.badgeRow}>
            <Text style={[styles.statusBadge, { color: STATUS_COLOR[status] || colors.textSecondary }]}>
              {STATUS_LABEL[status]}
            </Text>
            {peerName ? <Text style={styles.muted}>with {peerName}</Text> : null}
            {connectedAt ? <Text style={styles.mono}>{formatDuration(elapsed)}</Text> : null}
            {quality ? <Text style={[styles.muted, { color: quality.color }]}>{quality.label}</Text> : null}
          </View>
        </View>
        <Pressable onPress={copyLink} style={styles.chipButton}>
          <Text style={styles.chipButtonText}>Copy link</Text>
        </Pressable>
      </View>

      {status === 'scheduled' && pendingInfo ? (
        <View style={styles.infoBanner}>
          <Text style={styles.bannerTitle}>{pendingInfo.title || 'This meeting'} hasn't opened yet</Text>
          <Text style={styles.muted}>
            The room opens 10 minutes before the start time. This screen will move you in automatically.
          </Text>
        </View>
      ) : null}

      {status !== 'scheduled' && status !== 'error' && !devices.hasVideo ? (
        <View style={styles.warnBanner}>
          <Text style={styles.body}>No camera found — you've joined with audio only.</Text>
        </View>
      ) : null}

      {status === 'waiting' ? (
        <View style={styles.infoBanner}>
          <Text style={styles.body}>Waiting for the other person to join. Share the invite link above.</Text>
        </View>
      ) : null}

      {status === 'reconnecting' ? (
        <View style={styles.warnBanner}>
          <Text style={styles.bannerTitle}>Connection dropped — trying to restore it.</Text>
          <Text style={styles.muted}>Stay on the screen. Short drops usually recover on their own.</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {status !== 'scheduled' && (
        <>
          <View style={styles.videoTile}>
            {localStream ? (
              <RTCView streamURL={(localStream as any).toURL()} style={styles.video} objectFit="cover" mirror />
            ) : null}
            <Text style={styles.videoLabel}>You</Text>
          </View>

          <View style={styles.videoTile}>
            {remoteStream ? (
              <RTCView streamURL={(remoteStream as any).toURL()} style={styles.video} objectFit="cover" />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.muted}>{peerName || 'Waiting…'}</Text>
              </View>
            )}
            <Text style={styles.videoLabel}>{peerName || 'Waiting…'}</Text>
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              onPress={toggleMic}
              disabled={!devices.hasAudio}
              style={[styles.controlButton, !micOn ? styles.controlButtonOff : null]}
            >
              <Text style={styles.controlButtonText}>{micOn ? 'Mute' : 'Unmute'}</Text>
            </Pressable>
            <Pressable
              onPress={toggleCam}
              disabled={!devices.hasVideo}
              style={[styles.controlButton, !camOn ? styles.controlButtonOff : null]}
            >
              <Text style={styles.controlButtonText}>{camOn ? 'Stop video' : 'Start video'}</Text>
            </Pressable>
            <Pressable onPress={leaveRoom} style={[styles.controlButton, styles.leaveButton]}>
              <Text style={[styles.controlButtonText, { color: '#fff' }]}>Leave</Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Media flows directly between the two devices. If a direct path is blocked, a relay
            server carries it instead.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  statusBadge: { fontSize: 11, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 11 },
  mono: { color: colors.textSecondary, fontSize: 11, fontFamily: 'monospace' },
  chipButton: { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipButtonText: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  infoBanner: { backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12, padding: 14, marginBottom: 12 },
  warnBanner: { backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorBanner: { backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: 14, marginBottom: 12 },
  bannerTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  body: { color: colors.textPrimary, fontSize: 12 },
  errorText: { color: colors.danger, fontSize: 12 },
  videoTile: { aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  video: { flex: 1 },
  videoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoLabel: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  controlButton: { backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  controlButtonOff: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  controlButtonText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  leaveButton: { backgroundColor: colors.danger, borderColor: colors.danger },
  note: { color: colors.textSecondary, fontSize: 11, marginTop: 16, textAlign: 'center', lineHeight: 16 },
});
