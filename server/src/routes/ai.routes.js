import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { generateStructuredAi } from '../services/ai/aiCore.service.js';
import { getUserResume } from '../services/resume.service.js';
import { queryResumeRAG, chunkText } from '../services/ai/rag.service.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

const MAX_DOCUMENT_CHARS = 50_000;
const MAX_QUERY_CHARS = 2_000;

/** LLM calls cost money and are slow; keep a tighter budget than the global API limiter. */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many AI requests. Please wait a few minutes.' },
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: (req) => req.userId || req.ip,
});

/**
 * A live conversation burns one call per message, so it needs real headroom —
 * the shared 30/15min budget above would cut a chat off after a few exchanges.
 */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many chat messages. Please slow down for a few minutes.' },
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: (req) => req.userId || req.ip,
});

router.use(authenticate, aiLimiter);

const INTERVIEW_SYSTEM_PROMPT = `
You are an expert technical interviewer and career coach.

Build a targeted interview prep guide from the candidate's resume and the target job
description. Identify overlapping strengths and the gaps most likely to be probed.

Respond with strictly this JSON and nothing else:
{
  "focus": "1-2 sentences on what to review most carefully.",
  "questions": [
    {
      "id": 1,
      "question": "A technical or behavioural question matching the requirements",
      "tips": "Keywords and angles to hit when answering",
      "sampleAnswer": "A strong sample response drawing on the candidate's actual resume"
    }
  ]
}

Return between 3 and 6 question blocks.
`.trim();

router.post('/interview-prep', async (req, res, next) => {
  try {
    const { jobDescription } = req.body;

    if (!jobDescription?.trim()) {
      throw new AppError('A job description is required.', 422);
    }
    if (jobDescription.length > MAX_DOCUMENT_CHARS) {
      throw new AppError(`Job description exceeds ${MAX_DOCUMENT_CHARS} characters.`, 413);
    }

    // The stored resume is the single source of truth — no pasting required.
    const resume = await getUserResume(req.userId);

    const userPrompt = `
[TARGET JOB DESCRIPTION]
${jobDescription.trim()}

[CANDIDATE RESUME]
${resume?.content?.trim() || 'Not provided — assume a general software engineering background.'}
`.trim();

    const { data, provider } = await generateStructuredAi(INTERVIEW_SYSTEM_PROMPT, userPrompt, {
      isValid: (result) => Array.isArray(result.questions) && result.questions.length > 0,
      runName: 'interview_prep',
    });

    if (!data) {
      throw new AppError('No AI provider is available right now. Try again shortly.', 503);
    }

    res.json({ ...data, provider, usedResume: Boolean(resume) });
  } catch (err) {
    next(err);
  }
});

const MAX_CHAT_MESSAGE_CHARS = 4_000;
/** Bounds the prompt sent upstream — a token budget, not a conversation-length cap. */
const MAX_HISTORY_TURNS = 24;

const INTERVIEW_COACH_PROMPT = `
You are a senior technical interview coach running an ongoing 1:1 session with a candidate.
You have their resume and their target job description. Use both to ground every answer in
their real experience — never invent skills, employers or projects they have not mentioned.

This is an open-ended conversation, not a fixed quiz. The candidate may:
- ask you to quiz them (ask ONE question at a time, wait for their answer, then give specific
  feedback before the next question — do not dump a list of questions at once)
- ask you to explain a concept
- ask for feedback on a draft answer they typed
- ask about the company, role fit, or how to bridge an experience gap

Calibrate difficulty to how the candidate is doing, not to a fixed rung: start at a level
suited to their resume, and escalate toward staff/principal-level rigor as they answer well —
tighten follow-ups, probe edge cases and trade-offs, and push a strong answer to be more precise
rather than accepting "good enough". If they struggle, step back and rebuild the fundamental
before returning to depth. Never end the session or declare it complete on your own; keep going
for as long as the candidate keeps engaging.

Respond with strictly this JSON and nothing else:
{
  "reply": "Your conversational response. Markdown is fine for code blocks or lists.",
  "mode": "quizzing" | "explaining" | "feedback" | "discussion"
}
`.trim();

/**
 * A real back-and-forth coaching conversation. The client owns history (no server-side
 * session store); each turn re-sends the recent transcript so the model has context.
 */
router.post('/interview-chat', chatLimiter, async (req, res, next) => {
  try {
    const { jobDescription, message, history = [] } = req.body;

    if (!message?.trim()) {
      throw new AppError('A message is required.', 422);
    }
    if (message.length > MAX_CHAT_MESSAGE_CHARS) {
      throw new AppError(`Message exceeds ${MAX_CHAT_MESSAGE_CHARS} characters.`, 413);
    }
    if (!Array.isArray(history)) {
      throw new AppError('history must be an array.', 422);
    }

    const resume = await getUserResume(req.userId);

    const recentHistory = history
      .slice(-MAX_HISTORY_TURNS)
      .filter((turn) => turn?.role && turn?.content)
      .map((turn) => `${turn.role === 'user' ? 'Candidate' : 'Coach'}: ${turn.content}`)
      .join('\n\n');

    const userPrompt = `
[TARGET JOB DESCRIPTION]
${jobDescription?.trim() || 'Not specified — coach generally for the resume below.'}

[CANDIDATE RESUME]
${resume?.content?.trim() || 'No resume on file — coach generally and say so if it matters.'}

[CONVERSATION SO FAR]
${recentHistory || '(this is the first message)'}

[CANDIDATE'S NEW MESSAGE]
${message.trim()}
`.trim();

    const { data, provider } = await generateStructuredAi(INTERVIEW_COACH_PROMPT, userPrompt, {
      isValid: (result) => Boolean(result.reply),
      runName: 'interview_chat',
    });

    if (!data) {
      throw new AppError('No AI provider is available right now. Try again shortly.', 503);
    }

    res.json({ reply: data.reply, mode: data.mode || 'discussion', provider });
  } catch (err) {
    next(err);
  }
});

/** Queries the caller's stored resume; embeddings are reused, never recomputed. */
router.post('/rag/query', async (req, res, next) => {
  try {
    const { query } = req.body;

    if (!query?.trim()) {
      throw new AppError('A search query is required.', 422);
    }
    if (query.length > MAX_QUERY_CHARS) {
      throw new AppError(`Query exceeds ${MAX_QUERY_CHARS} characters.`, 413);
    }

    const resume = await getUserResume(req.userId);
    if (!resume) {
      throw new AppError('Add your resume first, then ask questions about it.', 404);
    }

    const ragResult = await queryResumeRAG(
      { chunks: resume.embedding?.chunks || [], content: resume.content },
      query,
    );

    res.json({ success: true, resumeTitle: resume.title, ...ragResult });
  } catch (err) {
    next(err);
  }
});

/** Chunk breakdown of the stored resume, for the retrieval visualiser. */
router.get('/rag/chunks', async (req, res, next) => {
  try {
    const resume = await getUserResume(req.userId);
    if (!resume) {
      throw new AppError('Add your resume first.', 404);
    }

    const stored = resume.embedding?.chunks || [];
    const chunks = (stored.length
      ? stored
      : chunkText(resume.content).map((text, i) => ({ index: i + 1, text }))
    ).map((c) => ({
      id: c.index,
      text: c.text,
      wordCount: c.text.split(/\s+/).filter(Boolean).length,
      characterCount: c.text.length,
      embedded: Boolean(c.vector?.length),
    }));

    res.json({
      success: true,
      totalChunks: chunks.length,
      embeddingProvider: resume.embedding?.provider || null,
      chunks,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
