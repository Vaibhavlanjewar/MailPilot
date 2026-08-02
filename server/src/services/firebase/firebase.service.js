import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '../../..');

let app = null;

/**
 * Credentials come from a service-account JSON file when present (keeps the
 * private key out of .env), otherwise from discrete FIREBASE_* env vars.
 */
function loadCredentials() {
  const explicitPath = env.firebase.serviceAccountPath;
  const candidates = [
    explicitPath && path.resolve(SERVER_ROOT, explicitPath),
    path.join(SERVER_ROOT, 'firebase.json'),
  ].filter(Boolean);

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (json.type !== 'service_account' || !json.private_key) continue;
      return {
        source: file,
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      };
    } catch (err) {
      logger.error('Could not parse Firebase service account file', {
        file,
        error: err.message,
      });
    }
  }

  if (env.firebase.privateKey && env.firebase.projectId && env.firebase.clientEmail) {
    return {
      source: 'env',
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    };
  }

  return null;
}

export function getFirebaseAdmin() {
  if (app) return app;

  const [existing] = getApps();
  if (existing) {
    app = existing;
    return app;
  }

  const creds = loadCredentials();
  if (!creds) return null;

  // A token's `aud` claim is the project that minted it. If the Admin SDK runs
  // under a different project every verifyIdToken call fails with a confusing
  // "incorrect audience" error, so surface the misconfiguration up front.
  const clientProject = env.firebase.projectId;
  if (clientProject && creds.projectId && clientProject !== creds.projectId) {
    logger.error(
      `Firebase project mismatch: credentials are for "${creds.projectId}" but FIREBASE_PROJECT_ID is "${clientProject}". ` +
        'The browser SDK and Admin SDK must use the same project or every login will be rejected.',
      { credentialSource: creds.source },
    );
  }

  try {
    app = initializeApp({
      credential: cert({
        projectId: creds.projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey,
      }),
    });
    logger.info('Firebase Admin initialized', {
      projectId: creds.projectId,
      credentialSource: creds.source === 'env' ? 'env vars' : path.basename(creds.source),
    });
    return app;
  } catch (err) {
    logger.error('Firebase Admin init failed', { error: err.message });
    return null;
  }
}

export function verifyFirebaseToken(idToken) {
  const adminApp = getFirebaseAdmin();
  if (!adminApp) {
    throw new Error('Firebase Admin is not configured');
  }
  return getAuth(adminApp).verifyIdToken(idToken);
}

function getBucket() {
  const adminApp = getFirebaseAdmin();
  if (!adminApp || !env.firebase.storageBucket) return null;
  try {
    return getStorage(adminApp).bucket(env.firebase.storageBucket);
  } catch (err) {
    logger.error('Firebase Storage unavailable', { error: err.message });
    return null;
  }
}

export function isStorageConfigured() {
  return Boolean(env.firebase.storageBucket && getFirebaseAdmin());
}

/**
 * Stores a resume binary at a deterministic path so re-uploading overwrites the
 * previous file instead of accumulating orphans.
 *
 * @returns {Promise<{storagePath: string, fileUrl: string} | null>}
 */
export async function uploadResumeFile(userId, buffer, { fileName, mimeType }) {
  const bucket = getBucket();
  if (!bucket) return null;

  const extension = (fileName?.split('.').pop() || 'pdf').toLowerCase();
  const storagePath = `resumes/${userId}/resume.${extension}`;

  try {
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType: mimeType || 'application/pdf',
      resumable: false,
      metadata: { metadata: { originalName: fileName || '' } },
    });
    return { storagePath, fileUrl: `gs://${bucket.name}/${storagePath}` };
  } catch (err) {
    logger.error('Resume upload to Firebase Storage failed', { error: err.message });
    return null;
  }
}

export async function downloadResumeFile(storagePath) {
  const bucket = getBucket();
  if (!bucket || !storagePath) return null;
  try {
    const [buffer] = await bucket.file(storagePath).download();
    return buffer;
  } catch (err) {
    logger.error('Resume download from Firebase Storage failed', {
      storagePath,
      error: err.message,
    });
    return null;
  }
}

/** Best-effort delete; a missing object is treated as already gone. */
export async function deleteResumeFile(storagePath) {
  const bucket = getBucket();
  if (!bucket || !storagePath) return false;
  try {
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
    return true;
  } catch (err) {
    logger.error('Resume delete from Firebase Storage failed', {
      storagePath,
      error: err.message,
    });
    return false;
  }
}
