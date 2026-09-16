# yourway.ai, Google sign in and the standard AI interface

Date: 16 September 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`. Commit `44bc658` (12.5 credits).
Published as deployment `aeb59bf4-3f96-4a5f-9166-f9706fa0d85a`.

## Purpose

Make the product feel like a familiar AI application rather than a
bespoke one, and remove the last friction at the front door.

## What shipped

- Google sign in, using Lovable Cloud's managed Google OAuth. No owner
  supplied Google Cloud credentials were required, which was the open
  question going in. Continue with Google is the primary action on
  /auth, with email and password kept beneath it. Google profile name
  and avatar populate the profile where not already set.
- Account linking works as specified: signing in with Google on an
  address that already had an email and password account lands in the
  same account rather than creating a duplicate.
- The interface is now the conventional one. A left sidebar with New
  chat, the conversation list, search, rename, pin and delete, and an
  account menu at the bottom. The main area is only the conversation,
  in a centred reading column, with the composer pinned at the bottom.
  Today, Reflect, Goals, Diary and the privacy controls moved into the
  account menu: all still working, none of them cluttering the view.
- Signed in visitors arriving at the root go straight to the
  conversation instead of the marketing page.
- Mobile: the sidebar becomes a drawer below 768px, composer pinned.
- Dark by default, brand colours and type retained.

## Verification, independent

Checked in the live database by this desk:

- The owner's account now carries two identity providers, `email` and
  `google`, on a single user row. That is direct proof both that Google
  sign in genuinely works and that the linking behaviour is correct: no
  duplicate account was created.
- The owner signed in on 10 September at 01:26 and held a real
  conversation, "Here is what I am working towards this month", then
  "I want to be a calisthenics athlete", answered with a substantive
  reply on bodyweight movement patterns and progression. This is the
  first genuine end user session in the product's history and it
  succeeded without intervention.
- The build agent's own test account showed one conversation, a pin, and
  two persisted assistant replies, covering new chat, rename, pin,
  search and cross route navigation, plus the mobile drawer at 375px.

Test accounts were deleted afterwards. The owner's account and its
conversation were left untouched.

## Still outstanding

- Stripe secrets absent, so billing cannot activate. Owner action.
- `yourway.ai` points at an unrelated external IP. The live product is
  `aiyourway.io`.
