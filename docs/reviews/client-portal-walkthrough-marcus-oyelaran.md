# The Genesis client portal — a producer's walkthrough

Reviewer: Marcus Oyelaran, Executive Producer
Date of review: 1 September 2026
Surfaces examined: the reference implementation on disk at `/home/user/Website-Development` (Express + SQLite + React), and read-only reads of the live Lovable project `genesismm` (`24db8413-d76d-4629-a829-bae09fdee220`). Where the two differ I say which one I mean.
Method: code review only. No live testing, no requests to the sign-in form, nothing sent.

## Who I am

Sixteen years client-side, currently running production at an integrated shop in London. On any given month I have four or five agencies in play and somewhere between six and twenty models on option. The shape of my week is always the same: a brand hands me a date and a number, I brief the agencies, packages come back, I option, I get overruled on budget, I confirm, and then eight weeks later somebody in finance emails me at 7pm asking why invoice 4102 doesn't match PO 88231 and whether the usage on the Manchester shoot has expired yet.

That last part is why I care about client portals at all. Most of my agency admin is archaeology — finding a thing I already agreed, in a thread I can no longer locate, with a person who has since left. A portal that lets me do that archaeology myself at 11pm is worth real money to me.

I am also prejudiced. I have had logins to maybe nine agency portals; seven were a password wall in front of "no records found". So my bar is low and my scepticism is high. And after a decade of GDPR training I notice when a form tells me something it shouldn't — whether an address is on file is itself a disclosure, and most people building these things have never thought about it.

## What I was trying to do

Six jobs with Genesis over three years. I wanted to: get in; find the November campaign; check what usage I actually bought and when it runs out; pull the invoice; see the thread where we agreed the extension; and brief a new job. Ten steps, below.

## The walkthrough

### 1. The arrival

I could not find it. That is deliberate and current.

On the live site the entry points are switched off by a flag: `src/lib/portal-flags.ts` in the Lovable project reads `export const PORTAL_PUBLIC_ENTRY = false;`, with a comment saying to set it back to true "once the Supabase auth email sender is confirmed to deliver". `docs/portal-build-4-hide-entry-links.md:11-21` records the decision: header link, footer link and the line on `/clients` all stop rendering, but `/portal/sign-in` stays reachable by direct URL with no holding page. `public/robots.txt` on the live project carries `Disallow: /portal`.

So the repo history's claim is accurate and still true: the portal is live, functional and invisible. I could not fetch the rendered page — egress to that host is blocked here — so this comes from the flag and the brief, not from served HTML.

**My reaction.** Correct call, given step 5 below. But it means the only way I get in is a booker emailing me a link, which is the exact behaviour the portal exists to replace. Fine as a two-week state; it has been off since the build-4 brief.

### 2. Registration, step 1

`POST /api/auth/register/start` (`server/src/routes/auth.ts:66-99`). Name and work email, and I get back exactly: `{ ok: true, message: 'If that address can be used, a six-digit code is on its way.' }`.

The README's headline claim is that this is identical whether or not Genesis knows me. **I checked it and it holds.** The only branch in that handler is on the `users` table (`auth.ts:75`) — whether I already have a *portal login* — not on the `clients` or `client_contacts` tables. Nothing about my history with the agency touches the response. That is the right thing and it is genuinely rare; most portals I have used will happily tell you "we don't recognise that address".

Two caveats, and the second is real.

**A timing side-channel exists, on a different axis than the README's.** With no portal account the handler does a DELETE, an INSERT into `verification_codes` and an `await deliver(...)` (`auth.ts:82-83`); with one it does none of that and falls through to the audit write. Measurably different work before responding. Here `deliver()` is a `console.info` (`server/src/mailer.ts:18-30`) so the gap is small; on live, `docs/portal-build-5-email-sender.md:36-41` says the code is minted with `generateLink` and pushed through the project's email queue — a network call, and not a small gap. It discloses "this address has registered", not "this address is a client", but once the portal has real users those sets converge.

**The response body is not identical outside production.** `env.revealCodes` is `!isProduction && process.env.REVEAL_CODES !== 'false'` (`server/src/env.ts:42`), and when on, the unregistered path returns `devCode` in the JSON while the registered path does not (`auth.ts:84, 97`). On a staging box where nobody set `NODE_ENV=production`, that endpoint hands the verification code for any address to anyone who asks. That is not a side-channel, that is the front door.

### 3. The code

`server/src/auth.ts:141-200`. Credit where it is due, this is the most carefully built part of the system.

- Generated with `randomInt(0, 1_000_000)` — a CSPRNG, not `Math.random()` (`auth.ts:144`).
- Stored as a SHA-256 hash, never in plaintext (`auth.ts:141, 160`), in `verification_codes` (`server/src/schema.sql:74-83`).
- Compared with `timingSafeEqual` on equal-length buffers (`auth.ts:189-191`).
- Fifteen-minute TTL (`env.ts:43`), five attempts per code (`env.ts:44`, enforced `auth.ts:187`), one live code per address and purpose — a new request deletes the old unconsumed row (`auth.ts:149-152`).
- Single-use: `consumed_at` is stamped on success and every lookup filters `consumed_at IS NULL` (`auth.ts:178, 198`). Not replayable.

Brute force is not practical. The attempt counter does reset when you request a fresh code, but the per-IP limiter caps you at six requests per fifteen minutes, so a million-space search is out of reach.

**The rate limiter is where I have a complaint, and it is a client-experience one.** `codeRequestLimiter` is a single middleware instance mounted on *both* `/register/start` and `/register/verify` (`auth.ts:66, 114`), so its six-per-fifteen-minutes budget (`env.ts:46`) is shared across the two. Request a code, mistype it twice, request a fresh one — you are at four. And it is keyed on IP. My production company sits behind one office NAT: two producers registering the same afternoon lock each other out, and the message says "Too many codes requested" with no hint that a colleague caused it.

Related: `app.set('trust proxy', 1)` (`server/src/app.ts:18`). Behind exactly one proxy that is right. Deployed with none, or with two, `req.ip` comes from a client-controlled `X-Forwarded-For` and the limiter is a suggestion.

### 4. Recognition — the moment that matters

`POST /api/auth/register/verify` (`auth.ts:114-168`) runs `findClientMatches` then `decideLink` (`server/src/matching.ts:85-182`), and only then says what it found. The ordering is right and it is the thing I would praise loudest: nothing is disclosed until I have proven I own the mailbox.

The grading is real, not decorative:

- **exact** — my address is in `client_contacts.email`, or is `clients.primary_contact_email` (`matching.ts:97-133`). One exact hit auto-links (`matching.ts:175`).
- **more than one exact hit** — the same address against two companies goes to review, not to a guess (`matching.ts:176`).
- **domain** — only the company domain matches, and never for a consumer mailbox; the list at `matching.ts:34-59` covers gmail, outlook, icloud, proton, hey and twenty others. Goes to review (`matching.ts:179`).
- **nothing** — new client record, status `prospect` (`auth.ts:236-252`).

And crucially, the match is **recomputed server-side at step 3** rather than trusted from the step-2 payload (`auth.ts:216-218`), so I cannot tamper my way into a company. That comment is in the code and the code does what it says.

Now the problems.

**Deactivated contacts still get the keys.** `client_contacts` has an `active` column (`schema.sql:42`), the seed sets it, and the matcher never reads it. The exact-match query at `matching.ts:97-105` filters `c.status != 'archived'` and nothing else. So the producer who ran Northbank's account until 2023, left, and still controls that mailbox — or whose successor now receives it on a catch-all — gets `exact`, auto-links, and pulls three years of fees, invoices and correspondence with no human in the loop.

**The domain grade discloses more than the README says.** The README promises that on a domain-only match "the history stays shut until Genesis approves the request". It isn't shut. `auth.ts:156-167` calls `summariseHistory` and returns full counts for `pending_review` as well as `linked`, and `client/src/pages/Register.tsx:306-332` renders them: company name, bookings, messages, invoices, "Working with Genesis since [date]". Anyone with any mailbox at a company domain learns that the company is a Genesis client and roughly how much business it does.

That is a regression against the live implementation, not an original sin. In the Lovable project, `src/lib/portal-matching.server.ts` returns `history: { enquiries: 0, messages: 0, packages: 0, firstSeen: null }` on *every* `pending_review` branch. Live gets this right; the repo does not.

**If it gets me wrong, I cannot say so.** I searched `client/` and `server/` for a dispute path — "not me", "wrong company", "dispute" — nothing. The only rejection route is agency-side (`server/src/routes/admin.ts:66-131`). If the portal greets me as the wrong company, my only move is to register under it or abandon the form.

### 5. Password and account creation

`POST /api/auth/register/complete` (`auth.ts:195-303`). Ten characters minimum, two hundred maximum (`auth.ts:48-51`), bcrypt at cost 12 (`auth.ts:8, 33`) — a good, current choice. Ten characters with no breach check and no blocklist means `Password12` passes; for an account that exposes another company's commercial terms I would want a compromised-password check.

**No 2FA.** I grepped `totp`, `2fa`, `two-factor`, `mfa`, `authenticator`. Zero hits.

**No password reset.** `verification_codes` carries a `reset` purpose (`schema.sql:78`) and `createVerificationCode` accepts it (`auth.ts:147`), but no route calls it. `SignIn.tsx` has no "forgot password" link — I read the whole file. The README is honest about this at line 107.

**And the dead end that follows.** If I already have an account and go to Register anyway — which I will, because I registered eight months ago and forgot — step 1 silently sends nothing (`auth.ts:81`) and tells me a code is on its way. I type a guess. Step 2 fails with "That code has expired or was already used. Request a new one." (`auth.ts:127`). I request another. Same. There is no forgot-password link, and the "Already set up? Sign in" link appears only on step 1, not on the code step (`Register.tsx:179-184`). I am stuck in a loop with a misleading error and no exit. This will happen to more clients than every security issue in this document combined.

### 6. Inside: bookings

This is the strongest room in the house. `GET /api/portal/bookings` and `/bookings/:id` (`server/src/routes/portal.ts:259-342`) give me reference, title, job type, status, date range, location, **usage terms**, model fees, agency fee, total, the booker at Genesis, the brief, and the full cast with board, role, day rate and per-model status. `client/src/pages/BookingDetail.tsx` lays it out with correspondence and invoices for that job alongside. I found my November job; search covers title, reference and location (`portal.ts:278`) and there is a status filter.

**Usage is prose, not data.** `bookings.usage_terms` is free text (`schema.sql:119`); the seed holds strings like "Print, OOH and digital, 18 months, UK and EU." (`server/src/seed.ts:178`). Readable, and better than most agencies manage. But I cannot ask the question I actually need answered — "what expires in the next ninety days". No expiry date, no territory field, no media list.

**You are showing me your commission.** `agency_fee_pence` goes to the browser on every booking (`portal.ts:87`, typed at `client/src/api.ts:87`) and renders as "Agency fee" (`BookingDetail.tsx:115`), alongside each model's day rate (`BookingDetail.tsx:62-64`). I am delighted. I am also fairly sure nobody decided it — the system goes to real trouble to hide internal margin notes via `visible_to_client` (`schema.sql:160-162`, filtered at `portal.ts:221, 318, 364`) and then itemises the commission on the same page. Make it deliberate either way.

No PO number field exists anywhere; I grepped `po_number` and `purchase`.

### 7. Inside: invoices

`GET /api/portal/invoices` (`portal.ts:447-471`). I get outstanding, overdue and paid-to-date totals, then a table: number, linked booking, issued, due, net, VAT, total, status (`client/src/pages/Invoices.tsx`).

The outstanding position is genuinely good and it is the thing my finance director would actually use. But **I cannot pull an invoice.** There is no `/invoices/:id` route — I checked every handler in `portal.ts`. There are no line items; the `invoices` table is number, status, three dates and three money columns (`schema.sql:175-189`). No PO reference. No billing address on the document. No PDF — I grepped `pdf` and got exactly one hit, `Invoices.tsx:32`, which tells me to email the accounts desk for a formal statement.

So the answer to "can I pull an invoice at 11pm and hand it to finance" is no. I can see that an invoice exists and what it totals. My finance team cannot process a row in a web table. I go back to email, which is where I started.

### 8. Inside: correspondence

`GET /api/portal/communications` (`portal.ts:353-391`) returns a flat list, newest first, filterable by channel and searchable over subject and body. Internal notes are excluded everywhere (`portal.ts:364`), and there is a test that proves it (`server/test/portal.test.ts:309-321`).

**They are not threads.** `communications` has a `thread_key` column and an index on it (`schema.sql:159, 169`), the API maps it through (`portal.ts:123`), and nothing groups by it — `Communications.tsx:104-137` renders one flat `<ol>`. The data model knows what a conversation is and the interface throws it away. That is the difference between finding the message where we agreed the extension and scrolling past sixty entries.

**I can reply, and it goes nowhere.** `POST /api/portal/communications` (`portal.ts:400-443`) writes a row with channel `portal`, direction `inbound`, addressed to `bookings@genesismodelmgmt.co.uk`. It never calls `deliver()` — I grepped: the mailer is imported in exactly two files, `routes/auth.ts:19` (verification codes) and `routes/admin.ts:5` (link approvals). There is no agency-side inbox route either; `admin.ts` contains link-requests and nothing else. My message lands in a table no human is notified about and no screen displays.

The UI is also narrower than the API: the composer posts without a `bookingId` (`Communications.tsx:154`) even though the endpoint supports and validates one (`portal.ts:414-420`), and `BookingDetail.tsx` has no composer. So I cannot reply on a job.

To answer the question directly: yes, I go back to email anyway.

### 9. A new enquiry

There is no briefing route. No enquiry form, no dates, budget, usage, territory or model selection. The only inbound channel is the free-text composer above, whose placeholder asks me to type "dates, usage and budget if you have them" into a textarea (`Communications.tsx:194`).

The live surface is ahead of the repo here: `docs/portal-build-1-backend.md:13-18` describes `leads` and `casting_briefs` already carrying `project_name`, `shoot_dates`, `budget`, `usage`, `territory`, `location` and `selected_slugs`, and `docs/portal-build-2-pages.md:19-27` specifies `/portal/enquiries` pages against them. This prototype has none of it.

### 10. The security pass

Code review, not testing. I went through every handler that takes an id.

**Object-level authorisation is clean, and I want to be clear about that.**

| Handler | Check |
| --- | --- |
| `GET /portal/bookings/:id` (`portal.ts:291-297`) | `WHERE id = ? AND client_id = ?` — a guessed id 404s. Tested (`portal.test.ts:305`) |
| `GET /portal/communications?bookingId=` (`portal.ts:371-373`) | Predicate is added *on top of* `client_id = ?` — a foreign id yields `[]` |
| `POST /portal/communications` (`portal.ts:414-420`) | Ownership verified before insert. Tested (`portal.test.ts:330`) |
| `POST /admin/link-requests/:id` (`admin.ts:66`) | Behind `requireAgencyAdmin`. Tested (`portal.test.ts:350`) |
| all `/portal/*` reads | `resolveClientScope` derives the client id from the session (`auth.ts:116-137`) |

There is no path parameter or body field I can edit to reach another company. The README's claim on this is true, and the tests back it.

**The hole is a missing state check, not a missing ownership check.** `GET /api/portal/account` (`portal.ts:475-532`) does **not** call `resolveClientScope`. It reads `user.clientId` off the session directly. A `pending_review` user has `client_id` populated — set during registration at `auth.ts:231-232` — so the endpoint returns the target company's `company_name`, `primary_contact_name`, `primary_contact_email`, `phone`, `billing_address`, `account_manager` and `created_at` to somebody a human has explicitly not approved. The `teammates` list *is* correctly gated on `link_status === 'linked'` (`portal.ts:497`), which tells me the author knew the rule and applied it one field too late.

The page is reachable: `/portal/account` sits inside `RequireAuth` with no link-status gate (`client/src/App.tsx:75`), the Account nav item renders for every non-agency user (`client/src/components/PortalLayout.tsx:9`), and `Account.tsx:61-69` draws company name, main contact, billing address and booker. The same pattern in miniature affects `GET /api/auth/me` (`auth.ts:348-367`), `requireAuth` only, which feeds the company name into the header chrome for a pending user (`PortalLayout.tsx:37`).

Chained with the step-2 disclosure, one mailbox at a company domain buys: confirmation the company is a Genesis client, its booking/invoice/message counts, how long the relationship has run, its billing address, its named main contact and its account manager — without approval. That is the enumeration risk the design set out to prevent, arriving through a side door.

**Also sent to the browser but never rendered:** `client.primaryContactEmail` (`portal.ts:520`, typed at `Account.tsx:14`, drawn nowhere). A small thing until it is in a support screenshot.

**Sessions.** Stateless 12-hour JWTs, `httpOnly`, `sameSite: 'lax'`, `secure` only in production (`auth.ts:50-62`). No revocation — signing out clears the cookie and the token stays valid, as the README admits at line 113. One nuance in its favour: `attachUser` re-reads the user row on every request (`auth.ts:84`), so a rejected link takes effect immediately. No CSRF token, but `sameSite=lax` plus JSON-only bodies plus no CORS means I could not construct a cross-site write. Acceptable.

**Deployment hygiene.** The seed refuses `NODE_ENV=production` (`seed.ts:27-30`), which is right. But "not production" includes staging, and on staging `revealCodes` defaults on and the seed installs an agency-admin account on a real Genesis address using the demo password printed in the README. Any environment not explicitly production is open.

## What's genuinely good

- **The disclosure ordering.** Code first, reveal second. Correct design, asserted by test (`portal.test.ts:191-205`), and step 1 really is identical for a known and an unknown client because the branch is on the wrong table to leak.
- **Match grading that resolves towards a human.** Two companies on one address goes to review, not to a coin flip (`matching.ts:176`), and the consumer-domain exclusion list is thorough (`matching.ts:34-59`).
- **Recomputing the match server-side at step 3** (`auth.ts:216-218`) rather than trusting the step-2 payload.
- **Tenant isolation done structurally**, through one session-derived scope function, so cross-tenant access is not expressible in the API surface — with tests that actually try it.
- **Code handling**: CSPRNG, hashed at rest, `timingSafeEqual`, single-use, attempt-capped.
- **`visible_to_client`** as a first-class column filtered in every client-facing query, with a test that greps for the word INTERNAL.
- **The booking detail page** is the best client-facing booking record an agency has shown me. Usage terms and per-model status in one place is exactly right.
- **Audit logging** on every auth and admin action (`server/src/db.ts:72-98`), and a `docs/` trail where `portal-build-1b` and `portal-build-5` both record the author being wrong and corrected by evidence. I trust a team that writes those down.

## Where it breaks down

| # | Severity | What happens | Evidence | What it costs me |
| --- | --- | --- | --- | --- |
| 1 | High | A `pending_review` user reads the target company's billing address, main contact and account manager before any human approves | `portal.ts:475-532` omits `resolveClientScope`; `Account.tsx:61-69`; reachable via `App.tsx:75`, `PortalLayout.tsx:9` | My commercial details handed to someone Genesis has not vetted |
| 2 | High | A contact who left the client years ago still auto-links to the full history | `matching.ts:97-105` ignores `client_contacts.active` (`schema.sql:42`) | Three years of fees and invoices to an ex-employee, no human in the loop |
| 3 | Medium-High | Domain-only match reveals company name, booking/invoice/message counts and relationship start date before approval | `auth.ts:156-167`; `Register.tsx:306-332`. Live gets this right: `portal-matching.server.ts` returns zeroed history | Contradicts the README; competitive intelligence for a single mailbox |
| 4 | Medium-High | A client who already registered hits an unrecoverable loop: no reset, no sign-in link on the code step, misleading error | `auth.ts:81-85, 127`; `SignIn.tsx` has no reset link; no `reset` route exists | The most common real failure. Every one is a phone call to a booker |
| 5 | Medium | Portal messages reach nobody. No email, no agency inbox, no thread grouping | `deliver()` called only at `auth.ts:83` and `admin.ts:140`; `admin.ts` has no inbox; `thread_key` unused in `Communications.tsx` | I go back to email, and the portal's purpose evaporates |
| 6 | Medium | No invoice document, no line items, no PO | No `/invoices/:id`; `schema.sql:175-189`; `Invoices.tsx:32` | Finance cannot use it. I email accounts@ anyway |
| 7 | Medium | Six-code-per-15-minutes limit shared across two endpoints and keyed on IP; `trust proxy: 1` is spoofable off-proxy | `auth.ts:66, 114`; `env.ts:46`; `app.ts:18` | Colleagues behind one office IP lock each other out |
| 8 | Medium | Outside production, `devCode` is returned in the response body | `env.ts:42`; `auth.ts:84, 97` | Any non-production deployment is an open door |
| 9 | Low-Medium | Agency commission and per-model day rates shown to the client | `portal.ts:87`; `BookingDetail.tsx:62-64, 115` | Good for me. Probably not a decision anyone made |
| 10 | Low | No 2FA; 10-char password floor with no breach check; 12h JWTs with no revocation | grep for `totp\|2fa\|mfa` returns nothing; `auth.ts:48-51, 50-62` | A stolen session is good for half a day |

**On 1.** The one I would fix before anything else, and it is small. `resolveClientScope` exists, is correct, and is used by every other read. The account route was deliberately exempted so a pending user could be told why they are waiting — a good instinct, implemented by returning the whole client row instead of the waiting message. The `teammates` query three lines below gets it right, which makes it a slip rather than a misunderstanding.

**On 2.** One missing predicate. The column exists, the seed populates it, and the matcher's own comment at `matching.ts:31-34` says the table exists so a booker is recognised "even if they have since changed roles" — but changing roles and leaving the company are not the same event, and the schema already distinguishes them. Until this is fixed, `exact` means "controlled this mailbox at some point", not "is currently authorised".

**On 3.** A gap between the README and the code, and fixable rather than structural because the right behaviour is already written and shipped on the live surface: counts on `linked`, zeros on `pending_review`.

**On 4.** Not a security issue, and the one that will generate the most calls. The system knows I have an account and deliberately will not say so — right instinct — then offers me no path at all. The fix costs nothing: the sign-in link belongs on every step, and the code-step error should carry it.

**On 5.** The composer's copy says "Goes to the bookings desk and joins this timeline". It joins the timeline and does not go to the desk. Combined with the flat, unthreaded view, this is where a producer quietly stops using the portal.

## What I'd change, concretely

**1. Pending review must not see a company record.**
Gate the client block in `GET /portal/account` on link status. Return `client: null` plus the `linkRequest` object when `link_status !== 'linked'`, so `Account.tsx` still explains the wait. Apply the same to `GET /api/auth/me` (`auth.ts:348`) and drop `primaryContactEmail` from the payload entirely.
*Where:* `server/src/routes/portal.ts:475-532`; `server/src/routes/auth.ts:348-367`.
*Acceptance test:* register a domain-only address, then `GET /api/portal/account`; assert `client === null`, assert the body contains neither `billingAddress` nor the primary contact's name or email, and assert `linkRequest.status === 'pending'`. Then approve and assert the client block appears.

**2. Exact match must mean currently active.**
Add `AND cc.active = 1` to the contact query.
*Where:* `server/src/matching.ts:102`.
*Acceptance test:* insert a contact with `active = 0`, call `findClientMatches`; assert no `exact` match and that `decideLink` returns `new_customer`. Add a second case where the same address is also a domain match, and assert `pending_review`, not `linked`.

**3. Disclose nothing extra on an unapproved match.**
Return the history summary only when `outcome.kind === 'linked'`. For `pending_review`, return company name and reason with zeroed counts, mirroring `portal-matching.server.ts` on the live project.
*Where:* `server/src/routes/auth.ts:156-167`; render accordingly at `client/src/pages/Register.tsx:306-332`.
*Acceptance test:* verify with a domain-only address; assert `history.bookings === 0 && history.invoices === 0 && history.firstBookedOn === null`. Assert the same address after approval returns real counts.

**4. Give a stuck client a way out.**
Implement `POST /auth/password/reset-request` and `/auth/password/reset` using the `reset` purpose already present in `verification_codes` and `createVerificationCode`; keep the reset-request response uniform the way `/register/start` is. Add the "Already set up? Sign in" link to the verify step, and a "Forgot your password?" link to `SignIn.tsx`.
*Where:* `server/src/routes/auth.ts` (new routes); `client/src/pages/Register.tsx:219-228`; `client/src/pages/SignIn.tsx:69-72`.
*Acceptance test:* request a reset for a registered and an unregistered address; assert identical status, body and absence of any code in the body. Assert the code sets a new password once and cannot be replayed.

**5. Make a portal message actually arrive.**
Call `deliver()` on insert to the bookings desk, and add a read-only agency inbox route beside the link-requests queue.
*Where:* `server/src/routes/portal.ts:432` (after the audit write); new handler in `server/src/routes/admin.ts`.
*Acceptance test:* post a message; assert a delivery was attempted with the client's company and subject, and that the agency inbox route returns it while a client account gets 403.

**6. Thread the correspondence, and let me reply on a job.**
Group by `thread_key` server-side; pass `bookingId` from the composer; put a composer on `BookingDetail`.
*Where:* `server/src/routes/portal.ts:380-390`; `client/src/pages/Communications.tsx:104-154`; `client/src/pages/BookingDetail.tsx`.
*Acceptance test:* two messages sharing a `thread_key` return as one thread; a message posted from a booking page comes back with that `bookingId` and appears in that booking's timeline.

**7. Give me a document, and a PO field.**
Add an `invoice_lines` table and `po_number` on `invoices` (both additive), plus `GET /portal/invoices/:id` scoped by `client_id` and a print stylesheet as a first step towards a PDF.
*Where:* `server/src/schema.sql:175-189`; new handler in `server/src/routes/portal.ts`.
*Acceptance test:* the detail route returns lines summing to `net_pence`; another client's invoice id 404s.

**8. Make usage queryable.**
Add `usage_expires_on`, `usage_territory` and `usage_media` alongside the existing prose, and an "expiring soon" filter on the bookings list.
*Where:* `server/src/schema.sql:109-127` (additive); `server/src/routes/portal.ts:254-289`.
*Acceptance test:* filtering for usage expiring within ninety days returns only bookings whose `usage_expires_on` falls in that window.

**9. Split the limiters, key them on email plus IP, and check the proxy depth** so one office cannot self-DoS (`auth.ts:31-45, 66, 114`; `app.ts:18`). *Acceptance test:* exhausting the verify budget still permits a fresh `register/start`; two addresses from one IP get separate budgets.

**10. Make `revealCodes` require an explicit `REVEAL_CODES=true`** rather than defaulting on outside production (`env.ts:42`). *Acceptance test:* with the variable unset, `register/start` returns no `devCode` in any environment.

## The five things I'd do first

1. **Gate `/portal/account` on link status** — S. One condition. Stops an unapproved account reading a company's billing details.
2. **`AND cc.active = 1` in the exact-match query** — S. One predicate. Stops ex-employees auto-linking to live commercial history.
3. **Zero the history summary on `pending_review`** — S. Brings the repo into line with both the README and the live implementation.
4. **Password reset plus a sign-in link on every registration step** — M. Fixes the failure that will actually happen, to actual clients, repeatedly.
5. **Make portal messages arrive, and thread the timeline** — M. Without it the correspondence page is a museum and I am back in Outlook.

Then, in the next cycle: the invoice document and PO number (L), and structured usage fields (M). Those are what turn this from a nice record into something my finance director will let me rely on.

## What I could not check

- **The live rendered site.** `https://www.genesismodelmgmt.co.uk/` and its `robots.txt` were blocked by the network egress proxy here. My statements about the portal being hidden come from `src/lib/portal-flags.ts` and `public/robots.txt` read out of the Lovable project, plus `docs/portal-build-4-hide-entry-links.md` — not from served HTML.
- **Tests and typecheck.** `node_modules` does not exist at the repo root or in either workspace and I was not permitted to install, so the sixteen tests in `server/test/portal.test.ts` are unverified by me; I read them and describe what they assert. **One gap I did notice:** the suite tests that a `pending_review` user gets 403 from `/api/portal/bookings` (`portal.test.ts:251-256`) and never tests `/api/portal/account`. That is precisely why finding 1 survived.
- **The live account route in depth.** `src/routes/api/portal/account.ts` on the Lovable project delegates to `loadAccount` in `portal-data.server.ts`, deliberately gated on `requirePortalUser` rather than `requireClientScope` — the same architectural choice as the repo. Whether `loadAccount` then withholds the company record for a pending account, I did not read. **It should be checked, because if it behaves like the repo, finding 1 is live.**
- **Anything requiring a request to a running system.** No sign-in attempted, no code requested, no email triggered, nothing written. Timing claims are reasoned from the code paths, not measured.
- **The live invoices surface.** `src/routes/api/portal/invoices.ts` returns 404 on the Lovable project, consistent with `docs/portal-build-2-pages.md:9` instructing the vocabulary to be "enquiries, not bookings". So live appears to have no invoices, bookings or fees at all — only enquiries, correspondence and packages. Steps 6 and 7 describe the repo prototype.

## Verdict

**Status: Amber.**

The thinking underneath this is better than most of what agencies show me, and in two places it is genuinely excellent: the disclosure ordering in registration, and the session-derived tenant scoping that makes cross-company access unrepresentable rather than merely blocked. I went looking for the usual portal disaster — an id in a URL that fetches somebody else's job — and it is not there, and there are tests proving it is not there. But the same care did not reach the account route or the `active` column, and the result is that an unapproved stranger with one mailbox at my domain can read my billing address and know what I spend, which is the exact failure the whole design was built to prevent. Findings 1, 2 and 3 are three small changes between here and a portal I would trust with my company's commercial history.

The reason it is Amber rather than Red is that the portal is not discoverable on the live site and the email sender is only just working, so nobody is walking into this today. Use that window. Fix the three, add a password reset, make my messages arrive — then turn the entry links back on, because when this works I will use it, and I do not say that about agency portals.

— M. Oyelaran
