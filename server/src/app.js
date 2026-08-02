import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { createApiRateLimiter } from "./utils/rateLimiter.js";
import campaignRoutes from "./routes/campaign.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import userRoutes from "./routes/user.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import templateRoutes from "./routes/template.routes.js";
import emailTrackingRoutes from "./routes/emailTracking.routes.js";
import trackingRoutes from "./routes/tracking.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import roadmapRoutes from "./routes/roadmap.routes.js";
import jobRoutes from "./routes/job.routes.js";
import careerRoutes from "./routes/career.routes.js";
import mockInterviewRoutes from "./routes/mockInterview.routes.js";
import discussionRoutes from "./routes/discussion.routes.js";
import codeRoutes from "./routes/code.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();

// ✅ FIX: trust proxy (IMPORTANT for Render)
app.set("trust proxy", 1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

const serveClient = env.nodeEnv === "production" && fs.existsSync(clientDist);

// ✅ Normalize origin
function normalizeOrigin(o) {
  return String(o || "")
    .trim()
    .replace(/\/$/, "");
}

// ✅ Allowed origins
const extraCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => normalizeOrigin(s))
  .filter(Boolean);

const corsAllowedOrigins = [
  ...new Set(
    [normalizeOrigin(env.frontendUrl), ...extraCorsOrigins].filter(Boolean),
  ),
];

/** HTTPS origins on *.vercel.app (production + preview deploys). */
function isVercelAppOrigin(origin) {
  try {
    const u = new URL(origin);
    return (
      u.protocol === "https:" &&
      (u.hostname === "vercel.app" || u.hostname.endsWith(".vercel.app"))
    );
  } catch {
    return false;
  }
}

/**
 * Single allow check for browser Origin (used by cors + explicit preflight).
 * Default: FRONTEND_URL / CORS_ORIGINS + all https://*.vercel.app (Render may omit NODE_ENV=production).
 * Set CORS_STRICT=true to allow only listed origins.
 */
function isCorsOriginAllowed(originHeader) {
  if (!originHeader) return true;
  const normalized = normalizeOrigin(originHeader);
  if (corsAllowedOrigins.includes(normalized)) return true;
  if (process.env.CORS_STRICT === "true") return false;
  return isVercelAppOrigin(normalized);
}

function corsOriginValidator(origin, callback) {
  if (!origin) return callback(null, true);
  if (isCorsOriginAllowed(origin)) return callback(null, true);
  console.warn("[cors] Blocked origin:", normalizeOrigin(origin));
  return callback(null, false);
}

const CORS_ALLOW_METHODS =
  "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS";
const CORS_ALLOW_HEADERS = "Content-Type, Authorization";

/**
 * Answer OPTIONS /api/* here so preflight always includes Allow-Methods (PATCH, etc.).
 * The cors package can omit them when origin validation fails in subtle ways.
 */
function handleApiCorsPreflight(req, res, next) {
  if (req.method !== "OPTIONS") return next();
  if (!req.path.startsWith("/api")) return next();

  const origin = req.headers.origin;
  if (origin && !isCorsOriginAllowed(origin)) {
    return res.sendStatus(403);
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
  res.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  res.setHeader("Access-Control-Max-Age", "86400");
  return res.status(204).end();
}

if (
  env.nodeEnv === "production" &&
  corsAllowedOrigins.every((o) => /localhost|127\.0\.0\.1/i.test(o)) &&
  process.env.CORS_STRICT === "true"
) {
  console.warn(
    "[cors] FRONTEND_URL is localhost-only and CORS_STRICT=true — add FRONTEND_URL or CORS_ORIGINS.",
  );
}

const corsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(handleApiCorsPreflight);
app.use(cors(corsOptions));

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ✅ Security
// Helmet's default CSP (script-src/connect-src 'self') only ever applied to
// API responses in dev, since Vite served the actual HTML page separately —
// Express never sat in front of the client. Now that this same server also
// serves the built client in production, that default CSP blocks Firebase
// Auth's own network calls to Google (identitytoolkit/securetoken for
// email+password, apis.google.com + accounts.google.com for the Google
// sign-in popup), which breaks login entirely. Widen just those origins.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://apis.google.com", "https://accounts.google.com"],
        connectSrc: [
          "'self'",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.googleapis.com",
        ],
        frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);

// ✅ Body parsing
// Resume uploads carry a base64-encoded file: a 2MB PDF becomes ~2.7MB of base64
// plus JSON overhead, so that route needs a larger limit than everything else.
// Registered first so it claims the body for this path before the general parser
// runs (body-parser marks the request as parsed, so the second app.use below is
// a no-op for these requests, not a double-parse).
app.use("/api/resumes", express.json({ limit: "4mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limiting
app.use(createApiRateLimiter());

// ✅ Root route
if (!serveClient) {
  app.get("/", (_req, res) => {
    res.json({ message: "MailPilot API running successfully" });
  });
}

// ✅ Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    env: env.nodeEnv,
  });
});

// ✅ Routes
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/email-tracking", emailTrackingRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/roadmaps", roadmapRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/mock-interview", mockInterviewRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/code", codeRoutes);
app.use("/track", trackingRoutes);

// ✅ Serve frontend
if (serveClient) {
  app.use(express.static(clientDist));

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();

    res.sendFile(path.join(clientDist, "index.html"), (err) => next(err));
  });
}

// ✅ Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
