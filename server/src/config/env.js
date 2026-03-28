import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredInProd = ['MONGODB_URI', 'JWT_SECRET', 'REDIS_HOST'];

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mailpilot',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'nodemailer',
    from: process.env.EMAIL_FROM || 'MailPilot <noreply@example.com>',
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    ses: {
      region: process.env.AWS_REGION,
    },
  },
  runEmailWorker: process.env.RUN_EMAIL_WORKER !== 'false',
  apiRateLimitMax: Number(process.env.API_RATE_LIMIT_MAX) || 200,
};

export function assertEnv() {
  if (env.nodeEnv !== 'production') return;
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
