import type { ReactNode } from 'react';

/** The two-column signed-out frame: agency voice on the left, the form on the right. */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-ink px-12 py-14 text-bone lg:flex">
        <p className="font-display text-xl tracking-wide">Genesis Model Management</p>

        <div className="max-w-md">
          <h2 className="font-display text-4xl leading-tight">
            Every booking, every conversation, in one place.
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-bone/70">
            Sign in to see the jobs we have run together, the models you have booked, the correspondence behind each
            one, and where your invoices stand. Existing clients are recognised automatically — your history comes with
            you.
          </p>
        </div>

        <p className="text-xs uppercase tracking-[0.18em] text-bone/40">London</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-md">
          <p className="label-caps">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl text-ink">{title}</h1>
          <p className="mt-3 mb-8 text-sm leading-relaxed text-ink-soft">{intro}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
