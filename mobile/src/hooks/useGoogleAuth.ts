import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const PLACEHOLDER = 'unconfigured.apps.googleusercontent.com';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * expo-auth-session requires a *platform-specific* client ID on native —
 * androidClientId on Android, iosClientId on iOS — and only falls back to
 * webClientId on web itself. Passing just webClientId (which is all that
 * was configured) throws synchronously on native with "Client Id property
 * `androidClientId` must be defined to use Google auth on this platform" —
 * and since that throw happens while rendering the Login screen, it crashed
 * the entire app on launch, before any UI could show.
 */
const REQUIRED_CLIENT_ID = Platform.select({
  android: ANDROID_CLIENT_ID,
  ios: IOS_CLIENT_ID,
  default: WEB_CLIENT_ID,
});

export const googleSignInConfigError = REQUIRED_CLIENT_ID
  ? null
  : `Google sign-in is not configured for ${Platform.OS}. Set EXPO_PUBLIC_GOOGLE_${Platform.OS === 'android' ? 'ANDROID' : Platform.OS === 'ios' ? 'IOS' : 'WEB'}_CLIENT_ID in mobile/.env (and on EAS) and rebuild.`;

/**
 * Wraps expo-auth-session's Google provider so screens only deal with a
 * single onIdToken callback instead of the request/response/prompt trio.
 */
export function useGoogleAuth(onIdToken: (idToken: string) => void, onError: (message: string) => void) {
  // A syntactically-valid placeholder on every platform-specific field keeps
  // the hook from throwing at render time regardless of which are actually
  // configured; `googleSignInConfigError` is what gates whether promptAsync()
  // is allowed to actually run.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: WEB_CLIENT_ID || PLACEHOLDER,
    androidClientId: ANDROID_CLIENT_ID || PLACEHOLDER,
    iosClientId: IOS_CLIENT_ID || PLACEHOLDER,
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
