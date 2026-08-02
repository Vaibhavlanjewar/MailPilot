import { generateStructuredAi } from './aiCore.service.js';
import { embedQuery, cosineSimilarity } from './embedding.service.js';

/**
 * Splits text into overlapping chunks.
 * Max word/character density suited for indexing.
 */
export function chunkText(text, chunkSize = 400, overlap = 100) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;
  
  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    chunks.push(chunkWords.join(' '));
    if (i + chunkSize >= words.length) break;
    i += (chunkSize - overlap);
  }
  return chunks;
}

/**
 * Generates an in-memory term frequency (TF) map, ignoring common filler words.
 */
export function getTermFrequencyVector(text) {
  const stopwords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
    'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from',
    'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'here',
    'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if',
    'in', 'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself',
    'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some',
    'such', 'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres',
    'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent', 'what', 'whats',
    'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont',
    'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves'
  ]);
  
  const words = text.toLowerCase().match(/\w+/g) || [];
  const tf = {};
  
  words.forEach(w => {
    if (!stopwords.has(w) && w.length > 1) {
      tf[w] = (tf[w] || 0) + 1;
    }
  });
  
  return tf;
}

/**
 * Inverse document frequency across the chunk set. Without this a term appearing in
 * every chunk (the candidate's own name, "engineer") scores as highly as a rare,
 * genuinely discriminating one.
 */
export function computeIdf(chunkVectors) {
  const docCount = chunkVectors.length;
  const seenIn = {};

  for (const vec of chunkVectors) {
    for (const term of Object.keys(vec)) {
      seenIn[term] = (seenIn[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const [term, count] of Object.entries(seenIn)) {
    idf[term] = Math.log((docCount + 1) / (count + 1)) + 1;
  }
  return idf;
}

export function applyIdf(tfVector, idf) {
  const weighted = {};
  for (const [term, freq] of Object.entries(tfVector)) {
    weighted[term] = freq * (idf[term] ?? 1);
  }
  return weighted;
}

/**
 * Calculates cosine similarity between two term frequency maps.
 */
export function calculateCosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  for (const term of allKeys) {
    const valA = vecA[term] || 0;
    const valB = vecB[term] || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Ranks pre-embedded chunks against the query vector. Returns null when the
 * stored chunks carry no vectors, so the caller can fall back to lexical search.
 */
async function retrieveBySimilarity(storedChunks, query, topK) {
  const withVectors = storedChunks.filter((c) => c.vector?.length);
  if (!withVectors.length) return null;

  const queryVector = await embedQuery(query);
  if (!queryVector) return null;

  return withVectors
    .map((c) => ({
      index: c.index,
      text: c.text,
      score: cosineSimilarity(queryVector, c.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score > 0.3);
}

/** Lexical IDF-weighted ranking; used when embeddings are unavailable. */
function retrieveByKeyword(chunks, query, topK) {
  const chunkVectors = chunks.map((c) => getTermFrequencyVector(c.text));
  const idf = computeIdf(chunkVectors);
  const queryVec = applyIdf(getTermFrequencyVector(query), idf);

  return chunks
    .map((c, i) => ({
      index: c.index,
      text: c.text,
      score: calculateCosineSimilarity(queryVec, applyIdf(chunkVectors[i], idf)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score > 0.02);
}

/**
 * Answers a question over a resume. Accepts either stored chunks (with vectors)
 * or raw text, and reports which retrieval strategy was actually used.
 */
export async function queryResumeRAG(resumeInput, query, { topK = 3 } = {}) {
  if (!query) {
    throw new Error('Query parameters are empty.');
  }

  const storedChunks = Array.isArray(resumeInput?.chunks) ? resumeInput.chunks : null;
  const chunks =
    storedChunks ||
    chunkText(typeof resumeInput === 'string' ? resumeInput : resumeInput?.content || '').map(
      (text, i) => ({ index: i + 1, text }),
    );

  if (!chunks.length) {
    return { answer: 'This resume has no readable text.', sources: [], retrieval: 'none' };
  }

  let matchedSources = await retrieveBySimilarity(chunks, query, topK);
  let retrieval = 'semantic';

  if (!matchedSources) {
    matchedSources = retrieveByKeyword(chunks, query, topK);
    retrieval = 'keyword';
  }

  const retrievalContext = matchedSources.length
    ? matchedSources
        .map((c) => `[Chunk #${c.index} (Score: ${c.score.toFixed(2)})]\n${c.text}`)
        .join('\n\n---\n\n')
    : 'No matching segments were found in the resume.';

  // 4. Formulate System & User prompts
  const systemPrompt = `
    You are an expert career advisory intelligence. Your goal is to review the candidate's Resume extracts and answer their custom inquiries.
    Use ONLY the details included in the resume context below to answer.
    If the question cannot be answered using the provided sources, state: "The resume does not contain information to address this question."
    Do not invent or extrapolate items not justified in the text.
    
    Structure response in following JSON format:
    {
      "answer": "Brief, detailed paragraph addressing their question, citing Chunk # references explicitly.",
      "criticalKeywords": ["keyword1", "keyword2"],
      "recommendedAction": "A quick tip to optimize this section of the resume based on the question."
    }
  `.trim();

  const userPrompt = `
    [RESUME REFERENCE CONTEXT]
    ${retrievalContext}

    [CANDIDATE QUESTION QUERY]
    ${query}
  `.trim();

  const { data, provider } = await generateStructuredAi(systemPrompt, userPrompt, {
    isValid: (result) => Boolean(result.answer),
    runName: 'resume_rag_query',
  });

  if (data) {
    return {
      answer: data.answer,
      criticalKeywords: data.criticalKeywords || [],
      recommendedAction: data.recommendedAction || '',
      sources: matchedSources,
      retrieval,
      provider,
    };
  }

  // Retrieval still succeeded even with every LLM provider down — return the matches.
  return {
    answer: matchedSources.length
      ? 'AI synthesis is unavailable right now, but these resume sections matched your query most closely.'
      : 'AI synthesis is unavailable, and no resume section matched your query.',
    criticalKeywords: Object.keys(getTermFrequencyVector(query)).slice(0, 5),
    recommendedAction: 'Review the retrieved sections below, then retry for an AI summary.',
    sources: matchedSources,
    retrieval,
    provider: null,
  };
}
