import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api, type Overview } from '../api';
import { ChannelIcon, EmptyState, Notice, PageHeading, Spinner, StatCard, StatusBadge } from '../components/ui';
import { dateRange, longDate, money, relativeTime } from '../format';

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api
      .get<Overview>('/portal/overview')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err : new ApiError('Could not load your account.', 500)));
  }, []);

  if (error) return <AccessNotice error={error} />;
  if (!data) return <Spinner label="Loading your account" />;

  const { client, stats, upcomingBookings, recentCommunications } = data;

  return (
    <>
      <PageHeading
        eyebrow={`Client since ${longDate(client.clientSince)}`}
        title={client.companyName}
        description={
          client.accountManager
            ? `Your booker at Genesis is ${client.accountManager}. Everything below is pulled from your account with us.`
            : 'Everything below is pulled from your account with us.'
        }
        actions={<StatusBadge status={client.status} />}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bookings"
          value={String(stats.totalBookings)}
          hint={`${stats.activeBookings} active · ${stats.completedBookings} completed`}
        />
        <StatCard label="Correspondence" value={String(stats.totalCommunications)} hint="Messages on file" />
        <StatCard
          label="Outstanding"
          value={money(stats.outstandingPence)}
          hint={stats.overduePence > 0 ? `${money(stats.overduePence)} overdue` : 'Nothing overdue'}
        />
        <StatCard label="Paid to date" value={money(stats.paidToDatePence)} hint="Across all settled invoices" />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">Coming up</h2>
            <Link to="/portal/bookings" className="label-caps hover:text-ink">
              All bookings →
            </Link>
          </div>

          {upcomingBookings.length === 0 ? (
            <EmptyState
              title="Nothing in the diary"
              description="When your next job is optioned or confirmed it will appear here."
              action={
                <Link to="/portal/communications" className="btn-primary">
                  Start an enquiry
                </Link>
              }
            />
          ) : (
            <ul className="space-y-3">
              {upcomingBookings.map((booking) => (
                <li key={booking.id}>
                  <Link
                    to={`/portal/bookings/${booking.id}`}
                    className="card block p-5 transition hover:border-brass hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="label-caps">{booking.reference}</p>
                        <p className="mt-1 font-display text-xl text-ink">{booking.title}</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {dateRange(booking.startDate, booking.endDate)}
                          {booking.location ? ` · ${booking.location}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    {(booking.models?.length ?? 0) > 0 ? (
                      <p className="mt-3 border-t border-rule pt-3 text-sm text-ink-soft">
                        {(booking.models ?? []).map((m) => m.name).join(' · ')}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-ink">Latest correspondence</h2>
            <Link to="/portal/communications" className="label-caps hover:text-ink">
              All →
            </Link>
          </div>

          {recentCommunications.length === 0 ? (
            <EmptyState title="No messages yet" description="Your conversations with Genesis will collect here." />
          ) : (
            <ul className="card divide-y divide-rule">
              {recentCommunications.map((comm) => (
                <li key={comm.id} className="flex gap-3 p-4">
                  <ChannelIcon channel={comm.channel} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{comm.subject ?? '(no subject)'}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{comm.body}</p>
                    <p className="mt-1.5 text-[0.7rem] uppercase tracking-wider text-ink-faint">
                      {comm.fromName ?? (comm.direction === 'inbound' ? 'Your team' : 'Genesis')} · {relativeTime(comm.occurredAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/** Turns the two "you cannot see data yet" states into an explanation rather than an error. */
export function AccessNotice({ error }: { error: ApiError }) {
  if (error.code === 'link_pending') {
    return (
      <Notice tone="warn">
        <p className="font-display text-lg">We are confirming your access.</p>
        <p className="mt-1">
          Your company&rsquo;s bookings and correspondence will appear here as soon as a member of the Genesis team has
          approved your account. We will email you when that happens.
        </p>
      </Notice>
    );
  }

  if (error.code === 'not_linked') {
    return (
      <Notice>
        <p className="font-display text-lg">No client account is linked to this login yet.</p>
        <p className="mt-1">
          If you have worked with Genesis before under a different address, email{' '}
          <a className="underline" href="mailto:bookings@genesismodelmgmt.co.uk">
            bookings@genesismodelmgmt.co.uk
          </a>{' '}
          and we will connect your history.
        </p>
      </Notice>
    );
  }

  return <Notice tone="error">{error.message}</Notice>;
}
