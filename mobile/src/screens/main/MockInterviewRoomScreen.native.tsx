import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useKeepAwake } from 'expo-keep-awake';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useActiveCall } from '../../context/ActiveCallContext';
import { colors } from '../../theme/colors';

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CONNECT_TIMEOUT_MS = 20_000;
const RECONNECT_GRACE_MS = 6_000;
const MAX_RECOVERY_ATTEMPTS = 3;
const CONTROLS_HIDE_MS = 5_000;

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
 * Android needs CAMERA and RECORD_AUDIO granted at runtime, not just declared
 * in the manifest — react-native-webrtc does not prompt on its own, so
 * getUserMedia would otherwise fail on a real device with a permission error
 * that reads like a hardware fault. Returns what was actually granted so the
 * call can still go ahead audio-only (or video-only) rather than refusing to
 * start because one of the two was declined.
 */
async function requestMediaPermissions(): Promise<{ camera: boolean; mic: boolean }> {
  if (Platform.OS !== 'android') return { camera: true, mic: true };
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return {
      camera: result[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED,
      mic: result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED,
    };
  } catch {
    // Treat a failed prompt as "try anyway" — getUserMedia reports the real
    // reason, and guessing "denied" here would block a working device.
    return { camera: true, mic: true };
  }
}

/**
 * Some devices reject a combined video+audio request outright even though
 * each works alone (another app holding the mic, a device-specific
 * constraint failure). Falling back preserves at least an audio-only call
 * instead of failing the join entirely.
 */
async function getBestAvailableStream(
  allowed: { camera: boolean; mic: boolean }
): Promise<{ stream: MediaStream; hasVideo: boolean; hasAudio: boolean }> {
  if (allowed.camera && allowed.mic) {
    try {
      const stream = (await mediaDevices.getUserMedia({ video: true, audio: true })) as unknown as MediaStream;
      return { stream, hasVideo: true, hasAudio: true };
    } catch {
      // fall through
    }
  }
  if (allowed.mic) {
    try {
      const stream = (await mediaDevices.getUserMedia({ video: false, audio: true })) as unknown as MediaStream;
      return { stream, hasVideo: false, hasAudio: true };
    } catch {
      // fall through
    }
  }
  const stream = (await mediaDevices.getUserMedia({ video: true, audio: false })) as unknown as MediaStream;
  return { stream, hasVideo: true, hasAudio: false };
}

export default function MockInterviewRoomScreen({ route, navigation }: any) {
  const code: string = route.params.code;
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { setCall, clearCall } = useActiveCall();

  // A call is useless if the screen dims mid-answer.
  useKeepAwake();

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
  const [joinUrl, setJoinUrl] = useState('');
  const [controlsVisible, setControlsVisible] = useState(true);
  /** Which stream occupies the full-bleed layer; tapping the thumbnail swaps. */
  const [mainView, setMainView] = useState<'remote' | 'local'>('remote');

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

  // The call owns the whole screen, so the stack header would just eat space
  // and put a second, conflicting back affordance next to the overlay one.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

    // Captured once: addTrack's second argument is non-nullable, and reading
    // the ref again inside the callback widens it back to MediaStream | null.
    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((track: any) => pc.addTrack(track, local));
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

        if (room.data.room.joinUrl) setJoinUrl(room.data.room.joinUrl);

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

        const allowed = await requestMediaPermissions();
        if (sessionIdRef.current !== mySession) return;
        if (!allowed.camera && !allowed.mic) {
          setStatus('error');
          setErrorMessage(
            'Camera and microphone permission were both denied. Allow them in Settings → Apps → JobPilot → Permissions, then rejoin.'
          );
          return;
        }

        const { stream, hasVideo, hasAudio } = await getBestAvailableStream(allowed);
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

  // Controls get out of the way once the call is up, and come back on tap.
  useEffect(() => {
    if (status !== 'connected' || !controlsVisible) return undefined;
    const timer = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(timer);
  }, [status, controlsVisible]);

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

  const leaveRoom = useCallback(() => {
    sessionIdRef.current++;
    cleanup();
    clearCall(code);
    navigation.goBack();
  }, [cleanup, clearCall, code, navigation]);

  // Publishes to the floating bubble so wandering off to another screen
  // doesn't silently strand a live call with no way back to it.
  useEffect(() => {
    const live = status === 'connected' || status === 'waiting' || status === 'reconnecting' || status === 'connecting';
    if (!live) {
      clearCall(code);
      return;
    }
    setCall({
      code,
      label: status === 'connected' && connectedAt ? formatDuration(elapsed) : STATUS_LABEL[status],
      focused: isFocused,
      renderThumbnail: remoteStream
        ? () => <RTCView streamURL={(remoteStream as any).toURL()} style={{ flex: 1 }} objectFit="cover" />
        : undefined,
      onReturn: () => navigation.navigate('MockInterviewRoom', { code }),
      onLeave: leaveRoom,
    });
  }, [status, isFocused, elapsed, connectedAt, remoteStream, code, setCall, clearCall, navigation, leaveRoom]);

  useEffect(() => () => clearCall(code), [clearCall, code]);

  async function copyLink() {
    if (!joinUrl) return;
    await Clipboard.setStringAsync(joinUrl);
    Toast.show({ type: 'success', text1: 'Link copied.' });
  }

  if (status === 'scheduled' && pendingInfo) {
    return (
      <View style={[styles.messageScreen, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.messageTitle}>{pendingInfo.title || 'This meeting'} hasn't opened yet</Text>
        <Text style={styles.messageBody}>
          The room opens 10 minutes before the start time. This screen will move you in automatically.
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.messageScreen, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.messageTitle, { color: colors.danger }]}>Can't join this room</Text>
        <Text style={styles.messageBody}>{errorMessage}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const showRemoteAsMain = mainView === 'remote';
  const mainStream = showRemoteAsMain ? remoteStream : localStream;
  const thumbStream = showRemoteAsMain ? localStream : remoteStream;
  const thumbIsSelf = showRemoteAsMain;

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setControlsVisible((v) => !v)}>
        {mainStream ? (
          <RTCView
            streamURL={(mainStream as any).toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={!showRemoteAsMain}
          />
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.placeholderText}>
              {status === 'waiting' ? 'Waiting for the other person to join' : STATUS_LABEL[status]}
            </Text>
            {status === 'waiting' && joinUrl ? (
              <Pressable onPress={copyLink} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Copy invite link</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Pressable>

      {thumbStream ? (
        <Pressable
          style={[styles.thumb, { top: insets.top + 64 }]}
          onPress={() => setMainView((v) => (v === 'remote' ? 'local' : 'remote'))}
        >
          <RTCView
            streamURL={(thumbStream as any).toURL()}
            style={{ flex: 1 }}
            objectFit="cover"
            mirror={thumbIsSelf}
          />
          <Text style={styles.thumbLabel}>{thumbIsSelf ? 'You' : peerName || 'Them'}</Text>
        </Pressable>
      ) : null}

      {controlsVisible ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.statusPill}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] || colors.textSecondary }]} />
            <Text style={styles.statusText}>
              {status === 'connected' && connectedAt ? formatDuration(elapsed) : STATUS_LABEL[status]}
            </Text>
            {quality ? <Text style={[styles.qualityText, { color: quality.color }]}>{quality.label}</Text> : null}
          </View>
          {peerName ? <Text style={styles.peerName}>{peerName}</Text> : null}
        </View>
      ) : null}

      {controlsVisible ? (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
          {!devices.hasVideo ? (
            <Text style={styles.audioOnlyNote}>No camera available — you're on audio only.</Text>
          ) : null}
          <View style={styles.controlRow}>
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
            <Pressable onPress={copyLink} style={styles.controlButton}>
              <Text style={styles.controlButtonText}>Invite</Text>
            </Pressable>
            <Pressable onPress={leaveRoom} style={[styles.controlButton, styles.leaveButton]}>
              <Text style={[styles.controlButtonText, { color: '#fff' }]}>Leave</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  placeholderText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  thumb: {
    position: 'absolute',
    right: 14,
    width: 104,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  thumbLabel: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    color: '#fff',
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, gap: 6 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  qualityText: { fontSize: 11, fontWeight: '700' },
  peerName: {
    color: '#fff',
    fontSize: 11,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, gap: 10 },
  audioOnlyNote: { color: colors.warning, fontSize: 11, textAlign: 'center' },
  controlRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  controlButton: {
    backgroundColor: 'rgba(30,41,59,0.92)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlButtonOff: { backgroundColor: 'rgba(248,113,113,0.22)', borderColor: colors.danger },
  controlButtonText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  leaveButton: { backgroundColor: colors.danger, borderColor: colors.danger },
  messageScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  messageTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  messageBody: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
});
