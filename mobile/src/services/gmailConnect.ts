import api from './api';

/**
 * Returns the Google consent URL when the account still has no Gmail refresh
 * token, or null when sending is already authorised (or the server has no
 * Gmail OAuth credentials configured, which must not block signing in).
 * Mirrors client/src/services/gmailConnect.js exactly.
 */
export async function getGmailConnectUrlIfNeeded(): Promise<string | null> {
  try {
    const { data: settings } = await api.get('/users/me/settings');
    if (settings?.hasGmailRefreshToken) return null;

    const { data } = await api.get('/users/me/gmail/connect-url');
    return data?.url || null;
  } catch {
    return null;
  }
}
