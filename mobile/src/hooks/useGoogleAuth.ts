import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleSignInConfigError = WEB_CLIENT_ID
  ? null
  : 'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (and on EAS) and rebuild.';

/**
 * Native Google Sign-In (Play Services) rather than the browser-based
 * expo-auth-session flow this used to run.
 *
 * The browser flow redirected through a custom URI scheme, and Google now
 * rejects that for Android OAuth clients outright — "Access blocked ...
 * Custom URI scheme is not enabled for your Android client" — a project-level
 * policy no app-side redirect config can satisfy. Play Services never leaves
 * the app, so there is no redirect URI to be blocked.
 *
 * `webClientId` is deliberately the *web* client, not the Android one: it sets
 * the audience of the returned ID token, and Firebase only accepts tokens
 * minted for the web client. The Android client still has to exist in the same
 * GCP project with this app's package name and signing SHA-1 — that is what
 * authorises the device — but it is never passed here.
 */
if (WEB_CLIENT_ID) {
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
}

function describeError(err: unknown): string {
  if (isErrorWithCode(err)) {
    switch (err.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return '';
      case statusCodes.IN_PROGRESS:
        return 'A sign-in is already in progress.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is unavailable or out of date on this device.';
      default:
        break;
    }
  }
  return err instanceof Error ? err.message : 'Google sign-in failed.';
}

/**
 * Wraps the sign-in call so screens only deal with a single onIdToken
 * callback instead of driving the SDK themselves. Keeps the same shape the
 * expo-auth-session version exposed, so the calling screens are unchanged.
 */
export function useGoogleAuth(
  onIdToken: (idToken: string) => void,
  onError: (message: string) => void
) {
  const [busy, setBusy] = useState(false);

  const promptAsync = useCallback(async () => {
    if (googleSignInConfigError) {
      onError(googleSignInConfigError);
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS === 'android') {
        // Surfaces the "update Play Services" prompt instead of failing with
        // an opaque native error on devices where it's missing or stale.
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') return; // user dismissed the picker

      const idToken = response.data?.idToken;
      if (!idToken) {
        onError('Google did not return an ID token. Check the web client ID configuration.');
        return;
      }
      onIdToken(idToken);
    } catch (err) {
      const message = describeError(err);
      if (message) onError(message); // empty = user cancelled, not worth a toast
    } finally {
      setBusy(false);
    }
  }, [onIdToken, onError]);

  return {
    ready: !googleSignInConfigError && !busy,
    promptAsync,
  };
}
