import { Campaign } from "../models/Campaign.js";
import { Contact } from "../models/Contact.js";
import { EmailLog } from "../models/EmailLog.js";
import { AppError } from "../utils/AppError.js";
import { getEmailQueue } from "../queues/email.queue.js";
import { logger } from "../utils/logger.js";

const JOB_ATTEMPTS = 3;
const BACKOFF_MS = 5000;

/**
 * Stagger dispatch so providers see a human-like cadence rather than a burst.
 * @param {number} index
 * @returns {number}
 */
function computeRecipientDelayMs(index) {
  const batchSize = Math.max(1, Number(process.env.EMAIL_BATCH_SIZE) || 2);
  const delayMs = Math.max(250, Number(process.env.EMAIL_DELAY_MS) || 1500);
  const jitterMs = Math.max(0, Number(process.env.EMAIL_JITTER_MS) || 500);
  const pauseMs = Math.max(0, Number(process.env.EMAIL_BATCH_PAUSE_MS) || 5000);
  const batchIndex = Math.floor(index / batchSize);
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
  return index * delayMs + batchIndex * pauseMs + jitter;
}

/**
 * @param {string} campaignId
 * @param {string} userId
 * @param {{ scheduledAt?: string|Date|null }} [options]
 */
export async function enqueueCampaignSend(campaignId, userId, options = {}) {
  const campaign = await Campaign.findOne({ _id: campaignId, userId });
  if (!campaign) {
    throw new AppError("Campaign not found", 404);
  }

  if (campaign.status === "processing" || campaign.status === "completed") {
    throw new AppError(
      "Campaign cannot be sent in its current state (already processing or completed)",
      409,
    );
  }

  let contactFilter = { userId, subscribed: { $ne: false } };
  if (campaign.recipientContactIds?.length) {
    contactFilter._id = { $in: campaign.recipientContactIds };
  }

  const contacts = await Contact.find(contactFilter).lean();
  if (!contacts.length) {
    throw new AppError(
      "No recipients found. Upload contacts or attach contact IDs to the campaign.",
      400,
    );
  }

  const scheduledSource =
    options.scheduledAt != null
      ? new Date(options.scheduledAt)
      : campaign.scheduledAt;

  const delayMs =
    scheduledSource && !Number.isNaN(scheduledSource.getTime())
      ? Math.max(0, scheduledSource.getTime() - Date.now())
      : 0;

  /**
   * No multi-document transaction: standalone MongoDB does not support
   * transactions (replica set / sharded cluster only). We use an atomic
   * findOneAndUpdate on status=pending, then insertMany + rollback on failure.
   */
  const $set = {
    status: "processing",
    "stats.total": contacts.length,
    "stats.sent": 0,
    "stats.failed": 0,
    ...(options.scheduledAt != null &&
    scheduledSource &&
    !Number.isNaN(scheduledSource.getTime())
      ? { scheduledAt: scheduledSource }
      : {}),
  };

  const updatedCampaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, userId, status: "pending" },
    { $set },
    { new: true },
  );

  if (!updatedCampaign) {
    throw new AppError("Campaign not found or not in pending state", 409);
  }

  let logs;
  try {
    logs = await EmailLog.insertMany(
      contacts.map((c) => ({
        campaignId,
        contactId: c._id,
        toEmail: c.email,
        status: "queued",
      })),
    );
  } catch (err) {
    await Campaign.findByIdAndUpdate(campaignId, {
      $set: {
        status: "pending",
        "stats.total": 0,
        "stats.sent": 0,
        "stats.failed": 0,
      },
    });
    await EmailLog.deleteMany({ campaignId });
    logger.error("EmailLog insertMany failed", {
      campaignId,
      message: err instanceof Error ? err.message : String(err),
    });
    throw new AppError(
      "Could not queue campaign emails. Please try again.",
      500,
    );
  }

  const emailLogIds = logs.map((l) => l._id);

  const queue = getEmailQueue();

  const sharedOpts = {
    attempts: JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: BACKOFF_MS },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 7 * 86400 },
  };

  await queue.addBulk(
    emailLogIds.map((logId, index) => ({
      name: "send-email",
      data: {
        emailLogId: logId.toString(),
      },
      opts: {
        jobId: logId.toString(),
        delay: delayMs + computeRecipientDelayMs(index),
        ...sharedOpts,
      },
    })),
  );

  logger.info("Campaign enqueued", {
    campaignId,
    recipients: contacts.length,
    delayMs,
  });

  const updated = await Campaign.findById(campaignId).lean();
  return updated;
}

/**
 * When sent + failed === total, mark campaign completed.
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 */
export async function maybeFinishCampaign(campaignId) {
  const c = await Campaign.findById(campaignId);
  if (!c || c.status !== "processing") return;

  const done = c.stats.sent + c.stats.failed;
  if (c.stats.total > 0 && done >= c.stats.total) {
    await Campaign.findByIdAndUpdate(campaignId, { status: "completed" });
    logger.info("Campaign completed", { campaignId });
  }
}
