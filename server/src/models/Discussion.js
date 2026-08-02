import mongoose from 'mongoose';

const replySchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    upvotes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true },
);

const discussionSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: { type: String, default: '' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 10_000 },
    category: {
      type: String,
      enum: ['Interview Experience', 'Referrals', 'Resume Review', 'Salary', 'General'],
      default: 'General',
      index: true,
    },
    tags: { type: [String], default: [] },
    /** User ids, so a person can only ever count once. */
    upvotes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true },
);

discussionSchema.index({ title: 'text', body: 'text', tags: 'text' });
discussionSchema.index({ createdAt: -1 });

discussionSchema.set('toJSON', { virtuals: true });
discussionSchema.virtual('upvoteCount').get(function count() {
  return this.upvotes.length;
});
discussionSchema.virtual('replyCount').get(function count() {
  return this.replies.length;
});

export const Discussion = mongoose.model('Discussion', discussionSchema);
