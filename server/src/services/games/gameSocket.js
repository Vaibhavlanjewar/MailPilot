import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { verifyFirebaseToken } from '../firebase/firebase.service.js';
import { User } from '../../models/User.js';
import { logger } from '../../utils/logger.js';

/**
 * Two-player Tic Tac Toe over WebSocket.
 *
 * Game state is held here and moves are validated server-side rather than
 * relayed blindly — with relay-only, any client could send a move out of turn
 * or into an occupied square and the opponent would have to trust it.
 *
 * Rooms are in-memory and deliberately ephemeral: a match is worth seconds, so
 * persisting it isn't worth a collection. The trade is that a server restart
 * drops in-progress games, which the client surfaces as a lost connection.
 */

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/** @type {Map<string, { board: (string|null)[], turn: 'X'|'O', players: Array }>} */
const rooms = new Map();

const EMPTY_BOARD = () => Array(9).fill(null);

function evaluate(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line, draw: false };
    }
  }
  return { winner: null, line: null, draw: board.every(Boolean) };
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcastState(code) {
  const room = rooms.get(code);
  if (!room) return;
  const result = evaluate(room.board);
  const roster = room.players.map((p) => ({ name: p.name, mark: p.mark }));

  for (const player of room.players) {
    send(player.ws, {
      type: 'state',
      board: room.board,
      turn: room.turn,
      yourMark: player.mark,
      players: roster,
      waitingForOpponent: room.players.length < 2,
      result,
    });
  }
}

async function authenticate(token) {
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
  const code = searchParams.get('room');
  const token = searchParams.get('token');

  if (!code) {
    send(ws, { type: 'error', message: 'Missing room code.' });
    return ws.close();
  }

  const identity = await authenticate(token);
  if (!identity) {
    send(ws, { type: 'error', message: 'Authentication failed.' });
    return ws.close();
  }

  let room = rooms.get(code);
  if (!room) {
    room = { board: EMPTY_BOARD(), turn: 'X', players: [] };
    rooms.set(code, room);
  }

  // Reconnecting (refresh, flaky network) replaces the old socket instead of
  // consuming the second seat and locking the player out of their own game.
  const existing = room.players.find((p) => p.userId === identity.userId);
  if (existing) {
    try {
      existing.ws.close();
    } catch {
      /* already gone */
    }
    existing.ws = ws;
  } else {
    if (room.players.length >= 2) {
      send(ws, { type: 'error', message: 'This game already has two players.' });
      return ws.close();
    }
    room.players.push({
      ws,
      userId: identity.userId,
      name: identity.name,
      mark: room.players.length === 0 ? 'X' : 'O',
    });
  }

  const self = room.players.find((p) => p.userId === identity.userId);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const current = rooms.get(code);
    if (!current) return;

    if (msg.type === 'move') {
      const { winner, draw } = evaluate(current.board);
      if (winner || draw) return;
      if (current.players.length < 2) return; // no solo play against an empty seat
      if (current.turn !== self.mark) return; // not your turn
      const index = Number(msg.index);
      if (!Number.isInteger(index) || index < 0 || index > 8) return;
      if (current.board[index]) return; // square taken

      current.board[index] = self.mark;
      current.turn = self.mark === 'X' ? 'O' : 'X';
      broadcastState(code);
      return;
    }

    if (msg.type === 'restart') {
      current.board = EMPTY_BOARD();
      current.turn = 'X';
      broadcastState(code);
    }
  });

  ws.on('close', () => {
    const current = rooms.get(code);
    if (!current) return;
    // A newer socket for this player already replaced ours — this is the stale
    // one closing after the fact, so evicting by userId would kick the live one.
    const entry = current.players.find((p) => p.userId === identity.userId);
    if (!entry || entry.ws !== ws) return;

    current.players = current.players.filter((p) => p.userId !== identity.userId);
    if (!current.players.length) {
      rooms.delete(code);
      return;
    }
    for (const player of current.players) {
      send(player.ws, { type: 'opponent-left' });
    }
    broadcastState(code);
  });

  broadcastState(code);
  // Tell the other side someone arrived, so their "waiting" view updates.
  for (const player of room.players) {
    if (player.userId !== identity.userId) {
      send(player.ws, { type: 'opponent-joined', name: identity.name });
    }
  }
}

export function attachGameServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/ws/game') return; // leave other upgrade handlers alone
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    handleConnection(ws, req).catch((err) => {
      logger.error('Game socket error', { error: err.message });
      ws.close();
    });
  });

  logger.info('Game server attached at /ws/game');
  return wss;
}
