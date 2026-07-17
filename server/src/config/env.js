import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const requiredInProd = ["MONGODB_URI", "JWT_SECRET", "REDIS_HOST"];

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  backendPublicUrl:
    process.env.BACKEND_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${Number(process.env.PORT) || 4000}`,
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mailpilot",
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-only-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  auth: {
    otpExpiryMs: Math.max(60_000, Number(process.env.OTP_EXPIRY_MS) || 300_000),
    otpResendCooldownMs: Math.max(
      10_000,
      Number(process.env.OTP_RESEND_COOLDOWN_MS) || 30_000,
    ),
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || "nodemailer",
    from: process.env.EMAIL_FROM || "MailPilot <noreply@example.com>",
    otpGmail: {
      clientId:
        process.env.MAILPILOT_OTP_GMAIL_CLIENT_ID ||
        process.env.GMAIL_CLIENT_ID,
      clientSecret:
        process.env.MAILPILOT_OTP_GMAIL_CLIENT_SECRET ||
        process.env.GMAIL_CLIENT_SECRET,
      redirectUri:
        process.env.MAILPILOT_OTP_GMAIL_REDIRECT_URI ||
        process.env.GMAIL_REDIRECT_URI ||
        "https://developers.google.com/oauthplayground",
      refreshToken:
        process.env.MAILPILOT_OTP_GMAIL_REFRESH_TOKEN ||
        process.env.GMAIL_REFRESH_TOKEN,
      senderEmail:
        process.env.MAILPILOT_OTP_GMAIL_SENDER_EMAIL ||
        process.env.GMAIL_SENDER_EMAIL ||
        "mailpilot.io@gmail.com",
    },
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri:
        process.env.GMAIL_REDIRECT_URI ||
        "https://developers.google.com/oauthplayground",
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      senderEmail: process.env.GMAIL_SENDER_EMAIL || "mailpilot.io@gmail.com",
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    /** Nodemailer timeouts (ms). Defaults match nodemailer’s built-ins (~2m / 30s / 10m). */
    smtpConnection: {
      connectionTimeoutMs:
        Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 120_000,
      greetingTimeoutMs: Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 30_000,
      socketTimeoutMs: Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 600_000,
    },
    ses: {
      region: process.env.AWS_REGION,
    },
    outreach: {
      batchSize: Math.max(1, Number(process.env.EMAIL_BATCH_SIZE) || 2),
      delayMs: Math.max(250, Number(process.env.EMAIL_DELAY_MS) || 1500),
      jitterMs: Math.max(0, Number(process.env.EMAIL_JITTER_MS) || 500),
      maxRetries: Math.max(
        1,
        Math.min(3, Number(process.env.EMAIL_MAX_RETRIES) || 3),
      ),
      pauseBetweenBatchesMs: Math.max(
        0,
        Number(process.env.EMAIL_BATCH_PAUSE_MS) || 5000,
      ),
    },
  },
  runEmailWorker: process.env.RUN_EMAIL_WORKER !== "false",
  /** BullMQ worker: higher values = faster delivery (respect your SMTP provider limits). */
  emailWorker: {
    concurrency: Math.max(1, Number(process.env.EMAIL_WORKER_CONCURRENCY) || 1),
    rateLimitMax: Math.max(1, Number(process.env.EMAIL_RATE_LIMIT_MAX) || 1),
    rateLimitDurationMs: Math.max(
      1,
      Number(process.env.EMAIL_RATE_LIMIT_DURATION_MS) || 1000,
    ),
  },
  apiRateLimitMax: Number(process.env.API_RATE_LIMIT_MAX) || 200,
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    googleApiKey: process.env.GOOGLE_API_KEY || '',
    langsmith: {
      tracing: process.env.LANGSMITH_TRACING === 'true',
      endpoint: process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com',
      apiKey: process.env.LANGSMITH_API_KEY || '',
      project: process.env.LANGSMITH_PROJECT || 'vaibhav-ai',
    }
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'mailpilot-e0424',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@mailpilot-e0424.iam.gserviceaccount.com',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  }
};

export function assertEnv() {
  if (env.nodeEnv !== "production") return;
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
