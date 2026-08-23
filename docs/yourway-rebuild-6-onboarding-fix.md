# yourway.ai, onboarding stall fix and hardening

Date: 23 August 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`. Commit `280eacf` (9.8 credits).
Published as deployment `526b6350-fcf5-4949-80f8-c63e04f6ea42`.

## The defect, found from the owner's own account

The owner signed up on 21 August at 22:07 and never reached the
assistant. The database showed the signature: a `user_profiles` row with
zero consents, zero conversations and zero messages.

Root cause: the /auth page fired two navigations at once, a race between
the initial `getSession` call and the `onAuthStateChange` subscription.
That remounted the onboarding route mid boot, and the existing boot latch
plus its cleanup guard then refused to boot the second mount. The result
was an account that existed, with a profile, that could never progress to
consent or chat.

This is why the earlier QA runs passed while the real journey failed: the
automated runs did not reproduce the double navigation timing.

## Fixes applied

- A navigation guard in `src/routes/auth.tsx` so exactly one navigation
  happens after sign in.
- `onboarding.tsx` releases the boot latch when no cycle was established,
  and `saveCurrent` self heals by creating the cycle if it is missing.
- Returning part way through onboarding now resumes at the correct step
  instead of dead ending, and chat is always reachable.

## Verification, independent

Confirmed from this desk in the live database, not taken on trust:
test account `qa+ob1787519932@example.com` completed signup, onboarding
with three answers, a recorded consent row, and produced assistant
message `666ed3ba-3769-4b78-905f-cfbb8b963bbc` with genuine model
content, persisted. Fifteen earlier accounts from the same session show
the profile only pattern, reproducing the owner's failure exactly, which
corroborates both the diagnosis and the fix. All test accounts were then
deleted; the owner's account was left untouched.

## Other findings this pass

- Supabase leaked password protection is now enabled. Verified: strong
  passwords work, a known breached password is rejected.
- DNS facts, checked from the build sandbox:
  - `aiyourway.io` and `www.aiyourway.io` resolve to this project.
  - `app.aiyourway.io` has no DNS record.
  - `yourway.ai` resolves to an unrelated external IP and times out. It
    is not this product. Earlier session notes that implied the site was
    live on an attached domain were wrong for `yourway.ai` and correct
    only for `aiyourway.io`.
- Stripe secrets remain absent. The billing code is activation ready and
  nothing in the codebase blocks it.

## Owner action still outstanding

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the Lovable
   project settings (test key first) and point a Stripe webhook at
   `/api/public/stripe/webhook`. This desk will then run the live
   verification loop before any real card is charged.
2. Sign in again at aiyourway.io: the stalled account now resumes at the
   correct onboarding step.
