import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post(
  '/register',
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters'),
  body('name').optional().trim().isString(),
  validateRequest,
  authController.register
);

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validateRequest,
  authController.login
);

router.get('/google/url', authController.getGoogleLoginUrl);
router.get('/google/callback', authController.googleOauthCallback);

export default router;
