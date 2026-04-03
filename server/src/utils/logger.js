import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_RE = /(password|pass|secret|token|authorization|cookie|api[-_]?key|refresh)/i;

function redactValue(value, depth = 0) {
  if (depth > 5) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

const line = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const safeMeta = redactValue(meta);
  const extra = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : '';
  return `${ts} [${level}] ${stack || message}${extra}`;
});

export const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'ISO' }),
    line
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), errors({ stack: true }), timestamp(), line),
    }),
  ],
});
