import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label } from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../services/api';
import { firebaseConfigError } from '../services/firebase';
import { getGmailConnectUrlIfNeeded } from '../services/gmailConnect';
import { PageLoader } from '../components/ui/LoadingSpinner';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function Login() {
  const { login, loginWithGoogle, consumeGoogleRedirectResult, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(firebaseConfigError || '');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // signInWithRedirect navigates the whole tab away and back — this is where
  // we pick the result back up once Firebase returns here. No-ops (resolves
  // null) on every ordinary page load that isn't a redirect return.
  useEffect(() => {
    let cancelled = false;
    consumeGoogleRedirectResult()
      .then(async (redirectedUser) => {
        if (cancelled || !redirectedUser) return;
        setGoogleLoading(true);
        // Firebase sign-in proves identity but yields no refresh token, so it
        // cannot authorise the queue to send mail later. Continue straight
        // into Google's offline consent while still in a sign-in mindset.
        const connectUrl = await getGmailConnectUrlIfNeeded();
        if (cancelled) return;
        if (connectUrl) {
          window.location.assign(connectUrl);
          return;
        }
        navigate(from, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not complete Google login');
        setGoogleLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <PageLoader />
      </div>
    );
  }

  if (getAuthToken()) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await login(normalizedEmail, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();

      // Firebase sign-in proves identity but yields no refresh token, so it cannot
      // authorise the queue to send mail later. Continue straight into Google's
      // offline consent while the user is still in a sign-in mindset.
      const connectUrl = await getGmailConnectUrlIfNeeded();
      if (connectUrl) {
        window.location.assign(connectUrl);
        return;
      }

      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google login');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-app-bg p-4">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-app-gradient text-lg font-bold text-white shadow-app-soft">
            M
          </div>
          <h1 className="text-xl font-semibold text-app">MailPilot</h1>
          <p className="text-sm text-app-muted">
            Sign in to manage campaigns
          </p>
        </div>
        <Card>
          <CardHeader title="Log in" description="Use the account you registered with." />
          {error && (
            <div className="alert-app mb-4 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="mt-2 text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[var(--primary)] hover:text-[var(--secondary)]"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={googleLoading || loading}
              onClick={handleGoogleLogin}
            >
              {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-app-muted">
            No account?{' '}
            <Link
              to="/register"
              className="font-medium text-[var(--primary)] hover:text-[var(--secondary)]"
            >
              Register
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
