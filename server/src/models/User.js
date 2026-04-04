import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    name: { type: String, trim: true, default: "" },
    /** SMTP login (e.g. Gmail). Empty = use account email. */
    smtpUser: { type: String, trim: true, lowercase: true, default: "" },
    /** Shown in From: "Name" <smtpUser|email> — e.g. MailChips */
    smtpFromDisplayName: { type: String, trim: true, default: "" },
    /** AES-GCM encrypted app password (never returned to clients). */
    smtpAppPasswordEnc: { type: String, select: false, default: "" },
    /** AES-GCM encrypted Gmail OAuth refresh token (never returned to clients). */
    gmailRefreshTokenEnc: { type: String, select: false, default: "" },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
