import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, type SessionUser } from '../api';
import { useAuth } from '../auth';
import { AuthShell } from '../components/AuthShell';
import { Notice } from '../components/ui';

type Step = 'request' | 'confirm';

/**
 * The way back in.
 *
 * Step one never says whether the address has an account — the response is the
 * same either way, so this page cannot be used to find out who is registered.
 * That is also why no code appears on screen here, even in development: read it
 * from the server terminal.
 */
export function ResetPassword() {
  const { refresh, setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown, fallback: string) => setError(err instanceof ApiError ? err.message : fallback);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password/reset-request', { email });
      setStep('confirm');
    } catch (err) {
      fail(err, 'We could not send your code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ user: SessionUser }>('/auth/password/reset', { email, code, password });
      setSession(result.user);
      await refresh();
      navigate('/portal');
    } catch (err) {
      fail(err, 'We could not reset your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Client Portal"
      title="Reset your password"
      intro={
        step === 'request'
          ? 'Enter the address you use with Genesis and we will send you a six-digit code.'
          : `If ${email} has a portal account, a six-digit code is on its way. Enter it below with a new password.`
      }
    >
      {error ? (
        <div className="mb-5">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {step === 'request' ? (
        <form onSubmit={submitRequest} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="label-caps mb-1.5 block">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending code…' : 'Send my code'}
          </button>

          <p className="text-center text-sm text-ink-soft">
            Remembered it?{' '}
            <Link to="/sign-in" className="text-brass underline underline-offset-2 hover:text-ink">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-5" noValidate>
          <div>
            <label htmlFor="code" className="label-caps mb-1.5 block">
              Six-digit code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="field text-center font-mono text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div>
            <label htmlFor="password" className="label-caps mb-1.5 block">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-2 text-xs text-ink-faint">At least 10 characters.</p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6 || password.length < 10}>
            {busy ? 'Setting your password…' : 'Set password and sign in'}
          </button>

          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => {
              setStep('request');
              setCode('');
              setError(null);
            }}
          >
            Use a different address
          </button>
        </form>
      )}
    </AuthShell>
  );
}
