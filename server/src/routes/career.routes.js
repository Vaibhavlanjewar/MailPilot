import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { CareerFit } from '../models/CareerFit.js';
import { getUserResume } from '../services/resume.service.js';
import { generateStructuredAi } from '../services/ai/aiCore.service.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait a few minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

router.use(authenticate);

const CAREER_FIT_PROMPT = `
You are a pragmatic career advisor. Given a candidate's resume, tell them concretely where to
focus their job search — not generic advice. Base every suggestion on specific evidence from the
resume (a project, a skill, years of experience, a domain) and name that evidence.

Never invent a skill, employer, or achievement not in the resume. If the resume is thin on
evidence for a category, say so rather than inventing detail.

Respond with strictly this JSON and nothing else:
{
  "summary": "2-3 sentences on the candidate's overall market position right now.",
  "strengths": ["Concrete strength tied to specific resume evidence", "..."],
  "companyTypes": [
    { "type": "e.g. Series B-D fintech startups", "why": "Tied to specific resume evidence" }
  ],
  "targetRoles": ["Specific job title", "..."],
  "locations": [
    { "location": "City or 'Remote'", "why": "Why this location fits, e.g. tech hub for their stack" }
  ],
  "salaryBand": {
    "currency": "INR or USD etc, inferred from resume context",
    "min": "realistic floor as a plain number string, e.g. 1800000",
    "max": "realistic ceiling as a plain number string",
    "note": "One sentence on what would move them toward the ceiling"
  },
  "skillGaps": [
    { "skill": "A specific skill", "why": "Why it would open more doors", "priority": "high" | "medium" | "low" }
  ]
}

Produce 3-5 companyTypes, 3-6 targetRoles, 2-4 locations, 3-6 skillGaps.
`.trim();

router.get('/fit', async (req, res, next) => {
  try {
    const advice = await CareerFit.findOne({ userId: req.userId });
    res.json({ success: true, advice });
  } catch (err) {
    next(err);
  }
});

router.post('/fit', generateLimiter, async (req, res, next) => {
  try {
    const resume = await getUserResume(req.userId);
    if (!resume?.content) {
      throw new AppError('Add your resume first — this needs it to give real suggestions.', 422);
    }

    const { data, provider } = await generateStructuredAi(
      CAREER_FIT_PROMPT,
      resume.content.slice(0, 15_000),
      {
        isValid: (r) => Boolean(r.summary) && Array.isArray(r.companyTypes),
        runName: 'career_fit_advice',
      },
    );

    if (!data) {
      throw new AppError('No AI provider is available right now. Try again shortly.', 503);
    }

    const advice = await CareerFit.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          provider,
          summary: data.summary || '',
          strengths: Array.isArray(data.strengths) ? data.strengths : [],
          companyTypes: Array.isArray(data.companyTypes) ? data.companyTypes : [],
          targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : [],
          locations: Array.isArray(data.locations) ? data.locations : [],
          salaryBand: data.salaryBand || {},
          skillGaps: Array.isArray(data.skillGaps) ? data.skillGaps : [],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.json({ success: true, advice });
  } catch (err) {
    next(err);
  }
});

export default router;
