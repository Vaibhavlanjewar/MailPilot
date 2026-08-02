import mongoose from 'mongoose';
import crypto from 'crypto';

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
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended'],
      default: 'waiting',
    },
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
    endedAt: { type: Date },
  },
  { timestamps: true },
);

// Rooms are ephemeral practice sessions — auto-delete 24h after creation so
// they don't accumulate forever.
mockInterviewRoomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const MockInterviewRoom = mongoose.model('MockInterviewRoom', mockInterviewRoomSchema);
