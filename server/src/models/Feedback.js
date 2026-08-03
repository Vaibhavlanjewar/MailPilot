import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    /** Absent for feedback submitted from the public landing page (no login). */
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    /** Which page the submitter was on, for context — e.g. "/app/interview-prep". */
    page: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['new', 'read'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true },
);

feedbackSchema.index({ createdAt: -1 });

export const Feedback = mongoose.model('Feedback', feedbackSchema);
