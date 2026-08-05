import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, resolveClientScope } from '../auth.js';
import { getDb, newId, nowIso, recordAudit } from '../db.js';

export const portalRouter = Router();

portalRouter.use(requireAuth);

/**
 * Every handler below starts by calling resolveClientScope, which derives the
 * client id from the session. No route reads a client id from the request, so
 * cross-tenant access is not expressible in the API surface.
 */

// --- shapes returned to the browser ----------------------------------------

interface BookingRow {
  id: string;
  reference: string;
  title: string;
  job_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  usage_terms: string | null;
  fee_pence: number;
  agency_fee_pence: number;
  currency: string;
  booker: string | null;
  brief: string | null;
  created_at: string;
}

interface BookingModelRow {
  id: string;
  booking_id: string;
  model_name: string;
  board: string | null;
  role: string | null;
  day_rate_pence: number;
  status: string;
}

/**
 * Booking rows always go out with their cast attached — the list, the detail
 * page and the dashboard all render model names, and leaving `models` off one
 * response is how the dashboard ended up reading `.length` of undefined.
 */
function withModels(bookings: BookingRow[]): Array<ReturnType<typeof mapBooking> & { models: unknown[] }> {
  if (bookings.length === 0) return [];

  const placeholders = bookings.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`SELECT * FROM booking_models WHERE booking_id IN (${placeholders}) ORDER BY model_name`)
    .all(...bookings.map((b) => b.id)) as BookingModelRow[];

  const byBooking = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const list = byBooking.get(row.booking_id) ?? [];
    list.push({
      id: row.id,
      name: row.model_name,
      board: row.board,
      role: row.role,
      dayRatePence: row.day_rate_pence,
      status: row.status,
    });
    byBooking.set(row.booking_id, list);
  }

  return bookings.map((booking) => ({ ...mapBooking(booking), models: byBooking.get(booking.id) ?? [] }));
}

const mapBooking = (row: BookingRow) => ({
  id: row.id,
  reference: row.reference,
  title: row.title,
  jobType: row.job_type,
  status: row.status,
  startDate: row.start_date,
  endDate: row.end_date,
  location: row.location,
  usageTerms: row.usage_terms,
  feePence: row.fee_pence,
  agencyFeePence: row.agency_fee_pence,
  totalPence: row.fee_pence + row.agency_fee_pence,
  currency: row.currency,
  booker: row.booker,
  brief: row.brief,
  createdAt: row.created_at,
});

interface CommRow {
  id: string;
  booking_id: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  from_name: string | null;
  from_email: string | null;
  to_email: string | null;
  thread_key: string | null;
  occurred_at: string;
  booking_reference?: string | null;
  booking_title?: string | null;
}

const mapComm = (row: CommRow) => ({
  id: row.id,
  bookingId: row.booking_id,
  bookingReference: row.booking_reference ?? null,
  bookingTitle: row.booking_title ?? null,
  channel: row.channel,
  direction: row.direction,
  subject: row.subject,
  body: row.body,
  fromName: row.from_name,
  fromEmail: row.from_email,
  toEmail: row.to_email,
  threadKey: row.thread_key,
  occurredAt: row.occurred_at,
});

interface InvoiceRow {
  id: string;
  booking_id: string | null;
  number: string;
  status: string;
  issued_on: string | null;
  due_on: string | null;
  paid_on: string | null;
  net_pence: number;
  vat_pence: number;
  total_pence: number;
  currency: string;
  booking_reference?: string | null;
}

const mapInvoice = (row: InvoiceRow) => ({
  id: row.id,
  bookingId: row.booking_id,
  bookingReference: row.booking_reference ?? null,
  number: row.number,
  status: row.status,
  issuedOn: row.issued_on,
  dueOn: row.due_on,
  paidOn: row.paid_on,
  netPence: row.net_pence,
  vatPence: row.vat_pence,
  totalPence: row.total_pence,
  currency: row.currency,
});

// --- overview ---------------------------------------------------------------

portalRouter.get('/overview', (req, res) => {
  const clientId = resolveClientScope(req, res);
  if (!clientId) return;

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const client = db
    .prepare(
      `SELECT id, company_name, status, account_manager, primary_contact_name, created_at
         FROM clients WHERE id = ?`,
    )
    .get(clientId) as
    | {
        id: string;
        company_name: string;
        status: string;
        account_manager: string | null;
        primary_contact_name: string | null;
        created_at: string;
      }
    | undefined;

  if (!client) {
    res.status(404).json({ error: 'Client record not found.' });
    return;
  }

  const counts = db
    .prepare(
      `SELECT
         COUNT(*)                                                      AS total,
         SUM(CASE WHEN status IN ('option','confirmed') THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)         AS completed,
         MIN(start_date)                                               AS first_booking
       FROM bookings WHERE client_id = ?`,
    )
    .get(clientId) as { total: number; active: number | null; completed: number | null; first_booking: string | null };

  const balances = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('sent','overdue') THEN total_pence ELSE 0 END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN status = 'overdue' THEN total_pence ELSE 0 END), 0)           AS overdue,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total_pence ELSE 0 END), 0)              AS paid_to_date
       FROM invoices WHERE client_id = ?`,
    )
    .get(clientId) as { outstanding: number; overdue: number; paid_to_date: number };

  const upcoming = db
    .prepare(
      `SELECT * FROM bookings
        WHERE client_id = ? AND status IN ('option','confirmed') AND (start_date IS NULL OR start_date >= ?)
        ORDER BY start_date ASC LIMIT 5`,
    )
    .all(clientId, today) as BookingRow[];

  const recentComms = db
    .prepare(
      `SELECT c.*, b.reference AS booking_reference, b.title AS booking_title
         FROM communications c
         LEFT JOIN bookings b ON b.id = c.booking_id
        WHERE c.client_id = ? AND c.visible_to_client = 1
        ORDER BY c.occurred_at DESC LIMIT 5`,
    )
    .all(clientId) as CommRow[];

  const commsTotal = db
    .prepare(`SELECT COUNT(*) AS n FROM communications WHERE client_id = ? AND visible_to_client = 1`)
    .get(clientId) as { n: number };

  res.json({
    client: {
      id: client.id,
      companyName: client.company_name,
      status: client.status,
      accountManager: client.account_manager,
      clientSince: counts.first_booking ?? client.created_at,
    },
    stats: {
      totalBookings: counts.total,
      activeBookings: counts.active ?? 0,
      completedBookings: counts.completed ?? 0,
      totalCommunications: commsTotal.n,
      outstandingPence: balances.outstanding,
      overduePence: balances.overdue,
      paidToDatePence: balances.paid_to_date,
    },
    upcomingBookings: withModels(upcoming),
    recentCommunications: recentComms.map(mapComm),
  });
});

// --- bookings ---------------------------------------------------------------

const bookingQuery = z.object({
  status: z.enum(['all', 'enquiry', 'option', 'confirmed', 'completed', 'cancelled']).default('all'),
  q: z.string().trim().max(120).optional(),
});

portalRouter.get('/bookings', (req, res) => {
  const clientId = resolveClientScope(req, res);
  if (!clientId) return;

  const parsed = bookingQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid filter.' });
    return;
  }
  const { status, q } = parsed.data;

  const conditions = ['client_id = ?'];
  const params: unknown[] = [clientId];

  if (status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (q) {
    conditions.push('(title LIKE ? OR reference LIKE ? OR location LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const rows = db_all<BookingRow>(
    `SELECT * FROM bookings WHERE ${conditions.join(' AND ')} ORDER BY COALESCE(start_date, created_at) DESC`,
    params,
  );

  res.json({ bookings: withModels(rows) });
});

portalRouter.get('/bookings/:id', (req, res) => {
  const clientId = resolveClientScope(req, res);
  if (!clientId) return;

  const db = getDb();
  // The client_id predicate is what makes a guessed id a 404 rather than a leak.
  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ? AND client_id = ?`).get(req.params.id, clientId) as
    | BookingRow
    | undefined;

  if (!booking) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }

  const models = db.prepare(`SELECT * FROM booking_models WHERE booking_id = ? ORDER BY model_name`).all(booking.id) as Array<{
    id: string;
    model_name: string;
    board: string | null;
    role: string | null;
    day_rate_pence: number;
    status: string;
  }>;

  const comms = db
    .prepare(
      `SELECT * FROM communications
        WHERE client_id = ? AND booking_id = ? AND visible_to_client = 1
        ORDER BY occurred_at ASC`,
    )
    .all(clientId, booking.id) as CommRow[];

  const invoices = db
    .prepare(`SELECT * FROM invoices WHERE client_id = ? AND booking_id = ? ORDER BY issued_on DESC`)
    .all(clientId, booking.id) as InvoiceRow[];

  res.json({
    booking: {
      ...mapBooking(booking),
      models: models.map((m) => ({
        id: m.id,
        name: m.model_name,
        board: m.board,
        role: m.role,
        dayRatePence: m.day_rate_pence,
        status: m.status,
      })),
    },
    communications: comms.map(mapComm),
    invoices: invoices.map(mapInvoice),
  });
});

// --- communications ---------------------------------------------------------

const commsQuery = z.object({
  channel: z.enum(['all', 'email', 'call', 'meeting', 'whatsapp', 'portal', 'note']).default('all'),
  bookingId: z.string().trim().max(64).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

portalRouter.get('/communications', (req, res) => {
  const clientId = resolveClientScope(req, res);
  if (!clientId) return;

  const parsed = commsQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid filter.' });
    return;
  }
  const { channel, bookingId, q, limit } = parsed.data;

  const conditions = ['c.client_id = ?', 'c.visible_to_client = 1'];
  const params: unknown[] = [clientId];

  if (channel !== 'all') {
    conditions.push('c.channel = ?');
    params.push(channel);
  }
  if (bookingId) {
    conditions.push('c.booking_id = ?');
    params.push(bookingId);
  }
  if (q) {
    conditions.push('(c.subject LIKE ? OR c.body LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const rows = db_all<CommRow>(
    `SELECT c.*, b.reference AS booking_reference, b.title AS booking_title
       FROM communications c
       LEFT JOIN bookings b ON b.id = c.booking_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.occurred_at DESC
      LIMIT ?`,
    [...params, limit],
  );

  res.json({ communications: rows.map(mapComm) });
});

/** A client replying from inside the portal lands in the same timeline as their email. */
const messageSchema = z.object({
  subject: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(5000),
  bookingId: z.string().trim().max(64).optional(),
});

portalRouter.post('/communications', (req, res) => {
  const clientId = resolveClientScope(req, res);
  if (!clientId) return;

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please add a subject and a message.' });
    return;
  }

  const db = getDb();
  const user = req.user!;
  const { subject, body, bookingId } = parsed.data;

  if (bookingId) {
    const owned = db.prepare(`SELECT id FROM bookings WHERE id = ? AND client_id = ?`).get(bookingId, clientId);
    if (!owned) {
      res.status(400).json({ error: 'That booking is not on your account.' });
      return;
    }
  }

  const id = newId();
  const now = nowIso();

  db.prepare(
    `INSERT INTO communications (id, client_id, booking_id, channel, direction, subject, body,
                                 from_name, from_email, to_email, thread_key, visible_to_client,
                                 occurred_at, created_at)
     VALUES (?, ?, ?, 'portal', 'inbound', ?, ?, ?, ?, 'bookings@genesismodelmgmt.co.uk', ?, 1, ?, ?)`,
  ).run(id, clientId, bookingId ?? null, subject, body, user.fullName, user.email, `portal-${id}`, now, now);

  recordAudit(db, {
    actorUserId: user.id,
    actorEmail: user.email,
    action: 'portal.message_sent',
    subjectType: 'communication',
    subjectId: id,
    ip: req.ip,
  });

  const row = db.prepare(`SELECT * FROM communications WHERE id = ?`).get(id) as CommRow;
  res.status(201).json({ communication: mapComm(row) });
});

// --- invoices ---------------------------------------------------------------

portalRouter.get('/invoices', (req, res) => {
  const clientId = resolveClientScope(req, res);
  if (!clientId) return;

  const rows = db_all<InvoiceRow>(
    `SELECT i.*, b.reference AS booking_reference
       FROM invoices i
       LEFT JOIN bookings b ON b.id = i.booking_id
      WHERE i.client_id = ?
      ORDER BY COALESCE(i.issued_on, i.created_at) DESC`,
    [clientId],
  );

  const totals = rows.reduce(
    (acc, row) => {
      if (row.status === 'paid') acc.paidPence += row.total_pence;
      if (row.status === 'sent' || row.status === 'overdue') acc.outstandingPence += row.total_pence;
      if (row.status === 'overdue') acc.overduePence += row.total_pence;
      return acc;
    },
    { paidPence: 0, outstandingPence: 0, overduePence: 0 },
  );

  res.json({ invoices: rows.map(mapInvoice), totals });
});

// --- account ----------------------------------------------------------------

portalRouter.get('/account', (req, res) => {
  const user = req.user!;
  const db = getDb();

  const client = user.clientId
    ? (db.prepare(`SELECT * FROM clients WHERE id = ?`).get(user.clientId) as
        | {
            id: string;
            company_name: string;
            client_type: string;
            status: string;
            primary_contact_name: string | null;
            primary_contact_email: string | null;
            phone: string | null;
            billing_address: string | null;
            account_manager: string | null;
            created_at: string;
          }
        | undefined)
    : undefined;

  const teammates =
    user.clientId && user.linkStatus === 'linked'
      ? (db
          .prepare(
            `SELECT full_name, email, last_login_at FROM users
              WHERE client_id = ? AND link_status = 'linked'
              ORDER BY full_name`,
          )
          .all(user.clientId) as Array<{ full_name: string; email: string; last_login_at: string | null }>)
      : [];

  const pendingRequest = db
    .prepare(`SELECT status, requested_at, match_reason FROM link_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 1`)
    .get(user.id) as { status: string; requested_at: string; match_reason: string } | undefined;

  res.json({
    user,
    client: client
      ? {
          id: client.id,
          companyName: client.company_name,
          clientType: client.client_type,
          status: client.status,
          primaryContactName: client.primary_contact_name,
          primaryContactEmail: client.primary_contact_email,
          phone: client.phone,
          billingAddress: client.billing_address,
          accountManager: client.account_manager,
          createdAt: client.created_at,
        }
      : null,
    teammates: teammates.map((t) => ({ fullName: t.full_name, email: t.email, lastLoginAt: t.last_login_at })),
    linkRequest: pendingRequest
      ? { status: pendingRequest.status, requestedAt: pendingRequest.requested_at, reason: pendingRequest.match_reason }
      : null,
  });
});

// --- helper -----------------------------------------------------------------

function db_all<T>(sql: string, params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}
