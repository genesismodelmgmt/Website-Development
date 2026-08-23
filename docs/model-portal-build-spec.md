# Genesis model portal, build specification

Project: Genesis website, Lovable project 24db8413-d76d-4629-a829-bae09fdee220, Supabase ref cmegncebauosbckttxfm, stack tanstack_start_ts.

## 0. Hard rules for this build

1. **No email is sent to any model, or to anyone, as part of this build.** Do not call `auth.admin.inviteUserByEmail`, `auth.admin.generateLink`, `enqueue_email`, or any Resend or transactional path. Do not write a row to `email_send_log`. There is no invite ledger in this build because there is no invite.
2. **No auth users are created by this build.** Do not call `auth.admin.createUser`. Auth users come into existence only when a model verifies her own one time code.
3. **Nothing is published.** Do not deploy the project. The feature ships behind `MODEL_PORTAL_ENABLED`, which defaults to off. New pages carry `robots: noindex, nofollow` and are linked from nowhere: not the header nav, not the footer, not `src/routes/sitemap[.]xml.ts`.
4. **Read only across the boundary.** Every call to First Option is an HTTPS GET made server side. The website never writes to First Option. `supabase/functions/sync-website` stays retired.
5. **No RLS policy is added to `leads`, `packages`, `email_send_log` or `lead_events`.** No column is added to them, no grant is changed on them, and no model route reads them.
6. **The client portal keeps working.** `src/lib/portal-matching.server.ts` is not touched. `src/lib/portal-auth.server.ts` is not touched. `src/routes/portal.sign-in.tsx` is not touched. `src/routes/api/portal/session.ts` is not touched. The only shipped client file that changes is `src/routes/api/portal/claim.ts`, and only by two additive edits specified in section 9.
7. Conventions: TanStack Start file routes and `.server.ts` modules, zod for every request body, sonner for toasts, shadcn/ui only where the client portal already uses it (`InputOTP`), UK English throughout, no em dashes and no en dashes in any string, comment or copy. Database columns snake_case, TypeScript camelCase, exported types PascalCase, zod schemas named `Body`.

## 1. What already exists and must not be disturbed

- Client portal: `/portal/sign-in`, `/api/portal/claim`, `/api/portal/session`, backed by `portal_clients`, `portal_client_emails`, `portal_accounts`, `portal_link_requests`, `portal_messages`. All five tables hold 0 rows.
- `requirePortalUser(request)` in `src/lib/portal-auth.server.ts` verifies a three segment JWT against the Auth server with a publishable key client and returns `{ userId, email }` with the email lowercased. **Reuse it unchanged.** It is already generic.
- `requireClientScope` is called by nothing. Leave it that way.
- `portal_accounts.is_agency` is written by nothing. Leave it alone. Do not repurpose it, and do not add a role column to `portal_accounts`.
- The First Option integration pattern is `src/lib/roster-feed.server.ts`: a single `.server.ts` module holding the only `fetch`, a hardcoded URL constant, an `AbortController` with `FETCH_TIMEOUT_MS = 12_000`, a two attempt loop retrying only `timeout` and `network`, strict envelope validation, fail soft per record normalisation, and category only logging. Follow that discipline, with the three deliberate divergences in section 7.
- File route server handlers are **not** covered by the `attachSupabaseAuth` function middleware in `src/start.ts`. Every new API route reads the `authorization` header itself, and the pages attach it by hand on a raw `fetch`, exactly as `src/routes/portal.sign-in.tsx` already does. Do not use `createServerFn` for any authenticated model route.

## 2. Shape of the build

One website, one Supabase auth pool, two account types, two identity tables that share no row. A model is never given a `client_id`.

At rest the website stores, per model, one HMAC hex digest and one opaque First Option uuid. It stores no model email address, no model name and no slug. The agenda is never copied across: it is fetched per request, validated, rendered and discarded.

One request, end to end:

```
browser  GET /portal/model/agenda
  page   fetch("/api/portal/model/agenda?window=upcoming", { headers: { authorization: "Bearer <access_token>" } })
  route  requireModelScope(request)          -> { userId, foModelId, emailHmac }   (session only, never request input)
  route  loadModelAgenda(foModelId, window)  -> src/lib/model-agenda.server.ts
  fetch  GET https://www.firstoption.app/api/partner/model-agenda
             ?domain=genesismodelmgmt.co.uk&model_id=<uuid>&window=upcoming
         Authorization: Bearer <FIRST_OPTION_PARTNER_TOKEN>
  crm    constant time token compare -> resolve domain -> rpc website_model_agenda_v1
  route  validate envelope, assert body.model_id === foModelId, map, respond, discard
```

The `model_id` never appears in anything the browser sends. The only client supplied input on the whole feature is the string `upcoming` or `recent`.

## 3. Environment variables

Add to the website project. All are server side only, none is `VITE_` prefixed.

| Name | Purpose |
|---|---|
| `MODEL_PORTAL_ENABLED` | Feature flag. Default absent, which means off. Only the literal string `"true"` enables. |
| `MODEL_IDENTITY_PEPPER` | HMAC key for email digests and IP digests. Must be byte identical to the value held by First Option. At least 32 random bytes, hex or base64. |
| `FIRST_OPTION_PARTNER_TOKEN` | Bearer sent to the two First Option partner endpoints. Must match the CRM value. |
| `PORTAL_ADMIN_TOKEN` | Bearer for the operator sync route in section 8.5. Distinct from the above. |

If `MODEL_PORTAL_ENABLED` is not `"true"`, every route in section 8 returns a bare `404` with no body, and `/portal/model` renders a plain page reading "This page is not available." Nothing else on the site changes.

## 4. Migration

One new file under `supabase/migrations/`. Note the `revoke` lines: the 2026-08-07 portal migration never revoked, which is why `anon` and `authenticated` still hold the full privilege set on all five `portal_*` tables with RLS as the only barrier. These tables follow the later casting migration pattern instead. Regenerate `src/integrations/supabase/types.ts` afterwards.

```sql
-- ---------------------------------------------------------------------
-- 1. The allowlist. No email, no name, no slug is stored here.
--    A dump of this table yields no mailing list and no roster.
-- ---------------------------------------------------------------------
create table public.portal_model_identities (
  email_hmac      text primary key,
  fo_model_id     uuid        not null,
  email_domain    text,
  access_state    text        not null default 'held'
                    check (access_state in ('open','held','revoked')),
  hold_reason     text
                    check (hold_reason is null or hold_reason in
                      ('non_consumer_domain','shared_address','ownership_unconfirmed','operator_hold')),
  bookings_ever   integer     not null default 0,
  bookings_180d   integer     not null default 0,
  digest_revision text,
  is_active       boolean     not null default true,
  seeded_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint portal_model_identities_hmac_ck check (email_hmac ~ '^[0-9a-f]{64}$')
);

comment on table public.portal_model_identities is
  'HMAC-SHA256 of a normalised model mailbox mapped to a First Option models.id. Seeded by pulling the CRM identity digest. Never stores an address. access_state defaults to held: an identity is unusable until a person opens it.';
comment on column public.portal_model_identities.fo_model_id is
  'First Option public.models.id. Deliberately not a foreign key: different Supabase project.';

-- Not unique. One model may hold more than one mailbox in future.
create index portal_model_identities_model_idx
  on public.portal_model_identities (fo_model_id);
create index portal_model_identities_state_idx
  on public.portal_model_identities (access_state) where is_active;

-- ---------------------------------------------------------------------
-- 2. The claimed link. Created on first successful sign in, never before.
--    email_hmac is stored so every read can re-check that the signed in
--    mailbox is still the mailbox First Option holds for this model.
-- ---------------------------------------------------------------------
create table public.portal_model_accounts (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  fo_model_id     uuid        not null,
  email_hmac      text        not null,
  link_status     text        not null default 'linked'
                    check (link_status in ('linked','revoked')),
  first_linked_at timestamptz not null default now(),
  last_seen_at    timestamptz,
  revoked_at      timestamptz,
  revoked_reason  text
                    check (revoked_reason is null or revoked_reason in
                      ('identity_changed','model_ineligible','identity_deactivated','self_closed','operator')),
  created_at      timestamptz not null default now()
);

comment on table public.portal_model_accounts is
  'One website auth user to one First Option model. Deliberately separate from portal_accounts: a model is never a client. Operator unlink runbook, service role only: update public.portal_model_accounts set link_status = ''revoked'', revoked_at = now(), revoked_reason = ''operator'' where user_id = $1;';

-- Partial, so revoking a link frees the model to be claimed again later.
create unique index portal_model_accounts_model_linked_key
  on public.portal_model_accounts (fo_model_id) where link_status = 'linked';
create index portal_model_accounts_hmac_idx
  on public.portal_model_accounts (email_hmac);

-- ---------------------------------------------------------------------
-- 3. Access log. Carries no payload, only that something happened.
--    ip_hash is HMAC-SHA256 of the client address under MODEL_IDENTITY_PEPPER,
--    never a raw IP. No FK to auth.users, so an account deletion does not
--    silently erase the trail. Swept at 90 days by the cron job below.
-- ---------------------------------------------------------------------
create table public.portal_model_access_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  fo_model_id uuid,
  ip_hash     text,
  route       text not null,
  outcome     text not null
                check (outcome in ('ok','refused','conflict','held','revoked',
                                   'rate_limited','upstream_unavailable')),
  at          timestamptz not null default now()
);

create index portal_model_access_log_at_idx   on public.portal_model_access_log (at desc);
create index portal_model_access_log_user_idx on public.portal_model_access_log (user_id, at desc);
create index portal_model_access_log_ip_idx   on public.portal_model_access_log (ip_hash, at desc);

-- ---------------------------------------------------------------------
-- 4. Grants and RLS. Two layers, not one.
-- ---------------------------------------------------------------------
revoke all on public.portal_model_identities  from anon;
revoke all on public.portal_model_identities  from authenticated;
revoke all on public.portal_model_accounts    from anon;
revoke all on public.portal_model_accounts    from authenticated;
revoke all on public.portal_model_access_log  from anon;
revoke all on public.portal_model_access_log  from authenticated;

grant all on public.portal_model_identities  to service_role;
grant all on public.portal_model_accounts    to service_role;
grant all on public.portal_model_access_log  to service_role;

alter table public.portal_model_identities  enable row level security;
alter table public.portal_model_accounts    enable row level security;
alter table public.portal_model_access_log  enable row level security;

create policy "portal_model_identities service role only"
  on public.portal_model_identities for all to service_role using (true) with check (true);
create policy "portal_model_accounts service role only"
  on public.portal_model_accounts for all to service_role using (true) with check (true);
create policy "portal_model_access_log service role only"
  on public.portal_model_access_log for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------
-- 5. Retention, implemented rather than described. pg_cron is installed
--    on this project (an existing weekly job runs at jobid 95).
-- ---------------------------------------------------------------------
select cron.schedule(
  'portal-model-access-log-sweep',
  '17 3 * * *',
  $$delete from public.portal_model_access_log where at < now() - interval '90 days'$$
);
```

## 5. `src/lib/model-identity.server.ts`

```ts
export function hashModelEmail(email: string): string
export function hashClientIp(ip: string | null): string | null
export type ModelIdentity = { foModelId: string; accessState: "open" | "held" | "revoked" }
export async function resolveModelIdentity(emailHmac: string): Promise<ModelIdentity | null>
```

- `hashModelEmail` lowercases and trims, then HMAC-SHA256 with `process.env.MODEL_IDENTITY_PEPPER` using `node:crypto`, hex encoded. Throw a typed error if the pepper is missing; never fall back to an unpeppered hash.
- `hashClientIp` reads the first entry of `x-forwarded-for` at the call site and applies the same HMAC. Never store or log a raw address.
- `resolveModelIdentity` selects `fo_model_id, access_state` from `portal_model_identities` where `email_hmac = $1 and is_active`. Returns `null` on no row.
- Import `supabaseAdmin` with `await import("@/integrations/supabase/client.server")` inside the function, matching `requireClientScope`.

## 6. `src/lib/portal-model-auth.server.ts`

Mirrors `requireClientScope` in shape and in its documented rule: nothing in the request body, query string or route params can influence the scope.

```ts
export type ModelScope = { userId: string; email: string; foModelId: string; emailHmac: string }
export type ModelPortalCode =
  | "unauthorized" | "no_model" | "account_held" | "identity_changed"
  | "model_revoked" | "client_account" | "model_already_claimed" | "not_configured"
export class ModelPortalError extends Error { readonly code: ModelPortalCode; readonly status: number }
export function modelPortalErrorResponse(err: unknown): Response
export async function requireModelScope(request: Request): Promise<ModelScope>
```

`requireModelScope` steps, in order:

1. `const user = await requirePortalUser(request)` from the existing, unmodified `@/lib/portal-auth.server`.
2. Select `fo_model_id, email_hmac, link_status` from `portal_model_accounts` by `user_id`. No row: `no_model`, 403, "This portal is opened by Genesis. Speak to your booker and we will open it for you."
3. `link_status <> 'linked'`: `model_revoked`, 403, "This portal has been closed. Speak to your booker if that is not what you expected."
4. **Re-hash the currently verified session email and compare with the stored `email_hmac`.** On mismatch, set `link_status = 'revoked'`, `revoked_reason = 'identity_changed'`, write an access log row with outcome `revoked`, and throw `identity_changed`, 403, "Your sign in address has changed, so this portal has been closed. Speak to your booker."
5. Re-resolve the identity by that hash. Missing, `is_active` false, or `access_state <> 'open'`: revoke with `identity_deactivated` and throw `account_held`, 403, "This portal is not open just now."
6. Touch `last_seen_at` without blocking the read, matching the existing comment style: "Touch last seen; never block a read on it."
7. Return `{ userId, email, foModelId, emailHmac }`.

`modelPortalErrorResponse` returns `Response.json({ error: err.message, code: err.code }, { status: err.status })` for a `ModelPortalError`, delegates a `PortalAuthError` to the existing `portalErrorResponse`, and otherwise logs `console.error("[model-portal] unexpected error", err)` and returns a generic 500 with code `server_error`.

## 7. `src/lib/model-agenda.server.ts`

The second and last cross project fetch module. Modelled on `roster-feed.server.ts`, with three divergences that are load bearing and must be stated in the file docblock.

```ts
const AGENDA_URL = "https://www.firstoption.app/api/partner/model-agenda";
const AGENDA_DOMAIN = "genesismodelmgmt.co.uk";
const FETCH_TIMEOUT_MS = 12_000;
export type AgendaErrorCategory =
  | "network" | "timeout" | "http_status" | "invalid_json" | "schema" | "revoked" | "not_configured";
export type AgendaWindow = "upcoming" | "recent";
export type AgendaSnapshot =
  | { available: true; model: AgendaModelHeader; items: AgendaItem[] }
  | { available: false; errorCategory: AgendaErrorCategory };
export async function loadModelAgenda(foModelId: string, window: AgendaWindow): Promise<AgendaSnapshot>
```

Reused as is: `fetch` with `method: "GET"`, `AbortController` at 12 seconds, the two attempt loop that retries only `timeout` and `network` and breaks on a bad payload, strict envelope validation, fail soft per record normalisation that drops a malformed row rather than crashing the render, and category only logging: `console.warn(\`[model-agenda] unavailable, category=${category}\`)`.

Divergence 1, **no module level state of any kind.** No `CACHE_TTL_MS`, no `lastGood`, no shared in flight promise. Module scope is shared across every request in a warm serverless instance, so a cached agenda is a cross model disclosure. The shared promise is separately forbidden because it caused the spurious `AbortError` fixed in commit c07ec0d5.

Divergence 2, **fail closed.** No last known good, no dev static fallback. On failure return `{ available: false, errorCategory }`.

Divergence 3, **identity assertion.** Reject with category `schema` unless `body.model_id === foModelId`. A mixed up response is the one failure that would show a model someone else's work, so it is checked rather than trusted.

Also: send `Authorization: Bearer ${process.env.FIRST_OPTION_PARTNER_TOKEN}` and `Accept: application/json`. Treat upstream `403` with body code `access_revoked` as category `revoked`, distinct from every other failure, so a revocation never renders with the outage copy. Never log the response body, the model id, an email or a title.

The module also computes display strings server side so the browser receives nothing it might reformat: `dateLabel` via `Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })`, and `timeLabel` only when `time_known` is true.

## 8. Server routes

All are file routes under `src/routes/api/portal/model/` and `src/routes/api/admin/`, all read the bearer themselves, all wrap the handler in try/catch funnelling through `modelPortalErrorResponse`, all import `supabaseAdmin` inside the handler, and all set `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

### 8.1 `POST /api/portal/model/claim`

Body: `const Body = z.object({}).strict()`. Nothing is accepted. Identity comes only from the verified token.

1. `requirePortalUser(request)`.
2. **Refuse if this user already holds a client account.** Select `user_id` from `portal_accounts` by `user_id`. If a row exists, log outcome `conflict` and return 409 `{ "error": "This address is already set up as a client account. Speak to your booker and we will sort it out.", "code": "client_account" }`.
3. `const emailHmac = hashModelEmail(user.email)`, then `resolveModelIdentity(emailHmac)`.
   - No row: log `refused`, return 403 `{ "error": "This portal is opened by Genesis. Speak to your booker and we will open it for you.", "code": "no_model" }`.
   - `access_state <> 'open'`: log `held`, same 403 body with code `account_held`.
4. Select any existing `portal_model_accounts` row by `user_id`.
   - Row exists with a different `fo_model_id` or a different `email_hmac`: **do not upsert.** Log `conflict`, return 403 `{ "code": "identity_changed" }`.
   - Row exists, same model, `link_status = 'linked'`: return 200 `{ "outcome": "linked" }`.
5. Otherwise **insert** (never upsert on `user_id`) `{ user_id, fo_model_id, email_hmac, link_status: 'linked' }`. A unique violation on `portal_model_accounts_model_linked_key` means another auth user already holds this model: catch it, log `conflict`, return 409 `{ "error": "This portal has already been opened from a different address. Speak to your booker.", "code": "model_already_claimed" }`. A primary key violation on `user_id` means a concurrent claim: return the same 409.
6. Success: log `ok`, return 200 `{ "outcome": "linked" }`.

### 8.2 `GET /api/portal/model/session`

`requirePortalUser`, then select `link_status, first_linked_at, last_seen_at` from `portal_model_accounts` by `user_id`.

- No row: 200 `{ "linkStatus": "none" }`.
- Row: 200 `{ "linkStatus": "linked" | "revoked", "firstLinkedAt": "<iso>" }`.

Returns no name, no slug, no model id, no company, nothing derived from First Option.

### 8.3 `GET /api/portal/model/agenda?window=upcoming|recent`

1. Parse the query with `z.object({ window: z.enum(["upcoming","recent"]).default("upcoming") })`. Any other value is a 400 `{ "code": "invalid_query" }`. No date is ever accepted from the caller.
2. `requireModelScope(request)`.
3. Throttle: count `portal_model_access_log` rows for this `user_id` on route `agenda` in the last 60 seconds. Above 30, log `rate_limited` and return 429 `{ "code": "rate_limited" }`.
4. `loadModelAgenda(scope.foModelId, window)`.
5. Log one row: outcome `ok`, `upstream_unavailable`, or `revoked`.
6. Respond.

Success shape, 200:

```json
{
  "status": "ok",
  "window": "upcoming",
  "model": { "firstName": "…", "board": "women", "publicSlug": "…" },
  "items": [
    {
      "itemId": "booking-8f1c…",
      "kind": "booking",
      "itemType": "casting",
      "state": "confirmed",
      "startsAt": "2026-09-03T09:30:00.000Z",
      "endsAt": "2026-09-03T11:00:00.000Z",
      "timeKnown": true,
      "dateLabel": "Thursday 3 September 2026",
      "timeLabel": "09:30",
      "title": "…",
      "clientLabel": "…",
      "location": null,
      "modelNote": null,
      "optionPriority": null
    }
  ]
}
```

`model.publicSlug` is whatever the upstream returned and may be `null`; **never construct a slug locally.** First Option generates full name slugs and only 60 of its 198 published slugs exist in the website's own `model_embeddings` table, so a locally built `/talent/<slug>` link would 404 for most models.

Failure shapes: 200 `{ "status": "unavailable", "category": "timeout" }` for transport and schema failures; 403 `{ "error": "…", "code": "model_revoked" }` for an upstream revocation, which `requireModelScope` will already have converted on the following request.

### 8.4 `POST /api/portal/model/close`

Body `z.object({}).strict()`. `requireModelScope`, then set `link_status = 'revoked'`, `revoked_at = now()`, `revoked_reason = 'self_closed'`, log outcome `revoked`, call `supabaseAdmin.auth.admin.signOut(<the bearer token>, "global")` so the refresh token dies immediately, and return 200 `{ "outcome": "closed" }`. A model must be able to close her own portal without asking anyone.

### 8.5 `POST /api/admin/model-identity-sync`

Operator triggered. Never scheduled, never attached to the existing weekly `pg_cron` job at jobid 95, which posts to a public endpoint with the anon key in a header.

1. Constant time compare of the bearer against `process.env.PORTAL_ADMIN_TOKEN`. Mismatch: bare 404.
2. One GET to `https://www.firstoption.app/api/partner/model-identity-digest?domain=genesismodelmgmt.co.uk` with `Authorization: Bearer ${FIRST_OPTION_PARTNER_TOKEN}`, same 12 second `AbortController`, same two attempt loop. Validate `schema_version === 1` and that `identities` is an array of `{ model_id, email_hmac, email_domain, bookings_ever, bookings_180d }` with unique `email_hmac`.
3. **The digest carries no plaintext address.** The CRM applies the shared pepper inside its own process. If any entry carries an `email` field, reject the whole payload with category `schema` and change nothing.
4. Upsert each row on `email_hmac`, setting `fo_model_id`, `email_domain`, `bookings_ever`, `bookings_180d`, `digest_revision`, `is_active = true`, `updated_at = now()`. Do **not** touch `access_state` or `hold_reason` on an existing row: once a person has opened or held an identity, only a person changes it.
5. For a newly inserted row, set `access_state` and `hold_reason` by policy: `open` with `hold_reason` null when `email_domain` is in `MODEL_CONSUMER_DOMAINS`; otherwise `held` with `hold_reason = 'non_consumer_domain'`.
6. For every row not present in this digest, set `is_active = false`. Then for every `portal_model_accounts` row whose `email_hmac` now resolves to nothing active, set `link_status = 'revoked'`, `revoked_reason = 'identity_deactivated'`.
7. Return 200 with counts only, never a hash or an address: `{ "seeded": 0, "updated": 0, "deactivated": 0, "opened": 0, "held": 0, "accountsRevoked": 0, "withAgenda180d": 0 }`.

`MODEL_CONSUMER_DOMAINS` lives in a new `src/lib/model-portal-domains.ts` and is the 22 entries already in `src/lib/portal-matching.server.ts` plus, at minimum, `gmx.de`, `gmx.net`, `hotmail.nl`, `sky.com`, `163.com`, `btinternet.com`, `virginmedia.com`, `aol.co.uk`, `ymail.com`, `web.de`. Do not import the client portal's set; copy it, because widening the client set would change client matching behaviour.

## 9. The two additive edits to `src/routes/api/portal/claim.ts`

Both are early returns. Neither changes any branch of `claimAccount`, the five rung ladder, the consumer domain list, or any client facing string on a successful client path.

**Edit 1, the model guard.** After `requirePortalUser`, before `claimAccount`:

```ts
const { hashModelEmail } = await import("@/lib/model-identity.server");
const emailHmac = hashModelEmail(user.email);
const { data: identity } = await supabaseAdmin
  .from("portal_model_identities")
  .select("access_state, is_active")
  .eq("email_hmac", emailHmac)
  .maybeSingle();
const { data: modelAccount } = await supabaseAdmin
  .from("portal_model_accounts")
  .select("user_id")
  .eq("user_id", user.userId)
  .maybeSingle();
if (modelAccount || (identity?.is_active && identity.access_state === "open")) {
  return Response.json(
    { error: "This address is set up for the model portal. Please sign in there instead.", code: "model_account" },
    { status: 409 },
  );
}
```

Note the deliberate asymmetry: an identity whose `access_state` is `held` does **not** block the client path. A mother agency or production company mailbox may legitimately be both a model contact and a booking client, and refusing it would lock that person out of both portals. When `identity` exists but is held, let `claimAccount` run and additionally write a `portal_model_access_log` row with route `client_claim` and outcome `conflict` so a person can see the dual identity.

**Edit 2, redact the pending review reply.** The route currently returns `claimAccount`'s result verbatim on the `pending_review` path, which discloses a real client's recorded company name to any holder of a mailbox at a domain Genesis has history with. Replace that path with a fixed, data free response:

```ts
if (result.outcome === "pending_review") {
  return Response.json(
    { outcome: "pending_review",
      message: "A booker at Genesis is confirming your account before your history is shown." },
    { status: 200 },
  );
}
```

The descriptive `match_reason` still goes into `portal_link_requests`, where only a booker sees it. `/api/portal/session` already withholds the company name unless the account is fully linked, so this brings `claim.ts` into line with it.

## 10. Pages

### `src/routes/portal.model.tsx` at `/portal/model`

A three step state machine (`"email" | "code" | "done"`) copying the structure and the house classes of `src/routes/portal.sign-in.tsx`: `<section className="mx-auto w-full max-w-xl px-5 py-20 sm:py-28">`, cards as `space-y-5 rounded-lg border border-border bg-card p-6`, labels as `text-[10px] uppercase tracking-widest-tight text-muted-foreground`, primary buttons as `rounded-full bg-foreground px-5 py-2.5 text-xs uppercase tracking-widest-tight text-background disabled:opacity-50`, `InputOTP` from `@/components/ui/input-otp`, its own `<Toaster position="top-center" />` from sonner, head meta `{ name: "robots", content: "noindex, nofollow" }`, title "Model portal sign in, Genesis Model Management".

- Step one calls `supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } })`. **`shouldCreateUser` stays true.** Setting it false makes the form an anonymous membership oracle for a roster whose full names are already public on this site. The cost of true is an unauthenticated mailer, which is bought off in the dashboard, not in code.
- **The page must never render `error.message` from the OTP call.** On both success and failure it shows the same sentence: "If that address can be used, a six digit code is on its way." Log nothing client side.
- Step two calls `supabase.auth.verifyOtp({ email, token, type: "email" })`, then reads `data.session.access_token` and POSTs `/api/portal/model/claim` with `authorization: Bearer …`, the same hand attached header the client page uses.
- Step three: on `{ outcome: "linked" }`, navigate to `/portal/model/agenda`. On any 403 or 409, show the message from the response body verbatim and offer a "Speak to your booker" mailto. Never say why an address was not recognised beyond the fixed copy.
- On an expired session during claim, reset to step one with "Your session has expired. Please request a new code," matching the existing page.

### `src/routes/portal.model.agenda.tsx` at `/portal/model/agenda`

Loader calls `/api/portal/model/session`; if `linkStatus` is not `linked`, redirect to `/portal/model`.

Two sections, **"Coming up"** and **"Recent"**, fetched as two calls with `window=upcoming` and `window=recent`. React Query with `staleTime: 0`, `gcTime: 0`, and the user id in the query key so a sign out and sign in on a shared device cannot repaint the previous session's data.

Three rendered states, and no fourth:

- Items: a card per item showing `dateLabel`, `timeLabel` only when `timeKnown` (47 of the 879 eligible rows start at midnight and carry no real call time, so rendering "00:00" would tell a model to be somewhere at midnight), `title`, `clientLabel` when present, a state chip, and `location` when present. `location` is currently null on every row, so the card must read correctly without it.
- Empty: "Nothing is in your diary here yet. Your agenda is kept by your booker, and confirmed work appears here." Never anything that reads as "you have no work". 33 of the 122 eligible models have no booking and no option ever, and 69 have nothing in the last twelve months.
- Unavailable: "We cannot reach your agenda just now. Please try again shortly." Never stale data, never a partial list.

A standing line in the page footer, always visible: "This is your diary, not a statement. For anything about fees, invoices or payments, please email the accounts desk." Plus a quiet "Close my portal" action calling `/api/portal/model/close` behind a confirm.

The root route installs global keyboard and clipboard interception that exempts `INPUT`, `TEXTAREA`, `SELECT` and `contentEditable`; the OTP input is an `INPUT`, so it survives, but verify it during testing.

## 11. Upstream contract, First Option, commissioned separately

The website build agent does **not** build this. It builds against it and degrades cleanly until it exists. Both endpoints live under `/api/partner/`, not `/api/public/`, because everything currently under `api/public/` is unauthenticated by design. Both require a constant time bearer compare against the shared token, resolve `?domain=` against `customer_accounts` exactly as `website-roster.ts` does, and return a bare `404 {"error":"not_found"}` on every unresolvable path. Neither sets `Access-Control-Allow-Origin` and neither is cacheable: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.

All column narrowing lives inside two `SECURITY DEFINER` SQL functions revoked from `public`, `anon` and `authenticated` and granted only to `service_role`. The routes must contain no column list and must never contain the string `.from("bookings")`. This is not stylistic: the CRM's own agenda page uses `.select("*")`, and 67 of the 879 booking rows belonging to eligible models carry the full commercial split in `bookings.notes`.

**`GET /api/partner/model-identity-digest?domain=…`** returns

```json
{ "schema_version": 1, "generated_at": "…", "revision": "…", "count": 122,
  "identities": [ { "model_id": "…", "email_hmac": "<64 hex>", "email_domain": "gmail.com",
                    "bookings_ever": 12, "bookings_180d": 2 } ] }
```

The CRM applies HMAC-SHA256 with the shared pepper in `node:crypto` inside its own process. **No plaintext address, no name, no age, no `is_minor`, no `safeguard_status` may appear in this payload.** Eligibility, applied in SQL: `status = 'active'`, `archived = false`, `is_test = false`, `is_minor = false`, `outreach_blocked = false`, `date_of_birth is not null`, `date_of_birth <= current_date - interval '18 years'`, a syntactically valid address on `models.email`, and any address shared by more than one model record excluded. That predicate returns 122 identities today, of 376 models. Gate on `date_of_birth` only: `safeguard_status` is `adult_ok` on all 376 rows including both flagged `is_minor`, `age_verified` is true on all 376, and the roster minimum `age_years` is 6.

**`GET /api/partner/model-agenda?domain=…&model_id=…&window=upcoming|recent`** re-applies that identical safeguarding gate on every single read, so revoking a model in the CRM closes her portal on the next request with nothing pushed to the website. A gate failure returns `403 {"error":"access_revoked"}`, distinct from the `404` used for an unresolvable model, so a revocation never renders as an outage. It returns

```json
{ "schema_version": 1, "model_id": "…", "public_slug": "…"|null,
  "first_name": "…", "board": "women",
  "window_from": "…", "window_to": "…",
  "bookings": [ { "id":"…","type":"casting","title":"…","starts_at":"…","ends_at":"…",
                  "is_multi_day":false,"status":"confirmed","is_cancelled":false,
                  "client_label":"…"|null,"location":null,"area":null,"model_note":null } ],
  "options":  [ { "id":"…","starts_at":"…","ends_at":"…","firmness":"option",
                  "priority":1,"status":"confirmed" } ] }
```

`public_slug` is returned only when `models.web_online` is true. `web_online` is **not** part of the access gate: an unpublished model still has an agenda.

Two filters that are not optional. The booking branch drops rows with `start_datetime < timestamptz '1990-01-01'` (epoch placeholders from the MediaSlide import). The option branch drops `status in ('lapsed','released')`: 529 of the 532 option rows belonging to eligible models are holds the model lost, 38 models carry five or more, one carries 55, and 19 have lost holds and no bookings at all. A portal that opens as a list of rejections is not shippable.

`window=upcoming` is `now()` to `now() + 180 days`. `window=recent` is `now() - 365 days` to `now()`.

## 12. The column boundary, named

**Crosses into a model session** (bookings): `id`, `type`, `title`, `start_datetime`, `end_datetime`, `is_multi_day`, `status`, `is_cancelled`, `location`, `area`, `models_note`, and a client label from `coalesce(bookings.client_name, clients.company_name)`. (options): `id`, `start_at`, `end_at`, `firmness`, `priority`, `status`. (models): first name, `board`, and `website_public_profiles.slug` when published.

**Never crosses, by name.** From `bookings`: `notes` in its entirety and not one key of it, including `model_amount` and `paid`; also `agency_note`, `agent`, `rate`, `currency`, `client_email`, `client_phone`, `contact_name`, `contact_phone`, `contact_email`, `product`, `ask_for`, `hotel`, `driver`, `created_by`, `created_at`, `customer_id`, `client_id`, `raw_date_text`, `source`, `external_id`, `job_type`, `category`. From `options`: `notes`, `created_by`, `org_id`, `client_id`, `casting_submission_id`, `cancellation_fee_applies`, `challenge_deadline`, `becomes_booking_id`, `source`, `external_id`. Whole tables never joined: `booking_financials` (`gross_client_fee`, `shoot_fee`, `usage_fee`, `agency_commission_amount`, `mother_agency_amount`, `model_net`, `vat_amount`, `vat_rate`, `commission_override_pct`, `mother_override_pct`), `booking` singular (`gross_incl_vat_pence`, `net_excl_vat_pence`, `agency_share_pence`, `agent_fee_pence`, `commission_rate`, `model_share_pence`), `invoices`, `payments`, `payment_allocations`, `model_accounting`, `model_accounting_secrets`, `model_event`, `model_contact_channels`, `model_related_contacts`. From `models`: `email`, `emails`, `cell`, `phones`, `date_of_birth`, `age_years`, `notes`, `mother_agency`, `right_to_work`, `visa_expiry`, `passport_valid_until`, `home_lat`, `home_lon`, `commission_rate`, `min_acceptable_rate_pence`, `agent_user_id`, `scouted_by`, and every stat column.

**No money crosses in v1.** `bookings.rate` is present on 68 of the 879 eligible rows and is the gross client fee, not the model's fee. The three per model sources disagree in coverage and are unreconciled, `booking_financials` is 98 rows all still `draft` and `backfill`, `invoices.paid_at` is null on all 100 rows, and `payments` and `payment_allocations` are both empty.

**No sibling model crosses.** There is no job or call sheet parent table; 143 of 497 `(title, start_datetime)` groups carry more than one model and the largest carries 103. The projection filters on `model_id`, so a model sees only her own rows.

**Nothing from the website's own database crosses into a model session.** No model route reads `leads`, `packages`, `email_send_log`, `lead_events`, `casting_briefs`, `applications` or any `portal_*` client table. This matters: 71 of the 129 `leads` rows are `route = 'join-us'` applications carrying applicant PII, and `applications.ai_review` is an internal assessment of an applicant.

## 13. Breaks closed, named

| Break from hostile review | Closed by |
|---|---|
| tenant-isolation critical: model becomes a client via rung 5, email stored in plaintext, locked out of the model portal | Section 9 Edit 1, keyed on the address hash rather than on an account row, so it fires on a model's first ever visit regardless of which portal she reaches first. Overlap is provably 0 today, so it cannot change any existing client's outcome. Operator unlink runbook in the migration comment. |
| tenant-isolation high: bind never revoked when the address of record changes; third party keeps access; real model locked out for ever | `portal_model_accounts.email_hmac` plus the re-hash comparison in `requireModelScope` step 4, and the partial unique index so revocation frees the model to be claimed again. |
| tenant-isolation high: changing the auth email rebinds the account to a different model | Section 8.1 step 4: explicit pre-check, **insert not upsert**, typed 403 `identity_changed`. |
| tenant-isolation medium: corporate domain poisoning of `portal_clients.email_domain`, and a client contact inheriting applicant PII | Prevented upstream by Edit 1, which stops the model reaching rung 5 at all. |
| tenant-isolation medium: `/portal/sign-in` discloses a real client's company name on the `pending_review` path | Section 9 Edit 2. |
| tenant-isolation medium: a dual identity mailbox locked out of both portals | The `held` asymmetry in Edit 1: only an `open` identity blocks the client path. |
| identity critical: `shouldCreateUser: false` turns the model form into a membership oracle | Section 10: `shouldCreateUser` stays true, and the page never renders `error.message`. |
| identity high: no leaver signal, so an ex model keeps a working account | Three layers: the upstream gate is re-applied on every read; any identity absent from a successful digest run is deactivated and its account revoked in section 8.5 step 6; and `requireModelScope` step 5 re-resolves the identity on every request. Blocking question 3 asks for an explicit CRM eligibility flag as the durable fix. |
| identity high: email change locks the model out and leaves the old mailbox in control | Same mechanism as the tenant-isolation high above: revoke on hash mismatch, partial unique index lets the corrected address claim. |
| identity high: minor gate in TypeScript | Section 11: the gate is in SQL inside both functions and is re-applied on every read. The website never evaluates age. |
| identity high: mother agency and third party mailboxes seeded with no hold | `access_state` defaults to `held`; section 8.5 step 5 opens only extended consumer domains; `resolveModelIdentity` and `requireModelScope` both refuse anything not `open`. |
| identity high: `shouldCreateUser: true` makes the page an unauthenticated mailer | Precondition in section 14 test 12: Turnstile or hCaptcha enabled on Supabase Auth, and the dashboard OTP limits read and recorded, before any model is told the portal exists. This hardens the existing client portal at the same time. |
| operational critical: the portal opens as a rejection archive | Section 11: `status in ('lapsed','released')` excluded in SQL. |
| operational critical: mass invite through a queue failing 83 per cent of the time | No email is sent by this build, and no invite ledger is built. |
| operational high: plaintext model addresses landing in `email_send_log` | Nothing is sent, so nothing is logged. The digest carries hashes only, and the website rejects any payload containing an `email` field. |
| operational high: a third of accounts render blank | The digest carries `bookings_ever` and `bookings_180d` so the operator worklist shows who would see something, the empty state copy is specified, and announcement is a human act per model, gated by blocking question 2. |
| operational medium: retention described but not implemented | The `pg_cron` sweep is in the migration. |
| operational medium: revocation renders as an outage | Distinct upstream `403 access_revoked`, distinct `AgendaErrorCategory` value `revoked`, distinct copy, and `requireModelScope` converts it into a closed account on the next request. |
| operational medium: single `customer_accounts` row on trial status takes the portal dark | Category `http_status` is logged separately from `network` and `timeout`, so an operator can tell a tenant resolution failure from an outage. Named in blocking question 3. |

## 14. Verification

Run every test through the real code path. No mocked scope, no hand written SQL standing in for a route.

1. **Client portal regression.** With `MODEL_PORTAL_ENABLED` unset, complete the full client flow at `/portal/sign-in` for an address with no history: OTP send, verify, claim, `needsCompanyName`, submit company, linked. Pass: outcome `linked`, one `portal_clients` row, one `portal_client_emails` row, one `portal_accounts` row, and the five rung ladder in `portal-matching.server.ts` byte identical to `git` HEAD before this build.
2. **Flag off.** With `MODEL_PORTAL_ENABLED` unset, `GET /api/portal/model/session`, `/agenda`, and `POST /claim`, `/close`, `/api/admin/model-identity-sync` each return a bare 404 with no body, and `/portal/model` renders the unavailable page. Pass: no route reveals its existence.
3. **Seeding sends nothing and creates nothing.** Point the sync route at a stub digest of 5 identities, 3 on `gmail.com` and 2 on a company domain. Pass: `portal_model_identities` holds 5 rows, 3 `open` and 2 `held` with `hold_reason = 'non_consumer_domain'`; `select count(*) from auth.users` is unchanged; `select count(*) from email_send_log` is unchanged; the response body contains no hash and no address.
4. **Digest rejects plaintext.** Add an `email` field to one stub identity. Pass: the whole payload is rejected with category `schema`, no row is written or updated, and the log line contains no address.
5. **Happy path claim.** Sign in at `/portal/model` with an address whose hash is `open`. Pass: `portal_model_accounts` gains exactly one row with `link_status = 'linked'`; the claim response is exactly `{ "outcome": "linked" }` and contains no name, slug or model id; one `portal_model_access_log` row with outcome `ok`.
6. **Held identity.** Sign in with an address whose hash is `held`. Pass: 403 code `account_held`, no `portal_model_accounts` row created, log outcome `held`, and the on screen copy does not confirm or deny roster membership.
7. **Unknown address.** Sign in with an address absent from `portal_model_identities`. Pass: the OTP step behaves identically to test 5 (an auth user is created and a code is sent), the claim returns 403 code `no_model`, and no page ever renders a Supabase error message.
8. **Client account guard, both directions.** (a) Complete test 1, then attempt a model claim with the same user. Pass: 409 code `client_account`. (b) Complete test 5, then attempt a client claim with the same user. Pass: 409 code `model_account`, and `claimAccount` is never entered, verified by `portal_clients` gaining no row.
9. **Held identity does not block the client path.** Seed a company domain address as `held`, then run the full client flow with it. Pass: the client ladder completes normally and one `portal_model_access_log` row exists with route `client_claim`, outcome `conflict`.
10. **Identity change revokes.** Complete test 5, then from the browser console run `supabase.auth.updateUser({ email: <a second controlled address> })` and confirm it. Call `/api/portal/model/agenda`. Pass: 403 code `identity_changed`, the account row now reads `link_status = 'revoked'`, `revoked_reason = 'identity_changed'`, and no agenda body is returned. Then attempt a fresh claim on that second address: it must not rebind the existing row.
11. **Re-claim after revocation.** With the account from test 10 revoked, sign in from the model's corrected address whose hash is `open` and points at the same `fo_model_id`. Pass: the claim succeeds, because the unique index is partial on `link_status = 'linked'`.
12. **Second claimant.** With a linked account in place, sign in from a different address that hashes to the same `fo_model_id`. Pass: 409 code `model_already_claimed`, the existing account untouched.
13. **Pending review redaction.** Drive the client claim to rung 3 using an address on a non consumer domain that has history in `leads`. Pass: the response body is exactly `{ "outcome": "pending_review", "message": "…" }` with no `companyName` and no `reason`, while the `portal_link_requests` row still carries the descriptive `match_reason`.
14. **Column boundary.** Capture the raw upstream response and the raw `/api/portal/model/agenda` response for a model who has at least one booking carrying JSON notes. Pass: neither body contains the substrings `notes`, `gross`, `net`, `vat`, `agency_amount`, `agent_commission`, `house`, `model_amount`, `rate`, `currency`, `agent`, `client_email`, `client_phone`, `contact_`. Assert this as an automated test over the JSON string, not by eye.
15. **Sibling isolation.** Pick a `(title, start_datetime)` group carrying more than one model. Sign in as one of them. Pass: the response contains exactly one item for that job and no other model's identifier appears anywhere in the body.
16. **Options filter.** Pass: no item in any response has an upstream option `status` of `lapsed` or `released`, and no booking item has `startsAt` before 1990.
17. **No cross request state.** Warm one server instance, request the agenda as model A, then immediately as model B on the same instance. Pass: B's response carries B's `model_id` and none of A's items. Then grep `src/lib/model-agenda.server.ts` for module level `let` or `const` holding a snapshot: there must be none.
18. **Envelope identity assertion.** Stub the upstream to return a valid envelope whose `model_id` is a different uuid. Pass: `{ "status": "unavailable", "category": "schema" }`, nothing rendered, and the log line carries the category only.
19. **Fail closed.** Stub the upstream to time out. Pass: `{ "status": "unavailable", "category": "timeout" }`, the page shows the unavailable state, and no previous agenda is shown. Repeat with a 500 and with malformed JSON.
20. **Revocation is not an outage.** Stub the upstream to return `403 {"error":"access_revoked"}`. Pass: the first request returns 403 code `model_revoked` with the closed account copy, distinct from test 19's copy; the account row is revoked; the second request is refused by `requireModelScope` without any upstream call.
21. **Self close.** Call `/api/portal/model/close`. Pass: `link_status = 'revoked'`, `revoked_reason = 'self_closed'`, the existing access token no longer works against `/api/portal/model/agenda`, and a page refresh lands back on `/portal/model`.
22. **Deactivation cascade.** Run the sync route with an identity removed from the digest. Pass: that row's `is_active` is false and any account on that hash is revoked with `revoked_reason = 'identity_deactivated'`.
23. **Throttle.** Issue 40 agenda requests in 60 seconds as one user. Pass: the first 30 succeed, the rest return 429 code `rate_limited`, and the log shows `rate_limited` rows.
24. **Grants.** Run, in a rolled back transaction, `set local role authenticated; select count(*) from public.portal_model_identities;` and the same for the other two new tables and for `role anon`. Pass: `ERROR: 42501 permission denied` in all six cases, because the `revoke` fires before RLS.
25. **No new policy on the sensitive tables.** Pass: `pg_policies` for `leads`, `packages`, `email_send_log` and `lead_events` is byte identical to before the migration.
26. **Retention job.** Pass: `select jobname, schedule from cron.job where jobname = 'portal-model-access-log-sweep'` returns one row, and inserting a row dated 100 days ago then invoking the statement removes it.
27. **Not published, not indexed, not linked.** Pass: `/portal/model` and `/portal/model/agenda` carry `noindex, nofollow`; neither path appears in `src/routes/sitemap[.]xml.ts` output, in `site-layout.tsx` nav items, or in any footer column; and the project has not been deployed.
28. **No email, verified after the whole run.** Pass: `select count(*) from email_send_log` and `select count(*) from auth.users` differ from their pre build values only by the auth users the tester created by verifying their own codes. No row in `email_send_log` has `template_name` mentioning model or portal.
29. **Preconditions before anyone is told the portal exists** (not code, but gate the announcement on them): Turnstile or hCaptcha enabled on Supabase Auth for this project; the Authentication rate limits read out of the dashboard and recorded; custom SMTP confirmed; and the operator worklist reviewed so a person has opened each identity they intend to open.