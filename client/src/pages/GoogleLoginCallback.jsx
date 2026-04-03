import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../services/api';
import Card from '../components/ui/Card';

export default function GoogleLoginCallback() {
  const { completeOAuthLogin, ready } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;

    const token = searchParams.get('token') || '';
    const id = searchParams.get('id') || '';
    const email = searchParams.get('email') || '';
    const name = searchParams.get('name') || '';
    const from = searchParams.get('from') || '/app';
    const oauthError = searchParams.get('error') || '';

    if (oauthError) {
      setError(oauthError);
      return;
    }

    try {
      completeOAuthLogin({
        token,
        user: { id, email, name },
      });
      navigate(from.startsWith('/') ? from : '/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
    }
  }, [ready, searchParams, completeOAuthLogin, navigate]);

  if (getAuthToken() && !error) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-app-bg p-4">
      <Card className="w-full max-w-md p-6 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-app">Google sign-in failed</h1>
            <p className="mt-2 text-sm text-app-muted">{error}</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
              onClick={() => navigate('/login', { replace: true })}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-app">Signing you in</h1>
            <p className="mt-2 text-sm text-app-muted">Please wait while we finish Google login.</p>
          </>
        )}
      </Card>
    </div>
  );
}
