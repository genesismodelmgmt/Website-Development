import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { INSTAGRAM_URL } from '../../content/gallery';

/** The signed-out frame: wordmark and nav above, contact and newsletter below. */

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/work', label: 'Work', end: false },
  { to: '/journal', label: 'Journal', end: false },
];

function NewsletterForm({ source }: { source: 'home' | 'journal' | 'footer' }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    try {
      const res = await fetch('/api/public/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return <p className="text-sm text-bone/80">You’re on the list. We write rarely and only when it’s worth your time.</p>;
  }

  return (
    <form onSubmit={submit} className="flex max-w-md gap-2">
      <label className="sr-only" htmlFor={`newsletter-${source}`}>
        Email address
      </label>
      <input
        id={`newsletter-${source}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="w-full rounded-sm border border-bone/25 bg-transparent px-3 py-2.5 text-sm text-bone outline-none transition placeholder:text-bone/40 focus:border-brass"
      />
      <button type="submit" disabled={state === 'busy'} className="btn shrink-0 border border-bone/25 text-bone hover:border-brass hover:text-brass">
        {state === 'busy' ? 'Joining…' : 'Join'}
      </button>
      {state === 'error' ? <p className="self-center text-xs text-rose-300">Try again?</p> : null}
    </form>
  );
}

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition ${isActive ? 'text-brass' : 'text-ink hover:text-brass'}`;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-rule bg-bone/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link to="/" className="font-display text-lg tracking-wide text-ink">
            Genesis Model Management
          </Link>

          <nav className="hidden items-center gap-8 sm:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            <Link to="/sign-in" className="btn-primary !py-2">
              Client portal
            </Link>
          </nav>

          <button
            type="button"
            className="btn-ghost !px-3 !py-2 sm:hidden"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
        </div>

        {menuOpen ? (
          <nav className="border-t border-rule px-6 py-4 sm:hidden" aria-label="Main">
            <div className="flex flex-col gap-4">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
              <Link to="/sign-in" className="btn-primary self-start" onClick={() => setMenuOpen(false)}>
                Client portal
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <main className="flex-1" key={location.pathname}>
        <Outlet />
      </main>

      <footer className="bg-ink text-bone">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-2xl">Genesis Model Management</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-bone/70">
              A London model agency representing women, men and new faces for campaigns, editorial, runway and e-commerce.
            </p>
            <div className="mt-8">
              <p className="label-caps !text-bone/50">The Genesis letter</p>
              <p className="mt-2 mb-4 text-sm text-bone/70">Season notes, casting calls and journal pieces. No noise.</p>
              <NewsletterForm source="footer" />
            </div>
          </div>

          <div>
            <p className="label-caps !text-bone/50">Visit</p>
            <ul className="mt-4 space-y-3 text-sm">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-bone/80 transition hover:text-brass">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/sign-in" className="text-bone/80 transition hover:text-brass">
                  Client portal
                </Link>
              </li>
              <li>
                <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="text-bone/80 transition hover:text-brass">
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="label-caps !text-bone/50">Contact</p>
            <ul className="mt-4 space-y-3 text-sm text-bone/80">
              <li>
                <a href="mailto:bookings@genesismodelmgmt.co.uk" className="transition hover:text-brass">
                  bookings@genesismodelmgmt.co.uk
                </a>
              </li>
              <li>
                <a href="mailto:contact@genesismodelmgmt.co.uk" className="transition hover:text-brass">
                  contact@genesismodelmgmt.co.uk
                </a>
              </li>
              <li className="text-bone/50">London, United Kingdom</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-bone/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-bone/40">
            <p>© {new Date().getFullYear()} Genesis Model Management. All rights reserved.</p>
            <p className="uppercase tracking-[0.18em]">London</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
