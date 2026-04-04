import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ["register", "forgot"],
      required: true,
    },
    // Stored as SHA-256 hash, never plaintext OTP.
    otp: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    context: {
      name: { type: String, trim: true, default: "" },
      passwordHash: { type: String, select: false, default: "" },
    },
  },
  { timestamps: true },
);

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model("Otp", otpSchema);
