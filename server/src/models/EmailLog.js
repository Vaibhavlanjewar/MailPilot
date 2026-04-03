import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
    toEmail: { type: String, required: true, lowercase: true },
    trackingToken: { type: String, default: '' },
    opened: { type: Boolean, default: false, index: true },
    openCount: { type: Number, default: 0 },
    openHistory: { type: [Date], default: [] },
    recentlyOpenedAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      index: true,
    },
    providerMessageId: { type: String, default: '' },
    error: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailLogSchema.index({ campaignId: 1, toEmail: 1 });
emailLogSchema.index({ trackingToken: 1 }, { unique: true, sparse: true });
emailLogSchema.index({ campaignId: 1, opened: 1, recentlyOpenedAt: -1 });
emailLogSchema.index({ toEmail: 1, campaignId: 1 });

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
