import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as campaignController from '../controllers/campaign.controller.js';

const router = Router();

router.get('/', authenticate, campaignController.listCampaigns);
router.get('/limits', authenticate, campaignController.getCampaignLimits);

const createRules = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('subject').trim().notEmpty().withMessage('subject is required'),
  body('content').isString().notEmpty().withMessage('content is required'),
  body('textContent').optional().isString(),
  body('contactIds').optional().isArray(),
  body('scheduledAt')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('scheduledAt must be ISO 8601 date'),
];

router.post(
  '/create',
  authenticate,
  createRules,
  validateRequest,
  campaignController.createCampaign
);

router.post(
  '/send/:id',
  authenticate,
  param('id').isMongoId().withMessage('invalid campaign id'),
  body('scheduledAt')
    .optional({ values: 'null' })
    .isISO8601()
    .withMessage('scheduledAt must be ISO 8601 date'),
  validateRequest,
  campaignController.sendCampaign
);

router.get(
  '/status/:id',
  authenticate,
  param('id').isMongoId().withMessage('invalid campaign id'),
  validateRequest,
  campaignController.getCampaignStatus
);

export default router;
