import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { verifyFirebaseToken } from '../firebase/firebase.service.js';
import { User } from '../../models/User.js';
import { MockInterviewRoom } from '../../models/MockInterviewRoom.js';
import { logger } from '../../utils/logger.js';

/**
 * Signaling only — relays WebRTC offer/answer/ICE candidates between exactly
 * two peers in a room. Media (video/audio) flows directly peer-to-peer once
 * connected, never through this server. In-memory room state assumes a
 * single server process; fine at this project's scale, would need Redis
 * pub/sub to survive horizontal scaling later.
 */

/** @type {Map<string, Array<{ ws: import('ws').WebSocket, userId: string, name: string }>>} */
const rooms = new Map();

/**
 * Rooms that emptied out and are pending an "ended" mark.
 *
 * Ending immediately on the last disconnect would break the most common
 * interruption there is — a refresh or a brief network drop closes the socket
 * with nobody else present, and the rejoin would then be rejected against a
 * room that no longer exists. The grace window lets that reconnect win.
 *
 * @type {Map<string, NodeJS.Timeout>}
 */
const pendingEnd = new Map();
const END_GRACE_MS = 90_000;

/**
 * Records a participant at most once per user.
 *
 * This used to `$push` on every socket connection, so a refresh, a flaky
 * network, or React StrictMode's double-invoke appended the same person again.
 * `participants.length >= 2` is what drives "room is full", so a single user
 * reconnecting once was enough to lock the room — including against themselves
 * and the person they invited. The `$ne` guard makes the insert idempotent
 * without a read-then-write race.
 */
async function recordParticipant(roomCode, identity) {
  await MockInterviewRoom.updateOne(
    { code: roomCode, 'participants.userId': { $ne: identity.userId } },
    {
      $push: {
        participants: {
          userId: identity.userId,
          name: identity.name,
          joinedAt: new Date(),
        },
      },
    },
  );
}

function cancelPendingEnd(roomCode) {
  const timer = pendingEnd.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    pendingEnd.delete(roomCode);
  }
}

/**
 * Only rooms that actually got going are ended this way. A room nobody ever
 * joined stays listed so the host can still share its link, and expires on its
 * own via the TTL index.
 */
function scheduleRoomEnd(roomCode) {
  cancelPendingEnd(roomCode);
  const timer = setTimeout(async () => {
    pendingEnd.delete(roomCode);
    if (rooms.get(roomCode)?.length) return; // someone came back
    try {
      await MockInterviewRoom.updateOne(
        { code: roomCode, status: 'active' },
        { $set: { status: 'ended', endedAt: new Date() } },
      );
      logger.debug('Mock interview room ended after grace period', { roomCode });
    } catch (err) {
      logger.warn('Could not mark room ended', { roomCode, error: err.message });
    }
  }, END_GRACE_MS);
  // Don't hold the event loop open on shutdown just for a cleanup timer.
  timer.unref?.();
  pendingEnd.set(roomCode, timer);
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function authenticateConnection(token) {
  if (!token) return null;
  try {
    const decoded = await verifyFirebaseToken(token);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) return null;
    const user = await User.findOne({ email }).select('_id name email');
    if (!user) return null;
    return { userId: String(user._id), name: user.name || user.email.split('@')[0] };
  } catch {
    return null;
  }
}

async function handleConnection(ws, req) {
  const { searchParams } = new URL(req.url, 'http://localhost');
  const roomCode = searchParams.get('room');
  const token = searchParams.get('token');

  if (!roomCode) {
    send(ws, { type: 'error', message: 'Missing room code.' });
    return ws.close();
  }

  const identity = await authenticateConnection(token);
  if (!identity) {
    send(ws, { type: 'error', message: 'Authentication failed.' });
    return ws.close();
  }

  const room = await MockInterviewRoom.findOne({ code: roomCode });
  if (!room || room.status === 'ended') {
    send(ws, { type: 'error', message: 'This practice room does not exist or has ended.' });
    return ws.close();
  }

  const peers = rooms.get(roomCode) || [];
  // A previously-recorded participant is reconnecting, not a third person
  // arriving — they keep their seat even if two sockets are somehow still
  // registered, since one of those is almost certainly their own stale one.
  const wasHere = room.participants.some(
    (p) => String(p.userId) === String(identity.userId),
  );
  const alreadyConnected = peers.some((p) => p.userId === identity.userId);
  if (peers.length >= 2 && !alreadyConnected && !wasHere) {
    send(ws, { type: 'error', message: 'This room already has two participants.' });
    return ws.close();
  }

  // A rejoin inside the grace window means the room is still in use.
  cancelPendingEnd(roomCode);

  const self = { ws, userId: identity.userId, name: identity.name };
  const otherPeers = peers.filter((p) => p.userId !== identity.userId);
  const nextPeers = [...otherPeers, self];
  rooms.set(roomCode, nextPeers);

  // Fixed, deterministic initiator (the room creator) rather than "whoever's
  // connection reached the server first" — connection order is inherently
  // racy (StrictMode double-invokes, reconnects, network jitter), and two
  // peers can end up disagreeing about who joined first. A fixed role never
  // has that ambiguity, and it makes reconnects trivial: the same peer is
  // always responsible for (re)offering, whether this is a fresh join or a
  // rejoin after a drop — no separate "second peer" case needed.
  const isInitiator = identity.userId === String(room.createdBy);
  const otherPeer = otherPeers[0] || null;

  // Attach the relay listener BEFORE notifying anyone or awaiting Mongo. The
  // peer starts offering the moment it sees 'peer-joined', and its answer can
  // land here while an await is still pending — any signaling message that
  // arrives before this listener exists is dropped by `ws` and the call
  // silently never connects.
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!['offer', 'answer', 'ice-candidate'].includes(msg.type)) return;

    const current = rooms.get(roomCode) || [];
    const peer = current.find((p) => p.userId !== identity.userId);
    if (peer) send(peer.ws, msg);
  });

  send(ws, { type: 'joined', isInitiator, peerName: otherPeer?.name || null });

  if (otherPeer) {
    // Symmetric notification — both sides learn a peer (re)joined; each is
    // told whether *they* are the initiator, so only one side ever reacts by
    // creating an offer, regardless of which one just connected.
    send(otherPeer.ws, {
      type: 'peer-joined',
      peerName: identity.name,
      youAreInitiator: String(room.createdBy) === otherPeer.userId,
    });
    send(ws, { type: 'peer-joined', peerName: otherPeer.name, youAreInitiator: isInitiator });
    await MockInterviewRoom.updateOne({ code: roomCode }, { $set: { status: 'active' } });
    await recordParticipant(roomCode, identity);
  } else {
    await recordParticipant(roomCode, identity);
  }

  ws.on('close', () => {
    const current = rooms.get(roomCode) || [];
    if (!current.includes(self)) {
      // A newer connection for this same userId already replaced `self` in
      // `rooms` (e.g. a StrictMode double-invoke on the client, a refresh, or
      // a reconnect) — this is the stale one closing after the fact. Evicting
      // by userId here would wrongly kick out the still-live replacement.
      return;
    }
    const remaining = current.filter((p) => p !== self);
    if (remaining.length) {
      rooms.set(roomCode, remaining);
      send(remaining[0].ws, { type: 'peer-left' });
    } else {
      rooms.delete(roomCode);
      // Everyone's gone — start the countdown to marking this finished so it
      // stops showing as an open room.
      scheduleRoomEnd(roomCode);
    }
    logger.debug('Mock interview peer disconnected', { roomCode, userId: identity.userId });
  });
}

export function attachSignalingServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/ws/mock-interview') return; // let other upgrade handlers (if any) see it

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    handleConnection(ws, req).catch((err) => {
      logger.error('Mock interview signaling error', { error: err.message });
      ws.close();
    });
  });

  logger.info('Mock interview signaling server attached at /ws/mock-interview');
  return wss;
}
