import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me/settings', authenticate, userController.getSettings);

router.patch('/me/settings', authenticate, userController.updateSettings);

export default router;
