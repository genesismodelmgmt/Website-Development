# Staff sign in entry point on the public site

Sent to genesismm and committed there. Not published yet, see "Outstanding" at
the end.

## Why this was needed

Genesis staff sign in to First Option at
`https://www.firstoption.app/auth/genesismodelmgmt`. Nothing on the public site
pointed at it. The only sign in link anywhere on genesismodelmgmt.co.uk was
"Client portal", which is the client facing email code flow, not a staff door.

Staff reached First Option by bookmark or by typing the address from memory.
That is fragile on its own, and it was actively misleading during the sign in
outage on 20 August: once the sign in page was repaired, anyone who had lost
their bookmark had no way to confirm it was working again, so a fixed service
still looked broken.

## What was changed in genesismm

Three additive changes, no existing route or component altered.

1. `src/routes/staff.tsx`, new. A `/staff` route that redirects on the server
   to `https://www.firstoption.app/auth/genesismodelmgmt`, with status 302 and
   `replace: true`, thrown from `beforeLoad` so it fires before any data loads.
   The route carries `robots: noindex, nofollow`. It mirrors the existing
   `/admin` route idiom rather than inventing a new one.

2. `public/robots.txt`. Added `Disallow: /staff` next to the existing
   `/admin` line.

3. `src/components/site-layout.tsx`. One link labelled "Staff login" added to
   the footer legal row, beside Privacy, Terms and Cookies. It uses the same
   `hover:underline` styling as its neighbours, and opens in a new tab with
   `rel="noopener noreferrer nofollow"`.

## Two decisions worth recording

**Footer, not the main navigation.** A staff door should not compete with
client facing navigation on an agency site. The footer legal row is where a
visitor ignores it and a member of staff can still find it.

**Title case, not upper case.** The instruction asked for the label
"STAFF LOGIN", and also asked it to match its neighbours. Its neighbours,
Privacy, Terms and Cookies, are title case, so it was rendered as
"Staff login". Matching the row was treated as the stronger of the two
requirements. Easy to change if the upper case form is preferred.

## Verification

Typecheck clean. The full suite passed, 144 tests across 18 files, with no
change to any existing assertion.

## Outstanding

**The change is committed on HEAD in genesismm but is not live.** Publishing
was deliberately held back, because at the time of writing the client portal
public entry points are being hidden pending confirmation that the Supabase
auth sender actually delivers a six digit code. Publishing HEAD would have
shipped that work in a part finished state.

The staff link goes live on the next publish of genesismm. Nothing further is
needed for it.

## A separate finding

The Wix site "Genesis Models" still holds genesismodelmgmt.co.uk in its
settings and is still on a Premium plan with the custom domain attached, but it
no longer serves the domain. The live site resolves to 185.158.133.1, which is
Lovable, returns a React server rendered app, and carries no Wix headers and no
Wix generator tag. Worth checking whether that Wix Premium plan is still being
paid for.

Relatedly, the `genesis-web-operations` skill still describes the public site
as "the Wix public site genesismodelmgmt.co.uk with Jin as external developer".
That is now wrong and will send the web operations desk to the wrong platform.
