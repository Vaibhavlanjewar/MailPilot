import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getUserResume,
  saveUserResume,
  deleteUserResume,
  MAX_RESUME_BYTES,
  MAX_RESUME_CHARS,
} from '../services/resume.service.js';
import { generateStructuredAi } from '../services/ai/aiCore.service.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

const DEFAULT_LINKS = { linkedin: '', github: '', portfolio: '', leetcode: '' };

router.use(authenticate);

/** The caller's single resume, or null when they have not added one yet. */
router.get('/me', async (req, res, next) => {
  try {
    const resume = await getUserResume(req.userId);
    res.json({ success: true, resume: resume ? resume.toSummary() : null });
  } catch (err) {
    next(err);
  }
});

function validateContent(content, fileSize) {
  if (!content?.trim()) {
    throw new AppError('Resume content is empty — the file may be a scanned image.', 422);
  }
  if (content.length > MAX_RESUME_CHARS) {
    throw new AppError(`Resume text exceeds ${MAX_RESUME_CHARS} characters.`, 413);
  }
  if (fileSize && Number(fileSize) > MAX_RESUME_BYTES) {
    throw new AppError('File exceeds the 2MB limit.', 413);
  }
}

/**
 * Creates or replaces the caller's resume. Any previous resume — and every
 * embedding vector attached to it — is overwritten in the same operation.
 */
router.put('/me', async (req, res, next) => {
  try {
    const { title, content, source, links, fileName, fileSize, fileBase64, mimeType } = req.body;
    validateContent(content, fileSize);

    // The binary is optional (pasted text has none) and goes to Firebase Storage,
    // never into the Mongo document.
    let binary = null;
    if (fileBase64) {
      const buffer = Buffer.from(fileBase64, 'base64');
      if (buffer.length > MAX_RESUME_BYTES) {
        throw new AppError('File exceeds the 2MB limit.', 413);
      }
      binary = { buffer, fileName, mimeType };
    }

    const resume = await saveUserResume(
      req.userId,
      {
        title: title?.trim() || fileName?.trim() || 'My resume',
        source: ['upload', 'paste', 'built'].includes(source) ? source : 'upload',
        content: content.trim(),
        links: { ...DEFAULT_LINKS, ...(links || {}) },
        fileName: fileName || '',
        fileSize: Number(fileSize) || content.length,
        builderData: '',
        templates: '',
      },
      binary,
    );

    res.json({ success: true, resume: resume.toSummary() });
  } catch (err) {
    next(err);
  }
});

/** Saves the structured builder output as the caller's resume. */
router.put('/me/built', async (req, res, next) => {
  try {
    const { title, content, links, templates, builderData } = req.body;
    validateContent(content);

    const resume = await saveUserResume(req.userId, {
      title: title?.trim() || 'My resume',
      source: 'built',
      content: content.trim(),
      links: { ...DEFAULT_LINKS, ...(links || {}) },
      builderData:
        typeof builderData === 'string' ? builderData : JSON.stringify(builderData || {}),
      templates: templates || 'Modern Tech',
      fileName: '',
      fileSize: content.length,
    });

    res.json({ success: true, resume: resume.toSummary() });
  } catch (err) {
    next(err);
  }
});

/** Deletes the resume and its embedding vectors together. */
router.delete('/me', async (req, res, next) => {
  try {
    const deleted = await deleteUserResume(req.userId);
    if (!deleted) {
      throw new AppError('You have no stored resume.', 404);
    }
    res.json({ success: true, message: 'Resume and its embeddings were deleted.' });
  } catch (err) {
    next(err);
  }
});

const RESUME_OPTIMIZE_PROMPT = `
You are an expert resume writer. Rewrite the candidate's material into achievement-oriented
bullet points using strong action verbs and the STAR method. Quantify impact only where the
input supports it; never invent metrics, employers or technologies that are not in the input.

Respond with strictly this JSON and nothing else:
{
  "summary": "A 2-3 sentence professional summary.",
  "experienceBullets": ["...", "..."],
  "projectBullets": ["...", "..."]
}
`.trim();

router.post('/optimize', async (req, res, next) => {
  try {
    const { roleTitle, existingExperience, skillsList } = req.body;
    if (!roleTitle?.trim() || !skillsList?.trim()) {
      throw new AppError('Role title and core skills are required.', 422);
    }

    const userPrompt = `
[TARGET ROLE]
${roleTitle.trim()}

[SKILLS]
${skillsList.trim()}

[EXPERIENCE CONTEXT]
${existingExperience?.trim() || 'None provided.'}
`.trim();

    const { data, provider } = await generateStructuredAi(RESUME_OPTIMIZE_PROMPT, userPrompt, {
      isValid: (result) => Boolean(result.summary),
      runName: 'resume_optimize',
    });

    if (!data) {
      throw new AppError('No AI provider is available right now. Try again shortly.', 503);
    }

    res.json({ success: true, data, provider });
  } catch (err) {
    next(err);
  }
});

export default router;
