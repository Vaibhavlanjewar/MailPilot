import { Router } from 'express';
import validator from 'validator';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { authenticate } from '../middlewares/auth.js';
import { Resume } from '../models/Resume.js';
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
const MAX_PROJECT_LINKS = 10;

/**
 * These get embedded verbatim as <a href> in outbound campaign emails, so a
 * malformed value here isn't just a cosmetic bug — it can produce a broken
 * link in something already sent. Reject rather than silently drop or coerce.
 */
function sanitizeProjectLinks(input) {
  if (input === undefined) return undefined; // omitted = leave unchanged
  if (!Array.isArray(input)) {
    throw new AppError('projectLinks must be an array of { title, url }', 422);
  }
  if (input.length > MAX_PROJECT_LINKS) {
    throw new AppError(`projectLinks is limited to ${MAX_PROJECT_LINKS} entries`, 422);
  }

  const out = [];
  for (const row of input) {
    const title = typeof row?.title === 'string' ? row.title.trim() : '';
    const url = typeof row?.url === 'string' ? row.url.trim() : '';
    if (!title && !url) continue; // a fully blank row from the UI — skip quietly
    if (!title || !url) {
      throw new AppError('Each project link needs both a title and a URL.', 422);
    }
    if (!validator.isURL(url, { require_protocol: true, protocols: ['http', 'https'] })) {
      throw new AppError(`"${url}" is not a valid http(s) URL.`, 422);
    }
    if (title.length > 80) {
      throw new AppError('Project link titles must be under 80 characters.', 422);
    }
    out.push({ title, url });
  }
  return out;
}

router.use(authenticate);

/**
 * Mirrors client/src/services/documentText.js — the web client extracts PDF/DOCX
 * text in-browser via pdf.js/mammoth (CDN scripts, DOM-only). Mobile has no DOM,
 * so the same extraction runs here instead, using the equivalent Node packages.
 */
router.post('/extract-text', async (req, res, next) => {
  try {
    const { fileBase64, fileName = '', mimeType = '' } = req.body || {};
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      throw new AppError('fileBase64 is required', 422);
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > MAX_RESUME_BYTES) {
      throw new AppError('File exceeds the 2MB limit.', 413);
    }

    const name = String(fileName).toLowerCase();
    const isPdf = name.endsWith('.pdf') || mimeType === 'application/pdf';
    const isDocx =
      name.endsWith('.docx') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    let content = '';
    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        content = (parsed.text || '').trim();
      } finally {
        await parser.destroy();
      }
      if (!content) {
        throw new AppError('No text found — this PDF looks like a scanned image.', 422);
      }
    } else if (isDocx) {
      const { value } = await mammoth.extractRawText({ buffer });
      content = (value || '').trim();
      if (!content) {
        throw new AppError('No text found in this Word document.', 422);
      }
    } else {
      throw new AppError('Unsupported format. Upload a .pdf, .docx, or .txt file.', 422);
    }

    res.json({ success: true, content });
  } catch (err) {
    next(err);
  }
});

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
    const { title, content, source, links, projectLinks, fileName, fileSize, fileBase64, mimeType } = req.body;
    validateContent(content, fileSize);
    const sanitizedProjectLinks = sanitizeProjectLinks(projectLinks);

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
        ...(sanitizedProjectLinks !== undefined ? { projectLinks: sanitizedProjectLinks } : {}),
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

/**
 * Updates only the profile links and/or project links, without touching resume
 * content, the embedding index, or the stored file.
 *
 * Deliberately NOT implemented by calling saveUserResume(): that function
 * treats "no fileBase64 in this call" as "the attached file was removed" and
 * deletes it from ResumeFile accordingly (see resume.service.js). Routing a
 * links-only edit through it would silently delete the user's attachment the
 * next time they update their LinkedIn URL. A direct, narrow $set avoids that
 * failure mode entirely and also skips re-running embeddings for text that
 * didn't change.
 */
router.patch('/me/links', async (req, res, next) => {
  try {
    const { links, projectLinks } = req.body;
    const sanitizedProjectLinks = sanitizeProjectLinks(projectLinks);

    const update = {};
    if (links !== undefined) {
      if (typeof links !== 'object' || links === null || Array.isArray(links)) {
        throw new AppError('links must be an object', 422);
      }
      update.links = { ...DEFAULT_LINKS, ...links };
    }
    if (sanitizedProjectLinks !== undefined) {
      update.projectLinks = sanitizedProjectLinks;
    }
    if (!Object.keys(update).length) {
      throw new AppError('Send links and/or projectLinks to update.', 422);
    }

    const resume = await Resume.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { new: true },
    );
    if (!resume) {
      throw new AppError('You have no resume yet — add one first.', 404);
    }

    res.json({ success: true, resume: resume.toSummary() });
  } catch (err) {
    next(err);
  }
});

/** Saves the structured builder output as the caller's resume. */
router.put('/me/built', async (req, res, next) => {
  try {
    const { title, content, links, projectLinks, templates, builderData } = req.body;
    validateContent(content);
    const sanitizedProjectLinks = sanitizeProjectLinks(projectLinks);

    const resume = await saveUserResume(req.userId, {
      title: title?.trim() || 'My resume',
      source: 'built',
      content: content.trim(),
      links: { ...DEFAULT_LINKS, ...(links || {}) },
      ...(sanitizedProjectLinks !== undefined ? { projectLinks: sanitizedProjectLinks } : {}),
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
