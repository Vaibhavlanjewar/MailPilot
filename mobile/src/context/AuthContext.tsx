import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, firebaseConfigError } from '../services/firebase';
import api, { setAuthToken, USER_KEY } from '../services/api';

type SessionUser = {
  uid: string;
  email: string | null;
  name: string;
  role?: string;
};

type AuthContextValue = {
  user: SessionUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  isRecruiter: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (args: { email: string; password: string; name?: string }) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  updateUser: (next: Partial<SessionUser>) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(firebaseUser: FirebaseUser, nameOverride?: string) {
  const token = await firebaseUser.getIdToken();
  await setAuthToken(token);
  const userData: SessionUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: nameOverride || firebaseUser.displayName || '',
  };
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
  return { token, user: userData };
}

async function clearSession() {
  await setAuthToken(null);
  await AsyncStorage.removeItem(USER_KEY);
}

function requireAuth() {
  if (!auth) throw new Error(firebaseConfigError || 'Firebase not configured');
  return auth;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
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
          await clearSession();
          setUser(null);
        }
      } else {
        await clearSession();
        setUser(null);
      }
      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Role lives in Mongo, not Firebase, so it needs its own fetch once a
  // session exists. Merged into `user` so every screen can read it for free.
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
    await clearSession();
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: credentialUser } = await signInWithEmailAndPassword(requireAuth(), email, password);
    const session = await persistSession(credentialUser);
    setUser(session.user);
  }, []);

  const register = useCallback(
    async ({ email, password, name = '' }: { email: string; password: string; name?: string }) => {
      const { user: credentialUser } = await createUserWithEmailAndPassword(requireAuth(), email, password);
      if (name) {
        await updateProfile(credentialUser, { displayName: name });
      }
      const session = await persistSession(credentialUser, name);
      setUser(session.user);
    },
    []
  );

  const loginWithGoogleIdToken = useCallback(async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const { user: credentialUser } = await signInWithCredential(requireAuth(), credential);
    const session = await persistSession(credentialUser);
    setUser(session.user);
  }, []);

  const updateUser = useCallback((next: Partial<SessionUser>) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...(next || {}) } as SessionUser;
      AsyncStorage.setItem(USER_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isAuthenticated: Boolean(user),
      isRecruiter: user?.role === 'recruiter',
      login,
      register,
      loginWithGoogleIdToken,
      updateUser,
      logout,
    }),
    [user, ready, login, register, loginWithGoogleIdToken, updateUser, logout]
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
