import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { google } from 'googleapis';
import { User } from '../models/User.js';
import { Otp } from '../models/Otp.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { encryptSecret } from '../utils/secretCrypto.js';
import { logger } from '../utils/logger.js';
import { sendOtpEmail } from '../services/email/gmailOtp.service.js';

const GOOGLE_LOGIN_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
];

const OTP_EXPIRY_MS = env.auth.otpExpiryMs;
const OTP_RESEND_COOLDOWN_MS = env.auth.otpResendCooldownMs;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function maskEmail(email) {
  const [localPart, domain] = normalizeEmail(email).split('@');
  if (!localPart || !domain) return '';
  const first = localPart.charAt(0);
  const masked = `${first}${'*'.repeat(Math.max(3, localPart.length - 1))}`;
  return `${masked}@${domain}`;
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto
    .createHmac('sha256', env.jwt.secret)
    .update(String(otp).trim())
    .digest('hex');
}

function compareHashHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function isStrongPassword(password) {
  const value = String(password || '');
  return (
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function secondsUntilAllowed(lastSentAt) {
  const elapsed = Date.now() - new Date(lastSentAt).getTime();
  const remainingMs = Math.max(0, OTP_RESEND_COOLDOWN_MS - elapsed);
  return Math.ceil(remainingMs / 1000);
}

async function issueOtp({ email, purpose, context = {} }) {
  const otp = generateOtp();
  const now = new Date();
  const otpDoc = await Otp.findOne({ email, purpose }).select('lastSentAt context');

  if (otpDoc?.lastSentAt) {
    const remaining = secondsUntilAllowed(otpDoc.lastSentAt);
    if (remaining > 0) {
      throw new AppError(`Please wait ${remaining}s before requesting a new OTP`, 429);
    }
  }

  const payload = {
    otp: hashOtp(otp),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    lastSentAt: now,
    ...(Object.keys(context).length ? { context } : {}),
  };

  await Otp.findOneAndUpdate(
    { email, purpose },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await sendOtpEmail({ to: email, otp });

  return {
    maskedEmail: maskEmail(email),
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    resendAfterSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function getGmailOauthClient() {
  const { clientId, clientSecret, redirectUri } = env.email.gmail;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AppError(
      'Missing Gmail OAuth config. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.',
      503,
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function frontendGoogleCallbackUrl(params = {}) {
  const base = `${env.frontendUrl || 'http://localhost:5173'}`.replace(/\/$/, '');
  const url = new URL(`${base}/login/google/callback`);

  if (params.token) url.searchParams.set('token', params.token);
  if (params.id) url.searchParams.set('id', params.id);
  if (params.email) url.searchParams.set('email', params.email);
  if (params.name) url.searchParams.set('name', params.name);
  if (params.from) url.searchParams.set('from', params.from);
  if (params.error) url.searchParams.set('error', params.error);

  return url.toString();
}

export async function register(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, name = '' } = req.body;

    if (!isStrongPassword(password)) {
      throw new AppError(
        'Password must be at least 8 chars and include uppercase, lowercase, number, and special character',
        422,
      );
    }

    const existing = await User.findOne({ email });
    if (existing && existing.isVerified !== false) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const meta = await issueOtp({
      email,
      purpose: 'register',
      context: {
        name: String(name || '').trim(),
        passwordHash,
      },
    });

    logger.info('Registration OTP sent', { email });

    res.status(202).json({
      message: 'OTP sent to your email',
      purpose: 'register',
      email: meta.maskedEmail,
      expiresIn: meta.expiresInSeconds,
      resendAfter: meta.resendAfterSeconds,
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const purpose = req.body.purpose === 'forgot' ? 'forgot' : 'register';

    const otpDoc = await Otp.findOne({ email, purpose }).select('+otp +context.passwordHash context.name expiresAt');

    if (!otpDoc) {
      throw new AppError('No OTP request found for this email', 404);
    }

    if (new Date(otpDoc.expiresAt).getTime() < Date.now()) {
      await Otp.deleteOne({ _id: otpDoc._id });
      throw new AppError('OTP expired. Please request a new OTP', 400);
    }

    const validOtp = compareHashHex(hashOtp(otp), otpDoc.otp);
    if (!validOtp) {
      throw new AppError('Invalid OTP', 400);
    }

    if (purpose === 'forgot') {
      return res.json({ message: 'OTP verified successfully' });
    }

    if (!otpDoc?.context?.passwordHash) {
      throw new AppError('Registration session is incomplete. Please register again.', 400);
    }

    let user = await User.findOne({ email }).select('+passwordHash');
    if (user && user.isVerified !== false) {
      await Otp.deleteMany({ email, purpose: 'register' });
      throw new AppError('Email already registered', 409);
    }

    if (user) {
      user.name = otpDoc.context.name || user.name || '';
      user.passwordHash = otpDoc.context.passwordHash;
      user.isVerified = true;
      await user.save();
    } else {
      user = await User.create({
        email,
        name: otpDoc.context.name || '',
        passwordHash: otpDoc.context.passwordHash,
        isVerified: true,
      });
    }

    await Otp.deleteMany({ email, purpose: 'register' });

    logger.info('User verified via OTP', { userId: user._id, email });

    res.json({
      message: 'Account verified successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function resendOtp(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const purpose = req.body.purpose === 'forgot' ? 'forgot' : 'register';

    let context = {};
    if (purpose === 'register') {
      const existingOtp = await Otp.findOne({ email, purpose }).select('context.name +context.passwordHash lastSentAt');
      if (!existingOtp?.context?.passwordHash) {
        throw new AppError('No pending registration found. Please register again.', 404);
      }
      context = {
        name: existingOtp.context.name || '',
        passwordHash: existingOtp.context.passwordHash,
      };
    } else {
      const user = await User.findOne({ email }).select('_id isVerified');
      if (!user || user.isVerified === false) {
        throw new AppError('No verified account found for this email', 404);
      }
    }

    const meta = await issueOtp({ email, purpose, context });
    logger.info('OTP resent', { email, purpose });

    res.status(202).json({
      message: 'OTP resent successfully',
      purpose,
      email: meta.maskedEmail,
      expiresIn: meta.expiresInSeconds,
      resendAfter: meta.resendAfterSeconds,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (user.isVerified === false) {
      const meta = await issueOtp({
        email,
        purpose: 'register',
        context: {
          name: user.name || '',
          passwordHash: user.passwordHash,
        },
      });

      logger.info('Login blocked for unverified user; OTP sent', { userId: user._id, email });

      return res.status(403).json({
        message: 'Email not verified. OTP sent to your email.',
        requiresOtp: true,
        purpose: 'register',
        email: meta.maskedEmail,
        expiresIn: meta.expiresInSeconds,
        resendAfter: meta.resendAfterSeconds,
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user._id.toString());
    logger.info('User login', { userId: user._id });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified !== false,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email }).select('_id isVerified');

    if (!user || user.isVerified === false) {
      // Anti-enumeration: return the same outward behavior for unknown emails.
      return res.status(202).json({
        message: 'OTP sent',
        purpose: 'forgot',
        email: maskEmail(email),
        expiresIn: Math.floor(OTP_EXPIRY_MS / 1000),
        resendAfter: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
      });
    }

    const meta = await issueOtp({ email, purpose: 'forgot' });
    logger.info('Forgot password OTP sent', { email });

    res.status(202).json({
      message: 'OTP sent',
      purpose: 'forgot',
      email: meta.maskedEmail,
      expiresIn: meta.expiresInSeconds,
      resendAfter: meta.resendAfterSeconds,
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const { newPassword } = req.body;

    if (!isStrongPassword(newPassword)) {
      throw new AppError(
        'Password must be at least 8 chars and include uppercase, lowercase, number, and special character',
        422,
      );
    }

    const otpDoc = await Otp.findOne({ email, purpose: 'forgot' }).select('+otp expiresAt');
    if (!otpDoc) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    if (new Date(otpDoc.expiresAt).getTime() < Date.now()) {
      await Otp.deleteOne({ _id: otpDoc._id });
      throw new AppError('OTP expired. Please request a new OTP', 400);
    }

    if (!compareHashHex(hashOtp(otp), otpDoc.otp)) {
      throw new AppError('Invalid OTP', 400);
    }

    const user = await User.findOne({ email }).select('+passwordHash isVerified');
    if (!user || user.isVerified === false) {
      throw new AppError('Invalid or expired OTP', 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    await Otp.deleteMany({ email, purpose: 'forgot' });
    logger.info('Password reset successful', { userId: user._id, email });

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

export async function getGoogleLoginUrl(req, res, next) {
  try {
    const oauth2Client = getGmailOauthClient();
    const fromParam = typeof req.query.from === 'string' ? req.query.from : '';
    const from = fromParam.startsWith('/') ? fromParam : '/app';

    const state = jwt.sign(
      { purpose: 'google-login', from },
      env.jwt.secret,
      { expiresIn: '10m' },
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GOOGLE_LOGIN_SCOPES,
      state,
    });

    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function googleOauthCallback(req, res, next) {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !state) {
      return res.redirect(frontendGoogleCallbackUrl({ error: 'Missing code or state' }));
    }

    let payload;
    try {
      payload = jwt.verify(state, env.jwt.secret);
    } catch {
      return res.redirect(frontendGoogleCallbackUrl({ error: 'Invalid or expired OAuth state' }));
    }

    if (payload?.purpose !== 'google-login') {
      return res.redirect(frontendGoogleCallbackUrl({ error: 'Invalid OAuth state payload' }));
    }

    const oauth2Client = getGmailOauthClient();
    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = tokenResponse.tokens || {};
    oauth2Client.setCredentials(tokens);

    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2Client });
    const profile = await oauth2Api.userinfo.get();
    const email = String(profile?.data?.email || '').trim().toLowerCase();
    const name = String(profile?.data?.name || '').trim();

    if (!email) {
      return res.redirect(frontendGoogleCallbackUrl({ error: 'Google account email is missing' }));
    }

    const existingUser = await User.findOne({ email }).select('_id email name smtpUser gmailRefreshTokenEnc');

    if (!existingUser && !tokens.refresh_token) {
      return res.redirect(
        frontendGoogleCallbackUrl({
          error:
            'No refresh token returned. Remove this app from Google Account access and try again.',
        }),
      );
    }

    let user = existingUser;
    if (!user) {
      const passwordHash = await bcrypt.hash(`google-oauth-${Date.now()}-${Math.random()}`, 12);
      user = await User.create({
        email,
        name,
        passwordHash,
        isVerified: true,
        smtpUser: email,
        ...(tokens.refresh_token
          ? { gmailRefreshTokenEnc: encryptSecret(tokens.refresh_token) }
          : {}),
      });
    } else {
      let changed = false;
      if (!user.name && name) {
        user.name = name;
        changed = true;
      }
      if (!user.smtpUser) {
        user.smtpUser = email;
        changed = true;
      }
      if (user.isVerified === false) {
        user.isVerified = true;
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
        name: user.name || '',
        from: typeof payload?.from === 'string' && payload.from.startsWith('/') ? payload.from : '/app',
      }),
    );
  } catch (err) {
    next(err);
  }
}
