import { env } from "../../config/env.js";
import { getEmailProvider } from "./index.js";
import { sendViaGmailApi } from "./gmailApi.provider.js";

/**
 * Sends over the Gmail API (HTTPS), which is the only per-user path — the
 * previous per-user "Gmail app password" option was removed because it needs
 * outbound SMTP on 587/465, and cloud hosts (Render included) block those
 * ports outright. It failed with connection timeouts in production while
 * looking correctly configured in the UI.
 *
 * The SMTP_HOST fallback below is server-level config, not per-user, and
 * stays for self-hosting and local development.
 *
 * @param {{ gmailRefreshTokenEnc?: string, email?: string, name?: string, smtpUser?: string }} owner
 * @param {{ to: string, subject: string, html?: string, text?: string, from: string | import('nodemailer').Address, attachments?: { filename: string, content: Buffer, contentType?: string }[] }} params
 * @returns {Promise<{ messageId: string, response?: string }>}
 */
export async function sendCampaignMail(owner, params) {
  const { to, subject, html, text, from, attachments } = params;

  const gmailResult = await sendViaGmailApi({
    owner,
    to,
    subject,
    html,
    text,
    from,
    attachments,
  });
  if (gmailResult) {
    return gmailResult;
  }

  if (env.email.provider === "gmail-api") {
    throw new Error(
      "EMAIL_PROVIDER is gmail-api but no valid Gmail API credentials were found (OAuth env vars + refresh token).",
    );
  }

  if (!env.email.smtp.host) {
    throw new Error(
      "Gmail is not connected. Open Settings and use Connect Gmail to authorise sending.",
    );
  }

  const provider = getEmailProvider();
  return provider.send({ to, subject, html, text, from, attachments });
}
