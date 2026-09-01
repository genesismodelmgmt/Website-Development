import { useEffect, useState } from 'react';
import { ApiError, api, type SessionUser } from '../api';
import { Notice, PageHeading, Spinner, StatusBadge } from '../components/ui';
import { longDate, relativeTime, titleCase } from '../format';

interface AccountResponse {
  user: SessionUser;
  client: {
    id: string;
    companyName: string;
    clientType: string;
    status: string;
    primaryContactName: string | null;
    phone: string | null;
    billingAddress: string | null;
    accountManager: string | null;
    createdAt: string;
  } | null;
  teammates: Array<{ fullName: string; email: string; lastLoginAt: string | null }>;
  linkRequest: { status: string; requestedAt: string; reason: string } | null;
}

export function Account() {
  const [data, setData] = useState<AccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AccountResponse>('/portal/account')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your account.'));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Spinner label="Loading account" />;

  const { user, client, teammates, linkRequest } = data;

  return (
    <>
      <PageHeading eyebrow="Your details" title="Account" description="Who you are to us, and who else can see this portal." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-xl text-ink">You</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Field label="Name" value={user.fullName} />
            <Field label="Email" value={user.email} />
            <Field label="Access" value={titleCase(user.linkStatus.replace('_', ' '))} />
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="font-display text-xl text-ink">Your company</h2>
          {!client ? (
            <p className="mt-3 text-sm text-ink-soft">
              {user.linkStatus === 'pending_review'
                ? 'We are still confirming which company this login belongs to. Your company details will appear here once a member of the Genesis team has approved your access.'
                : 'No company record is linked to this login yet.'}
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-3">
                <p className="font-display text-2xl text-ink">{client.companyName}</p>
                <StatusBadge status={client.status} />
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <Field label="Type" value={titleCase(client.clientType)} />
                <Field label="Main contact" value={client.primaryContactName ?? '—'} />
                <Field label="Billing address" value={client.billingAddress ?? '—'} />
                <Field label="Your booker at Genesis" value={client.accountManager ?? 'Genesis bookings desk'} />
                <Field label="On our books since" value={longDate(client.createdAt)} />
              </dl>
              <p className="mt-5 border-t border-rule pt-4 text-xs leading-relaxed text-ink-faint">
                Something out of date? Email{' '}
                <a className="underline hover:text-ink" href="mailto:bookings@genesismodelmgmt.co.uk">
                  bookings@genesismodelmgmt.co.uk
                </a>{' '}
                and we will correct it on the agency record.
              </p>
            </>
          )}
        </section>
      </div>

      {linkRequest ? (
        <div className="mt-6">
          <Notice tone={linkRequest.status === 'pending' ? 'warn' : 'info'}>
            <p className="font-medium">
              {linkRequest.status === 'pending'
                ? 'Your access request is with the Genesis team.'
                : `Your access request was ${linkRequest.status}.`}
            </p>
            <p className="mt-1 text-sm">
              {linkRequest.reason} · Requested {relativeTime(linkRequest.requestedAt)}.
            </p>
          </Notice>
        </div>
      ) : null}

      {teammates.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-4 font-display text-xl text-ink">Colleagues with portal access</h2>
          <ul className="card divide-y divide-rule">
            {teammates.map((mate) => (
              <li key={mate.email} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-ink">{mate.fullName}</p>
                  <p className="text-xs text-ink-faint">{mate.email}</p>
                </div>
                <p className="text-xs text-ink-faint">
                  {mate.lastLoginAt ? `Last signed in ${relativeTime(mate.lastLoginAt)}` : 'Not signed in yet'}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            Colleagues on your company domain can register themselves — we will check with you before opening up your
            account to an address we do not recognise.
          </p>
        </section>
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 leading-relaxed text-ink">{value}</dd>
    </div>
  );
}
