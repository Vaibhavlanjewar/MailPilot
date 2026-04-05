import { UnrecoverableError } from "bullmq";
import jwt from "jsonwebtoken";
import { Campaign } from "../models/Campaign.js";
import { Contact } from "../models/Contact.js";
import { EmailLog } from "../models/EmailLog.js";
import { User } from "../models/User.js";
import { sendCampaignMail } from "../services/email/campaignSend.js";
import { env } from "../config/env.js";
import { maybeFinishCampaign } from "../services/campaign.queue.service.js";
import { resolveCampaignFrom } from "../utils/mailFrom.js";
import { formatEmailSendErrorForLog } from "../utils/smtpErrors.js";
import { renderRecipientTemplate } from "../utils/templateRenderer.js";
import { logger } from "../utils/logger.js";

function appendTrackingPixel(html, trackingUrl) {
  if (!html) return html;
  const pixel = `<img src="${trackingUrl}" alt="" width="1" height="1" style="display:block; width:1px; height:1px; border:0; margin:0; padding:0;" />`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${html}${pixel}`;
}

/**
 * @param {import('bullmq').Job<{ emailLogId: string }>} job
 */
export async function processEmailJob(job) {
  const { emailLogId } = job.data;
  const maxAttempts = job.opts.attempts ?? 3;

  const log = await EmailLog.findById(emailLogId);
  if (!log) {
    logger.warn("EmailLog not found, skipping job", { emailLogId });
    throw new UnrecoverableError("EmailLog missing");
  }

  if (log.status === "sent") {
    return;
  }

  const campaign = await Campaign.findById(log.campaignId);
  if (!campaign) {
    await EmailLog.findByIdAndUpdate(emailLogId, {
      status: "failed",
      error: "Campaign missing",
    });
    throw new UnrecoverableError("Campaign missing");
  }

  const contact = await Contact.findById(log.contactId)
    .select("name email company")
    .lean();

  const owner = await User.findById(campaign.userId)
    .select(
      "+smtpAppPasswordEnc +gmailRefreshTokenEnc email name smtpUser smtpFromDisplayName",
    )
    .lean();
  if (!owner) {
    const accountMissingMessage =
      "Campaign owner account missing. Please log in again and recreate this campaign.";
    await EmailLog.findByIdAndUpdate(emailLogId, {
      status: "failed",
      error: accountMissingMessage,
    });
    throw new UnrecoverableError(accountMissingMessage);
  }
  const from = resolveCampaignFrom(owner);
  const recipient = contact || { name: "", email: log.toEmail, company: "" };
  const subject = renderRecipientTemplate(campaign.subject, recipient);
  const html = renderRecipientTemplate(campaign.content, recipient);
  const text = renderRecipientTemplate(campaign.textContent || "", recipient) || undefined;

  const trackingToken = jwt.sign(
    { emailLogId: log._id.toString() },
    env.jwt.secret,
    { expiresIn: "7d" },
  );
  log.trackingToken = trackingToken;
  await log.save();

  const trackingBase = String(env.backendPublicUrl || "").replace(/\/$/, "");
  const trackingUrl = `${trackingBase}/track?token=${encodeURIComponent(trackingToken)}`;
  const trackedHtml = appendTrackingPixel(html, trackingUrl);

  try {
    const result = await sendCampaignMail(owner, {
      to: log.toEmail,
      subject,
      html: trackedHtml,
      text,
      from,
    });

    await EmailLog.findByIdAndUpdate(emailLogId, {
      status: "sent",
      providerMessageId: result.messageId || "",
      error: "",
      lastAttemptAt: new Date(),
      $inc: { attempts: 1 },
    });

    await Campaign.findByIdAndUpdate(campaign._id, {
      $inc: { "stats.sent": 1 },
    });

    await maybeFinishCampaign(campaign._id);

    logger.debug("Email sent", {
      emailLogId,
      to: log.toEmail,
      messageId: result.messageId,
    });
  } catch (err) {
    const message = formatEmailSendErrorForLog(err);
    logger.warn("Email send failed", {
      emailLogId,
      attempt: job.attemptsMade + 1,
      maxAttempts,
      message,
    });

    await EmailLog.findByIdAndUpdate(emailLogId, {
      $inc: { attempts: 1 },
      lastAttemptAt: new Date(),
    });

    if (job.attemptsMade + 1 >= maxAttempts) {
      await EmailLog.findByIdAndUpdate(emailLogId, {
        status: "failed",
        error: message,
      });
      await Campaign.findByIdAndUpdate(campaign._id, {
        $inc: { "stats.failed": 1 },
      });
      await maybeFinishCampaign(campaign._id);
      throw new UnrecoverableError(message);
    }

    throw err;
  }
}
