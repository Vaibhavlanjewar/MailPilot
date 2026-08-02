import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { requireRecruiter } from '../middlewares/requireRecruiter.js';
import { Job, SavedJob } from '../models/Job.js';
import { AppError } from '../utils/AppError.js';
import { generateStructuredAi } from '../services/ai/aiCore.service.js';

const router = Router();

router.use(authenticate);

const PAGE_SIZE = 12;

/** Search + filter + paginate the job board. */
router.get('/', async (req, res, next) => {
  try {
    const {
      q,
      location,
      workMode,
      experienceLevel,
      employmentType,
      company,
      skill,
      salaryMin,
      datePosted,
      page = 1,
    } = req.query;

    const filter = { active: true };
    if (location) filter.location = location;
    if (workMode) filter.workMode = workMode;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (employmentType) filter.employmentType = employmentType;
    if (company) filter.company = company;
    if (skill) filter.skills = skill;
    if (q?.trim()) filter.$text = { $search: q.trim() };

    // datePosted is a relative window in days (LinkedIn-style "past 24h / week / month").
    if (datePosted) {
      const days = Number(datePosted);
      if (Number.isFinite(days) && days > 0) {
        filter.createdAt = { $gte: new Date(Date.now() - days * 86_400_000) };
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);

    const [jobsRaw, total, saved] = await Promise.all([
      Job.find(filter)
        .sort(q?.trim() ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip((pageNum - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Job.countDocuments(filter),
      SavedJob.find({ userId: req.userId }).select('jobId').lean(),
    ]);

    // salaryMin filters on the numeric floor parsed out of the free-text salaryRange string.
    const jobs = salaryMin
      ? jobsRaw.filter((j) => {
          const digits = String(j.salaryRange || '').match(/[\d,]+/);
          if (!digits) return true;
          const floor = Number(digits[0].replace(/,/g, ''));
          return floor >= Number(salaryMin);
        })
      : jobsRaw;

    const savedIds = new Set(saved.map((s) => String(s.jobId)));

    res.json({
      success: true,
      jobs: jobs.map((j) => ({ ...j, isSaved: savedIds.has(String(j._id)) })),
      page: pageNum,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE) || 1,
    });
  } catch (err) {
    next(err);
  }
});

/** Distinct values that actually exist, so filters never show empty options. */
router.get('/filters', async (_req, res, next) => {
  try {
    const [locations, skills, companies] = await Promise.all([
      Job.distinct('location', { active: true }),
      Job.distinct('skills', { active: true }),
      Job.distinct('company', { active: true }),
    ]);
    res.json({
      success: true,
      locations: locations.sort(),
      skills: skills.sort().slice(0, 40),
      companies: companies.sort(),
      workModes: ['Remote', 'Hybrid', 'On-site'],
      experienceLevels: ['Fresher', 'Junior', 'Mid', 'Senior', 'Lead'],
      employmentTypes: ['Full-time', 'Part-time', 'Contract', 'Internship'],
      datePostedOptions: [
        { label: 'Any time', value: '' },
        { label: 'Past 24 hours', value: '1' },
        { label: 'Past week', value: '7' },
        { label: 'Past month', value: '30' },
      ],
    });
  } catch (err) {
    next(err);
  }
});

router.get('/saved', async (req, res, next) => {
  try {
    const saved = await SavedJob.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate('jobId')
      .lean();
    res.json({
      success: true,
      jobs: saved.filter((s) => s.jobId).map((s) => ({ ...s.jobId, isSaved: true })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireRecruiter, async (req, res, next) => {
  try {
    const jobs = await Job.find({ postedBy: req.userId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
});

const extractLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many extraction requests. Please wait a few minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

const EXTRACT_PROMPT = `
You are a recruiting operations assistant. A recruiter pasted a raw job description. Extract
structured fields for a job board listing. Only use information present in the text — never
invent a company, salary, or skill that is not stated or clearly implied.

Respond with strictly this JSON and nothing else:
{
  "title": "Concise job title",
  "company": "Company name, or empty string if not stated",
  "location": "City, Country or 'Remote' — best guess from the text, empty string if unclear",
  "workMode": "Remote" | "Hybrid" | "On-site",
  "employmentType": "Full-time" | "Part-time" | "Contract" | "Internship",
  "experienceLevel": "Fresher" | "Junior" | "Mid" | "Senior" | "Lead",
  "salaryRange": "As stated in the text, or empty string if not mentioned",
  "skills": ["skill1", "skill2"],
  "description": "A cleaned-up 2-4 sentence summary of the role and requirements"
}
`.trim();

/** Recruiter pastes a raw JD; AI extracts structured fields for review before publish. */
router.post('/extract', requireRecruiter, extractLimiter, async (req, res, next) => {
  try {
    const { rawText } = req.body;
    if (!rawText?.trim()) {
      throw new AppError('Paste the job description text first.', 422);
    }
    if (rawText.length > 20_000) {
      throw new AppError('Text exceeds 20,000 characters.', 413);
    }

    const { data, provider } = await generateStructuredAi(EXTRACT_PROMPT, rawText.trim(), {
      isValid: (r) => Boolean(r.title),
      runName: 'job_posting_extract',
    });

    if (!data) {
      throw new AppError('No AI provider is available right now. Try again shortly.', 503);
    }

    res.json({ success: true, fields: data, provider });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRecruiter, async (req, res, next) => {
  try {
    const { title, company, location } = req.body;
    if (!title?.trim() || !company?.trim() || !location?.trim()) {
      throw new AppError('Title, company and location are required.', 422);
    }

    const job = await Job.create({
      ...req.body,
      skills: Array.isArray(req.body.skills)
        ? req.body.skills
        : String(req.body.skills || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      postedBy: req.userId,
      seeded: false,
      active: true,
    });

    res.status(201).json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRecruiter, async (req, res, next) => {
  try {
    const update = { ...req.body };
    delete update.postedBy;
    delete update.seeded;
    if (update.skills !== undefined) {
      update.skills = Array.isArray(update.skills)
        ? update.skills
        : String(update.skills || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, postedBy: req.userId },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!job) throw new AppError('Job not found or not yours to edit.', 404);
    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/save', async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).select('_id');
    if (!job) throw new AppError('Job not found.', 404);

    // Toggle: unsave when it is already saved.
    const existing = await SavedJob.findOneAndDelete({ userId: req.userId, jobId: job._id });
    if (existing) {
      return res.json({ success: true, isSaved: false });
    }

    await SavedJob.create({ userId: req.userId, jobId: job._id });
    res.json({ success: true, isSaved: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRecruiter, async (req, res, next) => {
  try {
    const { deletedCount } = await Job.deleteOne({
      _id: req.params.id,
      postedBy: req.userId,
    });
    if (!deletedCount) throw new AppError('Job not found or not yours to delete.', 404);
    await SavedJob.deleteMany({ jobId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
