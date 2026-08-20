import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EditorialImage } from '../../components/public/EditorialImage';
import { InstagramStrip } from '../../components/public/InstagramStrip';
import { Reveal } from '../../components/public/Reveal';
import { workEntries } from '../../content/gallery';
import { categoryLabel, journalArticles, keynotes } from '../../content/journal';

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function EnquiryForm() {
  const [form, setForm] = useState({ kind: 'booking', fullName: '', email: '', company: '', message: '' });
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    try {
      const res = await fetch('/api/public/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, company: form.company || undefined }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-ink">Thank you — it’s with the booking team.</p>
        <p className="mt-3 text-sm text-ink-soft">
          We reply to every enquiry, usually the same working day. If it’s urgent, email{' '}
          <a href="mailto:bookings@genesismodelmgmt.co.uk" className="text-brass underline">
            bookings@genesismodelmgmt.co.uk
          </a>{' '}
          directly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
      <div>
        <label className="label-caps" htmlFor="enquiry-kind">
          I’m enquiring as
        </label>
        <select id="enquiry-kind" value={form.kind} onChange={set('kind')} className="field mt-1.5">
          <option value="booking">A client, about a booking</option>
          <option value="model">A model or applicant</option>
          <option value="general">Something else</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-caps" htmlFor="enquiry-name">
            Name
          </label>
          <input id="enquiry-name" required value={form.fullName} onChange={set('fullName')} className="field mt-1.5" placeholder="Your name" />
        </div>
        <div>
          <label className="label-caps" htmlFor="enquiry-email">
            Email
          </label>
          <input id="enquiry-email" type="email" required value={form.email} onChange={set('email')} className="field mt-1.5" placeholder="you@company.com" />
        </div>
      </div>
      <div>
        <label className="label-caps" htmlFor="enquiry-company">
          Company <span className="normal-case tracking-normal text-ink-faint">(optional)</span>
        </label>
        <input id="enquiry-company" value={form.company} onChange={set('company')} className="field mt-1.5" placeholder="Brand, publication or production" />
      </div>
      <div>
        <label className="label-caps" htmlFor="enquiry-message">
          Message
        </label>
        <textarea
          id="enquiry-message"
          required
          minLength={10}
          rows={5}
          value={form.message}
          onChange={set('message')}
          className="field mt-1.5 resize-y"
          placeholder="Dates, usage, budget and creative direction get you the fastest, sharpest package — see the Journal for why."
        />
      </div>
      {state === 'error' ? <p className="text-sm text-rose-700">That didn’t send — please check the fields and try again.</p> : null}
      <button type="submit" disabled={state === 'busy'} className="btn-primary w-full sm:w-auto">
        {state === 'busy' ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}

export function Home() {
  const { hash } = useLocation();

  // Arriving on /#enquire from another page still lands on the form.
  useEffect(() => {
    if (hash === '#enquire') document.getElementById('enquire')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  const featured = workEntries.filter((w) => w.featured);
  const articles = journalArticles.filter((a) => a.featured).slice(0, 3);
  const heroKeynote = keynotes[0];

  return (
    <>
      {/* ——— hero ——— */}
      <section className="bg-ink text-bone">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pb-24 lg:pt-28">
          <div>
            <Reveal>
              <p className="label-caps !text-brass">London · Women · Men · New Faces</p>
              <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl">
                Faces that carry
                <br />
                the campaign.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-bone/70">
                Genesis is a London model agency. We scout, develop and represent models for campaigns, editorial, runway and
                e-commerce — and we run the bookings with the same care we give the board.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/work" className="btn-primary !bg-brass !text-ink hover:!bg-bone">
                  See the work
                </Link>
                <a href="#enquire" className="btn-ghost !border-bone/30 !text-bone hover:!border-brass hover:!text-brass">
                  Book a model
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={150} className="hidden lg:block">
            <div className="grid grid-cols-2 gap-3">
              <EditorialImage entry={featured[0]} className="translate-y-6" />
              <EditorialImage entry={{ ...featured[2], aspect: 'portrait' }} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ——— keynote band ——— */}
      <section className="border-b border-rule bg-brass-soft">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Reveal>
            <p className="label-caps !text-brass">{heroKeynote.topic}</p>
            <p className="mt-2 max-w-3xl font-display text-xl leading-relaxed text-ink sm:text-2xl">{heroKeynote.note}</p>
          </Reveal>
        </div>
      </section>

      {/* ——— featured work ——— */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps">Selected work</p>
              <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">The board, at work</h2>
            </div>
            <Link to="/work" className="btn-ghost">
              Full portfolio
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 columns-2 gap-4 lg:columns-3 [&>*]:mb-4">
          {featured.map((entry, i) => (
            <Reveal key={entry.id} delay={(i % 3) * 80} className="break-inside-avoid">
              <Link to="/work" className="group block">
                <EditorialImage entry={entry} />
                <div className="flex items-baseline justify-between pt-3">
                  <p className="font-display text-lg text-ink group-hover:text-brass">{entry.title}</p>
                  <p className="label-caps">{entry.season}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <InstagramStrip />

      {/* ——— journal preview ——— */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps">The Journal</p>
              <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Industry news, insights &amp; guidance</h2>
            </div>
            <Link to="/journal" className="btn-ghost">
              Read the Journal
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {articles.map((article, i) => (
            <Reveal key={article.slug} delay={i * 90}>
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
      </section>

      {/* ——— enquiry ——— */}
      <section id="enquire" className="border-t border-rule bg-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <p className="label-caps">Enquiries</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">Tell us about the job.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
              Every enquiry is read by a booker, not a bot, and answered the same working day. Existing clients can go straight to
              the <Link to="/sign-in" className="text-brass underline">client portal</Link> — every booking, conversation and
              invoice is already there.
            </p>
            <div className="mt-8 space-y-5 border-l-2 border-brass pl-5">
              {keynotes.slice(3).map((k) => (
                <div key={k.topic}>
                  <p className="label-caps !text-brass">{k.topic}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{k.note}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <EnquiryForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
