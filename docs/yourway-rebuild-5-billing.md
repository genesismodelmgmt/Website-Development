# yourway.ai, billing release

Date: 21 August 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`.

## What shipped

Two passes, both verified, typecheck and production build clean,
published as deployment `6b229c61-c6ef-4c76-8dd4-52f999f87337`.

Billing core (commit `f8f69ad`, 9.7 credits):
- `subscriptions` table under forced RLS, user read only, service role
  writes only.
- A fetch based Stripe layer for the Worker runtime: idempotent creation
  of the plan price (AI Your Way, £29.99 GBP monthly, lookup key
  `aiyourway_monthly_gbp_2999`), checkout sessions with the 30 day free
  trial, customer portal sessions, and Web Crypto HMAC signature
  verification with replay protection.
- `startCheckout` and `openBillingPortal` server functions, auth
  enforced, rate limited, user safe errors, no personal data logged.
- Entitlement gating unified in `resolveAccess`: subscription status
  overrides the trial when present; lapsed accounts get a calm renew
  state and never lose access to their own data.
- Account area and pricing page wired: subscribe and manage subscription
  actions, signed out visitors routed through /auth first.

Events enrichment (commit `9c24343`, 10.2 credits):
- `billing_events` table, forced RLS, service role writes, unique Stripe
  event id for idempotency, compact PII free summaries only.
- Webhook broadened: subscription created, updated and deleted, invoice
  paid and payment failed, trial will end. Events are recorded first,
  then applied; duplicates ignored; unknown types acknowledged.
- A failed payment moves the account to the renew state and a later
  successful payment clears it automatically.
- Billing history in the account area in plain UK English, with current
  status, next renewal date and gentle notes for trial ending or failed
  payment.
- Six unit tests cover the lifecycle, duplicate suppression and
  signature rejection (unsigned, tampered and stale payloads).

## The one step that remains, owner only

Stripe is not connected: no secret key exists in the project
environment, and connecting an account cannot be done programmatically.
To switch billing on:

1. In the Lovable dashboard for this project, add secrets
   `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
   (https://lovable.dev/dashboard?connectors, or Project Settings,
   Secrets). Use a test mode key first.
2. In the Stripe dashboard, point a webhook endpoint at
   `/api/public/stripe/webhook` on the live domain and copy its signing
   secret into `STRIPE_WEBHOOK_SECRET`.
3. Say the word and this desk will run the live verification loop
   (checkout session, signed test events, billing history rendering) and
   confirm before real cards are involved.

Until then the app shows the honest state: card payments are not
switched on yet, nothing is charged, and the 30 day trial tracking runs
as before.

## Also flagged

- Supabase leaked password protection is currently disabled on the
  project; re-enable before a wide public launch.
