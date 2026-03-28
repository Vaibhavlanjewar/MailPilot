import validator from 'validator';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { encryptSecret } from '../utils/secretCrypto.js';

function settingsPayload(user) {
  return {
    email: user.email,
    name: user.name || '',
    smtpUser: user.smtpUser || '',
    smtpFromDisplayName: user.smtpFromDisplayName || '',
    hasSmtpAppPassword: Boolean(user.smtpAppPasswordEnc),
  };
}

export async function getSettings(req, res, next) {
  try {
    const user = await User.findById(req.userId)
      .select('email name smtpUser smtpFromDisplayName smtpAppPasswordEnc')
      .lean();

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json(settingsPayload(user));
  } catch (err) {
    next(err);
  }
}

/**
 * Body (all optional except at least one update):
 * - smtpUser: string — SMTP login email; "" clears (use account email)
 * - smtpFromDisplayName: string — From display name (e.g. MailChips)
 * - smtpAppPassword: string — "" removes; omit to leave unchanged
 */
export async function updateSettings(req, res, next) {
  try {
    if (env.nodeEnv === 'production' && !process.env.SMTP_CREDENTIALS_ENCRYPTION_KEY) {
      throw new AppError(
        'Server is not configured to store app passwords (set SMTP_CREDENTIALS_ENCRYPTION_KEY)',
        503
      );
    }

    const { smtpUser, smtpFromDisplayName, smtpAppPassword } = req.body;

    if (
      smtpUser === undefined &&
      smtpFromDisplayName === undefined &&
      smtpAppPassword === undefined
    ) {
      throw new AppError(
        'Send at least one of: smtpUser, smtpFromDisplayName, smtpAppPassword',
        422
      );
    }

    const $set = {};
    const $unset = {};

    if (smtpUser !== undefined) {
      if (typeof smtpUser !== 'string') {
        throw new AppError('smtpUser must be a string', 422);
      }
      const u = smtpUser.trim().toLowerCase();
      if (u === '') {
        $unset.smtpUser = 1;
      } else if (!validator.isEmail(u)) {
        throw new AppError('smtpUser must be a valid email', 422);
      } else {
        $set.smtpUser = u;
      }
    }

    if (smtpFromDisplayName !== undefined) {
      if (typeof smtpFromDisplayName !== 'string') {
        throw new AppError('smtpFromDisplayName must be a string', 422);
      }
      $set.smtpFromDisplayName = smtpFromDisplayName.trim();
    }

    if (smtpAppPassword !== undefined) {
      if (typeof smtpAppPassword !== 'string') {
        throw new AppError('smtpAppPassword must be a string', 422);
      }
      const trimmed = smtpAppPassword.replace(/\s/g, '');
      if (trimmed === '') {
        $unset.smtpAppPasswordEnc = 1;
      } else if (trimmed.length < 16) {
        throw new AppError(
          'Gmail app password must be at least 16 characters (spaces ignored)',
          422
        );
      } else {
        $set.smtpAppPasswordEnc = encryptSecret(trimmed);
      }
    }

    const update = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    if (!Object.keys(update).length) {
      throw new AppError('No fields to update', 422);
    }

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
    }).select('email name smtpUser smtpFromDisplayName smtpAppPasswordEnc');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json(settingsPayload(user));
  } catch (err) {
    next(err);
  }
}
