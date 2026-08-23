import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

// The env module reads process.env at import time, so configure before importing.
const workDir = mkdtempSync(join(tmpdir(), 'genesis-public-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = join(workDir, 'public.db');
process.env.SESSION_SECRET = 'test-secret-that-is-definitely-long-enough';
// Deliberately blank: a present-but-empty variable must fall back to the
// default rather than becoming Number('') === 0 and disabling the cache.
process.env.INSTAGRAM_CACHE_MINUTES = '';

const { openDatabase, setDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/env.js');
const { headerSafe } = await import('../src/mailer.js');

const db = openDatabase(process.env.DATABASE_FILE!);
setDb(db);

let server: Server;
let baseUrl: string;

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function get(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
  db.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('environment parsing', () => {
  it('falls back to the default when a numeric variable is present but blank', () => {
    // Number('') is 0, which would disable the feed cache entirely.
    assert.equal(env.instagramCacheMinutes, 10);
  });
});

describe('public newsletter', () => {
  it('accepts a signup and stores it lower-cased', async () => {
    const res = await post('/api/public/newsletter', { email: 'Booker@Example.com', source: 'home' });
    assert.equal(res.status, 201);

    const row = db.prepare(`SELECT email, source FROM newsletter_subscribers WHERE email = ?`).get('booker@example.com') as
      | { email: string; source: string }
      | undefined;
    assert.equal(row?.source, 'home');
  });

  it('treats a repeat signup as success without duplicating the row', async () => {
    await post('/api/public/newsletter', { email: 'twice@example.com' });
    const second = await post('/api/public/newsletter', { email: 'twice@example.com' });
    assert.equal(second.status, 201);

    const count = db.prepare(`SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE email = ?`).get('twice@example.com') as {
      n: number;
    };
    assert.equal(count.n, 1);
  });

  it('rejects an address that is not an email', async () => {
    const res = await post('/api/public/newsletter', { email: 'not-an-address' });
    assert.equal(res.status, 400);
  });
});

describe('public enquiries', () => {
  it('stores an enquiry so it survives without a mail transport', async () => {
    const res = await post('/api/public/enquiries', {
      kind: 'booking',
      fullName: 'Hugo Reyes',
      email: 'hugo@example.com',
      company: 'Northbank Studios',
      message: 'Two models for a two-day shoot in October, UK e-commerce usage.',
    });
    assert.equal(res.status, 201);

    const row = db.prepare(`SELECT full_name, status, kind FROM enquiries WHERE email = ?`).get('hugo@example.com') as
      | { full_name: string; status: string; kind: string }
      | undefined;
    assert.equal(row?.full_name, 'Hugo Reyes');
    // 'new' is what puts it in the agency queue rather than nowhere.
    assert.equal(row?.status, 'new');
  });

  it('rejects an enquiry with too short a message', async () => {
    const res = await post('/api/public/enquiries', {
      fullName: 'Too Brief',
      email: 'brief@example.com',
      message: 'hi',
    });
    assert.equal(res.status, 400);
  });

  it('strips newlines from a subject so a name cannot forge mail headers', () => {
    const forged = headerSafe('Hugo\r\nBcc: everyone@example.com');
    assert.ok(!forged.includes('\n') && !forged.includes('\r'));
    assert.equal(forged, 'Hugo Bcc: everyone@example.com');
  });
});

describe('instagram feed', () => {
  it('reports itself unconfigured rather than failing when no token is set', async () => {
    const res = await get('/api/public/instagram');
    assert.equal(res.status, 200);
    assert.equal(res.body.configured, false);
    // The front end reads this as "show the curated wall".
    assert.deepEqual(res.body.posts, []);
  });
});

describe('enquiry queue is protected', () => {
  it('refuses to list enquiries without an agency session', async () => {
    const res = await get('/api/admin/enquiries');
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`);
  });
});
