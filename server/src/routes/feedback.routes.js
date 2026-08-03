import { Router } from 'express';
import { Feedback } from '../models/Feedback.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyFirebaseToken } from '../services/firebase/firebase.service.js';

const router = Router();

/**
 * Feedback is reachable from the public landing page too, so auth here is
 * best-effort: attach the account if a valid token is present, but a missing
 * or invalid one just falls back to anonymous rather than rejecting outright.
 */
async function identifySubmitter(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = await verifyFirebaseToken(header.slice(7));
    const email = decoded.email?.trim().toLowerCase();
    if (!email) return null;
    return await User.findOne({ email }).select('_id name email');
  } catch {
    return null;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { message, page } = req.body;
    let { name, email } = req.body;

    if (!message?.trim()) {
      throw new AppError('Feedback message is required.', 422);
    }
    if (message.length > 5000) {
      throw new AppError('Feedback exceeds 5000 characters.', 413);
    }

    const submitter = await identifySubmitter(req);
    if (submitter) {
      name = name?.trim() || submitter.name || '';
      email = submitter.email;
    } else {
      email = email?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError('A valid email is required.', 422);
      }
    }

    const feedback = await Feedback.create({
      userId: submitter?._id,
      name: name?.trim() || '',
      email,
      message: message.trim(),
      page: typeof page === 'string' ? page.slice(0, 200) : '',
    });

    res.status(201).json({ feedback: { id: feedback._id } });
  } catch (err) {
    next(err);
  }
});

export default router;
