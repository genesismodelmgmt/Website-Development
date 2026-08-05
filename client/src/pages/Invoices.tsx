import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api, type Invoice } from '../api';
import { EmptyState, PageHeading, Spinner, StatCard, StatusBadge } from '../components/ui';
import { money, shortDate } from '../format';
import { AccessNotice } from './Dashboard';

interface InvoiceResponse {
  invoices: Invoice[];
  totals: { paidPence: number; outstandingPence: number; overduePence: number };
}

export function Invoices() {
  const [data, setData] = useState<InvoiceResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api
      .get<InvoiceResponse>('/portal/invoices')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err : new ApiError('Could not load invoices.', 500)));
  }, []);

  if (error) return <AccessNotice error={error} />;
  if (!data) return <Spinner label="Loading invoices" />;

  return (
    <>
      <PageHeading
        eyebrow="Statement of account"
        title="Invoices"
        description="Where every invoice on your account stands. For a formal statement, ask the accounts desk and we will send a signed PDF."
      />

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={money(data.totals.outstandingPence)} hint="Issued and unpaid" />
        <StatCard
          label="Overdue"
          value={money(data.totals.overduePence)}
          hint={data.totals.overduePence > 0 ? 'Past the due date' : 'Nothing overdue'}
        />
        <StatCard label="Paid to date" value={money(data.totals.paidPence)} hint="Settled in full" />
      </section>

      {data.invoices.length === 0 ? (
        <EmptyState title="No invoices yet" description="Invoices raised against your bookings will be listed here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-rule">
                {['Invoice', 'Booking', 'Issued', 'Due', 'Net', 'VAT', 'Total', 'Status'].map((heading) => (
                  <th key={heading} scope="col" className="label-caps px-5 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-bone/60">
                  <th scope="row" className="px-5 py-4 font-medium text-ink">
                    {invoice.number}
                  </th>
                  <td className="px-5 py-4 text-ink-soft">
                    {invoice.bookingId ? (
                      <Link
                        to={`/portal/bookings/${invoice.bookingId}`}
                        className="text-brass underline underline-offset-2 hover:text-ink"
                      >
                        {invoice.bookingReference}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{shortDate(invoice.issuedOn)}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {invoice.status === 'paid' ? `Paid ${shortDate(invoice.paidOn)}` : shortDate(invoice.dueOn)}
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{money(invoice.netPence, true)}</td>
                  <td className="px-5 py-4 text-ink-soft">{money(invoice.vatPence, true)}</td>
                  <td className="px-5 py-4 font-medium text-ink">{money(invoice.totalPence, true)}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-sm text-ink-soft">
        Questions about a figure? Email{' '}
        <a className="text-brass underline underline-offset-2 hover:text-ink" href="mailto:accounts@genesismodelmgmt.co.uk">
          accounts@genesismodelmgmt.co.uk
        </a>
        .
      </p>
    </>
  );
}
