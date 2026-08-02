import { AppError } from '../utils/AppError.js';

/** Gates recruiter-only actions (posting/editing jobs). Run after `authenticate`. */
export function requireRecruiter(req, res, next) {
  if (req.user?.role !== 'recruiter') {
    return next(new AppError('Switch to a Recruiter account in Settings to do this.', 403));
  }
  next();
}
