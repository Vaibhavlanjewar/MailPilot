import mongoose from 'mongoose';

/**
 * The resume binary lives in its own collection so the 2MB-capped buffer is
 * never pulled in by the frequent Resume reads (text, links, embeddings).
 */
const resumeFileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: 'application/pdf' },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const ResumeFile = mongoose.model('ResumeFile', resumeFileSchema);
