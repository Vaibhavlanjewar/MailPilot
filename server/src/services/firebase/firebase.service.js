import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

