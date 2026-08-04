import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { env } from '../config/env.js';
import { MockInterviewRoom } from '../models/MockInterviewRoom.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

/** Public STUN — enough to discover a direct path on most home/mobile NATs. */
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many rooms created. Please wait a few minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

router.use(authenticate);

/**
 * ICE servers for the browser's RTCPeerConnection. Served per-session rather
 * than baked into the client bundle so the TURN credential isn't published to
 * anyone who views source. Degrades to STUN-only when TURN isn't configured.
 */
router.get('/ice-servers', (req, res) => {
  const { urls, username, credential } = env.turn;
  const turn =
    urls.length && username && credential
      ? [{ urls, username, credential }]
      : [];

  res.json({
    success: true,
    iceServers: [...STUN_SERVERS, ...turn],
    hasTurn: turn.length > 0,
  });
});

router.post('/rooms', createLimiter, async (req, res, next) => {
  try {
    const room = await MockInterviewRoom.create({ createdBy: req.userId });
    res.status(201).json({ success: true, room: { code: room.code, status: room.status } });
  } catch (err) {
    next(err);
  }
});

/** Public-shape status check — lets a joiner see the room is valid before granting camera/mic. */
router.get('/rooms/:code', async (req, res, next) => {
  try {
    const room = await MockInterviewRoom.findOne({ code: req.params.code });
    if (!room) throw new AppError('This practice room does not exist or has expired.', 404);

    res.json({
      success: true,
      room: {
        code: room.code,
        status: room.status,
        participantCount: room.participants.length,
        isFull: room.participants.length >= 2,
        isOwner: String(room.createdBy) === String(req.userId),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rooms', async (req, res, next) => {
  try {
    const rooms = await MockInterviewRoom.find({ createdBy: req.userId, status: { $ne: 'ended' } })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({
      success: true,
      rooms: rooms.map((r) => ({ code: r.code, status: r.status, createdAt: r.createdAt })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
