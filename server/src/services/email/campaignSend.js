import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { getEmailProvider } from "./index.js";
import { decryptSecret } from "../../utils/secretCrypto.js";
import { getSmtpConnectionOptions } from "../../utils/smtpConnectionOptions.js";
import { sendViaGmailApi } from "./gmailApi.provider.js";

/** Google SMTP — works for @gmail.com and Google Workspace. */
const GMAIL_TRANSPORT = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  ...getSmtpConnectionOptions(),
};

/**
 * @param {{ smtpAppPasswordEnc?: string, email?: string, name?: string, smtpUser?: string }} owner
 * @param {{ to: string, subject: string, html?: string, text?: string, from: string | import('nodemailer').Address }} params
 * @returns {Promise<{ messageId: string, response?: string }>}
 */
export async function sendCampaignMail(owner, params) {
  const { to, subject, html, text, from } = params;

  const gmailResult = await sendViaGmailApi({
    owner,
    to,
    subject,
    html,
    text,
    from,
  });
  if (gmailResult) {
    return gmailResult;
  }

  if (env.email.provider === "gmail-api") {
    throw new Error(
      "EMAIL_PROVIDER is gmail-api but no valid Gmail API credentials were found (OAuth env vars + refresh token).",
    );
  }

  const enc = owner?.smtpAppPasswordEnc;
  const pass = enc ? decryptSecret(enc) : null;
  const authUser =
    (owner?.smtpUser && String(owner.smtpUser).trim()) || owner?.email?.trim();

  if (pass && authUser) {
    const transport = nodemailer.createTransport({
      ...GMAIL_TRANSPORT,
      auth: { user: authUser, pass },
    });
    try {
      const info = await transport.sendMail({
        from,
        to,
        subject,
        html,
        text: text || undefined,
      });
      return { messageId: info.messageId || "", response: info.response };
    } finally {
      transport.close();
    }
  }

  if (!env.email.smtp.host) {
    throw new Error(
      "Configure SMTP in Settings (SMTP user, app password, sender name) or set SMTP_HOST in server .env.",
    );
  }

  const provider = getEmailProvider();
  return provider.send({ to, subject, html, text, from });
}
