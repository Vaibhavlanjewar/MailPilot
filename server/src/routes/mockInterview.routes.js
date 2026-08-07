import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import validator from 'validator';
import { authenticate } from '../middlewares/auth.js';
import { env } from '../config/env.js';
import { MockInterviewRoom } from '../models/MockInterviewRoom.js';
import { User } from '../models/User.js';
import { sendMeetingInvite, joinUrlFor } from '../services/mockInterview/meetingInvite.js';
import {
  scheduleMeetingReminder,
  cancelMeetingReminder,
} from '../services/mockInterview/meetingReminder.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

/** Public STUN — enough to discover a direct path on most home/mobile NATs. */
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function serializeRoom(room, viewerId) {
  const window = room.joinWindow();
  return {
    code: room.code,
    title: room.title,
    status: room.status,
    scheduledAt: room.scheduledAt,
    durationMinutes: room.durationMinutes,
    hostName: room.hostName,
    inviteeEmail: room.inviteeEmail,
    isOwner: String(room.createdBy) === String(viewerId),
    joinUrl: joinUrlFor(room.code),
    canJoinNow: window.isOpen,
    joinOpensAt: window.opensAt,
  };
}

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

/** Schedules a meeting for later. The invite email is best-effort — see below. */
router.post('/meetings', createLimiter, async (req, res, next) => {
  try {
    const { title, scheduledAt, durationMinutes = 30, inviteeEmail = '' } = req.body;

    const start = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(start.getTime())) {
      throw new AppError('Pick a valid date and time.', 422);
    }
    if (start.getTime() < Date.now() - 60 * 1000) {
      throw new AppError('That time is in the past.', 422);
    }
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 180) {
      throw new AppError('Duration must be between 5 and 180 minutes.', 422);
    }
    const invitee = String(inviteeEmail || '').trim().toLowerCase();
    if (invitee && !validator.isEmail(invitee)) {
      throw new AppError('That invitee email is not valid.', 422);
    }

    const host = await User.findById(req.userId).select('name email').lean();

    const room = await MockInterviewRoom.create({
      createdBy: req.userId,
      hostName: host?.name || host?.email?.split('@')[0] || '',
      title: String(title || '').trim() || 'Mock interview',
      status: 'scheduled',
      scheduledAt: start,
      durationMinutes: duration,
      inviteeEmail: invitee,
      inviteeUserId: invitee ? (await User.findOne({ email: invitee }).select('_id').lean())?._id || null : null,
    });

    // Deliberately not awaited into the response contract: the host already has
    // a shareable link, so a Gmail hiccup shouldn't fail the whole request.
    const invite = await sendMeetingInvite(room);
    await scheduleMeetingReminder(room);

    res.status(201).json({
      success: true,
      room: serializeRoom(room, req.userId),
      inviteSent: invite.sent,
      inviteError: invite.sent ? null : invite.reason,
    });
  } catch (err) {
    next(err);
  }
});

/** Upcoming meetings where the caller is either the host or the invitee. */
router.get('/meetings', async (req, res, next) => {
  try {
    const me = await User.findById(req.userId).select('email').lean();
    const rooms = await MockInterviewRoom.find({
      status: { $nin: ['ended', 'cancelled'] },
      $or: [
        { createdBy: req.userId },
        { inviteeUserId: req.userId },
        ...(me?.email ? [{ inviteeEmail: me.email }] : []),
      ],
    })
      .sort({ scheduledAt: 1, createdAt: -1 })
      .limit(50);

    res.json({ success: true, meetings: rooms.map((r) => serializeRoom(r, req.userId)) });
  } catch (err) {
    next(err);
  }
});

/** Removes a room outright — used for finished or abandoned practice rooms. */
router.delete('/rooms/:code', async (req, res, next) => {
  try {
    const room = await MockInterviewRoom.findOne({ code: req.params.code });
    if (!room) throw new AppError('This room does not exist or has already been removed.', 404);
    if (String(room.createdBy) !== String(req.userId)) {
      throw new AppError('Only the host can remove this room.', 403);
    }

    await cancelMeetingReminder(room.code);
    await MockInterviewRoom.deleteOne({ _id: room._id });

    res.json({ success: true, message: 'Room removed' });
  } catch (err) {
    next(err);
  }
});

router.patch('/meetings/:code/cancel', async (req, res, next) => {
  try {
    const room = await MockInterviewRoom.findOne({ code: req.params.code });
    if (!room) throw new AppError('This meeting does not exist or has expired.', 404);
    if (String(room.createdBy) !== String(req.userId)) {
      throw new AppError('Only the host can cancel this meeting.', 403);
    }

    room.status = 'cancelled';
    await room.save();
    await cancelMeetingReminder(room.code);

    res.json({ success: true, room: serializeRoom(room, req.userId) });
  } catch (err) {
    next(err);
  }
});

/** Public-shape status check — lets a joiner see the room is valid before granting camera/mic. */
router.get('/rooms/:code', async (req, res, next) => {
  try {
    const room = await MockInterviewRoom.findOne({ code: req.params.code });
    if (!room) throw new AppError('This practice room does not exist or has expired.', 404);
    if (room.status === 'cancelled') {
      throw new AppError('This meeting was cancelled by the host.', 410);
    }

    res.json({
      success: true,
      room: {
        ...serializeRoom(room, req.userId),
        participantCount: room.participants.length,
        isFull: room.participants.length >= 2,
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
