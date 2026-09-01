import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
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
const { outbox } = await import('../src/mailer.js');
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

  // A producer who ran the account and has since left. The row stays for the
  // agency's own records; it must no longer open the portal.
  db.prepare(
    `INSERT INTO client_contacts (id, client_id, full_name, email, role, is_primary, active, created_at)
     VALUES (?, ?, 'Departed Producer', 'departed@northbankstudios.test', 'Producer', 0, 0, ?)`,
  ).run(newId(), NORTHBANK, now);

  // The same, but on an address whose domain is not on file anywhere, so there is
  // no weaker match underneath and the answer has to come from the active flag.
  db.prepare(
    `INSERT INTO client_contacts (id, client_id, full_name, email, role, is_primary, active, created_at)
     VALUES (?, ?, 'Departed Buyer', 'departed@someoldshop.test', 'Buyer', 0, 0, ?)`,
  ).run(newId(), AURELIA, now);

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

  it('does not auto-link a contact who has been deactivated', () => {
    // The mailbox may still work, and may even have been handed on. Having once
    // been on the account is not authorisation to read it now.
    const matches = findClientMatches(db, 'departed@someoldshop.test');
    assert.deepEqual(matches, [], 'a deactivated contact should produce no match at all');
    assert.equal(decideLink(matches).kind, 'new_customer');
  });

  it('drops a deactivated contact to the domain grade rather than an exact one', () => {
    const matches = findClientMatches(db, 'departed@northbankstudios.test');
    assert.ok(
      !matches.some((m) => m.confidence === 'exact'),
      'a deactivated contact must not still count as an exact match',
    );
    assert.equal(matches[0]?.confidence, 'domain');
    // Which means a human decides, instead of the address auto-linking to years
    // of fees and invoices.
    assert.equal(decideLink(matches).kind, 'pending_review');
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

    // The counts are themselves a disclosure — they confirm the company is a
    // client and say roughly how much it spends — so they stay at zero until a
    // human approves the link, even though the fixture has real history.
    assert.equal(match.history.bookings, 0);
    assert.equal(match.history.communications, 0);
    assert.equal(match.history.invoices, 0);
    assert.equal(match.history.firstBookedOn, null);
    assert.equal(match.history.lastActivityOn, null);

    const blocked = await session.get('/api/portal/bookings');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'link_pending');

    // The account page is the one place a pending user is still answered, and it
    // must answer without handing over the company record it is waiting on.
    const account = await session.get('/api/portal/account');
    assert.equal(account.status, 200);
    assert.equal(account.body.client, null, 'a pending account must not receive the company record');
    assert.deepEqual(account.body.teammates, []);
    assert.equal(account.body.linkRequest.status, 'pending');

    // The company *name* is deliberately not on this list: a pending match is
    // told which company it matched, both here and at registration step 2, so
    // the person can say "that is not us". What must not travel is the company
    // record — where it is billed, who runs it, who books it.
    const serialised = JSON.stringify(account.body);
    for (const secret of ['billingAddress', 'accountManager', 'primaryContact', 'clientType', 'createdAt']) {
      assert.ok(!serialised.includes(secret), `pending account payload leaked ${secret}`);
    }

    // Same rule on the session route that feeds the page chrome.
    const me = await session.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.client, null, 'a pending account must not learn the company name from /me');

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

    // And once a human has approved it, the same account gets the record.
    const approvedAccount = await session.get('/api/portal/account');
    assert.equal(approvedAccount.status, 200);
    assert.equal(approvedAccount.body.client.companyName, 'Northbank Studios');
    // Still not the primary contact address — nothing renders it.
    assert.equal('primaryContactEmail' in approvedAccount.body.client, false);
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

describe('password reset', () => {
  /** The code never appears in a response, so read it out of the mailer. */
  function lastResetCodeFor(email: string): string {
    const message = [...outbox].reverse().find((m) => m.to === email && m.subject.includes('Reset'));
    assert.ok(message, `expected a reset email to ${email}`);
    const code = message.body.match(/\b\d{6}\b/)?.[0];
    assert.ok(code, 'expected a six-digit code in the reset email');
    return code;
  }

  it('answers identically whether or not the address has an account', async () => {
    const anon = new Session();
    const known = await anon.post('/api/auth/password/reset-request', { email: 'freya@northbankstudios.test' });
    const unknown = await anon.post('/api/auth/password/reset-request', { email: 'nobody-at-all@elsewhere.test' });

    assert.equal(known.status, unknown.status);
    // Byte-identical, not merely similar: any difference at all — an extra key,
    // a different message, a dev-only code — answers the question this endpoint
    // exists to refuse to answer.
    assert.equal(JSON.stringify(known.body), JSON.stringify(unknown.body));
    assert.equal(JSON.stringify(known.body).includes('devCode'), false);

    // And no code is minted for an address with no account, so the reveal cannot
    // arrive by a later route either.
    const unknownRow = db
      .prepare(`SELECT COUNT(*) AS n FROM verification_codes WHERE email = ? AND purpose = 'reset'`)
      .get('nobody-at-all@elsewhere.test') as { n: number };
    assert.equal(unknownRow.n, 0);
  });

  it('sets a new password, signs the client in, and cannot be replayed', async () => {
    const email = 'freya@northbankstudios.test';
    const session = new Session();
    assert.equal((await session.post('/api/auth/password/reset-request', { email })).status, 200);

    const code = lastResetCodeFor(email);
    const reset = await session.post('/api/auth/password/reset', {
      email,
      code,
      password: 'a-brand-new-long-password',
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.user.email, email);

    // The reset session is a real one.
    assert.equal((await session.get('/api/portal/overview')).status, 200);

    // Single use: the same code a second time is refused.
    const replay = await session.post('/api/auth/password/reset', {
      email,
      code,
      password: 'yet-another-long-password',
    });
    assert.equal(replay.status, 400);

    const fresh = new Session();
    assert.equal((await fresh.post('/api/auth/login', { email, password: 'a-brand-new-long-password' })).status, 200);

    const stale = new Session();
    assert.equal((await stale.post('/api/auth/login', { email, password: 'a-long-enough-password' })).status, 401);

    // Put the fixture password back for the tests that follow.
    const restore = await fresh.post('/api/auth/password/reset-request', { email });
    assert.equal(restore.status, 200);
    const restoreCode = lastResetCodeFor(email);
    assert.equal(
      (await fresh.post('/api/auth/password/reset', { email, code: restoreCode, password: 'a-long-enough-password' }))
        .status,
      200,
    );
  });

  it('rejects a wrong reset code', async () => {
    const anon = new Session();
    await anon.post('/api/auth/password/reset-request', { email: 'freya@northbankstudios.test' });
    const wrong = await anon.post('/api/auth/password/reset', {
      email: 'freya@northbankstudios.test',
      code: '000000',
      password: 'a-long-enough-password',
    });
    assert.equal(wrong.status, 400);
  });

  it('refuses a password below the minimum length', async () => {
    const anon = new Session();
    const short = await anon.post('/api/auth/password/reset', {
      email: 'freya@northbankstudios.test',
      code: '123456',
      password: 'short',
    });
    assert.equal(short.status, 400);
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

  it('keeps the agency\'s margin out of every booking shape', async () => {
    const session = new Session();
    await session.post('/api/auth/login', {
      email: 'freya@northbankstudios.test',
      password: 'a-long-enough-password',
    });

    // The client is told what they were charged. The split that produced it —
    // model fee before commission, the commission itself, and the per-model day
    // rates that make it up — is the agency's, and any one of them next to the
    // total gives up the other by subtraction.
    const withheld = ['agencyFeePence', 'feePence', 'dayRatePence'];

    const list = await session.get('/api/portal/bookings');
    const detail = await session.get('/api/portal/bookings/booking-nb-1');
    const overview = await session.get('/api/portal/overview');

    for (const [name, response] of [
      ['bookings list', list],
      ['booking detail', detail],
      ['overview', overview],
    ] as const) {
      const serialised = JSON.stringify(response.body);
      for (const field of withheld) {
        assert.ok(!serialised.includes(field), `${name} exposed ${field}`);
      }
    }

    // What the client legitimately needs is still there.
    assert.equal(detail.body.booking.totalPence, 120000);
    assert.equal(detail.body.invoices[0].totalPence, 120000);
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

describe('development code reveal', () => {
  /**
   * env reads process.env once, at import time, so the only honest way to ask
   * what a differently-configured deployment would put in the response body is
   * to boot the app in one and look.
   */
  const serverRoot = fileURLToPath(new URL('..', import.meta.url));
  const appModule = pathToFileURL(join(serverRoot, 'src', 'app.ts')).href;
  const run = promisify(execFile);

  async function registerStartUnder(overrides: Record<string, string | undefined>) {
    const probe = join(workDir, `probe-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(
      probe,
      [
        `const { createApp } = await import(${JSON.stringify(appModule)});`,
        'const server = createApp().listen(0);',
        'await new Promise((resolve) => server.once("listening", resolve));',
        'const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register/start`, {',
        '  method: "POST",',
        '  headers: { "content-type": "application/json" },',
        '  body: JSON.stringify({ email: "probe@elsewhere.test", fullName: "Probe Account" }),',
        '});',
        'const body = await response.text();',
        'server.close();',
        'console.log("PROBE:" + JSON.stringify({ status: response.status, body }));',
      ].join('\n'),
    );

    const childEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      SESSION_SECRET: 'probe-secret-that-is-definitely-long-enough',
      DATABASE_FILE: join(workDir, `probe-${Math.random().toString(36).slice(2)}.db`),
      APP_URL: 'http://localhost:5173',
    };
    // This file is itself running as a node:test child. Left in place, these make
    // the probe think it is one too, and it writes the reporter's binary protocol
    // over the result we are trying to read.
    for (const key of ['NODE_TEST_CONTEXT', 'NODE_OPTIONS', 'NODE_V8_COVERAGE']) delete childEnv[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete childEnv[key];
      else childEnv[key] = value;
    }

    const { stdout } = await run(process.execPath, ['--import', 'tsx', probe], {
      cwd: serverRoot,
      env: childEnv,
    });

    const line = stdout.split('\n').find((l) => l.startsWith('PROBE:'));
    assert.ok(line, `probe produced no result. stdout was:\n${stdout}`);
    return JSON.parse(line.slice('PROBE:'.length)) as { status: number; body: string };
  }

  it('never returns devCode when NODE_ENV is production', async () => {
    // REVEAL_CODES is deliberately set to true here: production must win anyway.
    const result = await registerStartUnder({ NODE_ENV: 'production', REVEAL_CODES: 'true' });

    assert.equal(result.status, 200);
    assert.equal(result.body.includes('devCode'), false, 'production must never return a verification code');
    assert.equal('devCode' in JSON.parse(result.body), false);
    // The endpoint still works — it is the code that is withheld, not the reply.
    assert.equal(JSON.parse(result.body).ok, true);
  });

  it('stays off outside production unless REVEAL_CODES is explicitly true', async () => {
    // The staging case: nobody set NODE_ENV, nobody set REVEAL_CODES. It used to
    // default on, which made every such box hand out codes for any address.
    const unset = await registerStartUnder({ NODE_ENV: undefined, REVEAL_CODES: undefined });
    assert.equal('devCode' in JSON.parse(unset.body), false);

    // A value that is not exactly "true" is not true.
    const fuzzy = await registerStartUnder({ NODE_ENV: 'staging', REVEAL_CODES: '1' });
    assert.equal('devCode' in JSON.parse(fuzzy.body), false);

    // And the development convenience still works when it is asked for.
    const on = await registerStartUnder({ NODE_ENV: 'development', REVEAL_CODES: 'true' });
    assert.equal(typeof JSON.parse(on.body).devCode, 'string');
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
