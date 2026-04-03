import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

router.get('/summary', authenticate, analyticsController.getAnalyticsSummary);

export default router;