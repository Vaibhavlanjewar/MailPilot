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
