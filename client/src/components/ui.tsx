import type { ReactNode } from 'react';
import { titleCase } from '../format';

export function StatusBadge({ status }: { status: string }) {
  const tones: Record<string, string> = {
    confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    completed: 'bg-brass-soft text-brass border-brass/30',
    option: 'bg-amber-50 text-amber-800 border-amber-200',
    optioned: 'bg-amber-50 text-amber-800 border-amber-200',
    enquiry: 'bg-sky-50 text-sky-800 border-sky-200',
    cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
    released: 'bg-bone text-ink-faint border-rule',
    paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    sent: 'bg-sky-50 text-sky-800 border-sky-200',
    overdue: 'bg-rose-50 text-rose-800 border-rose-200',
    draft: 'bg-bone text-ink-faint border-rule',
    void: 'bg-bone text-ink-faint border-rule',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dormant: 'bg-bone text-ink-soft border-rule',
    prospect: 'bg-sky-50 text-sky-800 border-sky-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] ${
        tones[status] ?? 'bg-bone text-ink-soft border-rule'
      }`}
    >
      {titleCase(status)}
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
      <div>
        {eyebrow ? <p className="label-caps mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="label-caps">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-ink-faint" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rule border-t-brass" aria-hidden />
      <span className="label-caps">{label}</span>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const tones = {
    info: 'border-brass/30 bg-brass-soft text-ink',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  } as const;

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-sm border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function ChannelIcon({ channel }: { channel: string }) {
  const glyphs: Record<string, string> = {
    email: '✉',
    call: '☎',
    meeting: '◷',
    whatsapp: '✆',
    portal: '⌂',
    note: '✎',
  };

  return (
    <span
      title={titleCase(channel)}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule bg-bone text-sm text-ink-soft"
      aria-hidden
    >
      {glyphs[channel] ?? '•'}
    </span>
  );
}
