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
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    name: { type: String, trim: true, default: "" },
    /** Self-selected: gates recruiter-only routes (post/edit own jobs, applicant view). */
    role: {
      type: String,
      enum: ["candidate", "recruiter"],
      default: "candidate",
    },
    /** SMTP login (e.g. Gmail). Empty = use account email. */
    smtpUser: { type: String, trim: true, lowercase: true, default: "" },
    /** Shown in From: "Name" <smtpUser|email> — e.g. MailChips */
    smtpFromDisplayName: { type: String, trim: true, default: "" },
    /** AES-GCM encrypted app password (never returned to clients). */
    smtpAppPasswordEnc: { type: String, select: false, default: "" },
    /** AES-GCM encrypted Gmail OAuth refresh token (never returned to clients). */
    gmailRefreshTokenEnc: { type: String, select: false, default: "" },
    /** Scrypt hash of a 4-digit PIN gating Email Sending Setup. Never reversible. */
    securityPinHash: { type: String, select: false, default: "" },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
