import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/portal', label: 'Overview', end: true },
  { to: '/portal/bookings', label: 'Bookings' },
  { to: '/portal/communications', label: 'Correspondence' },
  { to: '/portal/invoices', label: 'Invoices' },
  { to: '/portal/account', label: 'Account' },
];

export function PortalLayout() {
  const { user, client, signOut } = useAuth();
  const navigate = useNavigate();

  // Genesis staff have no client of their own, so the client sections would only
  // ever show them "nothing is linked to this login". They get their queue instead.
  const isAgency = user?.role === 'agency_admin';

  const handleSignOut = async () => {
    await signOut();
    navigate('/sign-in');
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-display text-lg leading-none tracking-wide text-ink">Genesis Model Management</p>
            <p className="label-caps mt-1.5">Client Portal</p>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-ink">{user?.fullName}</p>
              <p className="text-xs text-ink-faint">{client?.companyName ?? user?.email}</p>
            </div>
            <button type="button" onClick={handleSignOut} className="btn-ghost">
              Sign out
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl px-6" aria-label="Portal sections">
          <ul className="-mb-px flex flex-wrap gap-6">
            {(isAgency ? [] : NAV).map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-block border-b-2 pb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] transition ${
                      isActive ? 'border-brass text-ink' : 'border-transparent text-ink-faint hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            {isAgency ? (
              <li>
                <NavLink
                  to="/agency/link-requests"
                  className={({ isActive }) =>
                    `inline-block border-b-2 pb-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] transition ${
                      isActive ? 'border-brass text-brass' : 'border-transparent text-brass/70 hover:text-brass'
                    }`
                  }
                >
                  Access requests
                </NavLink>
              </li>
            ) : null}
          </ul>
        </nav>
      </header>

      {/* Each page explains its own state (see AccessNotice and the Account
          page), so there is no layout-level banner to duplicate it. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-rule bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-ink-faint">
          Genesis Model Management · Bookings desk:{' '}
          <a className="underline hover:text-ink" href="mailto:bookings@genesismodelmgmt.co.uk">
            bookings@genesismodelmgmt.co.uk
          </a>
        </div>
      </footer>
    </div>
  );
}
