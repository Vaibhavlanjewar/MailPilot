import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

export const firebaseConfigError = missing.length
  ? `Firebase is not configured. Set ${missing.join(', ')} in client/.env and restart the dev server.`
  : null;

// Degrade instead of throwing at module scope: a config gap must not white-screen
// the public pages, it should only block sign-in.
let app = null;
let auth = null;

if (!firebaseConfigError) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
} else {
  console.error(`[firebase] ${firebaseConfigError}`);
}

export { auth };
export const googleProvider = firebaseConfigError ? null : new GoogleAuthProvider();

export default app;
