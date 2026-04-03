import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../services/api';
import { PageLoader } from '../components/ui/LoadingSpinner';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function Register() {
  const { register, ready } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
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
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <p className="text-sm text-app-muted">Create an account</p>
        </div>
        <Card>
          <CardHeader title="Register" description="Password must be at least 8 characters." />
          {error && (
            <div className="alert-app mb-4 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-app-muted">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-[var(--primary)] hover:text-[var(--secondary)]"
            >
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
