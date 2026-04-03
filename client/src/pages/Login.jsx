import { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../services/api';
import { PageLoader } from '../components/ui/LoadingSpinner';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function Login() {
  const { login, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
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
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
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
