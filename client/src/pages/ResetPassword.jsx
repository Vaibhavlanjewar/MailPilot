import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label } from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import ThemeToggle from '../components/ui/ThemeToggle';
import { api, getAuthToken } from '../services/api';

const OTP_DIGITS = 6;

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  return `${name[0]}${'*'.repeat(Math.max(3, name.length - 1))}@${domain}`;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => (searchParams.get('email') || '').trim().toLowerCase(), [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState(Array.from({ length: OTP_DIGITS }, () => ''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(30);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (getAuthToken()) {
    return <Navigate to="/app" replace />;
  }

  const otp = otpDigits.join('');

  function handleOtpChange(index, value) {
    if (!/^\d?$/.test(value)) return;

    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);

    if (value && index < OTP_DIGITS - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, event) {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_DIGITS);
    if (!pasted) return;

    const next = Array.from({ length: OTP_DIGITS }, (_, idx) => pasted[idx] || '');
    setOtpDigits(next);

    const nextFocusIndex = Math.min(pasted.length, OTP_DIGITS - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (otp.length !== OTP_DIGITS) {
      setError('Enter the 6-digit OTP');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });
      toast.success(data?.message || 'Password reset successful');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      const { data } = await api.post('/auth/resend-otp', {
        email: email.trim().toLowerCase(),
        purpose: 'forgot',
      });
      toast.success(data?.message || 'OTP resent');
      setCooldown(30);
      setOtpDigits(Array.from({ length: OTP_DIGITS }, () => ''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setResending(false);
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
          <p className="text-sm text-app-muted">Create a new password</p>
        </div>

        <Card>
          <CardHeader title="Reset Password" description={email ? `Code sent to ${maskEmail(email)}` : 'Enter email, OTP, and new password.'} />

          {error && <div className="alert-app mb-4 rounded-xl px-4 py-3 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label>OTP</Label>
              <div className="grid grid-cols-6 gap-2">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    value={digit}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoFocus={index === 0}
                    className="text-center text-lg"
                    onChange={(e) => handleOtpChange(index, e.target.value.trim())}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
            >
              {resending ? 'Resending…' : cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
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
