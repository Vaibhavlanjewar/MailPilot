import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    textContent: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed'],
      default: 'pending',
      index: true,
    },
    scheduledAt: { type: Date, default: null },
    recipientContactIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    ],
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model('Campaign', campaignSchema);
