Build the foundation of a client portal at /portal: sign in, and the engine that recognises a returning client and links the history we already hold for them. This message is backend and auth only. I will ask for the portal pages next. Work in the preview, do not publish or deploy.

House rules for this job: UK English, no em dashes or en dashes anywhere including code comments, editorial and understated tone, no exclamation marks, no emoji, no placeholder or lorem text. Where there is nothing to show, build a genuine empty state.

## What it is for

A client (a brand, an agency or a casting director) signs in and sees everything Genesis already holds for them: the enquiries they have sent, the models they were shown, the emails we have exchanged, the packages shared with them. Someone enquiring for the first time gets an account too, and their history starts collecting from that moment.

## The data already exists, do not invent tables for it

The client history is already in this project's database. Read from it, do not create a parallel copy:

- `leads` (96 rows, 60 distinct addresses): enquiries submitted through the site. Keyed by `email`, with `company`, `reference`, `status`, `project_name`, `shoot_dates`, `budget`, `usage`, `territory`, `location`, `selected_slugs` (jsonb array of model slugs), `created_at`, `contacted_at`, `converted_at`.
- `email_send_log` (341 rows): emails sent, by `recipient_email`, with `template_name`, `status`, `created_at`, `metadata`.
- `packages` (21 rows): model packages shared with a client. `contact` is jsonb containing an email, plus `title`, `brief`, `items`, `share_token`, `status`.
- `casting_briefs`: structured briefs keyed by `work_email`, with `organisation`, `client_name`, `project_name`, shoot dates, budget, status, `owner_user_id`.
- `casting_selections`: models chosen per brief, by `model_slug`.
- `lead_events`: the activity trail per lead.

Model slugs resolve to names and photos through `src/data/site-data.json` and the helpers in `src/lib/models.ts`. Reuse those. Respect the existing display rules: surnames reduce to a single initial, and sports talent stays anonymised.

## Security constraint, please read carefully

`leads`, `lead_events`, `packages` and `email_send_log` have RLS enabled with service role only policies and no authenticated read policy. That is correct and it must stay that way. Do not add anon or authenticated policies to those tables, and do not query them from the browser.

Every portal read goes through a TanStack Start server route, in the style of the existing `src/routes/api/*`, which:

1. reads the Supabase access token from the request,
2. verifies it server side and resolves the auth user,
3. works out which client that user is from the server's own lookup, never from anything in the request body, query string or path,
4. queries with the service role key, filtered to that client.

No parameter a signed in client can edit may widen what they see. Asking for an enquiry id belonging to another company must return 404, not the record. Service keys stay server side.

## New tables, additive only

```sql
create table portal_clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  email_domain text,
  primary_email text,
  created_at timestamptz not null default now()
);

create table portal_client_emails (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (client_id, email)
);
create index portal_client_emails_email_idx on portal_client_emails (email);

create table portal_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid references portal_clients(id) on delete set null,
  full_name text,
  link_status text not null default 'unlinked'
    check (link_status in ('linked','pending_review','unlinked')),
  is_agency boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table portal_link_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references portal_clients(id) on delete cascade,
  email text not null,
  match_reason text not null,
  confidence text not null check (confidence in ('exact','domain')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  decision_note text
);
create index portal_link_requests_status_idx on portal_link_requests (status);

create table portal_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);
```

Store every email address lower cased. Enable RLS on all five tables with service role only policies. No anon or authenticated policies: the server routes are the only way in.

## Signing in, a six digit code by email

Route `/portal/sign-in`, using Supabase Auth email OTP.

Step 1, name and work email. Call `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`. The reply shown to the visitor must be identical whether or not we know the address, along the lines of "If that address can be used, a six digit code is on its way." Nothing at this step may hint at a match. This form must not be usable to work out who Genesis's clients are.

Step 2, the six digit code, using the `input-otp` component already in the project. Call `supabase.auth.verifyOtp({ email, token, type: 'email' })`.

Step 3, only now call `POST /api/portal/claim`, which runs the matching below and returns what was found. This is the moment the portal earns its keep, so let it land: "Welcome back, Northbank Studios. 14 enquiries, 63 messages and 6 packages on file, working with Genesis since March 2023." Then a button through to the portal.

The emailed code proves the person owns the mailbox before anything is disclosed. That ordering is the whole point of the design, please keep it.

## The matching engine, inside /api/portal/claim

Take the verified email of the signed in user, lower case it, and read its domain. Then:

Exact match: the address itself appears in any of `leads.email`, `casting_briefs.work_email`, `packages.contact->>'email'`, `email_send_log.recipient_email`, all compared lower cased.

Domain match: only the company domain appears in those columns. Skip domain matching entirely for consumer mailbox domains: gmail.com, googlemail.com, hotmail.com, hotmail.co.uk, outlook.com, live.com, live.co.uk, msn.com, yahoo.com, yahoo.co.uk, icloud.com, me.com, mac.com, aol.com, proton.me, protonmail.com, gmx.com, mail.com, zoho.com, yandex.com, fastmail.com, hey.com. Otherwise half of London matches on gmail.com.

Then decide:

- Exactly one exact match: resolve or create the `portal_clients` row, taking the company name from the most recent lead or brief among those records and setting `email_domain` only when it is not a consumer domain. Record the address in `portal_client_emails` and set `portal_accounts.link_status` to 'linked'. The history is theirs straight away, because the emailed code already proved they own the mailbox.
- Domain match only, or several different companies claiming the same address: still create the account, but set `link_status` to 'pending_review' and insert a `portal_link_requests` row. Show them nothing until a human at Genesis approves it. A domain proves employment at best, and guessing wrong shows one client another client's budgets.
- No match: create a fresh `portal_clients` row from the company name they give, set `link_status` to 'linked', and tell them plainly that their history starts here.

Ask for a company name at step 3 only in the no match case. In the other cases we already know it.

`/api/portal/claim` returns `{ outcome: 'linked' | 'pending_review' | 'new_customer', companyName, reason, history: { enquiries, messages, packages, firstSeen } }`.

## Also build

- A server helper, say `src/lib/portal-auth.server.ts`, exporting `requireClientScope(request)` which returns `{ userId, clientId, emails }` or throws 401 or 403. Every portal server route starts with it. When `link_status` is 'pending_review' it should fail with a distinguishable code such as `link_pending`, so the interface can explain the wait rather than show an error.
- `GET /api/portal/session`, returning the signed in user, their company and their link status.
- Sign out.

Follow the conventions already in this project: TanStack Start server routes, the existing Supabase setup, shadcn/ui, the site's existing typography and design tokens, `sonner` for toasts and `zod` for validating request bodies.

Do not build the portal pages yet. Sign in, the reveal, and the server foundation only.
