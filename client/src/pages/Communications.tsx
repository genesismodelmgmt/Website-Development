import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api, type Communication } from '../api';
import { ChannelIcon, EmptyState, Notice, PageHeading, Spinner } from '../components/ui';
import { dateTime, titleCase } from '../format';
import { AccessNotice } from './Dashboard';

const CHANNELS = ['all', 'email', 'call', 'meeting', 'whatsapp', 'portal'] as const;

export function Communications() {
  const [items, setItems] = useState<Communication[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('all');
  const [query, setQuery] = useState('');
  const [composing, setComposing] = useState(false);

  const load = () => {
    const params = new URLSearchParams({ channel });
    if (query.trim()) params.set('q', query.trim());

    return api
      .get<{ communications: Communication[] }>(`/portal/communications?${params}`)
      .then((data) => setItems(data.communications))
      .catch((err) => setError(err instanceof ApiError ? err : new ApiError('Could not load correspondence.', 500)));
  };

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    const timer = setTimeout(() => {
      if (!cancelled) void load();
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, query]);

  if (error) return <AccessNotice error={error} />;

  return (
    <>
      <PageHeading
        eyebrow="Everything on file"
        title="Correspondence"
        description="Emails, calls, meetings and messages between you and the Genesis team, oldest history included."
        actions={
          <button type="button" className="btn-primary" onClick={() => setComposing((open) => !open)}>
            {composing ? 'Close' : 'Message the bookings desk'}
          </button>
        }
      />

      {composing ? (
        <div className="mb-8">
          <Composer
            onSent={() => {
              setComposing(false);
              void load();
            }}
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setChannel(option)}
              aria-pressed={channel === option}
              className={`rounded-full border px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] transition ${
                channel === option
                  ? 'border-ink bg-ink text-bone'
                  : 'border-rule bg-paper text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {option === 'all' ? 'Everything' : titleCase(option)}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search subject or message"
          className="field ml-auto max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search correspondence"
        />
      </div>

      {!items ? (
        <Spinner label="Loading correspondence" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Every email, call and meeting we log against your account will appear on this timeline."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-rule pl-6">
          {items.map((comm) => (
            <li key={comm.id} className="relative">
              <span className="absolute -left-[1.85rem] top-4" aria-hidden>
                <ChannelIcon channel={comm.channel} />
              </span>

              <article className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium text-ink">{comm.subject ?? '(no subject)'}</h2>
                  <time className="text-xs text-ink-faint" dateTime={comm.occurredAt}>
                    {dateTime(comm.occurredAt)}
                  </time>
                </div>

                <p className="label-caps mt-1">
                  {comm.direction === 'inbound' ? 'From your team' : 'From Genesis'}
                  {comm.fromName ? ` · ${comm.fromName}` : ''} · {titleCase(comm.channel)}
                </p>

                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{comm.body}</p>

                {comm.bookingId ? (
                  <Link
                    to={`/portal/bookings/${comm.bookingId}`}
                    className="mt-4 inline-block border-t border-rule pt-3 text-xs text-brass underline underline-offset-2 hover:text-ink"
                  >
                    {comm.bookingReference} · {comm.bookingTitle}
                  </Link>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Composer({ onSent }: { onSent: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/portal/communications', { subject, body });
      setSubject('');
      setBody('');
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not send that message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div>
        <label htmlFor="subject" className="label-caps mb-1.5 block">
          Subject
        </label>
        <input
          id="subject"
          required
          className="field"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Availability for October"
        />
      </div>

      <div>
        <label htmlFor="body" className="label-caps mb-1.5 block">
          Message
        </label>
        <textarea
          id="body"
          required
          rows={5}
          className="field resize-y"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell us what you are planning — dates, usage and budget if you have them."
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-ink-faint">Goes to the bookings desk and joins this timeline.</p>
        <button type="submit" className="btn-primary" disabled={busy || !subject.trim() || !body.trim()}>
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}
