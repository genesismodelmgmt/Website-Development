# yourway.ai rebuild, AI systems report

Date: 18 August 2026. Desk: Genesis AI systems (Rafael Knight, Felix Ward).
Project: Lovable `yourway-ai-builder` (`f26b4d88-c196-498b-8f0e-09455b1c8def`).
Preview: https://id-preview--f26b4d88-c196-498b-8f0e-09455b1c8def.lovable.app

## Completed

Two build turns on Lovable, both staged in preview only.

Turn 1 (commit `b3b3eb1`, 12.8 credits), the rebuild pass:

- Real signup at /auth: email and password sign up, sign in and password
  reset, with Supabase email auto confirm enabled so a new account works
  immediately. Onboarding creates the profile, asks one question per axis
  and routes into the app.
- /chat, a streaming conversational assistant on the Lovable AI gateway
  (model `google/gemini-3-flash-preview`), now the default signed in
  surface. Server side only: bearer token auth, a fail closed rate limit
  (60 messages per 10 minutes per user) before any paid work, ownership
  checks on every conversation, user safe error strings, no logging of
  message content.
- The system prompt is built server side from the user's own confirmed
  memories, active goals and recent reflection answers via the existing
  consent gate (`has_active_consent`). Untrusted text is quoted and
  labelled as data. The assistant produces reviewable drafts only, never
  sends anything, and does not present itself as medical, legal,
  psychological or financial advice.
- Database migration bringing `conversations` and `messages` to the house
  standard: forced RLS with per operation own row policies, UNIQUE(id,
  user_id), a same owner composite foreign key from messages to
  conversations, and indexes. Verified live in `pg_policies`.
- Weekly reflection synthesis upgraded from deterministic counts to a real
  model pass, evidence cited, with the deterministic path kept as a
  fallback.
- Marketing pages repointed from the waitlist to "Create your account";
  closed beta copy removed. The waitlist remains only as a secondary path.

Turn 2 (commit `aa0b4cc`, 4 credits), the verification pass, which caught
a real defect:

- The chat response stream was built with a pull handler, so the final
  read, and with it the insert of the assistant reply, only ran if the
  browser kept pulling after the last token. It never did, so no assistant
  row was ever saved. Rewritten as a push based pump that drains the
  gateway stream to completion, persists the reply first and then closes,
  tolerating a closed tab.

## Evaluation, evidence not claims

Checked independently in the live database from this desk:

- Three fresh signups from the automated test run, all auto confirmed at
  creation, proving signup works with no confirmation blocker.
- Before the fix: a user message row at 14:37 with no assistant row, which
  is what exposed the defect.
- After the fix: conversation `2a708323-ad76-4ca6-abc5-69c1c234191a` for
  test user `verify.1787064707@aiyourway-test.io` holds the user row and
  assistant row `3813fd49-66f9-463c-9fb6-5ba38f2de3e9`, content beginning
  "Wake early to sit in silence with a warm drink." That row is a real
  streamed model reply, persisted, and it renders again after a full page
  reload.
- Typecheck reported clean on both turns. This desk could not reach the
  preview or Supabase directly (network egress from the build container is
  blocked to those hosts), so browser evidence comes from the Lovable
  agent's Playwright run and was cross checked against the database.

## Known gaps, named not hidden

- Memory extraction from chat is staged through the existing confirm path
  but was not exercised end to end in this pass.
- The onboarding consent step showed one slow save during testing; it
  completed on the second run. Worth watching.
- Project knowledge in Lovable still says "a private reflection engine,
  not a chatbot" and "private beta opening Q3 2026". The site now says the
  product is open. The knowledge file should be updated to match the new
  product truth once Steven confirms the positioning.
- Test users (three `@example.com`, several `@aiyourway-test.io`) remain in
  the database and should be cleared before launch.

## Approvals needed from Steven

1. Publish the rebuilt site from preview to the live domain. Nothing has
   been published; the live site still runs the previous version.
2. Confirm the positioning change (open product with a working assistant,
   rather than reflection engine behind a waitlist) so project knowledge
   and remaining copy can be aligned.
3. Approve deletion of the test accounts and their rows before launch.

## Handoffs

- Public site publish and any domain work: sebastian-moore, Journey 8,
  after approval 1.
- Credit watch: genesis-web-operations. This work used 16.8 credits.
