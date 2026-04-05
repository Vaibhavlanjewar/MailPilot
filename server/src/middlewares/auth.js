import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwt.secret);
    const sub = payload.sub || payload.id;
    if (!sub) {
      return next(new AppError('Invalid token payload', 401));
    }

    const userExists = await User.exists({ _id: String(sub) });
    if (!userExists) {
      return next(new AppError('Account not found. Please log in again.', 401));
    }

    req.userId = String(sub);
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
}
