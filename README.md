# Genesis Model Management — Client Portal

A sign-in area for Genesis clients. A booker signs in, and everything the agency
already holds for their company — bookings, correspondence, invoices — is there
waiting for them. Someone enquiring for the first time gets an account too, and
their history starts collecting from that moment.

## The part that matters: recognising a returning client

Registration runs in three steps, and the order is deliberate.

1. **Who are you.** Name and work email. We send a six-digit code and say
   nothing else — the response is byte-for-byte identical whether or not the
   address is known to Genesis, so the form cannot be used to find out who the
   agency's clients are.
2. **Prove the address.** Once the code comes back, and only then, the portal
   says what it found: *"Welcome back, Northbank Studios — 6 bookings, 16
   messages, 5 invoices, working with Genesis since August 2023."*
3. **Set a password.** The account is created and the history is attached.

Matches are graded by how much they actually prove:

| Signal | What it means | What happens |
| --- | --- | --- |
| `exact` | The address is on the client record (a known contact, or the main contact) | Linked automatically — the emailed code already proved they own the mailbox |
| `domain` | Only the company domain matches — a new colleague at a client we know | Account created, but the history stays shut until Genesis approves the request |
| none | Nothing on file | A fresh client record is opened, status `prospect` |

Consumer mailbox domains (gmail, outlook, icloud and friends) never count as a
domain match — otherwise half of London would match on `gmail.com`.

Ambiguity always resolves towards asking a human. Two companies claiming the
same address, or a domain-only hit, goes to the agency queue rather than
guessing, because guessing wrong means showing one client another client's fees.

## Running it

```bash
npm install
npm run seed      # demo data — fictional companies, models and figures
npm run dev       # API on :4000, portal on :5173
```

Open http://localhost:5173.

No mail transport is configured, so verification codes are printed to the server
terminal and returned by the API outside production. `REVEAL_CODES=false` turns
the API half of that off; in production it is off regardless.

### Demo logins

| Who | How |
| --- | --- |
| Existing client user | `hugo.reyes@northbankstudios.com` / `Portal-Demo-2026` |
| Genesis staff | `ops@genesismodelmgmt.co.uk` / `Portal-Demo-2026` |

And to watch a history link itself up, **register** (do not sign in) as:

| Address | Outcome |
| --- | --- |
| `freya.lambert@northbankstudios.com` | Exact match — six years of history attaches immediately |
| `ines.duarte@northbankstudios.com` | Exact match on a non-primary contact |
| `anyone.new@northbankstudios.com` | Domain match — lands in the agency approval queue |
| anything else | New customer — fresh client record |

Everything in the seed is invented. No real client, booking or payment appears
in it, and `npm run seed` refuses to run with `NODE_ENV=production`.

## Layout

```
server/            Express + SQLite API
  src/schema.sql   Tables, written portably so it can move to Postgres/Supabase
  src/matching.ts  How a returning client is recognised
  src/auth.ts      Passwords, sessions, verification codes, the tenant gate
  src/routes/      auth (register + sign in), portal (client data), admin (queue)
  test/            16 tests, including the isolation cases
client/            React + Vite + Tailwind portal
  src/pages/       Sign in, register, dashboard, bookings, correspondence, invoices, account
```

## How the data is kept apart

Every portal route resolves the client id from the **session**, never from the
request. There is no path parameter or body field a signed-in user could change
to reach another company's records — asking for a booking id that belongs to
someone else returns 404, not the booking. Communications marked
`visible_to_client = 0` (internal margin notes and the like) are filtered out of
every client-facing query.

The test suite covers those cases directly:

```bash
npm test
```

## Configuration

Copy `.env.example` to `server/.env`. In production `SESSION_SECRET` is required
and must be at least 32 characters — the server refuses to start without it,
rather than signing cookies with a key that changes on every restart.

## Not built yet

Worth knowing before this goes near live data:

- **Password reset.** The `verification_codes` table has a `reset` purpose and
  the mailer is ready, but no route uses it. Clients who forget a password
  currently need the agency to intervene.
- **A real mail transport.** `deliver()` logs instead of sending. Until it is
  wired to a provider, nobody receives their verification code by email.
- **The CRM link.** Bookings, communications and invoices are read from this
  database. Feeding it from First Option / MediaSlide is a separate job.
- **Session revocation.** Sessions are stateless JWTs; signing out clears the
  cookie but an already-issued token stays valid until it expires (12h default).
- **Invoice PDFs.** The invoices page lists figures; it does not yet produce the
  branded statement PDF the accounts desk sends today.
