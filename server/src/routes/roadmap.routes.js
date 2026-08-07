import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { Roadmap } from '../models/Roadmap.js';
import { getUserResume } from '../services/resume.service.js';
import { generateStructuredAi } from '../services/ai/aiCore.service.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many roadmap generations. Please wait a few minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

router.use(authenticate);

const ROADMAP_PROMPT = `
You are a senior engineering mentor who designs learning roadmaps in the style of roadmap.sh.

Build a staged, dependency-ordered roadmap for the learner's stated goal. Order stages so each
one only depends on earlier ones. Be concrete: name actual technologies, not vague advice.

If a CURRENT SKILLS section is supplied, mark topics the learner has clearly already mastered
with "alreadyStrong": true so they can skip them. Never mark something strong without evidence.

For each step, also give an "approach" — one concrete, practical instruction for how to actually
practice or apply the skill (e.g. "Build a small REST API with auth and rate limiting", not
"learn about APIs"). And name 1-3 real, well-known resources by their actual title (official
docs, a specific well-known course/book) — give the resource NAME only, never a URL; the app
links to a search for it, since a guessed URL is more likely to be wrong than a well-known name.

Respond with strictly this JSON and nothing else:
{
  "summary": "2-3 sentences on the overall path and realistic total duration.",
  "stages": [
    {
      "id": "stage-1",
      "title": "Foundations",
      "description": "One sentence on why this stage matters.",
      "steps": [
        {
          "id": "step-1-1",
          "title": "A specific, checkable skill",
          "summary": "One or two sentences on what to learn and why.",
          "approach": "One concrete instruction for practicing this, not just reading about it.",
          "topics": ["concrete topic", "another topic"],
          "resources": ["Official docs title or well-known course/book name"],
          "estimatedWeeks": 2,
          "alreadyStrong": false
        }
      ]
    }
  ]
}

Produce 4 to 6 stages, each with 3 to 6 steps.
`.trim();

router.get('/', async (req, res, next) => {
  try {
    const roadmaps = await Roadmap.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .select('goal summary personalised provider stages createdAt updatedAt');
    res.json({ success: true, roadmaps });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.userId });
    if (!roadmap) throw new AppError('Roadmap not found.', 404);
    res.json({ success: true, roadmap });
  } catch (err) {
    next(err);
  }
});

router.post('/', generateLimiter, async (req, res, next) => {
  try {
    const { goal, useResume = true } = req.body;
    if (!goal?.trim()) {
      throw new AppError('Tell us what you want to learn.', 422);
    }
    if (goal.length > 300) {
      throw new AppError('Goal must be under 300 characters.', 422);
    }

    const resume = useResume ? await getUserResume(req.userId) : null;

    const userPrompt = `
[GOAL]
${goal.trim()}
${
  resume?.content
    ? `\n[CURRENT SKILLS - from the learner's resume]\n${resume.content.slice(0, 12_000)}`
    : ''
}
`.trim();

    const { data, provider } = await generateStructuredAi(ROADMAP_PROMPT, userPrompt, {
      isValid: (r) => Array.isArray(r.stages) && r.stages.length > 0,
      runName: 'learning_roadmap',
    });

    if (!data) {
      throw new AppError('No AI provider is available right now. Try again shortly.', 503);
    }

    const roadmap = await Roadmap.create({
      userId: req.userId,
      goal: goal.trim(),
      summary: data.summary || '',
      personalised: Boolean(resume),
      provider,
      stages: (data.stages || []).map((stage, si) => ({
        id: stage.id || `stage-${si + 1}`,
        title: stage.title || `Stage ${si + 1}`,
        description: stage.description || '',
        steps: (stage.steps || []).map((step, pi) => ({
          id: step.id || `step-${si + 1}-${pi + 1}`,
          title: step.title || 'Untitled step',
          summary: step.summary || '',
          approach: step.approach || '',
          topics: Array.isArray(step.topics) ? step.topics : [],
          // AI gives a resource NAME; the URL is a deterministic search link we
          // build ourselves, never a URL the model guessed (those are often 404s).
          resources: (Array.isArray(step.resources) ? step.resources : [])
            .filter((r) => typeof r === 'string' && r.trim())
            .slice(0, 3)
            .map((label) => ({
              label: label.trim(),
              url: `https://www.google.com/search?q=${encodeURIComponent(label.trim())}`,
            })),
          estimatedWeeks: Number(step.estimatedWeeks) || 1,
          alreadyStrong: Boolean(step.alreadyStrong),
          completed: false,
        })),
      })),
    });

    res.status(201).json({ success: true, roadmap });
  } catch (err) {
    next(err);
  }
});

/** Toggles a single step's completion, keyed by stage/step id. */
router.patch('/:id/steps/:stepId', async (req, res, next) => {
  try {
    const { completed } = req.body;
    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.userId });
    if (!roadmap) throw new AppError('Roadmap not found.', 404);

    let found = false;
    for (const stage of roadmap.stages) {
      const step = stage.steps.find((s) => s.id === req.params.stepId);
      if (step) {
        step.completed = Boolean(completed);
        found = true;
        break;
      }
    }
    if (!found) throw new AppError('Step not found.', 404);

    await roadmap.save();
    res.json({ success: true, roadmap });
  } catch (err) {
    next(err);
  }
});

const EXPLAIN_PROMPT = `
You are a senior engineer teaching one specific topic to someone working through a learning
roadmap. Explain the topic itself — do not restate the roadmap or give generic study advice.

Be concrete and technical. Name real tools, real APIs, real commands. Prefer a short worked
example over an abstract description. Assume the learner is competent but new to this topic.

Respond with strictly this JSON and nothing else:
{
  "explanation": "3-5 sentences on what this is and why it matters. Plain prose, no markdown.",
  "keyPoints": ["A specific fact or rule worth remembering", "Another"],
  "subtopics": [
    { "title": "A narrower thing inside this topic", "detail": "1-2 sentences explaining it." }
  ],
  "example": "A short concrete example — a snippet, command, or worked scenario. Plain text.",
  "pitfalls": ["A specific mistake beginners make here"],
  "interviewAngle": "How this topic typically shows up in interviews, in 1-2 sentences."
}

Give 3-6 keyPoints, 3-5 subtopics, and 2-4 pitfalls.
`.trim();

/** Detail panel for a single topic inside a step — the roadmap's drill-down. */
router.post('/:id/explain', generateLimiter, async (req, res, next) => {
  try {
    const { topic, stepTitle = '' } = req.body;
    if (!topic?.trim()) throw new AppError('Pick a topic to explain.', 422);
    if (topic.length > 200) throw new AppError('Topic is too long.', 422);

    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!roadmap) throw new AppError('Roadmap not found.', 404);

    const userPrompt = `
[LEARNER'S GOAL]
${roadmap.goal}

[ROADMAP STEP]
${stepTitle || 'unspecified'}

[TOPIC TO EXPLAIN]
${topic.trim()}
`.trim();

    const { data, provider } = await generateStructuredAi(EXPLAIN_PROMPT, userPrompt, {
      isValid: (v) => typeof v?.explanation === 'string' && v.explanation.length > 0,
      runName: 'roadmap_topic_explain',
    });

    if (!data) {
      throw new AppError('Could not generate an explanation right now. Please try again.', 503);
    }

    res.json({ success: true, provider, detail: data });
  } catch (err) {
    next(err);
  }
});

const CHAT_PROMPT = `
You are a mentor answering a learner's question about their own learning roadmap.

Ground every answer in their goal and the roadmap they're following — reference specific stages
or steps when relevant. If they ask something outside the roadmap, answer it anyway, but tie it
back to where it fits in their plan.

Be direct and specific. Name real technologies. Keep it under 200 words unless the question
genuinely needs more. If they ask for an ordering or comparison, commit to a recommendation
rather than listing options neutrally.

Respond with strictly this JSON and nothing else:
{ "answer": "Your reply as plain prose. No markdown headings." }
`.trim();

/** Q&A grounded in this roadmap; history comes from the client so nothing extra is stored. */
router.post('/:id/chat', generateLimiter, async (req, res, next) => {
  try {
    const { question, history = [] } = req.body;
    if (!question?.trim()) throw new AppError('Ask a question first.', 422);
    if (question.length > 1000) throw new AppError('Question is too long.', 422);

    const roadmap = await Roadmap.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!roadmap) throw new AppError('Roadmap not found.', 404);

    // Only the outline goes in — full step bodies would crowd out the question
    // on smaller context windows in the provider cascade.
    const outline = roadmap.stages
      .map((stage) => {
        const steps = stage.steps
          .map((s) => `  - ${s.title}${s.completed ? ' (done)' : ''}`)
          .join('\n');
        return `${stage.title}\n${steps}`;
      })
      .join('\n');

    const recent = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'Learner' : 'Mentor'}: ${String(m.content).slice(0, 800)}`)
          .join('\n')
      : '';

    const userPrompt = `
[GOAL]
${roadmap.goal}

[ROADMAP OUTLINE]
${outline}
${recent ? `\n[EARLIER IN THIS CONVERSATION]\n${recent}` : ''}

[QUESTION]
${question.trim()}
`.trim();

    const { data, provider } = await generateStructuredAi(CHAT_PROMPT, userPrompt, {
      isValid: (v) => typeof v?.answer === 'string' && v.answer.length > 0,
      runName: 'roadmap_chat',
    });

    if (!data) {
      throw new AppError('Could not answer that right now. Please try again.', 503);
    }

    res.json({ success: true, provider, answer: data.answer });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { deletedCount } = await Roadmap.deleteOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!deletedCount) throw new AppError('Roadmap not found.', 404);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
