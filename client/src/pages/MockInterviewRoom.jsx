import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth } from '../services/firebase';
import api from '../services/api';
import AudioLevelMeter from '../components/AudioLevelMeter';

/**
 * Used only if the server's /ice-servers call fails. TURN credentials are
 * fetched per-session instead of hardcoded here, so they aren't published in
 * the client bundle to anyone who views source.
 */
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const CONNECT_TIMEOUT_MS = 20_000;
/** How long ICE gets to repair a 'disconnected' state before we force a rebuild. */
const RECONNECT_GRACE_MS = 6_000;
const MAX_RECOVERY_ATTEMPTS = 3;

/** Raw state names ("waiting", "checking") read as errors to a candidate mid-interview. */
const STATUS_LABEL = {
  checking: 'Preparing…',
  scheduled: 'Not started',
  waiting: 'Waiting for the other person',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  connected: 'Live',
  ended: 'Ended',
  error: 'Problem',
};

const STATUS_TONE = {
  connected: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  connecting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  reconnecting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  waiting: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  error: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

/**
 * Round-trip time is the signal users actually feel — it maps to the lag before
 * the other person reacts. Packet loss matters too, but RTT is what makes a
 * conversation feel broken, so it drives the rating.
 */
function rateConnection({ rtt, loss }) {
  if (rtt == null) return null;
  if (rtt < 0.15 && loss < 0.03) return { label: 'Good', bars: 3, tone: 'text-emerald-500' };
  if (rtt < 0.35 && loss < 0.08) return { label: 'Fair', bars: 2, tone: 'text-amber-500' };
  return { label: 'Poor', bars: 1, tone: 'text-rose-500' };
}

function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Plenty of desktops have a mic but no webcam. Asking for both at once fails
 * outright in that case (NotFoundError), which would block an audio-only
 * practice call that would otherwise work fine — so degrade instead of failing.
 *
 * @returns {Promise<{ stream: MediaStream, hasVideo: boolean, hasAudio: boolean }>}
 */
/**
 * Mobile browsers frequently reject a combined video+audio request that they'd
 * grant individually — another app holding the mic, or a device-specific
 * constraint failure. Falling straight back to video-only there would join the
 * call permanently mute, so audio is retried on its own before giving up, and
 * the reason for each failure is kept for the audio-check panel.
 */
async function getBestAvailableStream() {
  const reasons = [];

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    return { stream, hasVideo: true, hasAudio: true, audioError: '' };
  } catch (err) {
    // A denied *permission* is the user's decision and shouldn't be retried as
    // something else; only a missing/unusable device is worth falling back for.
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') throw err;
    reasons.push(`video+audio: ${err.name}`);
  }

  // Audio and video separately, then combined into one stream — this is what
  // rescues the common mobile case above.
  try {
    const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true });
      const combined = new MediaStream([
        ...videoOnly.getVideoTracks(),
        ...audioOnly.getAudioTracks(),
      ]);
      return { stream: combined, hasVideo: true, hasAudio: true, audioError: '' };
    } catch (err) {
      reasons.push(`video: ${err.name}`);
      return { stream: audioOnly, hasVideo: false, hasAudio: true, audioError: '' };
    }
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') throw err;
    reasons.push(`audio: ${err.name}`);
  }

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  return { stream, hasVideo: true, hasAudio: false, audioError: reasons.join(' · ') };
}

/**
 * Frontend and backend are separate deployments (Vercel + Render), so the
 * signaling WS can't just reuse window.location.host like it can in local
 * dev — it has to target the same backend api.js points REST calls at.
 */
function signalingBase() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const parsed = new URL(apiUrl, window.location.origin);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProtocol}://${parsed.host}`;
  }
  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProtocol}://${window.location.host}`;
}

export default function MockInterviewRoom() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('checking'); // checking | scheduled | waiting | connecting | connected | ended | error
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingInfo, setPendingInfo] = useState(null); // { title, joinOpensAt } — set only while status === 'scheduled'
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerName, setPeerName] = useState('');
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const [devices, setDevices] = useState({ hasVideo: true, hasAudio: true, mics: 0, cams: 0 });
  const [remoteHasAudio, setRemoteHasAudio] = useState(null); // null = unknown yet
  // Mirrored into state (not just refs) so the level meters re-render with them.
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [showAudioCheck, setShowAudioCheck] = useState(false);
  const [connectedAt, setConnectedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality, setQuality] = useState(null);
  // Android visitors get an upfront choice before anything touches their
  // camera/mic — null means undecided (interstitial showing), 'web' means
  // resolved either way (continuing here or the choice doesn't apply).
  const [platformChoice, setPlatformChoice] = useState(() => (isAndroid() ? null : 'web'));
  const stageRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const connectTimeoutRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  const remoteStreamRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const recoveryAttemptsRef = useRef(0);
  // StrictMode double-invokes the mount effect in dev, and getUserMedia/WS
  // setup isn't naturally cancellable — without this guard both invocations
  // race to open their own camera stream + signaling connection as the same
  // user, which corrupts the server's userId-keyed room-peer tracking (see
  // startCall below for the per-checkpoint bail-out this pairs with).
  const sessionIdRef = useRef(0);

  const shareUrl = `${window.location.origin}/app/mock-interview/${code}`;

  const cleanup = useCallback(() => {
    clearTimeout(connectTimeoutRef.current);
    clearTimeout(reconnectTimerRef.current);
    // Leaving while fullscreen would otherwise strand the next page in it.
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    pcRef.current?.close();
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  /**
   * Rebuilds the connection after ICE gives up.
   *
   * Only the fixed initiator re-offers — if both sides tried, the offers would
   * collide (glare) and neither would apply. The other side needs no special
   * handling: its existing 'offer' handler already tears down the stale
   * connection and answers, which is exactly the recovery path.
   */
  const attemptRecovery = useCallback(() => {
    if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
      setStatus('error');
      setErrorMessage(
        "Lost the connection and couldn't get it back. This is usually a strict office or campus network — try a different one (a phone hotspot normally works).",
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
        wsRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
      } catch {
        setStatus('error');
        setErrorMessage('Could not re-establish the connection. Please rejoin the room.');
      }
    })();
  }, []);

  // createPeerConnection and attemptRecovery reference each other; a ref breaks
  // the cycle without making either callback depend on the other's identity.
  const createPeerConnectionRef = useRef(null);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      const video = remoteVideoRef.current;
      if (!video) return;

      // ontrack fires once per track. Assigning e.streams[0] each time looks
      // equivalent but isn't: the audio track usually arrives *after* the video
      // one, and re-assigning srcObject to the same MediaStream object is a
      // no-op in some browsers, so the element keeps playing the video-only
      // snapshot it first latched onto and stays permanently silent.
      // Owning the stream and re-attaching on every track removes the guesswork.
      let assembled = remoteStreamRef.current;
      if (!assembled) {
        assembled = new MediaStream();
        remoteStreamRef.current = assembled;
      }
      if (!assembled.getTracks().includes(e.track)) {
        assembled.addTrack(e.track);
      }

      video.srcObject = null;
      video.srcObject = assembled;
      video.volume = 1;
      setRemoteStream(assembled);
      setRemoteHasAudio(assembled.getAudioTracks().length > 0);

      // A previous autoplay fallback may have left the element muted; without
      // clearing it here a reconnect would stay permanently silent.
      video.muted = false;
      setNeedsUnmute(false);
      // Browsers block autoplay of unmuted media without a prior user gesture
      // on the tab — very likely for whoever opened the invite link fresh.
      // Fall back to muted playback and let them opt in to sound.
      video.play().catch(() => {
        video.muted = true;
        setNeedsUnmute(true);
        video.play().catch(() => {});
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      if (state === 'connected') {
        clearTimeout(connectTimeoutRef.current);
        clearTimeout(reconnectTimerRef.current);
        recoveryAttemptsRef.current = 0;
        setStatus('connected');
        // Keep the original start time across a reconnect or renegotiation, so
        // the timer reflects the whole session, not the current ICE connection.
        setConnectedAt((prev) => prev ?? Date.now());
        return;
      }

      // 'disconnected' is routinely transient — a Wi-Fi blip, a phone changing
      // towers, a few lost packets. ICE usually repairs it within seconds, so
      // treating it as fatal (as this did) ended calls that would have healed
      // on their own. Show it, give it a window, and only then intervene.
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

    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    pcRef.current = pc;
    pendingCandidatesRef.current = [];
    // Each new connection brings fresh tracks; carrying the old stream over
    // would leave dead tracks in it and mis-report what the peer is sending.
    remoteStreamRef.current = null;
    return pc;
  }, [attemptRecovery]);

  // Kept current so attemptRecovery can rebuild without depending on this
  // callback's identity (they reference each other).
  createPeerConnectionRef.current = createPeerConnection;

  // Candidates can arrive over the WS while setRemoteDescription is still
  // pending (separate message events aren't blocked by that await), so they
  // must be queued and flushed after — applying them immediately throws and
  // silently drops them, which starves ICE of candidates and the call never connects.
  async function flushPendingCandidates(pc) {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore malformed/stale candidates.
      }
    }
  }

  const startCall = useCallback(async (mySession) => {
    try {
      const room = await api.get(`/mock-interview/rooms/${code}`);
      if (sessionIdRef.current !== mySession) return; // superseded by a newer effect run

      // Scheduled meetings only open the join window shortly before the start
      // time (see server-side joinWindow()) — bail out before touching the
      // camera/mic at all, rather than opening a live room nobody should be in yet.
      if (!room.data.room.canJoinNow) {
        setPendingInfo({ title: room.data.room.title, joinOpensAt: room.data.room.joinOpensAt });
        setStatus('scheduled');
        return;
      }

      // isFull already excludes the caller if they've been in this room before,
      // so a returning participant is never turned away by their own presence.
      if (room.data.room.isFull) {
        setStatus('error');
        setErrorMessage('This room already has two participants.');
        return;
      }

      // Must resolve before the first RTCPeerConnection is built — ICE servers
      // can't be added after construction. A failure here is non-fatal: STUN
      // alone still connects most calls, just not behind strict firewalls.
      try {
        const { data } = await api.get('/mock-interview/ice-servers');
        if (data.iceServers?.length) iceServersRef.current = data.iceServers;
      } catch {
        iceServersRef.current = FALLBACK_ICE_SERVERS;
      }
      if (sessionIdRef.current !== mySession) return;

      const { stream, hasVideo, hasAudio } = await getBestAvailableStream();
      if (sessionIdRef.current !== mySession) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // enumerateDevices only reports real labels/counts once permission has
      // been granted, so it has to run after getUserMedia, not before. This
      // distinguishes "hardware isn't there" from "we failed to open it".
      let detected = { mics: 0, cams: 0 };
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        detected = {
          mics: list.filter((d) => d.kind === 'audioinput').length,
          cams: list.filter((d) => d.kind === 'videoinput').length,
        };
      } catch {
        // Diagnostics only — never block the call on this.
      }
      setDevices({ hasVideo, hasAudio, ...detected });
      setCamOn(hasVideo);
      setMicOn(hasAudio);
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const token = await auth.currentUser.getIdToken();
      if (sessionIdRef.current !== mySession) return;

      const ws = new WebSocket(`${signalingBase()}/ws/mock-interview?room=${code}&token=${token}`);
      if (sessionIdRef.current !== mySession) {
        ws.close();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => setStatus('waiting');

      ws.onmessage = async (event) => {
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
              setErrorMessage('Connection timed out. Try refreshing, or a different network.');
            }
          }, CONNECT_TIMEOUT_MS);

          // Only the fixed initiator offers, so the two sides can never both
          // offer at once (glare). Both get this message on every (re)join.
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
              setErrorMessage('Connection timed out. Try refreshing, or a different network.');
            }
          }, CONNECT_TIMEOUT_MS);

          // A re-offer means the peer reconnected — drop the stale connection
          // rather than trying to renegotiate on top of it.
          pcRef.current?.close();
          const pc = createPeerConnection();
          await pc.setRemoteDescription(msg.sdp);
          await flushPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
          return;
        }

        if (msg.type === 'answer') {
          const pc = pcRef.current;
          await pc?.setRemoteDescription(msg.sdp);
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
            await pc.addIceCandidate(msg.candidate);
          } catch {
            // Ignore malformed/stale candidates.
          }
          return;
        }

        if (msg.type === 'peer-left') {
          setStatus('waiting');
          setPeerName('');
          setNeedsUnmute(false);
          // The call is over, so stop the clock — it previously kept counting
          // while the header said "waiting", reporting time nobody was on.
          setConnectedAt(null);
          setElapsed(0);
          recoveryAttemptsRef.current = 0;
          clearTimeout(connectTimeoutRef.current);
          clearTimeout(reconnectTimerRef.current);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setRemoteStream(null);
          setRemoteHasAudio(null);
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
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Camera/microphone permission was denied — allow access and reload.');
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        setErrorMessage(
          'No camera or microphone was found on this device. Plug one in (or join from a phone/laptop that has one) and reload.',
        );
      } else if (err.name === 'NotReadableError') {
        setErrorMessage(
          'Your camera or microphone is already in use by another app. Close it (Zoom, Teams, Meet) and reload.',
        );
      } else {
        setErrorMessage(err.message || 'Could not start the call.');
      }
    }
  }, [code, createPeerConnection]);

  useEffect(() => {
    if (platformChoice !== 'web') return undefined; // interstitial still showing — nothing to join yet
    const mySession = ++sessionIdRef.current;
    startCall(mySession);
    return () => {
      sessionIdRef.current++; // invalidate this session so its in-flight setup bails out
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, platformChoice]);

  // Ticks only while a call is up. Derived from a timestamp rather than an
  // incrementing counter so a backgrounded tab (where timers are throttled)
  // still shows the true duration on return.
  useEffect(() => {
    if (!connectedAt) return undefined;
    const tick = () => setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [connectedAt]);

  // Samples getStats while a call is up so a degrading network is visible
  // before it drops, rather than the call simply freezing with no explanation.
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
        let rtt = null;
        let lost = 0;
        let received = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') {
              rtt = report.currentRoundTripTime;
            }
          }
          if (report.type === 'inbound-rtp' && !report.isRemote) {
            lost += report.packetsLost || 0;
            received += report.packetsReceived || 0;
          }
        });

        // Deltas, not cumulative totals — otherwise early loss would keep the
        // rating pinned to "poor" long after the network recovered.
        const deltaLost = Math.max(0, lost - lastLost);
        const deltaReceived = Math.max(0, received - lastReceived);
        lastLost = lost;
        lastReceived = received;
        const loss = deltaReceived > 0 ? deltaLost / (deltaLost + deltaReceived) : 0;

        setQuality(rateConnection({ rtt, loss }));
      } catch {
        // Stats are advisory; never let them disturb a working call.
      }
    };

    sample();
    const timer = setInterval(sample, 4000);
    return () => clearInterval(timer);
  }, [status]);

  // The browser can exit fullscreen without going through our button (Esc,
  // gesture, OS chrome), so mirror the real state instead of assuming.
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // While the join window hasn't opened yet, re-check periodically so the
  // page moves itself into the call the moment it's allowed to, instead of
  // requiring a manual reload at exactly the right second.
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

  async function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // iOS Safari doesn't implement the element Fullscreen API; the caller
        // just stays windowed rather than throwing at the user.
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      toast.info('Your browser blocked fullscreen here.');
    }
  }

  function leaveRoom() {
    cleanup();
    navigate('/app/mock-interview');
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied.');
  }

  // Android visitors choose up front, before this page ever asks for
  // camera/mic — opening the app hands off immediately; staying here just
  // resolves the choice and falls through to the normal join flow below.
  if (platformChoice === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 pt-16 text-center">
        <h1 className="text-lg font-bold text-app">Join this practice room</h1>
        <p className="text-sm text-app-muted">
          Have the JobPilot app installed? Join there for the best experience — or continue right here in
          the browser.
        </p>
        <a
          href={`jobpilot://mock-interview/${code}`}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Open in the JobPilot app
        </a>
        <button
          type="button"
          onClick={() => setPlatformChoice('web')}
          className="w-full rounded-xl bg-app-muted px-4 py-3 text-sm font-semibold text-app hover:opacity-80"
        >
          Continue in this browser
        </button>
        <p className="text-xs text-app-muted">Don't have the app? Continuing in the browser works fine too.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-app">Live Practice Room</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold ${STATUS_TONE[status] || 'bg-app-muted text-app-muted'}`}
            >
              <i className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-500' : 'bg-current opacity-60'}`} />
              {STATUS_LABEL[status] || status}
            </span>
            {peerName && <span className="text-app-muted">with {peerName}</span>}
            {connectedAt && (
              <span className="font-mono tabular-nums text-app-muted" title="Time on this call">
                {formatDuration(elapsed)}
              </span>
            )}
            {quality && (
              <span
                className={`inline-flex items-center gap-1 ${quality.tone}`}
                title={`Connection quality: ${quality.label}`}
              >
                <span className="flex items-end gap-[2px]" aria-hidden="true">
                  {[1, 2, 3].map((bar) => (
                    <i
                      key={bar}
                      className={`w-[3px] rounded-sm ${bar <= quality.bars ? 'bg-current' : 'bg-current opacity-25'}`}
                      style={{ height: `${bar * 3 + 2}px` }}
                    />
                  ))}
                </span>
                {quality.label}
              </span>
            )}
          </div>
        </div>
        <button onClick={copyLink} className="rounded-xl bg-app-muted px-3 py-2 text-xs font-semibold text-app hover:opacity-80">
          Copy invite link
        </button>
      </div>

      {status === 'scheduled' && pendingInfo && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center text-sm text-app">
          <p className="text-base font-semibold">{pendingInfo.title || 'This meeting'} hasn't opened yet</p>
          <p className="mt-1 text-app-muted">
            The room opens 10 minutes before the start time
            {pendingInfo.joinOpensAt && (
              <> — around {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(pendingInfo.joinOpensAt))}</>
            )}
            . This page will move you in automatically once it does.
          </p>
        </div>
      )}

      {status !== 'scheduled' && status !== 'error' && !devices.hasVideo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-app">
          No camera found on this device, so you've joined with audio only. The other person can
          still see and hear you as normal — they just won't see your video.
        </div>
      )}

      {status !== 'scheduled' && status !== 'error' && !devices.hasAudio && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-app">
          <p className="font-semibold">They can't hear you — no microphone is available.</p>
          <p className="mt-1 text-app-muted">
            {devices.mics > 0
              ? `Windows sees ${devices.mics} microphone${devices.mics > 1 ? 's' : ''}, but the browser couldn't open one. It's usually another app holding it (Zoom/Teams/Meet), or the site's mic permission is blocked — check the icon at the left of the address bar, then reload.`
              : 'No microphone is connected to this device at all. Plug in a headset or USB mic, or check Windows Settings → Privacy & security → Microphone, then reload.'}
          </p>
        </div>
      )}

      {status === 'connected' && remoteHasAudio === false && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-app">
          You can't hear them because they joined without a microphone — nothing is wrong on your end.
        </div>
      )}

      {status === 'waiting' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-app">
          Waiting for the other person to join. Share the invite link above with them.
        </div>
      )}

      {status === 'reconnecting' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-app">
          <p className="font-semibold">Connection dropped — trying to restore it.</p>
          <p className="mt-1 text-app-muted">
            Stay on the page. Short drops usually recover on their own within a few seconds.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </div>
      )}

      {status !== 'scheduled' && (
      <>
      {/*
        In fullscreen the stage becomes the whole screen, so it carries its own
        black background and centres itself — otherwise the browser letterboxes
        a page-width grid against default white.
        On phones in landscape the two tiles sit side by side; portrait stacks
        them, which is why the breakpoint is orientation-aware rather than
        width-only.
      */}
      <div
        ref={stageRef}
        className={
          isFullscreen
            ? 'flex h-screen w-screen flex-col justify-center gap-2 bg-black p-2'
            : 'space-y-4'
        }
      >
        <div
          className={
            isFullscreen
              ? 'grid min-h-0 flex-1 grid-cols-1 gap-2 landscape:grid-cols-2'
              : 'grid grid-cols-1 gap-4 landscape:grid-cols-2 md:grid-cols-2'
          }
        >
          <div className="relative min-h-0 overflow-hidden rounded-2xl border border-surface-border bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={
                isFullscreen
                  ? 'h-full w-full object-contain'
                  : 'aspect-video w-full object-cover'
              }
            />
            {!devices.hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">
                Audio only — no camera on this device
              </div>
            )}
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">You</span>
          </div>
          <div className="relative min-h-0 overflow-hidden rounded-2xl border border-surface-border bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={
                isFullscreen
                  ? 'h-full w-full object-contain'
                  : 'aspect-video w-full object-cover'
              }
            />
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {peerName || 'Waiting…'}
            </span>
            {status === 'connected' && (
              <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white">
                {formatDuration(elapsed)}
              </span>
            )}
          {needsUnmute && (
            <button
              onClick={() => {
                const video = remoteVideoRef.current;
                if (video) {
                  video.muted = false;
                  video.play().catch(() => {});
                }
                setNeedsUnmute(false);
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-white"
            >
              Tap to enable sound
            </button>
          )}
        </div>
      </div>

      {/* Diagnostics would eat the video area when the stage is the whole screen. */}
      <div className={`rounded-xl border border-surface-border bg-app-surface p-4 ${isFullscreen ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => setShowAudioCheck((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-semibold text-app">Audio check</span>
          <span className="text-xs text-app-muted">{showAudioCheck ? 'Hide' : 'No sound? Open this'}</span>
        </button>

        {showAudioCheck && (
          <div className="mt-4 space-y-3">
            <AudioLevelMeter
              stream={localStream}
              label="Your mic"
              hint={micOn ? 'say something' : 'muted by you'}
            />
            <AudioLevelMeter
              stream={remoteStream}
              label={peerName ? `${peerName}'s mic` : 'Their mic'}
              hint="nothing incoming"
            />

            <ul className="space-y-1.5 border-t border-surface-border pt-3 text-xs text-app-muted">
              <li>
                <strong className="text-app">Your bar moves, theirs doesn't</strong> — their mic
                isn't sending. They should open this panel on their side.
              </li>
              <li>
                <strong className="text-app">Their bar moves but you hear nothing</strong> — the
                browser is blocking sound. Use the button below, and check your system volume and
                output device.
              </li>
              <li>
                <strong className="text-app">Your bar doesn't move</strong> — your mic isn't being
                captured. Check the mic permission in the address bar, and close any other app
                holding it (Zoom, Teams, Meet).
              </li>
            </ul>

            <button
              type="button"
              onClick={() => {
                const video = remoteVideoRef.current;
                if (video) {
                  video.muted = false;
                  video.volume = 1;
                  video.play().catch(() => {});
                }
                setNeedsUnmute(false);
              }}
              className="rounded-lg bg-app-gradient px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Force unmute their audio
            </button>
          </div>
        )}
      </div>

      {/* Kept inside the stage so the controls stay reachable in fullscreen. */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        <button
          onClick={toggleMic}
          disabled={!devices.hasAudio}
          title={devices.hasAudio ? '' : 'No microphone found on this device'}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            micOn ? 'bg-app-muted text-app' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button
          onClick={toggleCam}
          disabled={!devices.hasVideo}
          title={devices.hasVideo ? '' : 'No camera found on this device'}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            camOn ? 'bg-app-muted text-app' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          {camOn ? 'Stop video' : 'Start video'}
        </button>
        <button
          onClick={toggleFullscreen}
          className="rounded-xl bg-app-muted px-4 py-2.5 text-sm font-semibold text-app transition hover:opacity-80"
        >
          {isFullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
        <button
          onClick={leaveRoom}
          className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Leave
        </button>
      </div>
      </div>
      </>
      )}
    </div>
  );
}
