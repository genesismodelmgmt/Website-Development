/** Typed wrapper over the portal API. Cookies carry the session, so every call is credentialed. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(body?.error ?? 'Something went wrong.', response.status, body?.code);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};

// --- shared shapes ----------------------------------------------------------

export type LinkStatus = 'linked' | 'pending_review' | 'unlinked';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'agency_admin';
  clientId: string | null;
  linkStatus: LinkStatus;
}

export interface HistorySummary {
  bookings: number;
  communications: number;
  invoices: number;
  firstBookedOn: string | null;
  lastActivityOn: string | null;
}

export type MatchResult =
  | { kind: 'new_customer' }
  | {
      kind: 'linked' | 'pending_review';
      companyName: string;
      confidence: 'exact' | 'domain';
      reason: string;
      history: HistorySummary;
    };

export interface BookingModel {
  id?: string;
  name: string;
  board: string | null;
  role: string | null;
  status: string;
  dayRatePence?: number;
}

export interface Booking {
  id: string;
  reference: string;
  title: string;
  jobType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  usageTerms: string | null;
  feePence: number;
  agencyFeePence: number;
  totalPence: number;
  currency: string;
  booker: string | null;
  brief: string | null;
  models: BookingModel[];
}

export interface Communication {
  id: string;
  bookingId: string | null;
  bookingReference: string | null;
  bookingTitle: string | null;
  channel: string;
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
  occurredAt: string;
}

export interface Invoice {
  id: string;
  bookingId: string | null;
  bookingReference: string | null;
  number: string;
  status: string;
  issuedOn: string | null;
  dueOn: string | null;
  paidOn: string | null;
  netPence: number;
  vatPence: number;
  totalPence: number;
  currency: string;
}

export interface Overview {
  client: {
    id: string;
    companyName: string;
    status: string;
    accountManager: string | null;
    clientSince: string;
  };
  stats: {
    totalBookings: number;
    activeBookings: number;
    completedBookings: number;
    totalCommunications: number;
    outstandingPence: number;
    overduePence: number;
    paidToDatePence: number;
  };
  upcomingBookings: Booking[];
  recentCommunications: Communication[];
}
