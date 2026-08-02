import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

/** A 4-digit PIN is only 10,000 combinations — this is the brute-force guard. */
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many PIN attempts. Please wait 15 minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

router.get('/me/settings', authenticate, userController.getSettings);
router.post('/me/verify-pin', authenticate, pinLimiter, userController.verifyPin);
router.get('/me/gmail/connect-url', authenticate, userController.getGmailConnectUrl);
router.get('/gmail/callback', userController.gmailOauthCallback);

router.patch(
	'/me/profile',
	authenticate,
	body('name').isString().trim(),
	validateRequest,
	userController.updateProfile,
);

router.patch('/me/settings', authenticate, userController.updateSettings);

export default router;
