import { useEffect, useState } from 'react';
import { EditorialImage } from '../../components/public/EditorialImage';
import { Reveal } from '../../components/public/Reveal';
import { INSTAGRAM_URL, WORK_CATEGORIES, workEntries, type WorkCategory, type WorkEntry } from '../../content/gallery';

const boardLabel: Record<WorkEntry['board'], string> = {
  women: 'Women',
  men: 'Men',
  'new-faces': 'New Faces',
};

function Lightbox({ entry, onClose }: { entry: WorkEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={entry.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <EditorialImage entry={entry} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-bone">
          <div>
            <p className="font-display text-2xl">{entry.title}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-bone/60">
              {boardLabel[entry.board]} · {entry.season}
            </p>
          </div>
          <div className="flex gap-2">
            <a href={entry.instagram ?? INSTAGRAM_URL} target="_blank" rel="noreferrer" className="btn-ghost !border-bone/30 !text-bone hover:!border-brass hover:!text-brass">
              On Instagram
            </a>
            <button type="button" onClick={onClose} className="btn-ghost !border-bone/30 !text-bone hover:!border-brass hover:!text-brass">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Work() {
  const [category, setCategory] = useState<WorkCategory | 'all'>('all');
  const [open, setOpen] = useState<WorkEntry | null>(null);

  const entries = category === 'all' ? workEntries : workEntries.filter((w) => w.category === category);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <Reveal>
        <p className="label-caps">Portfolio</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl leading-tight text-ink sm:text-5xl">The work</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Campaigns, editorial, runway and e-commerce from across the Genesis boards. The freshest of it lands first on{' '}
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-brass underline">
            Instagram
          </a>
          .
        </p>
      </Reveal>

      <div className="mt-10 flex flex-wrap gap-2 border-b border-rule pb-6" role="tablist" aria-label="Filter work by category">
        {WORK_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={category === c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full border px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition ${
              category === c.key ? 'border-ink bg-ink text-bone' : 'border-rule bg-paper text-ink-soft hover:border-ink hover:text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-8 columns-2 gap-4 lg:columns-3 [&>*]:mb-4">
        {entries.map((entry, i) => (
          <Reveal key={entry.id} delay={(i % 3) * 70} className="break-inside-avoid">
            <button type="button" onClick={() => setOpen(entry)} className="group block w-full text-left">
              <EditorialImage entry={entry} />
              <div className="flex items-baseline justify-between gap-3 pt-3">
                <p className="font-display text-lg text-ink group-hover:text-brass">{entry.title}</p>
                <p className="label-caps shrink-0">{boardLabel[entry.board]}</p>
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {open ? <Lightbox entry={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
