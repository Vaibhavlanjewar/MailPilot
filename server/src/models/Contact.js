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
    subscribed: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

contactSchema.index({ userId: 1, email: 1 }, { unique: true });

export const Contact = mongoose.model('Contact', contactSchema);
