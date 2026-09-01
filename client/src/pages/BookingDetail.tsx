import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api, type Booking, type Communication, type Invoice } from '../api';
import { ChannelIcon, PageHeading, Spinner, StatusBadge } from '../components/ui';
import { dateRange, dateTime, money, shortDate, titleCase } from '../format';
import { AccessNotice } from './Dashboard';

interface BookingDetailResponse {
  booking: Booking;
  communications: Communication[];
  invoices: Invoice[];
}

export function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BookingDetailResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<BookingDetailResponse>(`/portal/bookings/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err : new ApiError('Could not load this booking.', 500)));
  }, [id]);

  if (error) return <AccessNotice error={error} />;
  if (!data) return <Spinner label="Loading booking" />;

  const { booking, communications, invoices } = data;

  return (
    <>
      <Link to="/portal/bookings" className="label-caps mb-6 inline-block hover:text-ink">
        ← All bookings
      </Link>

      <PageHeading
        eyebrow={`${booking.reference} · ${titleCase(booking.jobType)}`}
        title={booking.title}
        description={booking.brief ?? undefined}
        actions={<StatusBadge status={booking.status} />}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section className="card p-6">
            <h2 className="font-display text-xl text-ink">Cast</h2>
            {booking.models.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No models attached to this job.</p>
            ) : (
              <ul className="mt-4 divide-y divide-rule">
                {booking.models.map((model) => (
                  <li key={model.id ?? model.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-display text-lg text-ink">{model.name}</p>
                      <p className="label-caps mt-0.5">
                        {[model.board ? titleCase(model.board) : null, model.role].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusBadge status={model.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl text-ink">Correspondence on this job</h2>
            {communications.length === 0 ? (
              <p className="card p-6 text-sm text-ink-soft">Nothing logged against this booking yet.</p>
            ) : (
              <ol className="space-y-3">
                {communications.map((comm) => (
                  <li key={comm.id} className="card flex gap-4 p-5">
                    <ChannelIcon channel={comm.channel} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-ink">{comm.subject ?? '(no subject)'}</p>
                        <p className="text-xs text-ink-faint">{dateTime(comm.occurredAt)}</p>
                      </div>
                      <p className="label-caps mt-1">
                        {comm.direction === 'inbound' ? 'From your team' : 'From Genesis'}
                        {comm.fromName ? ` · ${comm.fromName}` : ''}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{comm.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="label-caps">Details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <Detail label="Dates" value={dateRange(booking.startDate, booking.endDate)} />
              <Detail label="Location" value={booking.location ?? '—'} />
              <Detail label="Usage" value={booking.usageTerms ?? '—'} />
              <Detail label="Booked by" value={booking.booker ?? 'Genesis bookings desk'} />
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="label-caps">Fees</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Total" value={money(booking.totalPence, true)} strong />
            </dl>
            <p className="mt-3 text-xs text-ink-faint">
              The booking total, excluding VAT — VAT is shown on the invoice. For a breakdown of what was agreed, ask
              your booker.
            </p>
          </section>

          {invoices.length > 0 ? (
            <section className="card p-6">
              <h2 className="label-caps">Invoices</h2>
              <ul className="mt-4 space-y-3">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{invoice.number}</p>
                      <p className="text-xs text-ink-faint">
                        {invoice.status === 'paid'
                          ? `Paid ${shortDate(invoice.paidOn)}`
                          : `Due ${shortDate(invoice.dueOn)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-ink">{money(invoice.totalPence, true)}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 leading-relaxed text-ink-soft">{value}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-medium text-ink' : 'text-ink-soft'}>{label}</dt>
      <dd className={strong ? 'font-display text-lg text-ink' : 'text-ink'}>{value}</dd>
    </div>
  );
}
