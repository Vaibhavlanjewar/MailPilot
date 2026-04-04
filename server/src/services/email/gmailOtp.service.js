import { google } from "googleapis";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

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
    `From: MailPilot <${env.email.otpGmail.senderEmail}>`,
    `To: ${to}`,
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    textBody,
  ].join("\n");
}

export async function sendOtpEmail({ to, otp }) {
  const { oauth2Client } = getOtpClient();
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const raw = toBase64Url(buildOtpEmail({ to, otp }));

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}
