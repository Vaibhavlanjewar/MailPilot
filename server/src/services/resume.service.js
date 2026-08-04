import { Resume } from '../models/Resume.js';
import { ResumeFile } from '../models/ResumeFile.js';
import { chunkText } from './ai/rag.service.js';
import { embedTexts } from './ai/embedding.service.js';
import { logger } from '../utils/logger.js';

export const MAX_RESUME_BYTES = 2 * 1024 * 1024;
export const MAX_RESUME_CHARS = 50_000;

export async function getUserResume(userId) {
  return Resume.findOne({ userId });
}

/**
 * Splits the resume and embeds each chunk. Vectors are omitted (not faked) when
 * the provider is unavailable, so retrieval can fall back to lexical scoring.
 */
async function buildEmbedding(content) {
  const chunks = chunkText(content);
  if (!chunks.length) {
    return { provider: '', model: '', dimensions: 0, chunks: [], generatedAt: null };
  }

  const embedded = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT');

  return {
    provider: embedded ? 'gemini' : '',
    model: embedded?.model || '',
    dimensions: embedded?.dimensions || 0,
    chunks: chunks.map((text, index) => ({
      index: index + 1,
      text,
      vector: embedded?.vectors[index],
    })),
    generatedAt: new Date(),
  };
}

/**
 * Creates or replaces the caller's single resume. Because the document is
 * overwritten wholesale, stale chunks and their vectors cannot survive.
 *
 * @param {object} [binary] Optional original file: { buffer, fileName, mimeType }
 */
export async function saveUserResume(userId, data, binary = null) {
  const embedding = await buildEmbedding(data.content);

  let file = { stored: false, mimeType: '' };

  if (binary?.buffer?.length) {
    await ResumeFile.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          fileName: binary.fileName || '',
          mimeType: binary.mimeType || 'application/pdf',
          size: binary.buffer.length,
          data: binary.buffer,
        },
      },
      { upsert: true },
    );
    file = { stored: true, mimeType: binary.mimeType || 'application/pdf' };
  } else {
    // A text-only save replaces the resume wholesale, so a previously attached
    // binary no longer matches the stored content.
    await ResumeFile.deleteOne({ userId });
  }

  const resume = await Resume.findOneAndUpdate(
    { userId },
    { $set: { ...data, userId, embedding, file } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  logger.info('Resume stored', {
    userId: String(userId),
    chunks: embedding.chunks.length,
    embeddingProvider: embedding.provider || 'none (lexical fallback)',
    fileStored: file.stored,
  });

  return resume;
}

/** Removes the resume, its embedding vectors, and the stored file together. */
export async function deleteUserResume(userId) {
  const resume = await Resume.findOne({ userId }).select('_id');
  if (!resume) return false;

  await ResumeFile.deleteOne({ userId });
  await Resume.deleteOne({ userId });

  logger.info('Resume, embeddings and stored file deleted', { userId: String(userId) });
  return true;
}

/** Fetches the original file for attaching to outreach emails. */
export async function getUserResumeAttachment(userId) {
  // Not .lean(): that yields a BSON Binary, while nodemailer needs a real Buffer.
  const stored = await ResumeFile.findOne({ userId });
  if (!stored?.data?.length) return null;

  return {
    filename: stored.fileName || 'resume.pdf',
    content: stored.data,
    contentType: stored.mimeType || 'application/pdf',
  };
}
