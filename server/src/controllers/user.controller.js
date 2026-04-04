import validator from "validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { encryptSecret } from "../utils/secretCrypto.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function isStrongPassword(password) {
  const value = String(password || "");
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

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

function frontendGoogleCallbackUrl(params = {}) {
  const base = `${env.frontendUrl || "http://localhost:5173"}`.replace(/\/$/, "");
  const url = new URL(`${base}/login/google/callback`);

  if (params.token) url.searchParams.set("token", params.token);
  if (params.id) url.searchParams.set("id", params.id);
  if (params.email) url.searchParams.set("email", params.email);
  if (params.name) url.searchParams.set("name", params.name);
  if (params.from) url.searchParams.set("from", params.from);
  if (params.error) url.searchParams.set("error", params.error);

  return url.toString();
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function settingsPayload(user) {
  return {
    email: user.email,
    name: user.name || "",
    smtpUser: user.smtpUser || "",
    smtpFromDisplayName: user.smtpFromDisplayName || "",
    hasSmtpAppPassword: Boolean(user.smtpAppPasswordEnc),
    hasGmailRefreshToken: Boolean(user.gmailRefreshTokenEnc),
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
        "email name smtpUser smtpFromDisplayName smtpAppPasswordEnc gmailRefreshTokenEnc",
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
    const { name, email } = req.body;
    if (name === undefined && email === undefined) {
      throw new AppError("Send at least one of: name, email", 422);
    }

    const update = {};

    if (name !== undefined) {
      if (typeof name !== "string") {
        throw new AppError("name must be a string", 422);
      }
      update.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string") {
        throw new AppError("email must be a string", 422);
      }
      const normalized = email.trim().toLowerCase();
      if (!validator.isEmail(normalized)) {
        throw new AppError("email must be valid", 422);
      }

      const conflict = await User.findOne({
        email: normalized,
        _id: { $ne: req.userId },
      })
        .select("_id")
        .lean();
      if (conflict) {
        throw new AppError("Email already in use", 409);
      }
      update.email = normalized;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: update },
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

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new AppError("currentPassword and newPassword are required", 422);
    }
    if (!isStrongPassword(newPassword)) {
      throw new AppError(
        "newPassword must be at least 8 chars and include uppercase, lowercase, number, and special character",
        422,
      );
    }

    const user = await User.findById(req.userId).select("+passwordHash");
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError("Current password is incorrect", 401);
    }

    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new AppError("New password must be different", 422);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: "Password changed successfully" });
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
    } = req.body;

    if (
      smtpUser === undefined &&
      smtpFromDisplayName === undefined &&
      smtpAppPassword === undefined &&
      gmailRefreshToken === undefined
    ) {
      throw new AppError(
        "Send at least one of: smtpUser, smtpFromDisplayName, smtpAppPassword, gmailRefreshToken",
        422,
      );
    }

    const $set = {};
    const $unset = {};

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
      "email name smtpUser smtpFromDisplayName smtpAppPasswordEnc gmailRefreshTokenEnc",
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.json(settingsPayload(user));
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

    if (payload?.purpose === "google-login") {
      oauth2Client.setCredentials(tokens);

      let googleEmail = "";
      let googleName = "";
      try {
        const oauth2Api = google.oauth2({ version: "v2", auth: oauth2Client });
        const profile = await oauth2Api.userinfo.get();
        if (profile?.data?.email && validator.isEmail(String(profile.data.email))) {
          googleEmail = String(profile.data.email).trim().toLowerCase();
        }
        if (typeof profile?.data?.name === "string") {
          googleName = profile.data.name.trim();
        }
      } catch {
        return res.redirect(frontendGoogleCallbackUrl({ error: "Could not read Google account profile" }));
      }

      if (!googleEmail) {
        return res.redirect(frontendGoogleCallbackUrl({ error: "Google account email is missing" }));
      }

      let user = await User.findOne({ email: googleEmail }).select(
        "_id email name smtpUser gmailRefreshTokenEnc",
      );

      if (!user && !tokens.refresh_token) {
        return res.redirect(
          frontendGoogleCallbackUrl({
            error:
              "No refresh token returned. Remove app access from your Google account and try again.",
          }),
        );
      }

      if (!user) {
        const passwordHash = await bcrypt.hash(
          `google-oauth-${Date.now()}-${Math.random()}`,
          12,
        );
        user = await User.create({
          email: googleEmail,
          name: googleName,
          passwordHash,
          smtpUser: googleEmail,
          ...(tokens.refresh_token
            ? { gmailRefreshTokenEnc: encryptSecret(tokens.refresh_token) }
            : {}),
        });
      } else {
        let changed = false;
        if (!user.name && googleName) {
          user.name = googleName;
          changed = true;
        }
        if (!user.smtpUser) {
          user.smtpUser = googleEmail;
          changed = true;
        }
        if (tokens.refresh_token) {
          user.gmailRefreshTokenEnc = encryptSecret(tokens.refresh_token);
          changed = true;
        }
        if (changed) {
          await user.save();
        }
      }

      const token = signToken(user._id.toString());
      return res.redirect(
        frontendGoogleCallbackUrl({
          token,
          id: user._id.toString(),
          email: user.email,
          name: user.name || "",
          from:
            typeof payload?.from === "string" && payload.from.startsWith("/")
              ? payload.from
              : "/app",
        }),
      );
    }

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
