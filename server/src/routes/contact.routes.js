import { Router } from 'express';
import { body, param } from 'express-validator';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import * as contactController from '../controllers/contact.controller.js';

const router = Router();

router.get('/', authenticate, contactController.listContacts);

router.post(
  '/bulk',
  authenticate,
  body('contacts').isArray({ min: 1 }).withMessage('contacts array required'),
  validateRequest,
  contactController.bulkContacts
);

router.patch(
  '/:id',
  authenticate,
  param('id').isMongoId().withMessage('invalid contact id'),
  body('email').optional({ nullable: true }).isEmail().withMessage('email must be a valid email address'),
  body('name').optional({ nullable: true }).isString().withMessage('name must be a string'),
  body('company').optional({ nullable: true }).isString().withMessage('company must be a string'),
  validateRequest,
  contactController.updateContact,
);

router.patch(
  '/:id/subscription',
  authenticate,
  param('id').isMongoId().withMessage('invalid contact id'),
  body('subscribed').isBoolean().withMessage('subscribed must be boolean'),
  validateRequest,
  contactController.updateContactSubscription,
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname?.toLowerCase().endsWith('.csv');
    if (!ok) {
      cb(new Error('Only CSV uploads are allowed'));
      return;
    }
    cb(null, true);
  },
});

router.post(
  '/upload',
  authenticate,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Upload failed' });
      }
      next();
    });
  },
  contactController.uploadContacts
);

export default router;
