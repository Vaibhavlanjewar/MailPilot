import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label } from '../components/ui/Input';
import ThemeToggle from '../components/ui/ThemeToggle';
import { getAuthToken } from '../services/api';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, firebaseConfigError } from '../services/firebase';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (getAuthToken()) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!auth) throw new Error(firebaseConfigError);
      const normalizedEmail = email.trim().toLowerCase();
      await sendPasswordResetEmail(auth, normalizedEmail);
      toast.success('Password reset email sent. Please check your inbox.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
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
          <p className="text-sm text-app-muted">Reset your password</p>
        </div>

        <Card>
          <CardHeader title="Forgot Password" description="We'll send an OTP to your email." />
          {error && <div className="alert-app mb-4 rounded-xl px-4 py-3 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-app-muted">
            Back to{' '}
            <Link to="/login" className="font-medium text-[var(--primary)] hover:text-[var(--secondary)]">
              Login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
