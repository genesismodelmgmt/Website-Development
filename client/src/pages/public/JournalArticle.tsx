import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Reveal } from '../../components/public/Reveal';
import { categoryLabel, findArticle, journalArticles } from '../../content/journal';

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function JournalArticle() {
  const { slug } = useParams();
  const article = slug ? findArticle(slug) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!article) return <Navigate to="/journal" replace />;

  const others = journalArticles.filter((a) => a.slug !== article.slug && a.category === article.category).slice(0, 2);

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <Reveal>
        <Link to="/journal" className="label-caps !text-brass hover:underline">
          ← The Journal
        </Link>
        <p className="label-caps mt-8">{categoryLabel(article.category)}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">{article.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">{article.standfirst}</p>
        <p className="mt-5 border-b border-rule pb-8 text-xs text-ink-faint">
          Genesis Model Management · {longDate(article.date)} · {article.readMinutes} min read
        </p>
      </Reveal>

      <div className="mt-10 space-y-10">
        {article.sections.map((section, i) => (
          <Reveal key={i}>
            <section>
              {section.heading ? <h2 className="mb-4 font-display text-2xl text-ink">{section.heading}</h2> : null}
              <div className="space-y-4">
                {section.paragraphs.map((paragraph, j) => (
                  <p key={j} className="text-[0.98rem] leading-[1.85] text-ink-soft">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-14 border-t border-rule pt-10">
          <p className="label-caps">Enquiries</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Booking a job, or thinking about applying to the board? Start on the{' '}
            <Link to="/#enquire" className="text-brass underline">
              enquiry form
            </Link>{' '}
            or email{' '}
            <a href="mailto:bookings@genesismodelmgmt.co.uk" className="text-brass underline">
              bookings@genesismodelmgmt.co.uk
            </a>
            .
          </p>
        </div>
      </Reveal>

      {others.length > 0 ? (
        <Reveal>
          <div className="mt-12">
            <p className="label-caps mb-4">More {categoryLabel(article.category).toLowerCase()}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {others.map((other) => (
                <Link key={other.slug} to={`/journal/${other.slug}`} className="card group block p-5 transition hover:border-brass">
                  <p className="font-display text-lg leading-snug text-ink group-hover:text-brass">{other.title}</p>
                  <p className="mt-2 text-xs text-ink-faint">
                    {longDate(other.date)} · {other.readMinutes} min read
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      ) : null}
    </article>
  );
}
