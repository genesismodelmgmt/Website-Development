import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { AuthShell } from '../components/AuthShell';
import { Notice } from '../components/ui';

export function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate('/portal');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not sign you in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Client Portal"
      title="Sign in"
      intro="Your bookings, correspondence and invoices with Genesis, all in one place."
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}

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

        <div>
          <label htmlFor="password" className="label-caps mb-1.5 block">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 border-t border-rule pt-6 text-sm text-ink-soft">
        <p className="font-medium text-ink">First time here?</p>
        <p className="mt-1">
          Whether you have worked with Genesis for years or are enquiring for the first time,{' '}
          <Link to="/register" className="text-brass underline underline-offset-2 hover:text-ink">
            set up your portal access
          </Link>
          . If we already have a history with you, it will be waiting inside.
        </p>
      </div>
    </AuthShell>
  );
}
