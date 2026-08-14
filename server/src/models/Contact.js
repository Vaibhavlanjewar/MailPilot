import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    subscribed: { type: Boolean, default: true, index: true },
    /**
     * Distinguishes contacts brought in by the single-CSV import from ones
     * typed in by hand, so re-uploading a CSV can prune rows that were
     * removed from the new file without ever touching manually-added
     * contacts. Existing documents predate this field and default to
     * 'manual', which is the safe reading — nothing pre-existing gets pruned
     * by a later CSV replace.
     */
    source: { type: String, enum: ['csv', 'manual'], default: 'manual' },
  },
  { timestamps: true }
);

contactSchema.index({ userId: 1, email: 1 }, { unique: true });

export const Contact = mongoose.model('Contact', contactSchema);
