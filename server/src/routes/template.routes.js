import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as templateController from '../controllers/template.controller.js';

const router = Router();

router.get('/', authenticate, templateController.listTemplates);

router.post(
  '/ai-generate',
  authenticate,
  body('prompt').trim().notEmpty().withMessage('prompt is required'),
  validateRequest,
  templateController.generateTemplateAi
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
