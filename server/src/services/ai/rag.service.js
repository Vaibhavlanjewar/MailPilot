import { generateCoreStructuredAi } from './aiCore.service.js';

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
 * Service to execute local vector search on chunked text & request AI response synthesis.
 */
export async function queryResumeRAG(resumeText, query) {
  if (!resumeText) {
    throw new Error("No resume text provided for analysis.");
  }
  if (!query) {
    throw new Error("Query parameters are empty.");
  }

  // 1. Chunk document
  const chunks = chunkText(resumeText);
  if (chunks.length === 0) {
    return {
      answer: "Unable to process empty resume text.",
      sources: []
    };
  }

  // 2. Compute similarity
  const queryVec = getTermFrequencyVector(query);
  const scoredChunks = chunks.map((text, index) => {
    const chunkVec = getTermFrequencyVector(text);
    const score = calculateCosineSimilarity(queryVec, chunkVec);
    return { index: index + 1, text, score };
  });

  // 3. Sort and pick top K
  const matchedSources = scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // retrieve top 3 relevant chunks
    .filter(c => c.score > 0.02); // threshold filters out completely irrelevant passages

  const retrievalContext = matchedSources.length > 0 
    ? matchedSources.map(c => `[Chunk #${c.index} (Score: ${c.score.toFixed(2)})]\n${c.text}`).join('\n\n---\n\n')
    : "No highly matching segments found in the resume. Revert to general layout context.";

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

  try {
    const aiResponse = await generateCoreStructuredAi(systemPrompt, userPrompt);
    
    if (aiResponse && aiResponse.answer) {
      return {
        answer: aiResponse.answer,
        criticalKeywords: aiResponse.criticalKeywords || [],
        recommendedAction: aiResponse.recommendedAction || "",
        sources: matchedSources
      };
    }
  } catch (err) {
    console.error("RAG AI generation error:", err);
  }

  // Fallback if LLM execution is offline or crashes
  const fallbackWords = matchedSources.length > 0 
    ? `From references in your resume (e.g. "${matchedSources[0].text.slice(0, 100)}..."), this matching section was retrieved.`
    : "No corresponding details could be queried from the resume.";
    
  return {
    answer: `${fallbackWords} Let us review the query: "${query}"`,
    criticalKeywords: Object.keys(queryVec).slice(0, 3),
    recommendedAction: "Review technical stack terms or custom bullet templates.",
    sources: matchedSources
  };
}
