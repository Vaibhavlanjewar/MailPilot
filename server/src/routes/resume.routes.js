import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { 
  saveUserResumeToFirebase, 
  getUserResumesFromFirebase, 
  deleteUserResumeFromFirebase 
} from '../services/firebase/firebase.service.js';
import { generateCoreStructuredAi } from '../services/ai/aiCore.service.js';

const router = Router();

// 1. Fetch user resumes list
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await getUserResumesFromFirebase(req.userId);
    res.json({ success: true, resumes: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Upload / Create resume (checks limits of 2 files maximum. Overwrites/deletes oldest if exceeded)
router.post('/upload', authenticate, async (req, res) => {
  try {
    const { title, type, content, links, fileBase64, fileName, fileSize } = req.body;
    
    if (!title || !content) {
      return res.status(405).json({ success: false, error: "Title and content details are required." });
    }

    // Size limit check (2MB max)
    if (fileSize && fileSize > 2 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: "Resume file size exceeds maximum 2MB size limit." });
    }

    // Limit check: Fetch existing resumes for user
    const existing = await getUserResumesFromFirebase(req.userId);
    
    // We only allow 1-2 resumes (max 2). If limit exceeded, delete/overwrite the oldest resume
    if (existing.length >= 2) {
      // Sort by updatedAt asc (oldest first)
      const sorted = [...existing].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
      const oldest = sorted[0];
      await deleteUserResumeFromFirebase(req.userId, oldest.id);
      console.log(`Limit exceeded (${existing.length}). Auto-deleted oldest resume: ${oldest.title} (${oldest.id})`);
    }

    const uniqueId = `res-${Math.floor(100 + Math.random() * 900)}${Date.now().toString().slice(-4)}`;
    
    const resumeEntry = {
      id: uniqueId,
      title: title.trim(),
      type: type || 'document', // document, built
      content: content.trim(),
      links: links || { linkedin: '', github: '', portfolio: '', leetcode: '' },
      fileName: fileName || 'uploaded_resume.pdf',
      fileBase64: fileBase64 || null,
      fileSize: fileSize || content.length
    };

    const saved = await saveUserResumeToFirebase(req.userId, resumeEntry);
    res.status(201).json({ success: true, resume: saved, deletedOldest: existing.length >= 2 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Save built/edited resume data
router.post('/save-built', authenticate, async (req, res) => {
  try {
    const { id, title, content, links, templates } = req.body;
    
    if (!title || !content) {
      return res.status(405).json({ success: false, error: "Title and structured inputs are required." });
    }

    // Limit check: Fetch existing resumes for user
    const existing = await getUserResumesFromFirebase(req.userId);
    const isNew = !id || !existing.some(r => r.id === id);

    if (isNew && existing.length >= 2) {
      // Sort oldest first
      const sorted = [...existing].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
      const oldest = sorted[0];
      await deleteUserResumeFromFirebase(req.userId, oldest.id);
      console.log(`Limit exceeded during build-save (${existing.length}). Auto-deleted oldest resume: ${oldest.title} (${oldest.id})`);
    }

    const uniqueId = id || `built-${Math.floor(100 + Math.random() * 900)}${Date.now().toString().slice(-4)}`;
    
    const resumeEntry = {
      id: uniqueId,
      title: title.trim(),
      type: 'built',
      content: typeof content === 'string' ? content : JSON.stringify(content),
      links: links || { linkedin: '', github: '', portfolio: '', leetcode: '' },
      templates: templates || 'Standard Modern'
    };

    const saved = await saveUserResumeToFirebase(req.userId, resumeEntry);
    res.json({ success: true, resume: saved, deletedOldest: isNew && existing.length >= 2 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Generate optimized resume content using Gemini / Ollama
router.post('/optimize', authenticate, async (req, res) => {
  const { roleTitle, existingExperience, skillsList } = req.body;

  if (!roleTitle || !skillsList) {
    return res.status(405).json({ success: false, error: "Role title and core skills are required." });
  }

  const aiPrompt = `
    You are an expert resume writer and layout designer. Optimize the profile resume content for a candidate targeting the position: "${roleTitle}".
    Skills inventory: ${skillsList}.
    Provided work experience context: ${existingExperience || 'None provided'}.

    Produce a structural JSON containing professional, clean bullet points formatted with action verbs (STAR method) and a summary.
    
    Return EXACTLY a JSON structure matching:
    {
      "summary": "Full professional technical bio summary...",
      "experienceBullets": [
        "Led deployment of...",
        "Optimized microservice interfaces, reducing latency by...",
        "Designed and maintained key infrastructure pipeline..."
      ],
      "projectBullets": [
        "Built React and Node outreach platform integrated with real-time...",
        "Deployed distributed backend caching modules utilizing..."
      ]
    }
  `;

  try {
    const structure = await generateCoreStructuredAi(
      aiPrompt,
      {
        summary: "Full summary paragraph.",
        experienceBullets: ["Bullet 1", "Bullet 2"],
        projectBullets: ["Bullet 1"]
      }
    );
    res.json({ success: true, data: structure });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Delete a user resume
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const deleted = await deleteUserResumeFromFirebase(req.userId, req.params.id);
    if (deleted) {
      res.json({ success: true, message: "Resume deleted successfully." });
    } else {
      res.status(404).json({ success: false, error: "Resume not found or unauthorized delete target." });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
