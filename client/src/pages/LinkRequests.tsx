import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { EmptyState, Notice, PageHeading, Spinner, StatusBadge } from '../components/ui';
import { relativeTime } from '../format';

interface LinkRequest {
  id: string;
  status: string;
  confidence: 'exact' | 'domain' | 'manual';
  reason: string;
  requestedAt: string;
  user: { id: string; fullName: string; email: string };
  client: { id: string; companyName: string; bookingCount: number; communicationCount: number };
}

/** Agency-side queue: who is asking to see which client's history, and why. */
export function LinkRequests() {
  const [requests, setRequests] = useState<LinkRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    setRequests(null);
    api
      .get<{ requests: LinkRequest[] }>(`/admin/link-requests?status=${showAll ? 'all' : 'pending'}`)
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load requests.'));
  }, [showAll]);

  useEffect(load, [load]);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/link-requests/${id}`, { decision });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that decision.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="Agency only"
        title="Portal access requests"
        description="People who registered on a company-domain match. Approving one opens that client's full history to them."
        actions={
          <button type="button" className="btn-ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Pending only' : 'Show all'}
          </button>
        }
      />

      {error ? (
        <div className="mb-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {!requests ? (
        <Spinner label="Loading requests" />
      ) : requests.length === 0 ? (
        <EmptyState title="Nothing waiting" description="Every access request has been dealt with." />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-display text-xl text-ink">{request.user.fullName}</p>
                  <p className="text-sm text-ink-soft">{request.user.email}</p>
                  <p className="mt-3 text-sm text-ink">
                    Wants access to <strong className="font-semibold">{request.client.companyName}</strong> —{' '}
                    {request.client.bookingCount} bookings, {request.client.communicationCount} messages.
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {request.reason} · asked {relativeTime(request.requestedAt)}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <StatusBadge status={request.status} />
                  {request.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busyId === request.id}
                        onClick={() => decide(request.id, 'reject')}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busyId === request.id}
                        onClick={() => decide(request.id, 'approve')}
                      >
                        Approve
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
