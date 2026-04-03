import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { trackEmailOpen } from '../controllers/emailTracking.controller.js';

const router = Router();
const trackRateLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 240,
	standardHeaders: true,
	legacyHeaders: false,
});

router.get('/', trackRateLimiter, trackEmailOpen);

export default router;
