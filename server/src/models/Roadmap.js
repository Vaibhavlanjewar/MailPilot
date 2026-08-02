import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    /** Practical tip on how to practice/apply the step, not just what to read. */
    approach: { type: String, default: '' },
    /** Concrete things to learn inside this step. */
    topics: { type: [String], default: [] },
    /** url points at a search query, not an AI-guessed link — avoids shipping hallucinated 404s. */
    resources: {
      type: [{ label: String, url: String }],
      default: [],
    },
    estimatedWeeks: { type: Number, default: 1 },
    /** Set when the resume shows the candidate already covers this. */
    alreadyStrong: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
  },
  { _id: false },
);

const stageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    steps: { type: [stepSchema], default: [] },
  },
  { _id: false },
);

const roadmapSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    goal: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    /** Whether the resume was used to skip topics the candidate already knows. */
    personalised: { type: Boolean, default: false },
    provider: { type: String, default: '' },
    stages: { type: [stageSchema], default: [] },
  },
  { timestamps: true },
);

roadmapSchema.index({ userId: 1, updatedAt: -1 });

roadmapSchema.virtual('progress').get(function progress() {
  const steps = this.stages.flatMap((s) => s.steps);
  if (!steps.length) return 0;
  return Math.round((steps.filter((s) => s.completed).length / steps.length) * 100);
});

roadmapSchema.set('toJSON', { virtuals: true });

export const Roadmap = mongoose.model('Roadmap', roadmapSchema);
