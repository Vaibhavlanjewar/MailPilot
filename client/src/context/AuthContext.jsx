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
  signInWithRedirect,
  getRedirectResult,
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

// Module-level, not component state: StrictMode double-invokes mount effects
// in dev, and it isn't documented whether Firebase's own getRedirectResult()
// is safe to call more than once per page load (some SDKs only surface the
// result to the first caller). Caching the promise here guarantees Firebase
// is only ever actually asked once per page load — every caller (real or
// StrictMode's phantom re-invoke) shares the same resolved outcome, no
// matter how Firebase's own internals behave.
let redirectResultPromise = null;
function getRedirectResultOnce(authInstance) {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(authInstance);
  }
  return redirectResultPromise;
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

  // signInWithPopup relies on postMessage/storage access between the popup
  // and the opener window. Our app's origin (the deployed Render domain)
  // differs from Firebase's own authDomain, and browsers' third-party
  // storage partitioning (Chrome, Safari ITP, etc.) blocks that cross-origin
  // channel — even a fully completed sign-in can't report its result back,
  // so Firebase's SDK falls back to reporting "popup closed by user" no
  // matter what the user actually did. signInWithRedirect sidesteps this
  // entirely by navigating the whole tab through Google and back.
  const loginWithGoogle = useCallback(async () => {
    await signInWithRedirect(requireAuth(), googleProvider);
    // Never resolves — the page navigates away before this line matters.
  }, []);

  // Called once on mount by whichever page initiated the Google redirect
  // (currently only Login) to pick up the result once Firebase navigates
  // back. Returns the signed-in user, or null if this load isn't a redirect
  // return (the common case — most page loads aren't).
  const consumeGoogleRedirectResult = useCallback(async () => {
    if (!auth) return null;
    const result = await getRedirectResultOnce(auth);
    if (!result?.user) return null;
    const session = await persistSession(result.user);
    setUser(session.user);
    return session.user;
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
      consumeGoogleRedirectResult,
      updateUser,
      logout,
    }),
    [user, ready, login, register, loginWithGoogle, consumeGoogleRedirectResult, updateUser, logout]
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
