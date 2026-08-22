import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleSignInConfigError = WEB_CLIENT_ID
  ? null
  : 'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env and restart Expo.';

/**
 * Wraps expo-auth-session's Google provider so screens only deal with a
 * single onIdToken callback instead of the request/response/prompt trio.
 */
export function useGoogleAuth(onIdToken: (idToken: string) => void, onError: (message: string) => void) {
  // Google.useIdTokenAuthRequest throws synchronously at construction time
  // (at least on web) when webClientId is empty, which would crash the
  // Login/Register screen on every render whenever the env var isn't set —
  // not just when the button is pressed. A syntactically-valid placeholder
  // keeps the hook from throwing; `googleSignInConfigError` is what actually
  // gates whether promptAsync() is allowed to run.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: WEB_CLIENT_ID || 'unconfigured.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params?.id_token) {
      onIdToken(response.params.id_token);
    } else if (response?.type === 'error') {
      onError(response.error?.message || 'Google sign-in failed.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return {
    ready: Boolean(request) && !googleSignInConfigError,
    promptAsync,
  };
}
