import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please try again later.' },
  skip: (req) => req.method === 'OPTIONS',
});

const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP attempts. Please try again later.' },
  skip: (req) => req.method === 'OPTIONS',
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
  skip: (req) => req.method === 'OPTIONS',
});

router.post(
  '/register',
  otpSendLimiter,
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .withMessage('password must include uppercase, lowercase, number, and special character'),
  body('name').optional().trim().isString(),
  validateRequest,
  authController.register
);

router.post(
  '/verify-otp',
  otpVerifyLimiter,
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('otp must be a 6-digit code'),
  body('purpose').optional().isIn(['register', 'forgot']),
  validateRequest,
  authController.verifyOtp
);

router.post(
  '/resend-otp',
  otpSendLimiter,
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  body('purpose').optional().isIn(['register', 'forgot']),
  validateRequest,
  authController.resendOtp
);

router.post(
  '/login',
  loginLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validateRequest,
  authController.login
);

router.post(
  '/forgot-password',
  otpSendLimiter,
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  validateRequest,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  otpVerifyLimiter,
  body('email').isEmail().normalizeEmail().withMessage('valid email required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('otp must be a 6-digit code'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('newPassword must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .withMessage('newPassword must include uppercase, lowercase, number, and special character'),
  validateRequest,
  authController.resetPassword
);

router.get('/google/url', authController.getGoogleLoginUrl);
router.get('/google/callback', authController.googleOauthCallback);

export default router;
