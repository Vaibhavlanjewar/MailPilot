import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { encryptSecret } from '../utils/secretCrypto.js';
import { logger } from '../utils/logger.js';

const GOOGLE_LOGIN_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
];

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
    const { email, password, name = '' } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name });

    const token = signToken(user._id.toString());
    logger.info('User registered', { userId: user._id });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
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
      },
    });
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
