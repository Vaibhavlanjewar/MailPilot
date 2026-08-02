import axios from 'axios';
import { toast } from 'react-toastify';
import { auth } from './firebase';

export const TOKEN_KEY = 'mailpilot_token';
export const USER_KEY = 'mailpilot_user';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // The server's own AI cascade waits up to 30s for a local Ollama fallback;
  // a shorter client timeout would abort requests the server was about to fulfil.
  timeout: 35000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Firebase ID tokens expire after ~1h; getIdToken() refreshes them transparently,
// so always prefer it over the cached copy in localStorage.
api.interceptors.request.use(async (config) => {
  let token = null;
  if (auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      token = null;
    }
  }
  if (!token && typeof localStorage !== 'undefined') {
    token = localStorage.getItem(TOKEN_KEY);
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isTimeout =
      error?.code === 'ECONNABORTED' ||
      /timeout/i.test(String(error?.message || ''));

    if (isTimeout) {
      const busyMessage =
        'Please wait, server busy to watch IPL. Please refresh 1-2 time.';
      if (!toast.isActive('server-timeout-busy')) {
        toast.error(busyMessage, { toastId: 'server-timeout-busy' });
      }
      return Promise.reject(new Error(busyMessage));
    }

    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      const path = window.location.pathname;
      if (
        !path.startsWith('/login') &&
        !path.startsWith('/register') &&
        !path.startsWith('/forgot-password')
      ) {
        window.location.href = '/';
      }
    }
    const message =
      error.response?.data?.message || error.message || 'Request failed';
    const wrapped = new Error(message);
    wrapped.status = error.response?.status;
    wrapped.data = error.response?.data;
    return Promise.reject(wrapped);
  }
);

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates an API response with mock data (for UI development).
 * @template T
 * @param {T} data
 * @param {number} [ms=700]
 * @returns {Promise<T>}
 */
export async function mockRequest(data, ms = 700) {
  await delay(ms);
  return structuredClone(data);
}

export { api };
export default api;
