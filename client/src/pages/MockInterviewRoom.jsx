import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth } from '../services/firebase';
import api from '../services/api';

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

  const [status, setStatus] = useState('checking'); // checking | waiting | connecting | connected | ended | error
  const [errorMessage, setErrorMessage] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerName, setPeerName] = useState('');
  const [needsUnmute, setNeedsUnmute] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const isInitiatorRef = useRef(false);
  const connectTimeoutRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  // StrictMode double-invokes the mount effect in dev, and getUserMedia/WS
  // setup isn't naturally cancellable — without this guard both invocations
  // race to open their own camera stream + signaling connection as the same
  // user, which corrupts the server's userId-keyed room-peer tracking (see
  // startCall below for the per-checkpoint bail-out this pairs with).
  const sessionIdRef = useRef(0);

  const shareUrl = `${window.location.origin}/app/mock-interview/${code}`;

  const cleanup = useCallback(() => {
    clearTimeout(connectTimeoutRef.current);
    pcRef.current?.close();
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

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
      video.srcObject = e.streams[0];
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
      if (pc.connectionState === 'connected') {
        clearTimeout(connectTimeoutRef.current);
        setStatus('connected');
      } else if (['failed', 'disconnected'].includes(pc.connectionState)) {
        setStatus('error');
        setErrorMessage(
          'Could not establish a direct connection — this can happen on strict corporate/campus networks. Try a different network (mobile hotspot often works).',
        );
      }
    };

    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    pcRef.current = pc;
    pendingCandidatesRef.current = [];
    return pc;
  }, []);

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

      if (room.data.room.isFull && !room.data.room.isOwner) {
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

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (sessionIdRef.current !== mySession) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
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
          clearTimeout(connectTimeoutRef.current);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied — allow access and reload.'
          : err.message || 'Could not start the call.',
      );
    }
  }, [code, createPeerConnection]);

  useEffect(() => {
    const mySession = ++sessionIdRef.current;
    startCall(mySession);
    return () => {
      sessionIdRef.current++; // invalidate this session so its in-flight setup bails out
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
    navigate('/app/mock-interview');
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied.');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-app">Live Practice Room</h1>
          <p className="text-xs text-app-muted">
            Status: <span className="font-semibold text-app">{status}</span>
            {peerName && <> · with {peerName}</>}
          </p>
        </div>
        <button onClick={copyLink} className="rounded-xl bg-app-muted px-3 py-2 text-xs font-semibold text-app hover:opacity-80">
          Copy invite link
        </button>
      </div>

      {status === 'waiting' && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-app">
          Waiting for the other person to join. Share the invite link above with them.
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-black">
          <video ref={localVideoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">You</span>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className="aspect-video w-full object-cover" />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {peerName || 'Waiting…'}
          </span>
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

      <div className="flex justify-center gap-3">
        <button
          onClick={toggleMic}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            micOn ? 'bg-app-muted text-app' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          {micOn ? 'Mute' : 'Unmute'}
        </button>
        <button
          onClick={toggleCam}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            camOn ? 'bg-app-muted text-app' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          {camOn ? 'Stop video' : 'Start video'}
        </button>
        <button
          onClick={leaveRoom}
          className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
