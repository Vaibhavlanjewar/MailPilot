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
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import templateRoutes from "./routes/template.routes.js";
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
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ✅ Body parsing
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
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/templates", templateRoutes);

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
