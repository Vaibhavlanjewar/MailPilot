import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  GoogleAuthProvider,
  Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `EXPO_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

export const firebaseConfigError = missing.length
  ? `Firebase is not configured. Set ${missing.join(', ')} in mobile/.env and restart Expo.`
  : null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (!firebaseConfigError) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  if (Platform.OS === 'web') {
    // The RN-only build (native) ships getReactNativePersistence; the
    // browser build (Expo web) doesn't export it at all, so calling it here
    // would crash — getAuth()'s own indexedDB persistence is correct on web.
    auth = getAuth(app);
  } else {
    // Native: getAuth() alone defaults to in-memory persistence, so a
    // session wouldn't survive an app restart without this explicit store.
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} else {
  console.error(`[firebase] ${firebaseConfigError}`);
}

export { auth };
export const googleProvider = firebaseConfigError ? null : new GoogleAuthProvider();
export default app;
