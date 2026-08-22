import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { auth } from './firebase';

export const TOKEN_KEY = 'jobpilot_token';
export const USER_KEY = 'jobpilot_user';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api',
  // Mirrors client/src/services/api.js: the server's AI cascade waits up to
  // 30s for a local Ollama fallback, so the client timeout must exceed that.
  timeout: 35000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Firebase ID tokens expire after ~1h; getIdToken() refreshes them
// transparently, so always prefer it over the AsyncStorage-cached copy.
api.interceptors.request.use(async (config) => {
  let token: string | null = null;
  if (auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch {
      token = null;
    }
  }
  if (!token) {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  }
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function setAuthToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getAuthToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isTimeout =
      error?.code === 'ECONNABORTED' || /timeout/i.test(String(error?.message || ''));

    if (isTimeout) {
      Toast.show({
        type: 'error',
        text1: 'Please wait, server busy to watch IPL. Please refresh 1-2 time.',
      });
      return Promise.reject(new Error('Server busy, please retry.'));
    }

    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    }

    const message = error.response?.data?.message || error.message || 'Request failed';
    const wrapped = new Error(message);
    // @ts-expect-error attaching extra context, same pattern as the web client
    wrapped.status = error.response?.status;
    // @ts-expect-error see above
    wrapped.data = error.response?.data;
    return Promise.reject(wrapped);
  }
);

export { api };
export default api;
