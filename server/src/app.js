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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");
const serveClient =
  env.nodeEnv === "production" && fs.existsSync(clientDist);

const extraCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsAllowedOrigins = [
  ...new Set([env.frontendUrl, ...extraCorsOrigins].filter(Boolean)),
];

function corsOriginValidator(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (corsAllowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

// CORS before helmet so preflight responses always include Allow-Methods (PATCH, etc.).
// Browsers reject `origin: "*"` together with `credentials: true`; use an explicit allow list.
app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  }),
);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(createApiRateLimiter());

if (!serveClient) {
  app.get("/", (_req, res) => {
    res.json({ message: "MailPilot API running successfully" });
  });
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    env: env.nodeEnv,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/templates", templateRoutes);

if (serveClient) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => next(err));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
