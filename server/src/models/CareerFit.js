import mongoose from 'mongoose';

/** One per user — regenerated in place, mirrors the Resume model's "latest only" pattern. */
const careerFitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    provider: { type: String, default: '' },
    summary: { type: String, default: '' },
    strengths: { type: [String], default: [] },
    // Inner key must be `{ type: { type: String } }`, not `{ type: String }` —
    // a nested key literally named "type" is otherwise read by Mongoose as a
    // SchemaType declaration for the whole object, not a field named "type",
    // which silently turns this into an array-of-strings and throws a
    // CastError the moment a real {type, why} object is saved.
    companyTypes: {
      type: [{ type: { type: String }, why: String }],
      default: [],
    },
    locations: {
      type: [{ location: String, why: String }],
      default: [],
    },
    salaryBand: {
      currency: { type: String, default: '' },
      min: { type: String, default: '' },
      max: { type: String, default: '' },
      note: { type: String, default: '' },
    },
    targetRoles: { type: [String], default: [] },
    skillGaps: {
      type: [{ skill: String, why: String, priority: { type: String, enum: ['high', 'medium', 'low'] } }],
      default: [],
    },
  },
  { timestamps: true },
);

export const CareerFit = mongoose.model('CareerFit', careerFitSchema);
