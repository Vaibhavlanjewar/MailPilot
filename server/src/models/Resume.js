import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    text: { type: String, required: true },
    /** Embedding vector; absent when the provider was unavailable at ingest time. */
    vector: { type: [Number], default: undefined },
  },
  { _id: false },
);

const resumeSchema = new mongoose.Schema(
  {
    /** Unique: a user holds exactly one resume, replaced on re-upload. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    /** How the text arrived: an uploaded file, pasted text, or the builder. */
    source: {
      type: String,
      enum: ['upload', 'paste', 'built'],
      default: 'upload',
    },
    content: { type: String, required: true },
    links: {
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      portfolio: { type: String, default: '' },
      leetcode: { type: String, default: '' },
    },
    /** Structured builder payload (JSON string) when source === 'built'. */
    builderData: { type: String, default: '' },
    templates: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    /** The binary itself lives in the ResumeFile collection, keyed by userId. */
    file: {
      stored: { type: Boolean, default: false },
      mimeType: { type: String, default: '' },
    },
    embedding: {
      provider: { type: String, default: '' },
      model: { type: String, default: '' },
      dimensions: { type: Number, default: 0 },
      chunks: { type: [chunkSchema], default: [] },
      generatedAt: { type: Date },
    },
  },
  { timestamps: true },
);

/** Chunk vectors are large; skip them unless a caller explicitly asks. */
resumeSchema.methods.toSummary = function toSummary() {
  return {
    _id: this._id,
    title: this.title,
    source: this.source,
    content: this.content,
    links: this.links,
    builderData: this.builderData,
    templates: this.templates,
    fileName: this.fileName,
    fileSize: this.fileSize,
    hasFile: Boolean(this.file?.stored),
    wordCount: this.content.split(/\s+/).filter(Boolean).length,
    embedding: {
      provider: this.embedding?.provider || '',
      model: this.embedding?.model || '',
      chunkCount: this.embedding?.chunks?.length || 0,
      generatedAt: this.embedding?.generatedAt || null,
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Resume = mongoose.model('Resume', resumeSchema);
