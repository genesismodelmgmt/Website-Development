Two defects in the portal foundation, found by checking the matching engine against the real data rather than by reading it. Fix both, then verify the foundation properly and report what you actually observed. Work in the preview, do not publish or deploy. UK English, no em dashes or en dashes, including in code comments.

## Defect 1, the company name falls back to the email local part

In `claimAccount`, the exact match branch does this:

```
const companyName = exactCompanies[0] ?? cleanCompany(args.companyNameInput) ?? email.split("@")[0] ?? "";
```

On the first claim the visitor has not been asked for a company name, so when the history carries no company the name becomes the local part of their address. A returning client would be greeted as "Welcome back, sarahjones92."

This is not an edge case. Counting the real rows in `leads`, `casting_briefs` and `packages`, there are 91 distinct addresses on file and 66 of them have no company name recorded anywhere. Of those 66, 61 are consumer mailboxes, so the domain gives us nothing to fall back on either. Roughly three quarters of the people who sign in would be greeted by their own email prefix.

Fix it so we never invent a company name from an address:

- Keep linking the history immediately. The mailbox is proven and the history is genuinely theirs, so do not hold it back or add a step before they can see it.
- When we hold history but no company name, return the claim with the history counts and a flag such as `needsCompanyName: true`, and set the client's `company_name` to a neutral placeholder that is never displayed, or leave the reveal to render without a name.
- On the reveal, greet them without a company name in that case, for example "Welcome back." followed by the counts, and invite them to confirm the company we should file them under. Leave the field empty rather than pre-filling a guess. When they submit it, update `portal_clients.company_name`.
- Never render an empty or placeholder company name as though it were real. "Welcome back, ." is as bad as the local part.

## Defect 2, ilike treats the address as a pattern

`collectCandidates` matches with `.ilike("email", pattern)` where the pattern is the raw address. In a LIKE pattern `_` matches any single character and `%` matches any run, so `john_smith@acme.com` also matches `johnasmith@acme.com`. Two addresses on file already contain an underscore.

Either escape `%`, `_` and `\` in the address before using it as an exact pattern, or match case insensitively without LIKE semantics. Keep using the wildcard form only for the deliberate `%@domain` domain lookup, and escape the domain there too.

Please do not silently widen this to a "close enough" match. An exact match must mean exact.

## While you are in there

`POST /api/portal/claim` can return `{ outcome: "model_account", portal: "model" }`, but `/portal/sign-in` does not handle that outcome. As written it falls through to the welcome branch and tells a model that her history with Genesis starts here, which is both wrong and confusing. Give it its own short branch pointing her at the model portal, and add it to the `ClaimResult` type.

## Then verify the foundation, by exercising it

Run the dev server and drive the real code path. Do not report from reading the source. For each check, state what you did and what actually came back.

1. Pick a real address from `leads` that has history. Mint a session for it and call `POST /api/portal/claim`. Report the outcome, the company name shown, and the three counts. Then confirm those counts against the database directly, so we know the numbers on the reveal are true.
2. Pick a real address whose history carries no company name. Confirm the reveal no longer shows an email prefix, and that the history counts are still correct.
3. Call `POST /api/portal/claim` with no Authorization header, and again with a forged bearer token. Both must be 401. Report the exact status and body.
4. Call `POST /api/portal/claim` with a valid session but pass a different company's address in the request body. Confirm the body is ignored and the match is computed from the session address only.
5. Confirm the response for step one of sign in is identical for an address that exists in `leads` and one that does not.
6. Grep the built client bundle for the service role key and for `SUPABASE_SERVICE`. It must not appear. Report the command and the result.
7. Confirm `leads`, `lead_events`, `packages` and `email_send_log` still have no anon or authenticated RLS policy.
8. Run the typecheck and the linter.

If any check fails, fix it and re-run until it passes. Do not weaken a check to make it pass, and if something cannot be verified in the sandbox, say so plainly rather than reporting it as passed.
