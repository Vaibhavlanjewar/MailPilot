import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;

function getKey() {
  const hex = process.env.SMTP_CREDENTIALS_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  if (env.nodeEnv === 'production') {
    throw new Error(
      'SMTP_CREDENTIALS_ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production'
    );
  }
  return crypto.scryptSync(env.jwt.secret, 'mailpilot-smtp-cred-v1', 32);
}

/**
 * @param {string} plain
 * @returns {string} base64 blob
 */
export function encryptSecret(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * @param {string | undefined | null} blob
 * @returns {string | null}
 */
export function decryptSecret(blob) {
  if (!blob || typeof blob !== 'string') return null;
  try {
    const buf = Buffer.from(blob, 'base64');
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8'
    );
  } catch {
    return null;
  }
}

const PIN_SALT_LEN = 16;
const PIN_HASH_LEN = 32;

/**
 * One-way hash for the security PIN (scrypt + per-PIN random salt). Unlike
 * encryptSecret above, a PIN only ever needs to be *verified*, never read
 * back — hashing is the correct primitive here, not reversible encryption.
 */
export function hashPin(pin) {
  const salt = crypto.randomBytes(PIN_SALT_LEN);
  const hash = crypto.scryptSync(String(pin), salt, PIN_HASH_LEN);
  return Buffer.concat([salt, hash]).toString('base64');
}

export function verifyPin(pin, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  try {
    const buf = Buffer.from(storedHash, 'base64');
    if (buf.length !== PIN_SALT_LEN + PIN_HASH_LEN) return false;
    const salt = buf.subarray(0, PIN_SALT_LEN);
    const expected = buf.subarray(PIN_SALT_LEN);
    const actual = crypto.scryptSync(String(pin), salt, PIN_HASH_LEN);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
