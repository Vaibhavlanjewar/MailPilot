import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    company: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true, index: true },
    workMode: {
      type: String,
      enum: ['Remote', 'Hybrid', 'On-site'],
      default: 'On-site',
      index: true,
    },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
      default: 'Full-time',
    },
    experienceLevel: {
      type: String,
      enum: ['Fresher', 'Junior', 'Mid', 'Senior', 'Lead'],
      default: 'Mid',
      index: true,
    },
    salaryRange: { type: String, default: '' },
    skills: { type: [String], default: [], index: true },
    description: { type: String, default: '' },
    applyUrl: { type: String, default: '' },
    recruiterName: { type: String, default: '' },
    recruiterEmail: { type: String, default: '', lowercase: true, trim: true },
    recruiterLinkedIn: { type: String, default: '' },
    /** Set when a MailPilot user posted it; absent for seeded/external listings. */
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    seeded: { type: Boolean, default: false },
    /** Stable ID from the source API — lets re-fetches upsert instead of duplicating. */
    externalId: { type: String, index: true, sparse: true, unique: true },
    externalSource: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Backs the keyword search box.
jobSchema.index({ title: 'text', company: 'text', description: 'text', skills: 'text' });

export const Job = mongoose.model('Job', jobSchema);

const savedJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  },
  { timestamps: true },
);

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export const SavedJob = mongoose.model('SavedJob', savedJobSchema);
