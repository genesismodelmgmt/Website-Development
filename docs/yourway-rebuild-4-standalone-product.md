# yourway.ai, standalone product release

Date: 20 August 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`.

## Owner direction

AI Your Way is a standalone AI product: no Try taster, no waitlist, no
external product app. A visitor creates an account and uses the AI. Best
possible web app functionality plus a mobile grade experience. Take
interface inspiration from the leading AI products.

## Research applied

Interaction patterns distilled from published teardowns of ChatGPT,
Claude and Perplexity interfaces: streaming with a visible cursor as
table stakes, a reading column near 740 px, a searchable conversation
sidebar with auto titles (searching message content, which ChatGPT still
lacks), personalised suggestion chips in the empty state, stop,
regenerate, copy and edit and resend controls, dark mode default, a
visible and editable memory surface, and a waveform voice button with
bottom composer on mobile.

## What shipped

Project knowledge was rewritten first with the owner decision reversing
the 19 August marketing only split, then three build passes ran:

Pass A (commit `f1de830`, 14.9 credits): restored /auth, /chat,
/onboarding, /today, /reflect, /goals and /you from the proven 18 August
implementation; retired Try completely (routes redirect to /auth);
repointed every CTA to /auth; added a private `history_imports` table
with forced RLS and a paste box import step in onboarding matched to the
provider chosen on the homepage; fixed an onboarding trigger bug
(validation triggers needed SECURITY DEFINER with a fixed search_path);
retuned homepage copy to open now.

Pass B (commit `abb6804`, 16 credits): fixed the restored chat's missing
reply persistence, then raised the app to the interaction standard:
streaming cursor, stop, regenerate, copy, edit and resend; sidebar with
auto titles, content search and pinning; 740 px column with markdown
rendering; server side personalised suggestion chips from the user's own
goals, memories, reflections and imports; memory surface with confirm,
correct and retract plus import deletion; 30 day trial tracked server
side (`trial_started_at`) and shown in the account area; service worker
with offline fallback; mobile drawer and bottom composer.

## Verification, independent

Checked from this desk in the live database, not taken from the agent:
the QA run's assistant reply row `7956447a-0610-4242-bba3-c3ad18d80a5c`
existed for test user `qa+pb1787264147@example.com` with real model
content, proving signup, onboarding, streaming and persistence end to
end. All ten QA accounts were then deleted, cascades clearing their data.

## Publish

Published to production on the owner's standing direction, deployment
`62c902bc-7a25-4b4b-b6f1-f724df421797` to
https://yourway-ai-builder.lovable.app and its attached domain.

## Open items

- Billing checkout is not live; the trial is tracked honestly and expiry
  gates new AI work with a calm state. Connecting Stripe remains an owner
  action in the Lovable workspace.
- The mobile app shell (Capacitor config exists in the repo) is untouched
  this release; the PWA covers mobile until a store build is wanted.
- Credits used this release: about 31 on passes A and B.
