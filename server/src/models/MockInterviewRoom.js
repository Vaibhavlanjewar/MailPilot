import mongoose from 'mongoose';
import crypto from 'crypto';

/** How long after a meeting ends the room record is kept before auto-deletion. */
const RETENTION_AFTER_END_MS = 24 * 60 * 60 * 1000;

const mockInterviewRoomSchema = new mongoose.Schema(
  {
    /** Short, URL-safe, guessable-resistant — used directly in the share link. */
    code: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(9).toString('base64url'),
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostName: { type: String, default: '' },
    title: { type: String, default: 'Mock interview', trim: true },
    status: {
      type: String,
      enum: ['waiting', 'scheduled', 'active', 'ended', 'cancelled'],
      default: 'waiting',
    },
    /**
     * Null for instant rooms (join now), set for scheduled ones. Stored UTC;
     * the client renders it in the viewer's own timezone.
     */
    scheduledAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 30, min: 5, max: 180 },
    /** Who the host invited. Kept even if they never register an account. */
    inviteeEmail: { type: String, default: '', lowercase: true, trim: true },
    inviteeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /** At most 2 — enforced in the route layer, not just the schema. */
    participants: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          name: String,
          joinedAt: Date,
        },
      ],
      default: [],
    },
    /**
     * Explicit expiry rather than a createdAt-relative TTL: a meeting booked a
     * week out would otherwise be deleted days before it happened.
     */
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + RETENTION_AFTER_END_MS) },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

/** Recomputed on every save so rescheduling moves the expiry with it. */
mockInterviewRoomSchema.pre('save', function setExpiry(next) {
  if (this.scheduledAt) {
    const endsAt = this.scheduledAt.getTime() + this.durationMinutes * 60 * 1000;
    this.expiresAt = new Date(endsAt + RETENTION_AFTER_END_MS);
  }
  next();
});

mockInterviewRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
mockInterviewRoomSchema.index({ scheduledAt: 1 });

/** Joinable from 10 min before the start until 30 min after the scheduled end. */
const JOIN_OPENS_BEFORE_MS = 10 * 60 * 1000;
const JOIN_CLOSES_AFTER_MS = 30 * 60 * 1000;

mockInterviewRoomSchema.methods.joinWindow = function joinWindow() {
  if (!this.scheduledAt) {
    // Instant rooms are always open until explicitly ended.
    return { opensAt: null, closesAt: null, isOpen: this.status !== 'ended' && this.status !== 'cancelled' };
  }
  const start = this.scheduledAt.getTime();
  const opensAt = new Date(start - JOIN_OPENS_BEFORE_MS);
  const closesAt = new Date(start + this.durationMinutes * 60 * 1000 + JOIN_CLOSES_AFTER_MS);
  const now = Date.now();
  return {
    opensAt,
    closesAt,
    isOpen:
      this.status !== 'cancelled' &&
      this.status !== 'ended' &&
      now >= opensAt.getTime() &&
      now <= closesAt.getTime(),
  };
};

export const MockInterviewRoom = mongoose.model('MockInterviewRoom', mockInterviewRoomSchema);
