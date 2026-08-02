import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const EMBED_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';
const EMBED_TIMEOUT_MS = Number(process.env.AI_CLOUD_TIMEOUT_MS) || 20_000;
/** Gemini caps batchEmbedContents at 100 requests per call. */
const BATCH_LIMIT = 100;

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isEmbeddingConfigured() {
  return Boolean(env.ai.googleApiKey);
}

/**
 * Embeds texts with Gemini. Returns null (never throws) when the provider is
 * unconfigured or failing, so callers can fall back to lexical scoring.
 *
 * @param {string[]} texts
 * @param {'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'} taskType
 * @returns {Promise<{vectors: number[][], model: string, dimensions: number} | null>}
 */
export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  const apiKey = env.ai.googleApiKey?.trim();
  if (!apiKey || !texts?.length) return null;

  const vectors = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: `models/${EMBED_MODEL}`,
              content: { parts: [{ text }] },
              taskType,
            })),
          }),
        },
        EMBED_TIMEOUT_MS,
      );

      if (!response.ok) {
        logger.warn('Embedding request failed; falling back to lexical scoring', {
          status: response.status,
          error: (await response.text()).slice(0, 200),
        });
        return null;
      }

      const data = await response.json();
      const batchVectors = (data?.embeddings || []).map((e) => e.values);
      if (batchVectors.length !== batch.length || batchVectors.some((v) => !v?.length)) {
        logger.warn('Embedding response was incomplete; falling back to lexical scoring');
        return null;
      }
      vectors.push(...batchVectors);
    } catch (err) {
      logger.warn('Embedding provider unreachable; falling back to lexical scoring', {
        error: err.message,
      });
      return null;
    }
  }

  return {
    vectors,
    model: EMBED_MODEL,
    dimensions: vectors[0]?.length || 0,
  };
}

export async function embedQuery(text) {
  const result = await embedTexts([text], 'RETRIEVAL_QUERY');
  return result?.vectors?.[0] || null;
}

/** Cosine similarity for two equal-length dense vectors. */
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
