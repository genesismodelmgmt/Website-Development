One blocking bug in the portal, plus the missing piece that goes with it. Work in the preview, do not publish or deploy. UK English, no em dashes or en dashes, including in code comments.

## The agency review queue cannot be opened by anyone

`src/routes/api/portal/requests.ts` starts with `requireClientScope(request)` and only then checks `scope.isAgency`. But `requireClientScope` throws `no_client` with a 403 whenever `link_status` is not `linked` or `client_id` is null:

```
if (account.link_status !== "linked" || !account.client_id) {
  throw new PortalAuthError("no_client", "Your account is not linked to a company yet.", 403);
}
```

A member of Genesis staff is not a client and has no `client_id`, so they are rejected before the `isAgency` check is ever reached. The queue is unreachable.

This matters more than it looks. The queue is the only way a domain matched colleague ever gets approved, so as it stands every `pending_review` account waits forever and nobody can clear it.

Please add a separate gate, for example `requireAgencyUser(request)` in `src/lib/portal-auth.server.ts`, which:

- verifies the bearer token exactly as `requirePortalUser` already does,
- looks up `portal_accounts` for that user id,
- requires `is_agency = true` and nothing else, with no requirement for a linked client,
- throws the same 404 shaped response as now when the caller is not agency, so the route still does not disclose that a queue exists.

Use it for both the GET and the POST in `requests.ts`, in place of `requireClientScope`. Keep `requireClientScope` exactly as it is for the client data routes.

Then check the rest of the portal for the same assumption. A Genesis staff account with no client should be able to sign in, reach `/portal/requests`, and not be shown a broken or empty client portal. If `/portal` or the account page would error for them, send them to the queue instead.

## There is no way to make someone an agency user

`is_agency` defaults to false and nothing in the code ever sets it, so even with the gate fixed there is no route into the queue.

Do not build a self service way to grant it, that would be a privilege escalation. Instead:

- Make sure `is_agency` can be set directly on `portal_accounts` by an administrator, and that the account keeps it across later sign ins. Check that the `upsert` in `claimAccount` does not reset `is_agency` to false when an existing agency user signs in again, because the upsert currently writes a fixed column set and may clobber it. Fix that if it does.
- Add a short note to the project README, or a comment at the top of `requests.ts`, giving the exact SQL to grant it, along the lines of `update portal_accounts set is_agency = true where user_id = (select id from auth.users where email = 'name@genesismodelmgmt.co.uk');`

## Verify, by exercising it

1. Create two accounts in the sandbox: one ordinary client, one with `is_agency = true` and no `client_id`. Confirm the agency account can GET `/api/portal/requests` and the client account gets 404. Report both statuses.
2. With a real pending review request in the queue, approve it as the agency account and confirm the target account flips to `linked` and can then see its history. Then reject one and confirm the account becomes `unlinked` and the login still works.
3. Sign in as the agency account and open `/portal`. Confirm it does something sensible rather than erroring.
4. Confirm an existing agency account still has `is_agency = true` after signing in a second time.
5. Run the typecheck, the linter and the tests.

Clean up every account and row you create. Report what you actually observed, and say plainly if something could not be verified.
