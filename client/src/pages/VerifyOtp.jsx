import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label } from '../components/ui/Input';
import ThemeToggle from '../components/ui/ThemeToggle';
import { api, getAuthToken } from '../services/api';

const OTP_DIGITS = 6;

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  return `${name[0]}${'*'.repeat(Math.max(3, name.length - 1))}@${domain}`;
}

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = useMemo(() => (searchParams.get('email') || '').trim().toLowerCase(), [searchParams]);
  const purpose = searchParams.get('purpose') === 'forgot' ? 'forgot' : 'register';

  const [otpDigits, setOtpDigits] = useState(Array.from({ length: OTP_DIGITS }, () => ''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [error, setError] = useState('');

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

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg p-4">
        <Card className="w-full max-w-md">
          <CardHeader title="Invalid verification request" description="Email is missing." />
          <Link to="/register" className="text-sm font-medium text-[var(--primary)] hover:text-[var(--secondary)]">
            Go back to register
          </Link>
        </Card>
      </div>
    );
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

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp, purpose });
      toast.success(data?.message || 'Account verified successfully');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      const { data } = await api.post('/auth/resend-otp', { email, purpose });
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
          <p className="text-sm text-app-muted">Verify your account</p>
        </div>

        <Card>
          <CardHeader title="OTP Verification" description={`Code sent to ${maskEmail(email)}`} />

          {error && <div className="alert-app mb-4 rounded-xl px-4 py-3 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Enter OTP</Label>
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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Verifying…' : 'Verify OTP'}
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
