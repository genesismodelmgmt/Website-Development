Sent to the genesismm Lovable project after the portal went live, to take the
public entry points down until the Supabase email sender is confirmed.

Hide the public entry points to the client portal for now. The portal is live on
the public site, but Supabase email OTP has not been confirmed to deliver, so a
visitor who clicks through reaches a sign in form that may never send a code.
Take the links down until the sender is confirmed working.

Do not delete anything. This is a temporary hide that must be trivial to reverse.

Add a single flag, `PORTAL_PUBLIC_ENTRY = false` in `src/lib/portal-flags.ts`.
When false: the "Client portal" and "Your account" links do not render in the
site header or footer, and the line on `/clients` does not render. Nothing else
changes.

What must keep working: `/portal/sign-in` and every `/portal` route stay
reachable by direct URL, with no redirect or holding page. The portal server
routes, the matching engine and the agency queue are untouched. `/portal` stays
disallowed in robots.txt. Anyone already signed in keeps their session.

No "coming soon" banner. A visitor should simply not see it exists yet.

## Outcome

Implemented across three files and verified with Playwright by the Lovable
agent: with the flag false there is no portal text on the home page, in the
footer or on `/clients`; `/portal/sign-in` still loads by direct URL with a
working form; flipping the flag to true brings all three back. 144 tests pass,
typecheck clean. Published as commit 9690fb5c.

## To turn it back on

Set `PORTAL_PUBLIC_ENTRY = true` in `src/lib/portal-flags.ts` and publish, once
a six digit code actually arrives in a real mailbox.
