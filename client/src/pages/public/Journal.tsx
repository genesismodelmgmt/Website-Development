import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '../../components/public/Reveal';
import { categoryLabel, JOURNAL_CATEGORIES, journalArticles, keynotes, type JournalCategory } from '../../content/journal';

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function Journal() {
  const [category, setCategory] = useState<JournalCategory | 'all'>('all');

  const sorted = [...journalArticles].sort((a, b) => b.date.localeCompare(a.date));
  const articles = category === 'all' ? sorted : sorted.filter((a) => a.category === category);
  const [lead, ...rest] = articles;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <Reveal>
        <p className="label-caps">The Journal</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl leading-tight text-ink sm:text-5xl">
          Industry news, insights and guidance — from the booking table
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
          What is moving in the business of fashion, how the industry actually works, and honest advice for models and clients.
          Written by the agency, not a content farm.
        </p>
      </Reveal>

      <div className="mt-10 flex flex-wrap gap-2 border-b border-rule pb-6">
        {JOURNAL_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full border px-4 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition ${
              category === c.key ? 'border-ink bg-ink text-bone' : 'border-rule bg-paper text-ink-soft hover:border-ink hover:text-ink'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          {lead ? (
            <Reveal>
              <Link to={`/journal/${lead.slug}`} className="card group block p-8 transition hover:border-brass sm:p-10">
                <p className="label-caps !text-brass">{categoryLabel(lead.category)}</p>
                <h2 className="mt-3 font-display text-3xl leading-snug text-ink group-hover:text-brass">{lead.title}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{lead.standfirst}</p>
                <p className="mt-6 text-xs text-ink-faint">
                  {longDate(lead.date)} · {lead.readMinutes} min read
                </p>
              </Link>
            </Reveal>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            {rest.map((article, i) => (
              <Reveal key={article.slug} delay={(i % 2) * 80}>
                <Link to={`/journal/${article.slug}`} className="card group flex h-full flex-col p-6 transition hover:border-brass">
                  <p className="label-caps !text-brass">{categoryLabel(article.category)}</p>
                  <h3 className="mt-3 font-display text-xl leading-snug text-ink group-hover:text-brass">{article.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{article.standfirst}</p>
                  <p className="mt-5 text-xs text-ink-faint">
                    {longDate(article.date)} · {article.readMinutes} min read
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>

        <aside>
          <Reveal delay={100}>
            <div className="card sticky top-24 p-6">
              <p className="label-caps">Keynotes</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">Short positions the agency stands behind.</p>
              <div className="mt-6 space-y-6">
                {keynotes.map((k) => (
                  <div key={k.topic} className="border-l-2 border-brass pl-4">
                    <p className="label-caps !text-brass">{k.topic}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{k.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </aside>
      </div>
    </div>
  );
}
