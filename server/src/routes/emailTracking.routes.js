import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { getEmailTracking } from '../controllers/emailTracking.controller.js';

const router = Router();

router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be between 1 and 50'),
    query('campaignId').optional().isMongoId().withMessage('campaignId must be a valid id'),
    query('sort')
      .optional()
      .isIn(['recently-opened', 'most-opened', 'not-opened'])
      .withMessage('sort is invalid'),
  ],
  validateRequest,
  getEmailTracking,
);

export default router;
