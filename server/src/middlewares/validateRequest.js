import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join('; ');
    return next(new AppError(message, 422));
  }
  next();
}
