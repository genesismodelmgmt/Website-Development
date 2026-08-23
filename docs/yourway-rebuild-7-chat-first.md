# yourway.ai, chat first release

Date: 23 August 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`. Commit `dac9b44` (9.4 credits).
Published as deployment `b4b4e90b-b8d7-4ea6-8165-6a1ad4f12a93`.

## The change

Onboarding was a gate between signing in and using the assistant, and it
was where the owner's own account died. The gate is removed.

- Signing up or signing in lands directly in /chat, every time, whatever
  the account state. /onboarding now redirects to /chat.
- The assistant answers from the first message with no profile, no
  consent, no memories and no imported history. With no context it simply
  says less about the person and asks better questions.
- The profile row and the reflection cycle are created lazily and
  silently when needed, never as a precondition for entry.
- Onboarding is now a dismissible panel inside chat: optional, answerable
  in any order, resumable, skippable for good, and it shows existing
  answers as already done.
- Memory consent is requested in context at the moment it would first be
  used, with a plain explanation and an easy decline. Declining leaves
  chat fully working. The consent gated memory lifecycle underneath is
  unchanged: nothing is stored without explicit confirmation.
- A trial status line sits above the thread without obstructing it.

## Verification, independent

Checked from this desk in the live database, not taken on trust. The
decisive evidence is assistant replies existing on accounts that have no
consent row and no onboarding answers, which could not happen if chat
were still gated:

- `qa+cf1787521274`: 0 consents, 0 answers, 1 conversation, 1 assistant
  reply. Brand new signup, straight into a working assistant.
- `qa+rc1787521336`: same pattern, the stranded state journey.
- `qa+jm1787521487`: same pattern, the declined consent journey.
- `qa+jb1787521398`: 1 consent, 1 answer, 3 assistant replies. The
  optional panel path records answers and consent correctly.

Reply content was inspected and is genuine model output in the product's
voice. All test accounts were then deleted. The owner's account was left
untouched and now falls into the chat first path on next sign in.

## Still outstanding

- Stripe secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) remain
  absent, so billing cannot activate. Owner action.
- `yourway.ai` still points at an unrelated external IP. The live product
  is `aiyourway.io`.
