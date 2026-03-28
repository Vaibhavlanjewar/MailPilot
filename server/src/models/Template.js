import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, default: '' },
    textContent: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Template = mongoose.model('Template', templateSchema);
