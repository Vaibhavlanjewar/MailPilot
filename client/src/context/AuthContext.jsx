import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, firebaseConfigError } from '../services/firebase';
import api, {
  setAuthToken,
  getAuthToken,
  USER_KEY,
} from '../services/api';

const AuthContext = createContext(null);

async function persistSession(firebaseUser, nameOverride) {
  const token = await firebaseUser.getIdToken();
  setAuthToken(token);
  const userData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: nameOverride || firebaseUser.displayName || '',
  };
  localStorage.setItem(USER_KEY, JSON.stringify(userData));
  return { token, user: userData };
}

function clearSession() {
  setAuthToken(null);
  localStorage.removeItem(USER_KEY);
}

function requireAuth() {
  if (!auth) throw new Error(firebaseConfigError);
  return auth;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      clearSession();
      setReady(true);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const { user: userData } = await persistSession(firebaseUser);
          setUser(userData);
        } catch {
          clearSession();
          setUser(null);
        }
      } else {
        clearSession();
        setUser(null);
      }
      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Role lives in Mongo, not Firebase, so it needs its own fetch once a
  // session exists. Merged into `user` so every page can read it for free.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    api
      .get('/users/me/settings')
      .then(({ data }) => {
        if (!cancelled && data?.role) updateUser({ role: data.role });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const logout = useCallback(async () => {
    if (auth) await signOut(auth);
    clearSession();
    setUser(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: credentialUser } = await signInWithEmailAndPassword(requireAuth(), email, password);
    const session = await persistSession(credentialUser);
    setUser(session.user);
    return session;
  }, []);

  const register = useCallback(async ({ email, password, name = '' }) => {
    const { user: credentialUser } = await createUserWithEmailAndPassword(requireAuth(), email, password);
    if (name) {
      await updateProfile(credentialUser, { displayName: name });
    }
    const session = await persistSession(credentialUser, name);
    setUser(session.user);
    return session;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const { user: credentialUser } = await signInWithPopup(requireAuth(), googleProvider);
    const session = await persistSession(credentialUser);
    setUser(session.user);
    return session;
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
      isRecruiter: user?.role === 'recruiter',
      login,
      register,
      loginWithGoogle,
      updateUser,
      logout,
    }),
    [user, ready, login, register, loginWithGoogle, updateUser, logout]
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
