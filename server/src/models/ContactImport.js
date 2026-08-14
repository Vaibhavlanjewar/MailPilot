import mongoose from 'mongoose';

/**
 * Tracks the single active CSV import per user — metadata only, never the
 * file bytes. Unique on userId so there is exactly one "current file" record;
 * re-uploading updates it in place rather than accumulating a history, which
 * is what makes "replace" a meaningful concept in the UI.
 */
const contactImportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fileName: { type: String, default: '' },
    rowCount: { type: Number, default: 0 },
    importedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const ContactImport = mongoose.model('ContactImport', contactImportSchema);
