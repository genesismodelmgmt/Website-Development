import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// The env module reads process.env at import time, so configure before importing.
const workDir = mkdtempSync(join(tmpdir(), 'genesis-portal-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = join(workDir, 'test.db');
process.env.SESSION_SECRET = 'test-secret-that-is-definitely-long-enough';
process.env.REVEAL_CODES = 'true';
// Every request in the suite comes from 127.0.0.1, so the per-IP throttles have
// to be lifted here or the later tests trip them.
process.env.CODE_REQUEST_LIMIT = '1000';
process.env.LOGIN_ATTEMPT_LIMIT = '1000';

const { openDatabase, setDb, newId, nowIso } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { findClientMatches, decideLink, normaliseEmail, emailDomain, isConsumerDomain } = await import(
  '../src/matching.js'
);
const bcrypt = (await import('bcryptjs')).default;

const db = openDatabase(process.env.DATABASE_FILE!);
setDb(db);

let server: Server;
let baseUrl: string;

const NORTHBANK = 'client-northbank';
const AURELIA = 'client-aurelia';

/** A minimal cookie jar so a test can act as a signed-in user. */
class Session {
  private cookie = '';

  async request(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(init.headers ?? {}),
      },
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(';')[0] ?? '';
      if (pair.startsWith('genesis_portal_session=')) this.cookie = pair;
    }

    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  get(path: string) {
    return this.request(path);
  }

  post(path: string, body?: unknown) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
  }
}

/** Walk the three registration steps and return the finished session. */
async function register(email: string, fullName: string, companyName?: string) {
  const session = new Session();
  const start = await session.post('/api/auth/register/start', { email, fullName });
  assert.equal(start.status, 200);
  assert.ok(start.body.devCode, 'expected a dev code outside production');

  const verify = await session.post('/api/auth/register/verify', { email, code: start.body.devCode });
  assert.equal(verify.status, 200);

  const complete = await session.post('/api/auth/register/complete', {
    registrationToken: verify.body.registrationToken,
    fullName,
    password: 'a-long-enough-password',
    companyName,
  });

  return { session, match: verify.body.match, complete };
}

before(async () => {
  seedFixtures();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
  db.close();
  rmSync(workDir, { recursive: true, force: true });
});

function seedFixtures(): void {
  const now = nowIso();
  const hash = bcrypt.hashSync('a-long-enough-password', 4);

  db.prepare(
    `INSERT INTO clients (id, company_name, client_type, status, primary_contact_email, email_domain, created_at)
     VALUES (?, 'Northbank Studios', 'brand', 'active', 'freya@northbankstudios.test', 'northbankstudios.test', ?)`,
  ).run(NORTHBANK, now);

  db.prepare(
    `INSERT INTO clients (id, company_name, client_type, status, primary_contact_email, email_domain, created_at)
     VALUES (?, 'Aurelia Beauty', 'brand', 'active', 'priya@aureliabeauty.test', 'aureliabeauty.test', ?)`,
  ).run(AURELIA, now);

  db.prepare(
    `INSERT INTO client_contacts (id, client_id, full_name, email, role, is_primary, active, created_at)
     VALUES (?, ?, 'Freya Lambert', 'freya@northbankstudios.test', 'Head of Brand', 1, 1, ?)`,
  ).run(newId(), NORTHBANK, now);

  for (const [id, clientId, reference, title, status, startDate] of [
    // Dated in the future and confirmed, so it also appears in the dashboard's
    // "coming up" list — that is the shape that regressed.
    ['booking-nb-1', NORTHBANK, 'GEN-T-001', 'Northbank campaign', 'confirmed', '2099-05-01'],
    ['booking-au-1', AURELIA, 'GEN-T-002', 'Aurelia beauty stills', 'completed', '2025-05-01'],
  ] as const) {
    db.prepare(
      `INSERT INTO bookings (id, client_id, reference, title, job_type, status, start_date, fee_pence,
                             agency_fee_pence, created_at)
       VALUES (?, ?, ?, ?, 'campaign', ?, ?, 100000, 20000, ?)`,
    ).run(id, clientId, reference, title, status, startDate, now);
  }

  db.prepare(
    `INSERT INTO booking_models (id, booking_id, model_name, board, role, day_rate_pence, status)
     VALUES (?, 'booking-nb-1', 'Aiyana Brooks', 'women', 'Lead', 100000, 'confirmed')`,
  ).run(newId());

  db.prepare(
    `INSERT INTO communications (id, client_id, booking_id, channel, direction, subject, body,
                                 visible_to_client, occurred_at, created_at)
     VALUES (?, ?, 'booking-nb-1', 'email', 'inbound', 'Client visible note', 'Body', 1, ?, ?)`,
  ).run(newId(), NORTHBANK, now, now);

  db.prepare(
    `INSERT INTO communications (id, client_id, booking_id, channel, direction, subject, body,
                                 visible_to_client, occurred_at, created_at)
     VALUES (?, ?, 'booking-nb-1', 'note', 'outbound', 'INTERNAL margin note', 'Secret', 0, ?, ?)`,
  ).run(newId(), NORTHBANK, now, now);

  db.prepare(
    `INSERT INTO invoices (id, client_id, booking_id, number, status, issued_on, due_on,
                           net_pence, vat_pence, total_pence, created_at)
     VALUES (?, ?, 'booking-nb-1', 'INV-T-001', 'sent', '2025-05-10', '2025-06-10', 100000, 20000, 120000, ?)`,
  ).run(newId(), NORTHBANK, now);

  db.prepare(
    `INSERT INTO users (id, email, full_name, password_hash, client_id, link_status, role, email_verified_at, created_at)
     VALUES ('user-admin', 'ops@genesismodelmgmt.test', 'Ops', ?, NULL, 'unlinked', 'agency_admin', ?, ?)`,
  ).run(hash, now, now);
}

describe('email matching', () => {
  it('normalises addresses and reads domains', () => {
    assert.equal(normaliseEmail('  Freya@Northbank.TEST '), 'freya@northbank.test');
    assert.equal(emailDomain('freya@northbank.test'), 'northbank.test');
    assert.equal(isConsumerDomain('gmail.com'), true);
    assert.equal(isConsumerDomain('northbankstudios.test'), false);
  });

  it('treats a known contact address as an exact match', () => {
    const matches = findClientMatches(db, 'freya@northbankstudios.test');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].confidence, 'exact');
    assert.equal(decideLink(matches).kind, 'linked');
  });

  it('treats an unknown address on a known company domain as needing review', () => {
    const matches = findClientMatches(db, 'brand.new@northbankstudios.test');
    assert.equal(matches[0]?.confidence, 'domain');
    assert.equal(decideLink(matches).kind, 'pending_review');
  });

  it('never matches on a consumer mailbox domain', () => {
    assert.deepEqual(findClientMatches(db, 'someone@gmail.com'), []);
    assert.equal(decideLink([]).kind, 'new_customer');
  });
});

describe('registration', () => {
  it('does not reveal whether an address is known before the code is verified', async () => {
    const anon = new Session();
    const known = await anon.post('/api/auth/register/start', {
      email: 'freya@northbankstudios.test',
      fullName: 'Freya Lambert',
    });
    const unknown = await anon.post('/api/auth/register/start', {
      email: 'nobody@elsewhere.test',
      fullName: 'Nobody Here',
    });

    assert.equal(known.status, unknown.status);
    assert.equal(known.body.message, unknown.body.message);
    assert.equal('companyName' in known.body, false);
  });

  it('links an existing customer to their full history', async () => {
    const { match, complete, session } = await register('freya@northbankstudios.test', 'Freya Lambert');

    assert.equal(match.kind, 'linked');
    assert.equal(match.companyName, 'Northbank Studios');
    assert.equal(match.history.bookings, 1);
    assert.equal(match.history.invoices, 1);
    assert.equal(complete.status, 201);
    assert.equal(complete.body.user.linkStatus, 'linked');

    const overview = await session.get('/api/portal/overview');
    assert.equal(overview.status, 200);
    assert.equal(overview.body.client.companyName, 'Northbank Studios');
    assert.equal(overview.body.stats.totalBookings, 1);

    const bookings = await session.get('/api/portal/bookings');
    assert.equal(bookings.body.bookings[0].reference, 'GEN-T-001');
  });

  it('returns the cast on every booking shape the UI renders', async () => {
    const session = new Session();
    await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });

    // The dashboard, the list and the detail view all render model names, so
    // `models` has to be present on all three or the page crashes.
    const overview = await session.get('/api/portal/overview');
    assert.ok(overview.body.upcomingBookings.length > 0, 'fixture should produce an upcoming booking');
    for (const booking of overview.body.upcomingBookings) {
      assert.ok(Array.isArray(booking.models), 'overview bookings need a models array');
      assert.equal(booking.models[0]?.name, 'Aiyana Brooks');
    }

    const list = await session.get('/api/portal/bookings');
    for (const booking of list.body.bookings) {
      assert.ok(Array.isArray(booking.models), 'listed bookings need a models array');
    }

    const detail = await session.get('/api/portal/bookings/booking-nb-1');
    assert.ok(Array.isArray(detail.body.booking.models));
  });

  it('holds a domain-only match for agency approval and shows nothing until approved', async () => {
    const { match, session } = await register('newstarter@northbankstudios.test', 'New Starter');
    assert.equal(match.kind, 'pending_review');

    const blocked = await session.get('/api/portal/bookings');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'link_pending');

    const admin = new Session();
    await admin.post('/api/auth/login', { email: 'ops@genesismodelmgmt.test', password: 'a-long-enough-password' });

    const queue = await admin.get('/api/admin/link-requests');
    assert.equal(queue.status, 200);
    const request = queue.body.requests.find((r: any) => r.user.email === 'newstarter@northbankstudios.test');
    assert.ok(request, 'expected a pending link request');

    const decision = await admin.post(`/api/admin/link-requests/${request.id}`, { decision: 'approve' });
    assert.equal(decision.status, 200);

    const allowed = await session.get('/api/portal/bookings');
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.bookings.length, 1);
  });

  it('opens a fresh client record for a brand new customer', async () => {
    const { match, session } = await register('hello@unheardof.test', 'Sam Fielder', 'Unheard Of Ltd');
    assert.equal(match.kind, 'new_customer');

    const overview = await session.get('/api/portal/overview');
    assert.equal(overview.status, 200);
    assert.equal(overview.body.client.companyName, 'Unheard Of Ltd');
    assert.equal(overview.body.stats.totalBookings, 0);
  });

  it('rejects a wrong verification code', async () => {
    const anon = new Session();
    await anon.post('/api/auth/register/start', { email: 'wrongcode@elsewhere.test', fullName: 'Wrong Code' });
    const verify = await anon.post('/api/auth/register/verify', { email: 'wrongcode@elsewhere.test', code: '000000' });
    assert.equal(verify.status, 400);
  });
});

describe('tenant isolation', () => {
  it('does not return another client\'s booking by id', async () => {
    const session = new Session();
    const login = await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });
    assert.equal(login.status, 200);

    const own = await session.get('/api/portal/bookings/booking-nb-1');
    assert.equal(own.status, 200);

    const other = await session.get('/api/portal/bookings/booking-au-1');
    assert.equal(other.status, 404);
  });

  it('hides internal notes from the client timeline', async () => {
    const session = new Session();
    await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });

    const comms = await session.get('/api/portal/communications');
    assert.equal(comms.status, 200);
    const subjects = comms.body.communications.map((c: any) => c.subject);
    assert.ok(subjects.includes('Client visible note'));
    assert.ok(!subjects.some((s: string) => s?.includes('INTERNAL')));
  });

  it('refuses to attach a portal message to another client\'s booking', async () => {
    const session = new Session();
    await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });

    const rejected = await session.post('/api/portal/communications', {
      subject: 'Trying it on',
      body: 'Attach this to someone else',
      bookingId: 'booking-au-1',
    });
    assert.equal(rejected.status, 400);
  });

  it('requires a session for portal data', async () => {
    const anon = new Session();
    assert.equal((await anon.get('/api/portal/overview')).status, 401);
    assert.equal((await anon.get('/api/admin/link-requests')).status, 401);
  });

  it('refuses agency routes to a client account', async () => {
    const session = new Session();
    await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });
    assert.equal((await session.get('/api/admin/link-requests')).status, 403);
  });
});

describe('portal messaging', () => {
  it('adds a client message to the shared timeline', async () => {
    const session = new Session();
    await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });

    const sent = await session.post('/api/portal/communications', {
      subject: 'Availability for October',
      body: 'Could we hold two models for the week of the 12th?',
      bookingId: 'booking-nb-1',
    });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.communication.channel, 'portal');

    const comms = await session.get('/api/portal/communications');
    assert.ok(comms.body.communications.some((c: any) => c.subject === 'Availability for October'));
  });
});
