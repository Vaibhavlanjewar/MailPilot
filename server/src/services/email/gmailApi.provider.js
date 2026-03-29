import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../utils/secretCrypto.js";
import { logger } from "../../utils/logger.js";

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @param {number} max */
function randomInt(max) {
  if (max <= 0) return 0;
  return Math.floor(Math.random() * (max + 1));
}

/**
 * @param {string | { name?: string, address?: string }} from
 * @returns {string}
 */
function normalizeFrom(from) {
  if (!from) return "";
  if (typeof from === "string") return from;
  const address = from.address?.trim() || "";
  const name = from.name?.trim() || "";
  if (!address) return "";
  return name ? `"${name}" <${address}>` : address;
}

/**
 * @param {{ gmailRefreshTokenEnc?: string, smtpUser?: string, email?: string } | null | undefined} owner
 */
export function getGmailAuthStatus(owner) {
  const refreshToken =
    decryptSecret(owner?.gmailRefreshTokenEnc) ||
    process.env.GMAIL_REFRESH_TOKEN ||
    "";

  const senderEmail =
    owner?.smtpUser?.trim() ||
    owner?.email?.trim() ||
    process.env.GMAIL_SENDER_EMAIL ||
    "";

  const { clientId, clientSecret, redirectUri } = env.email.gmail;
  if (!clientId || !clientSecret || !redirectUri) {
    return {
      ok: false,
      reason:
        "Gmail OAuth app is not configured on server. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.",
    };
  }

  if (!refreshToken) {
    return {
      ok: false,
      reason:
        "Gmail is not connected for this account. Open Settings and connect Gmail first.",
    };
  }

  if (!senderEmail) {
    return {
      ok: false,
      reason:
        "Sender email is missing. Update profile email/smtpUser or set GMAIL_SENDER_EMAIL.",
    };
  }

  return { ok: true, reason: "" };
}

/**
 * @param {{
 *  owner?: { gmailRefreshTokenEnc?: string, smtpUser?: string, email?: string },
 * }} params
 */
function resolveGmailAuth(params) {
  const owner = params?.owner;
  const authStatus = getGmailAuthStatus(owner);
  if (!authStatus.ok) {
    if (authStatus.reason.includes("not connected")) {
      return null;
    }
    throw new Error(authStatus.reason);
  }

  const refreshToken =
    decryptSecret(owner?.gmailRefreshTokenEnc) ||
    process.env.GMAIL_REFRESH_TOKEN ||
    "";

  const senderEmail =
    owner?.smtpUser?.trim() ||
    owner?.email?.trim() ||
    process.env.GMAIL_SENDER_EMAIL ||
    "";

  const { clientId, clientSecret, redirectUri } = env.email.gmail;

  return {
    refreshToken,
    senderEmail,
    oauth: { clientId, clientSecret, redirectUri },
  };
}

/**
 * @param {{
 *  owner?: { gmailRefreshTokenEnc?: string, smtpUser?: string, email?: string },
 *  to: string,
 *  subject: string,
 *  html?: string,
 *  text?: string,
 *  from: string | { name?: string, address?: string },
 *  replyTo?: string,
 * }} params
 */
export async function sendViaGmailApi(params) {
  const auth = resolveGmailAuth({ owner: params.owner });
  if (!auth) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    auth.oauth.clientId,
    auth.oauth.clientSecret,
    auth.oauth.redirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: auth.refreshToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const from = normalizeFrom(params.from) || auth.senderEmail;
  const unsubscribeMailbox = `unsubscribe+${Date.now()}@${auth.senderEmail.split("@")[1]}`;

  const mail = new MailComposer({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text || undefined,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    headers: {
      "X-Auto-Response-Suppress": "OOF, AutoReply",
      "List-Unsubscribe": `<mailto:${unsubscribeMailbox}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  const compiled = await mail.compile().build();
  const raw = Buffer.from(compiled)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    messageId: response.data.id || "",
    response: response.statusText || "",
  };
}

/**
 * @param {{
 *  owner?: { gmailRefreshTokenEnc?: string, smtpUser?: string, email?: string },
 *  recipients: string[],
 *  subject: string,
 *  html?: string,
 *  text?: string,
 *  from: string | { name?: string, address?: string },
 *  replyTo?: string,
 * }} params
 */
export async function sendBulkViaGmailApi(params) {
  const recipients = Array.isArray(params.recipients)
    ? params.recipients.filter(Boolean)
    : [];
  if (!recipients.length) {
    return [];
  }

  const outreach = env.email.outreach;
  const results = [];

  for (let i = 0; i < recipients.length; i += outreach.batchSize) {
    const chunk = recipients.slice(i, i + outreach.batchSize);

    for (let j = 0; j < chunk.length; j += 1) {
      const to = chunk[j];
      let sent = false;
      let lastError = "";

      for (let attempt = 1; attempt <= outreach.maxRetries; attempt += 1) {
        try {
          const info = await sendViaGmailApi({
            owner: params.owner,
            to,
            subject: params.subject,
            html: params.html,
            text: params.text,
            from: params.from,
            replyTo: params.replyTo,
          });

          results.push({
            to,
            status: "sent",
            attempts: attempt,
            messageId: info?.messageId || "",
            error: "",
          });
          logger.info("Gmail API send success", {
            to,
            attempt,
            messageId: info?.messageId || "",
          });
          sent = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          logger.warn("Gmail API send failed", {
            to,
            attempt,
            maxAttempts: outreach.maxRetries,
            message: lastError,
          });

          if (attempt < outreach.maxRetries) {
            const retryDelay =
              outreach.delayMs * attempt + randomInt(outreach.jitterMs);
            await sleep(retryDelay);
          }
        }
      }

      if (!sent) {
        results.push({
          to,
          status: "failed",
          attempts: outreach.maxRetries,
          messageId: "",
          error: lastError,
        });
      }

      if (j < chunk.length - 1) {
        await sleep(outreach.delayMs + randomInt(outreach.jitterMs));
      }
    }

    if (i + outreach.batchSize < recipients.length) {
      await sleep(
        outreach.pauseBetweenBatchesMs + randomInt(outreach.jitterMs),
      );
    }
  }

  return results;
}
