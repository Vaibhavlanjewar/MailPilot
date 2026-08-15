import { Router } from "express";
import { User } from "../models/User.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * Deliberately public, unauthenticated — this powers a social-proof number on
 * the landing page, which is seen before anyone signs in.
 *
 * Cached in-process for 5 minutes rather than querying on every page view.
 * The number changes by a handful of signups a day at most, so a short cache
 * is invisible to visitors and avoids a User.countDocuments() on every single
 * landing page load without adding Redis for something this low-stakes.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = { userCount: null, expiresAt: 0 };

router.get("/", async (req, res, next) => {
  try {
    if (!cache.userCount || Date.now() > cache.expiresAt) {
      const userCount = await User.countDocuments();
      cache = { userCount, expiresAt: Date.now() + CACHE_TTL_MS };
    }
    res.json({ userCount: cache.userCount });
  } catch (err) {
    // A stat widget failing to load must never look like the whole app is
    // down — log it and let the client degrade to "no number shown".
    logger.warn("Public stats query failed", { error: err.message });
    next(err);
  }
});

export default router;
