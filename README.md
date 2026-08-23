# Genesis Model Management — Website & Client Portal

The Genesis site in two halves that share one origin, one design language and
one deployment:

- **The public site** (`/`, `/work`, `/journal`) — the front door. An
  editorial, image-led home page, a filterable portfolio wall with an
  Instagram integration, and the Genesis Journal: industry news, insights and
  practical guidance, plus the agency's keynotes. Newsletter signup and a
  booking enquiry form both persist to the same database the portal uses.
- **The client portal** (`/sign-in`, `/portal`) — a booker signs in, and
  everything the agency already holds for their company — bookings,
  correspondence, invoices — is there waiting for them. Someone enquiring for
  the first time gets an account too, and their history starts collecting from
  that moment.

## The public site

### Imagery

Two sources feed the pictures, in order of preference:

1. **Instagram** — set `INSTAGRAM_ACCESS_TOKEN` (an Instagram Graph API token
   for @genesismodelmgmt) in `server/.env` and the home page's feed strip shows
   the account's latest posts, cached server-side for
   `INSTAGRAM_CACHE_MINUTES` (default 10). No token, no problem: the strip
   falls back to the curated wall and never renders empty.

   **Issuing the token** — done once, by someone logged into the agency's
   Instagram account. The token is a credential: it goes in `server/.env`
   (gitignored) and never into the repo, a commit or a screenshot.

   1. At [developers.facebook.com](https://developers.facebook.com/apps),
      create an app (type: **Consumer**) and add the **Instagram Basic
      Display** product.
   2. Under *Basic Display*, add @genesismodelmgmt as an **Instagram Test
      User**, then accept the invitation from the Instagram account itself
      (Settings → Apps and Websites → Tester Invites).
   3. Click **Generate Token** next to that user and copy what it produces.
   4. Put it in `server/.env` as `INSTAGRAM_ACCESS_TOKEN=IGQ...`
   5. Verify it before trusting the site to it:

      ```bash
      npm run instagram:check -w server
      ```

      It calls the Graph API exactly as the site does and reports how many
      posts came back and how long the token has left.

   Long-lived tokens last **60 days**. Re-running `instagram:check` refreshes
   the window; let it lapse and the feed quietly falls back to the curated
   wall — no breakage, but no live photos either.
2. **The curated wall** — `client/src/content/gallery.ts`. Drop a MediaSlide
   export into `client/public/work/` and point an entry's `image` at it; until
   then each entry renders a composed editorial frame in the house palette, so
   the layout is finished today and photography slots in one line at a time.

### The Journal and keynotes

`client/src/content/journal.ts` holds the articles (three registers:
industry news, insights, guidance) and the keynotes — short agency positions
shown across the site. Adding a piece is adding an object; no CMS until the
volume justifies one.

### Public API

`/api/public/instagram` (cached feed), `/api/public/newsletter` and
`/api/public/enquiries` (both rate-limited; enquiries are stored, audited and
forwarded to the bookings inbox via the mailer). Nothing under `/api/public`
reads a session or can reach client data.

## The client portal

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
