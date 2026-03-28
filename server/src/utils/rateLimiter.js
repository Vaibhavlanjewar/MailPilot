import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Global API rate limit (per IP). For per-email sending limits use BullMQ worker limiter.
 */
export function createApiRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.apiRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
  });
}
