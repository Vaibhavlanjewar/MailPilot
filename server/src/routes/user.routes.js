import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me/settings', authenticate, userController.getSettings);
router.get('/me/gmail/connect-url', authenticate, userController.getGmailConnectUrl);
router.get('/gmail/callback', userController.gmailOauthCallback);

router.patch(
	'/me/profile',
	authenticate,
	body('name').optional().isString().trim(),
	body('email').optional().isEmail().normalizeEmail(),
	validateRequest,
	userController.updateProfile,
);

router.patch(
	'/me/password',
	authenticate,
	body('currentPassword').isString().notEmpty(),
	body('newPassword')
		.isString()
		.isLength({ min: 8 })
		.withMessage('newPassword must be at least 8 characters'),
	validateRequest,
	userController.changePassword,
);

router.patch('/me/settings', authenticate, userController.updateSettings);

export default router;
