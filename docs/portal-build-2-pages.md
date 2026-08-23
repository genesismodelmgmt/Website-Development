Now build the client portal pages themselves, on top of the sign in and matching foundation from the previous message. Work in the preview, do not publish or deploy.

House rules: UK English, no em dashes or en dashes anywhere including code comments, editorial and understated tone like a fashion publication, no exclamation marks, no emoji, no placeholder or lorem text. Where a client genuinely has nothing yet, build a real empty state that reads well, do not invent filler.

Every page below reads through a TanStack Start server route that begins with `requireClientScope(request)`. The client id comes from the session, never from the request. Reuse the existing site header, footer, typography and shadcn components so the portal feels like part of genesismodelmgmt.co.uk and not a bolted on dashboard.

## Vocabulary

Call them enquiries, not bookings. That is what `leads` actually holds, and overstating it would be a lie to the client.

## /portal, the overview

A quiet summary of the relationship:
- the company name, and since when they have been working with Genesis (earliest lead or brief date)
- counts: enquiries, messages on file, packages shared
- the most recent enquiries, with their status and the models that were put forward
- the latest few messages

## /portal/enquiries

Every enquiry from `leads` scoped to the client, newest first, plus any `casting_briefs` for the same addresses. Show reference, project name, status, shoot dates, location, budget, usage and territory where present. Filter by status, and a search box over project name and reference.

## /portal/enquiries/$id

One enquiry in full. Resolve `selected_slugs` through `src/lib/models.ts` and show the models that were put forward as a proper card row with their headshots, linking to `/talent/$slug`. Honour the display rules: surnames as a single initial, sports talent stays anonymised. Below that, the correspondence attached to this enquiry, and any packages that reference it.

A model slug that no longer resolves must be skipped quietly, not rendered as a broken card.

## /portal/correspondence

One timeline for the whole relationship, newest first, merging:
- `email_send_log` rows for the client's addresses (subject or template name, sent date, delivery status)
- `lead_events` for their leads
- `portal_messages` they have sent from the portal

Filter by kind. Include a composer that writes to `portal_messages` and confirms with a `sonner` toast. Be honest in the wording: it reaches the bookings desk, it is not a live chat.

## /portal/packages

The packages shared with them, from `packages`, with title, date, status and the models inside. Link through to the existing `/package/$token` view rather than rebuilding it.

## /portal/account

Their name and email, the company we have them under, the addresses linked to that company, and colleagues with portal access. If their link is still pending review, explain that plainly here rather than showing an error.

## /portal/requests, agency only

Gated on `portal_accounts.is_agency`. The queue of `portal_link_requests`: who is asking, which company, how many enquiries and messages approving would open up, and the reason we matched them. Approve and reject buttons. Approving sets the account to linked and records the address against the company. Rejecting clears the company from the account and leaves the login intact.

Non agency users must never see this route or its data.

## Wiring it into the site, this part matters

People must be able to find the sign in from the website itself, not by knowing the URL.

- Add a "Client portal" link in the site header, and one in the footer. Signed out it points at `/portal/sign-in`, signed in it points at `/portal` and reads "Your account". Keep it understated in the house style, it is not a call to action competing with the enquiry flow.
- On `/portal/sign-in`, the Continue button after the reveal currently points at `/`, because the portal did not exist when it was written. Point it at `/portal`.
- `/portal` itself, when signed out, redirects to `/portal/sign-in` rather than showing an error. When signed in it shows the overview.
- Anyone already signed in who opens `/portal/sign-in` goes straight to `/portal`.
- The existing `/clients` page is the public facing page for clients. Add a quiet line there linking to the portal for clients who already work with Genesis.

## Carry the foundation fix through

The claim step can now come back linked with history but no company name on file, flagged for confirmation. Handle that in the portal too: show the account without a company name rather than a placeholder, and offer the same quiet prompt to confirm the company on the account page.

Add `/portal` and everything under it to `robots.txt` as disallowed, and keep it out of `sitemap.xml`.

## States that must be right

- Pending review: the portal renders, but every data page explains that a member of the Genesis team is confirming access, rather than showing an error or an empty list.
- A genuinely new client with no history: a warm empty state explaining that their enquiries and correspondence will collect here from now on.
- Loading and failure states on every page, in keeping with the rest of the site.

## Before you finish

Verify these by actually exercising them, not by reading the code, and report what you found:

1. Sign in with an address that exists in `leads`, and confirm the enquiries, messages and packages that appear all belong to that client.
2. Take an enquiry id belonging to a different client and request it directly as the first client. It must 404.
3. Confirm no portal page queries `leads`, `packages`, `email_send_log` or `lead_events` from the browser, and that the service role key never reaches the client bundle.
4. Confirm step 1 of sign in gives the same response for a known address and an unknown one.
5. Run the typecheck and the linter.
