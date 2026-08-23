import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api, type Booking } from '../api';
import { EmptyState, PageHeading, Spinner, StatusBadge } from '../components/ui';
import { dateRange, money, titleCase } from '../format';
import { AccessNotice } from './Dashboard';

const FILTERS = ['all', 'option', 'confirmed', 'completed', 'cancelled'] as const;

export function Bookings() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ status });
    if (query.trim()) params.set('q', query.trim());

    let cancelled = false;
    setBookings(null);

    const timer = setTimeout(() => {
      api
        .get<{ bookings: Booking[] }>(`/portal/bookings?${params}`)
        .then((data) => {
          if (!cancelled) setBookings(data.bookings);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err : new ApiError('Could not load bookings.', 500));
        });
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, query]);

  const totals = useMemo(() => {
    if (!bookings) return null;
    return bookings.reduce((sum, booking) => sum + booking.totalPence, 0);
  }, [bookings]);

  if (error) return <AccessNotice error={error} />;

  return (
    <>
      <PageHeading
        eyebrow="Your work with Genesis"
        title="Bookings"
        description="Every job we have run together, from first option through to completion."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              aria-pressed={status === filter}
              className={`rounded-full border px-3.5 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] transition ${
                status === filter
                  ? 'border-ink bg-ink text-bone'
                  : 'border-rule bg-paper text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {filter === 'all' ? 'All' : titleCase(filter)}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search title, reference or location"
          className="field ml-auto max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search bookings"
        />
      </div>

      {!bookings ? (
        <Spinner label="Loading bookings" />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings to show"
          description={
            status === 'all' && !query
              ? 'Once your first job is confirmed it will appear here with its models, dates and usage.'
              : 'Nothing matches that filter. Try widening your search.'
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <Link
                  to={`/portal/bookings/${booking.id}`}
                  className="card block p-6 transition hover:border-brass hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="label-caps">{booking.reference}</p>
                        <StatusBadge status={booking.status} />
                        <span className="label-caps text-ink-faint">{titleCase(booking.jobType)}</span>
                      </div>

                      <p className="mt-2 font-display text-2xl text-ink">{booking.title}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {dateRange(booking.startDate, booking.endDate)}
                        {booking.location ? ` · ${booking.location}` : ''}
                      </p>

                      {(booking.models?.length ?? 0) > 0 ? (
                        <p className="mt-3 text-sm text-ink-soft">
                          <span className="label-caps mr-2">Cast</span>
                          {(booking.models ?? []).map((m) => m.name).join(' · ')}
                        </p>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <p className="label-caps">Total</p>
                      <p className="font-display text-2xl text-ink">{money(booking.totalPence)}</p>
                      <p className="text-xs text-ink-faint">inc. agency fee</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {totals !== null ? (
            <p className="mt-6 border-t border-rule pt-4 text-sm text-ink-soft">
              {bookings.length} booking{bookings.length === 1 ? '' : 's'} shown · {money(totals)} in total fees
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
