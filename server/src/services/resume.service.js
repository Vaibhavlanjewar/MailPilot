import { Resume } from '../models/Resume.js';
import { chunkText } from './ai/rag.service.js';
import { embedTexts } from './ai/embedding.service.js';
import {
  uploadResumeFile,
  deleteResumeFile,
  downloadResumeFile,
} from './firebase/firebase.service.js';
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

  const previous = await Resume.findOne({ userId }).select('file');
  let file = { storagePath: '', fileUrl: '', mimeType: '' };

  if (binary?.buffer?.length) {
    const stored = await uploadResumeFile(userId, binary.buffer, {
      fileName: binary.fileName,
      mimeType: binary.mimeType,
    });
    if (stored) {
      file = { ...stored, mimeType: binary.mimeType || '' };
    } else {
      logger.warn('Resume text saved but the file could not be stored', {
        userId: String(userId),
      });
    }
  }

  // Replacing pdf -> docx changes the path, so clear the old object explicitly.
  const oldPath = previous?.file?.storagePath;
  if (oldPath && oldPath !== file.storagePath) {
    await deleteResumeFile(oldPath);
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
    fileStored: Boolean(file.storagePath),
  });

  return resume;
}

/** Removes the resume, its embedding vectors, and the stored file together. */
export async function deleteUserResume(userId) {
  const resume = await Resume.findOne({ userId }).select('file');
  if (!resume) return false;

  if (resume.file?.storagePath) {
    await deleteResumeFile(resume.file.storagePath);
  }
  await Resume.deleteOne({ userId });

  logger.info('Resume, embeddings and stored file deleted', { userId: String(userId) });
  return true;
}

/** Fetches the original file for attaching to outreach emails. */
export async function getUserResumeAttachment(userId) {
  const resume = await Resume.findOne({ userId }).select('file fileName');
  if (!resume?.file?.storagePath) return null;

  const buffer = await downloadResumeFile(resume.file.storagePath);
  if (!buffer) return null;

  return {
    filename: resume.fileName || 'resume.pdf',
    content: buffer,
    contentType: resume.file.mimeType || 'application/pdf',
  };
}
