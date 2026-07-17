import { google } from "googleapis";
import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { logger } from "../../utils/logger.js";

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getOtpClient() {
  const { clientId, clientSecret, redirectUri, refreshToken, senderEmail } =
    env.email.otpGmail;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !refreshToken ||
    !senderEmail
  ) {
    throw new AppError(
      "Missing Gmail API OTP configuration. Set MAILPILOT_OTP_GMAIL_CLIENT_ID, MAILPILOT_OTP_GMAIL_CLIENT_SECRET, MAILPILOT_OTP_GMAIL_REDIRECT_URI, MAILPILOT_OTP_GMAIL_REFRESH_TOKEN, and MAILPILOT_OTP_GMAIL_SENDER_EMAIL (or fallback GMAIL_* keys).",
      503,
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return { oauth2Client, senderEmail };
}

function buildOtpEmail({ to, otp }) {
  const subject = "MailPilot OTP Verification";
  const textBody = [
    "Hello,",
    "",
    `Your OTP is: ${otp}`,
    "This OTP is valid for 5 minutes.",
    "",
    "If you did not request this OTP, please ignore this email.",
    "",
    "- MailPilot",
  ].join("\n");

  return [
    `From: MailPilot <${env.email.otpGmail.senderEmail || "noreply@example.com"}>`,
    `To: ${to}`,
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textBody,
  ].join("\n");
}

export async function sendOtpEmail({ to, otp }) {
  const { clientId, clientSecret, redirectUri, refreshToken, senderEmail } =
    env.email.otpGmail;

  const hasGmailConfig =
    clientId && clientSecret && redirectUri && refreshToken && senderEmail;

  if (hasGmailConfig) {
    try {
      const { oauth2Client } = getOtpClient();
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const raw = toBase64Url(buildOtpEmail({ to, otp }));
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });
      logger.info(`OTP email sent via Gmail API to ${to}`);
      return;
    } catch (err) {
      logger.error("Failed to send OTP via Gmail API", { error: err.message });
      // Proceed to fallbacks
    }
  }

  // Fallback 1: SMTP email host is configured
  if (env.email.smtp.host) {
    try {
      const { host, port, secure, user, pass } = env.email.smtp;
      const hasAuth = Boolean(user && pass);
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: hasAuth ? { user, pass } : undefined,
      });
      await transporter.sendMail({
        from: env.email.from,
        to,
        subject: "MailPilot OTP Verification",
        text: `Your OTP is: ${otp}\nThis OTP is valid for 5 minutes.`,
      });
      logger.info(`OTP email sent via SMTP to ${to}`);
      return;
    } catch (err) {
      logger.error("Failed to send OTP via SMTP fallback", { error: err.message });
      // Proceed to local dev fallback
    }
  }

  // Fallback 2: Local development/testing console logging
  if (env.nodeEnv !== "production") {
    logger.warn(`📬 [DEVELOPMENT FALLBACK] Verification OTP for ${to} is: ${otp}`);
    return;
  }

  throw new AppError(
    "Missing Gmail API OTP configuration or SMTP fallback.",
    503,
  );
}
