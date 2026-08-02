import validator from "validator";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { encryptSecret, hashPin, verifyPin as verifyPinHash } from "../utils/secretCrypto.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function getGmailOauthClient() {
  const { clientId, clientSecret, redirectUri } = env.email.gmail;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      "Missing Gmail OAuth config. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.",
      503,
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function frontendSettingsUrl(status, message = "") {
  const base = `${env.frontendUrl || "http://localhost:5173"}`.replace(/\/$/, "");
  const url = new URL(`${base}/settings`);
  url.searchParams.set("gmail", status);
  if (message) {
    url.searchParams.set("message", message);
  }
  return url.toString();
}

function settingsPayload(user) {
  return {
    email: user.email,
    name: user.name || "",
    role: user.role || "candidate",
    smtpUser: user.smtpUser || "",
    smtpFromDisplayName: user.smtpFromDisplayName || "",
    hasSmtpAppPassword: Boolean(user.smtpAppPasswordEnc),
    hasGmailRefreshToken: Boolean(user.gmailRefreshTokenEnc),
    hasSecurityPin: Boolean(user.securityPinHash),
  };
}

function authUserPayload(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name || "",
  };
}

export async function getSettings(req, res, next) {
  try {
    const user = await User.findById(req.userId)
      .select(
        "email name role smtpUser smtpFromDisplayName smtpAppPasswordEnc gmailRefreshTokenEnc securityPinHash",
      )
      .lean();

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json(settingsPayload(user));
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { name } = req.body;
    if (typeof name !== "string") {
      throw new AppError("name must be a string", 422);
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { name: name.trim() } },
      { new: true },
    ).select("_id email name");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json({ user: authUserPayload(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * Body (all optional except at least one update):
 * - smtpUser: string — SMTP login email; "" clears (use account email)
 * - smtpFromDisplayName: string — From display name (e.g. MailChips)
 * - smtpAppPassword: string — "" removes; omit to leave unchanged
 * - gmailRefreshToken: string — "" removes; omit to leave unchanged
 */
export async function updateSettings(req, res, next) {
  try {
    if (
      env.nodeEnv === "production" &&
      !process.env.SMTP_CREDENTIALS_ENCRYPTION_KEY
    ) {
      throw new AppError(
        "Server is not configured to store app passwords (set SMTP_CREDENTIALS_ENCRYPTION_KEY)",
        503,
      );
    }

    const {
      smtpUser,
      smtpFromDisplayName,
      smtpAppPassword,
      gmailRefreshToken,
      role,
      securityPin,
    } = req.body;

    if (
      smtpUser === undefined &&
      smtpFromDisplayName === undefined &&
      smtpAppPassword === undefined &&
      gmailRefreshToken === undefined &&
      role === undefined &&
      securityPin === undefined
    ) {
      throw new AppError(
        "Send at least one of: smtpUser, smtpFromDisplayName, smtpAppPassword, gmailRefreshToken, role, securityPin",
        422,
      );
    }

    const $set = {};
    const $unset = {};

    if (securityPin !== undefined) {
      if (typeof securityPin !== "string") {
        throw new AppError("securityPin must be a string", 422);
      }
      if (securityPin === "") {
        $unset.securityPinHash = 1;
      } else if (!/^\d{4}$/.test(securityPin)) {
        throw new AppError("securityPin must be exactly 4 digits", 422);
      } else {
        $set.securityPinHash = hashPin(securityPin);
      }
    }

    if (role !== undefined) {
      if (!["candidate", "recruiter"].includes(role)) {
        throw new AppError('role must be "candidate" or "recruiter"', 422);
      }
      $set.role = role;
    }

    if (smtpUser !== undefined) {
      if (typeof smtpUser !== "string") {
        throw new AppError("smtpUser must be a string", 422);
      }
      const u = smtpUser.trim().toLowerCase();
      if (u === "") {
        $unset.smtpUser = 1;
      } else if (!validator.isEmail(u)) {
        throw new AppError("smtpUser must be a valid email", 422);
      } else {
        $set.smtpUser = u;
      }
    }

    if (smtpFromDisplayName !== undefined) {
      if (typeof smtpFromDisplayName !== "string") {
        throw new AppError("smtpFromDisplayName must be a string", 422);
      }
      $set.smtpFromDisplayName = smtpFromDisplayName.trim();
    }

    if (smtpAppPassword !== undefined) {
      if (typeof smtpAppPassword !== "string") {
        throw new AppError("smtpAppPassword must be a string", 422);
      }
      const trimmed = smtpAppPassword.replace(/\s/g, "");
      if (trimmed === "") {
        $unset.smtpAppPasswordEnc = 1;
      } else if (trimmed.length < 16) {
        throw new AppError(
          "Gmail app password must be at least 16 characters (spaces ignored)",
          422,
        );
      } else {
        $set.smtpAppPasswordEnc = encryptSecret(trimmed);
      }
    }

    if (gmailRefreshToken !== undefined) {
      if (typeof gmailRefreshToken !== "string") {
        throw new AppError("gmailRefreshToken must be a string", 422);
      }
      const trimmed = gmailRefreshToken.trim();
      if (trimmed === "") {
        $unset.gmailRefreshTokenEnc = 1;
      } else if (trimmed.length < 20) {
        throw new AppError("gmailRefreshToken looks too short", 422);
      } else {
        $set.gmailRefreshTokenEnc = encryptSecret(trimmed);
      }
    }

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    if (!Object.keys(update).length) {
      throw new AppError("No fields to update", 422);
    }

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
    }).select(
      "email name role smtpUser smtpFromDisplayName smtpAppPasswordEnc gmailRefreshTokenEnc securityPinHash",
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json(settingsPayload(user));
  } catch (err) {
    next(err);
  }
}

/**
 * Verifies the security PIN gating Email Sending Setup. Rate-limited at the
 * route level — a 4-digit PIN is only 10,000 combinations and would be
 * trivially brute-forceable without it.
 */
export async function verifyPin(req, res, next) {
  try {
    const { pin } = req.body;
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      throw new AppError("pin must be exactly 4 digits", 422);
    }

    const user = await User.findById(req.userId).select("securityPinHash");
    if (!user) throw new AppError("User not found", 404);

    if (!user.securityPinHash) {
      // No PIN set yet — nothing to gate, so verification trivially passes.
      return res.json({ valid: true, pinSet: false });
    }

    const valid = verifyPinHash(pin, user.securityPinHash);
    res.json({ valid, pinSet: true });
  } catch (err) {
    next(err);
  }
}

export async function getGmailConnectUrl(req, res, next) {
  try {
    const oauth2Client = getGmailOauthClient();
    const state = jwt.sign(
      { sub: req.userId, purpose: "gmail-connect" },
      env.jwt.secret,
      { expiresIn: "10m" },
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: GMAIL_SCOPES,
      state,
    });

    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function gmailOauthCallback(req, res, next) {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";

    if (!code || !state) {
      return res.redirect(frontendSettingsUrl("error", "Missing code or state"));
    }

    let payload;
    try {
      payload = jwt.verify(state, env.jwt.secret);
    } catch {
      return res.redirect(frontendSettingsUrl("error", "Invalid or expired OAuth state"));
    }

    const oauth2Client = getGmailOauthClient();
    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = tokenResponse.tokens || {};

    if (!payload?.sub || payload?.purpose !== "gmail-connect") {
      return res.redirect(frontendSettingsUrl("error", "Invalid OAuth state payload"));
    }

    if (!tokens.refresh_token) {
      return res.redirect(
        frontendSettingsUrl(
          "error",
          "No refresh token returned. Revoke app access in Google Account and reconnect.",
        ),
      );
    }

    oauth2Client.setCredentials(tokens);

    let gmailAddress = "";
    try {
      const oauth2Api = google.oauth2({ version: "v2", auth: oauth2Client });
      const profile = await oauth2Api.userinfo.get();
      if (
        profile?.data?.email &&
        validator.isEmail(String(profile.data.email))
      ) {
        gmailAddress = String(profile.data.email).trim().toLowerCase();
      }
    } catch {
      // Not fatal: token storage still succeeds.
    }

    const update = {
      $set: {
        gmailRefreshTokenEnc: encryptSecret(tokens.refresh_token),
      },
    };

    if (gmailAddress) {
      update.$set.smtpUser = gmailAddress;
    }

    const user = await User.findByIdAndUpdate(payload.sub, update, {
      new: true,
    }).select("_id");

    if (!user) {
      return res.redirect(frontendSettingsUrl("error", "User not found"));
    }

    return res.redirect(frontendSettingsUrl("connected"));
  } catch (err) {
    next(err);
  }
}
