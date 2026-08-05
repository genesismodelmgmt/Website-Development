import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, type MatchResult, type SessionUser } from '../api';
import { useAuth } from '../auth';
import { AuthShell } from '../components/AuthShell';
import { Notice } from '../components/ui';
import { longDate } from '../format';

type Step = 'identify' | 'verify' | 'confirm';

/**
 * Registration in three steps.
 *
 * Step one asks who you are and sends a code. Step two checks the code — and
 * only then does the portal say whether Genesis already has a history against
 * that address. That ordering matters: it means nobody can use this form to
 * find out who the agency's clients are, and nobody can claim a company's
 * records without controlling the mailbox.
 */
export function Register() {
  const { refresh, setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('identify');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  const [match, setMatch] = useState<MatchResult | null>(null);
  const [registrationToken, setRegistrationToken] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  const submitIdentity = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ devCode?: string }>('/auth/register/start', { email, fullName });
      setDevCode(result.devCode ?? null);
      setStep('verify');
    } catch (err) {
      fail(err, 'We could not send your code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ registrationToken: string; match: MatchResult; suggestedCompanyName?: string }>(
        '/auth/register/verify',
        { email, code },
      );
      setRegistrationToken(result.registrationToken);
      setMatch(result.match);
      if (result.suggestedCompanyName) setCompanyName(result.suggestedCompanyName);
      setStep('confirm');
    } catch (err) {
      fail(err, 'That code did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ user: SessionUser }>('/auth/register/complete', {
        registrationToken,
        fullName,
        password,
        companyName: companyName || undefined,
        phone: phone || undefined,
      });
      setSession(result.user);
      await refresh();
      navigate('/portal');
    } catch (err) {
      fail(err, 'We could not finish setting up your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Client Portal"
      title={step === 'confirm' ? 'Confirm your account' : 'Set up your access'}
      intro={
        step === 'identify'
          ? 'Tell us who you are. If Genesis has worked with you before, we will find your history in the next step.'
          : step === 'verify'
            ? `We have sent a six-digit code to ${email}.`
            : 'Almost there — choose a password and you are in.'
      }
    >
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {(['identify', 'verify', 'confirm'] as Step[]).map((name, index) => {
          const order: Step[] = ['identify', 'verify', 'confirm'];
          const state = order.indexOf(step) === index ? 'current' : order.indexOf(step) > index ? 'done' : 'todo';
          return (
            <li key={name} className="flex flex-1 items-center gap-2">
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[0.7rem] font-semibold ${
                  state === 'todo'
                    ? 'border-rule text-ink-faint'
                    : state === 'current'
                      ? 'border-ink bg-ink text-bone'
                      : 'border-brass bg-brass text-bone'
                }`}
              >
                {state === 'done' ? '✓' : index + 1}
              </span>
              <span className={`h-px flex-1 ${state === 'todo' ? 'bg-rule' : 'bg-brass'}`} />
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="mb-5">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {step === 'identify' ? (
        <form onSubmit={submitIdentity} className="space-y-5" noValidate>
          <div>
            <label htmlFor="fullName" className="label-caps mb-1.5 block">
              Your name
            </label>
            <input
              id="fullName"
              autoComplete="name"
              required
              className="field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="email" className="label-caps mb-1.5 block">
              Work email address
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
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Use the address you book with. It is how we match you to the work we have already done together.
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending code…' : 'Send my code'}
          </button>

          <p className="text-center text-sm text-ink-soft">
            Already set up?{' '}
            <Link to="/sign-in" className="text-brass underline underline-offset-2 hover:text-ink">
              Sign in
            </Link>
          </p>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={submitCode} className="space-y-5" noValidate>
          {devCode ? (
            <Notice>
              <span className="label-caps">Development mode</span>
              <p className="mt-1">
                No mail transport is configured, so your code is <strong className="font-mono">{devCode}</strong>.
              </p>
            </Notice>
          ) : null}

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

          <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Verify and continue'}
          </button>

          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => {
              setStep('identify');
              setCode('');
            }}
          >
            Use a different address
          </button>
        </form>
      ) : null}

      {step === 'confirm' && match ? (
        <form onSubmit={submitAccount} className="space-y-5" noValidate>
          <MatchPanel match={match} />

          {match.kind === 'new_customer' ? (
            <>
              <div>
                <label htmlFor="companyName" className="label-caps mb-1.5 block">
                  Company or brand
                </label>
                <input
                  id="companyName"
                  required
                  className="field"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="phone" className="label-caps mb-1.5 block">
                  Phone <span className="normal-case tracking-normal text-ink-faint">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor="password" className="label-caps mb-1.5 block">
              Choose a password
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

          <button type="submit" className="btn-primary w-full" disabled={busy || password.length < 10}>
            {busy ? 'Creating your account…' : 'Create account and enter portal'}
          </button>
        </form>
      ) : null}
    </AuthShell>
  );
}

/** What the agency found — the moment the portal earns its keep for a returning client. */
function MatchPanel({ match }: { match: MatchResult }) {
  if (match.kind === 'new_customer') {
    return (
      <Notice>
        <p className="font-display text-lg">Welcome to Genesis.</p>
        <p className="mt-1 text-sm text-ink-soft">
          We do not have a booking history against this address, so we will open a fresh account for you. Everything
          from your first enquiry onwards will be collected here.
        </p>
      </Notice>
    );
  }

  const { history } = match;
  const pending = match.kind === 'pending_review';

  return (
    <div className={`rounded-sm border p-5 ${pending ? 'border-amber-200 bg-amber-50' : 'border-brass/30 bg-brass-soft'}`}>
      <p className="label-caps">{pending ? 'We think we know you' : 'Welcome back'}</p>
      <p className="mt-2 font-display text-2xl text-ink">{match.companyName}</p>
      <p className="mt-1 text-xs text-ink-soft">{match.reason}</p>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-black/10 pt-4">
        <div>
          <dt className="label-caps">Bookings</dt>
          <dd className="font-display text-2xl text-ink">{history.bookings}</dd>
        </div>
        <div>
          <dt className="label-caps">Messages</dt>
          <dd className="font-display text-2xl text-ink">{history.communications}</dd>
        </div>
        <div>
          <dt className="label-caps">Invoices</dt>
          <dd className="font-display text-2xl text-ink">{history.invoices}</dd>
        </div>
      </dl>

      {history.firstBookedOn ? (
        <p className="mt-4 text-xs text-ink-soft">Working with Genesis since {longDate(history.firstBookedOn)}.</p>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {pending
          ? 'We recognised your company domain but not your exact address, so a member of the Genesis team will confirm your access before this history opens up. You can finish setting up your account now.'
          : 'All of it will be linked to your account the moment you finish setting up.'}
      </p>
    </div>
  );
}
