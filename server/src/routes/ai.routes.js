import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { generateCoreStructuredAi } from '../services/ai/aiCore.service.js';
import { getUserResumesFromFirebase } from '../services/firebase/firebase.service.js';
import { queryResumeRAG, chunkText } from '../services/ai/rag.service.js';

const router = Router();

const INTERVIEW_SYSTEM_PROMPT = `
You are an expert technical interviewer and career coach.
Formulate high-quality customized interview preparation guide questions based on the candidate's Resume and target Job Description.
Evaluate matching skills, possible technical gaps, and domain topics.

You must respond with a strictly formatted JSON object with no additional text or conversational fluff, matching this structure:
{
  "focus": "A short 1-2 sentence focus summary of subjects the user should review most carefully.",
  "questions": [
    {
      "id": 1,
      "question": "A technical or behavioral question matching the requirements",
      "tips": "Practical tips or keywords to mention when answering this question",
      "sampleAnswer": "A professional sample response demonstrating how to highlight matching qualities from the resume."
    }
  ]
}

Make sure to return between 2 and 5 comprehensive question blocks.
`.trim();

const STATIC_PREP_FALLBACK = {
  focus: "General interview readiness checklist. Focus on technical core skills, past projects architecture, and system scalability.",
  questions: [
    {
      id: 1,
      question: "Can you describe a challenging engineering project from your resume and how you resolved technical debt within it?",
      tips: "Use the STAR method (Situation, Task, Action, Result) to explain the scenario, highlighting your architecture choices and team collaborations.",
      sampleAnswer: "In my previous project, we encountered latency bottlenecks with database queries. I resolved this by introducing Redis caching and refactoring long-running loops, resulting in a 40% speed enhancement."
    },
    {
      id: 2,
      question: "Why should we hire you for this role, and how do your skills align with the Job Description requirements?",
      tips: "Map your core strengths (Javascript, React, Node) directly to their wishlist. Show authentic passion for their business domain.",
      sampleAnswer: "My background in fullstack outreach systems matches your tech stack requirements perfectly. I scale products quickly and possess solid frontend-to-backend engineering maturity."
    }
  ]
};

router.post('/interview-prep', async (req, res, next) => {
  try {
    const { jobDescription, resumeText } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: 'Job Description content is required.' });
    }
    if (jobDescription.length > 50000) {
      return res.status(400).json({ error: 'Job description content exceeds maximum 50000 characters.' });
    }
    if (resumeText && resumeText.length > 50000) {
      return res.status(400).json({ error: 'Resume details exceed maximum 50000 characters.' });
    }

    const userPrompt = `
[TARGET JOB DESCRIPTION]
${jobDescription.trim()}

[CANDIDATE RESUME DETAIL]
${(resumeText || '').trim() || 'General software engineer candidate with vanilla stack experience.'}
`.trim();

    const outputObj = await generateCoreStructuredAi(INTERVIEW_SYSTEM_PROMPT, userPrompt);
    if (outputObj && (outputObj.focus || outputObj.questions)) {
      return res.json(outputObj);
    }

    // fallback
    return res.json(STATIC_PREP_FALLBACK);
  } catch (err) {
    next(err);
  }
});

// 1. RAG query on resume
router.post('/rag/query', authenticate, async (req, res, next) => {
  try {
    const { resumeId, resumeText, query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }
    if (query.length > 2000) {
      return res.status(400).json({ error: 'Query parameter size exceeds 2000 characters.' });
    }
    if (resumeText && resumeText.length > 50000) {
      return res.status(400).json({ error: 'Direct resume input exceeds maximum 50000 characters.' });
    }

    let targetText = '';
    let resumeTitle = 'Direct Input';

    if (resumeId) {
      const list = await getUserResumesFromFirebase(req.userId);
      const matched = list.find(r => r.id === resumeId);
      if (!matched) {
        return res.status(404).json({ error: 'Target resume ID not found in security scope.' });
      }
      targetText = matched.content;
      resumeTitle = matched.title;
    } else if (resumeText) {
      targetText = resumeText;
    } else {
      return res.status(400).json({ error: 'Either resumeId or resumeText must be provided.' });
    }

    const ragResult = await queryResumeRAG(targetText, query);
    res.json({
      success: true,
      resumeTitle,
      ...ragResult
    });
  } catch (err) {
    next(err);
  }
});

// 2. Visual chunking breakdown of a resume text
router.post('/rag/chunks', authenticate, async (req, res, next) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: 'Resume text is required.' });
    }
    if (resumeText.length > 50000) {
      return res.status(400).json({ error: 'Resume content exceeds maximum 50000 characters.' });
    }
    const chunks = chunkText(resumeText);
    const mapped = chunks.map((chunk, idx) => ({
      id: idx + 1,
      text: chunk,
      wordCount: chunk.split(/\s+/).filter(Boolean).length,
      characterCount: chunk.length
    }));
    res.json({
      success: true,
      totalChunks: mapped.length,
      chunks: mapped
    });
  } catch (err) {
    next(err);
  }
});

export default router;
