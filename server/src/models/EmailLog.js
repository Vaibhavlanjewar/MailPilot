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

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
