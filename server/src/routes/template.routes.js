import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param } from 'express-validator';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as templateController from '../controllers/template.controller.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many AI requests. Please wait a few minutes.' },
  keyGenerator: (req) => req.userId || req.ip,
});

router.get('/', authenticate, templateController.listTemplates);

router.post(
  '/ai-generate',
  authenticate,
  aiLimiter,
  body('prompt').trim().notEmpty().withMessage('prompt is required'),
  validateRequest,
  templateController.generateTemplateAi
);

router.post(
  '/chat',
  authenticate,
  aiLimiter,
  body('message').trim().notEmpty().withMessage('message is required'),
  body('subject').optional().isString(),
  body('body').optional().isString(),
  body('history').optional().isArray(),
  validateRequest,
  templateController.chatTemplate
);

router.post(
  '/',
  authenticate,
  body('name').trim().notEmpty().withMessage('name is required'),
  body('subject').trim().notEmpty().withMessage('subject is required'),
  body('body').isString().withMessage('body is required'),
  body('textContent').optional().isString(),
  validateRequest,
  templateController.createTemplate
);

router.patch(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('invalid template id'),
  body('name').trim().notEmpty().withMessage('name is required'),
  body('subject').trim().notEmpty().withMessage('subject is required'),
  body('body').isString().withMessage('body is required'),
  body('textContent').optional().isString(),
  validateRequest,
  templateController.updateTemplate
);

router.delete(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('invalid template id'),
  validateRequest,
  templateController.deleteTemplate
);

export default router;
