import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  api,
  setAuthToken,
  getAuthToken,
  USER_KEY,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const raw = localStorage.getItem(USER_KEY);
    if (token && raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem(USER_KEY);
        setAuthToken(null);
        setUser(null);
      }
    } else if (!token) {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAuthToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async ({ email, password, name = '' }) => {
    const { data } = await api.post('/auth/register', { email, password, name });
    setAuthToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...(nextUser || {}) };
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(getAuthToken() && user),
      login,
      register,
      updateUser,
      logout,
    }),
    [user, ready, login, register, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
