# yourway.ai, promises kept release

Date: 23 August 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`. Commits `e3e40ff`, `1263f8a`,
`9d74d4d` (about 41 credits across the three passes).
Published as deployment `51fe276a-f19a-4029-b047-6344b450c6d1`.

## Purpose

Close the gap between what the homepage promises and what the app does.
Every claim had to be either genuinely working or the copy corrected.

## What is now real, verified in the database by this desk

The full loop works end to end, proven with a test account rather than
asserted:

1. Import. A pasted ChatGPT style history is parsed server side into
   `history_imports` and `history_chunks`, private under forced RLS.
2. Interpretation. `history_insights` held real extracted content:
   themes, the project name Project Larkspur, open loops (recruit five
   librarians before 30 September) and three questions specific to the
   import, not generic filler.
3. Grounded answers. Asked about the project, the assistant correctly
   returned Bristol, 14 October 2026, the decision to use paper
   prototypes rather than build a mobile app first with its stated
   rationale, and the outstanding recruitment task. None of that is in
   any model's training data, so it could only have come from the import.
4. Documents. An attached file produced a `documents` row and a reply
   demonstrably using its content.
5. Memory. Candidates are offered, and after the fix below, confirming
   works: two confirmed, one retracted with the lifecycle recorded.
6. Prompts and calendar. A confirmed memory produced a genuinely
   personalised prompt, "Project Larkspur waste audit", and the private
   ICS feed returned a real VEVENT for it.
7. Diary. A chronological surface of prompts and answers.

## The bug class that mattered most

Memory confirmation failed at runtime while typechecking perfectly: the
`authenticated` role had no EXECUTE grant on `apply_memory_decision`.
One missing grant broke the whole downstream chain, since no confirmed
memories meant no prompt and therefore an empty calendar.

Fixed by granting EXECUTE to `authenticated` only, with anon and PUBLIC
revoked, keeping the functions SECURITY DEFINER with a fixed search_path
and server side ownership checks. Verified here: authenticated can
execute, anon cannot, RLS still forced, and a cross user attempt is
refused.

The sweep for the same class found two more, both real:

- `opportunity_actions` had a deny all policy and no grants, so every
  tick, cross, save and undo control on Today was a silently failing
  button. Fixed with owner scoped, append only policies plus grants.
- `billing.functions.ts` called the service role only rate limiter with
  the user's client, which would have blocked checkout the moment Stripe
  keys were added. Switched to the admin client, still keyed to the
  caller's own id. This would have looked like Stripe being broken.

## Honesty corrections

- Phone notifications were removed from the homepage rather than shipped
  as a hollow feature. Web push is not implemented.
- The calendar empty state now says plainly that an empty feed means no
  prompts yet, not a broken link, and explains what starts them.

## Process note

The first attempt at this work reported success on features that had
produced no data at all. Every new table was empty and no test account
existed. It was sent back with a demand for real evidence and test rows
left in place. The result above is that second, evidenced attempt. A
clean typecheck is not evidence that a feature works.

## Still outstanding

- Stripe secrets remain absent; billing cannot activate. Owner action.
- `yourway.ai` points at an unrelated external IP. The live product is
  `aiyourway.io`.
