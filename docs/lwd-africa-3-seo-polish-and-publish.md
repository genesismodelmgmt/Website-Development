# LWD Africa: SEO build-out, polish, and publication

The owner's brief on 8 September 2026: build out the SEO because the site is
performing, take the email off for now, show a single UK office at Television
Centre as Genesis does, do not show a Sierra Leone office, and make it clean
enough to publish. Publication was authorised in the same message.

**The site is live.** lwdcarsafrica.com serves Lovable commit `e00f041c`.

## What the owner asked for, and what was done

**The email is off, but not deleted.** `SHOW_EMAIL = false` in
`src/lib/contact.ts` gates every render of the address across the whole site, so
one flag brings it back without touching markup. Verified on the live domain:
the string `hello@lwdafrica.com` does not appear anywhere. One of the eight
places it lived was a hard coded `mailto:` on the image credits page that
bypassed every other guard.

The email was the stated contact route on the privacy and terms pages, for data
protection and legal requests. Deleting it there without a replacement would
have left those policies with no way to reach the company, which is a legal
weakness rather than a design one. All four legal pages now give the postal
address and the phone number instead, each with a purpose written lead: how to
make a data protection request, where legal notices are treated as served, and
the route for a rights holder.

**One UK office: Television Centre, 101 Wood Lane, London W12 7FA.** Defined
once as `OFFICE` in `contact.ts` and rendered from that single constant in the
contact panel, the footer, the mobile drawer, the freight hub and the legal
pages, so the four cannot drift apart. It is also now the postal address in the
structured data, where the site previously said only "London". There is no
Sierra Leone office and nothing implies a branch network: the positioning is one
office that works everywhere, which is both what the owner asked for and a
stronger claim than implying branches that do not exist.

The address was confirmed with the owner rather than guessed, because a wrong
address on a live site is worse than a partial one and inconsistent details
across listings actively hurt local search.

## Search visibility

**The country pages were near duplicates of one another.** Sixteen pages at
0.710 mean pairwise similarity, twelve of them under 10 per cent unique content:
the pattern search engines consolidate rather than rank. Rewritten to 0.423 mean
(0.347 excluding a shared component), with word counts roughly doubled, on
geography rather than invented business claims.

**Layout shift was failing Google's threshold and nobody had noticed.** The
webfont swap re-wrapped headings and dragged pages upward: country pages
measured CLS 0.366 against a 0.1 threshold, with an `h1` changing height by 65px
as it went from two lines to one. Proven by blocking the font, which took every
page to exactly zero. Fixed with metric matched fallback faces whose numbers
were measured against the real fonts rather than estimated, plus a preload.
Country pages went to 0 of 16 over threshold; home, `/cars`, `/shipping` and
`/privacy` to 0.005 or below.

**Results were being truncated mid phrase.** Every title on the site is now 60
characters or fewer and every description 158 or fewer, from worst cases of 85
and 349. On the home page the visible snippet had been spent entirely on a brand
list and never reached the proposition.

**The two halves of the business barely linked to each other.** Content links
from the car side into freight went from 1 to 97, with four freight pages
linking back, so a country page visitor who needs a container now has a path and
the site reads as one business rather than two islands.

**Structured data.** The FAQ marked up on 87 car pages was invisible to readers,
which Google requires it not to be; it is now rendered. A fabricated
`priceRange` was removed, since the Terms page states no binding prices are
shown. The logo became a raster PNG, which Google accepts and SVG is not. The
car business node was joined to the site wide organisation instead of floating
as an unrelated second company. A `sameAs` pointing at a click to chat link was
dropped, as `sameAs` is for authoritative profiles.

## Polish

Footer and header touch targets went from 13 of 13 under the 44px guideline to
none. The site gained a keyboard focus ring, in its own palette, where before
there was only the browser default. Heading widows at three widths fell from
7/5/3 to 2/2/1. The hero call to action at 320x568 was being cut by the fold and
now clears it. Directory filters live in the URL, so pressing Back from a
vehicle no longer discards a narrowed list. Primary actions moved up about half a
screen on the vehicle and service pages. The empty state on `/cars` became a
designed panel with a way out rather than one grey sentence. All three dialogs
now restore focus to the element that opened them, including on the first click
during hydration, which had never worked.

## Verification

Both harnesses green on the code that shipped: **26 of 26** and **51 of 51**.
Typecheck clean. No horizontal overflow at ten widths from 320 to 1920.

Checked on the live domain after publication: the email absent, Television
Centre present, the short home description serving, `/shipping` and
`/ship-to/nigeria` both 200 with their own headings and FAQ.

## Open items

- **Google Search Console is not verified.** The owner chose to publish first and
  verify after. Until it is done there is no ranking or impression data, and the
  sitemap has not been submitted. The stub is still in `__root.tsx`; wiring in a
  token is a one line change.
- `twitter:site` and `twitter:creator` are `@lwdafrica`. Nobody has confirmed
  that account exists. If it does not, remove it rather than point at nothing.
- The 16 country pages still share the site wide car share image. Per country
  images would help social click through, not ranking.
- There is no `/ship-to` index page. It would be a strong internal linking hub
  but needs a nav decision, and the header has no room at 1024px without
  dropping an item.
- The header phone number is still hidden between 1024 and 1279px, which is what
  paid for the sixth nav item.
- A human should read the 16 country `note` strings before they age: they are
  geography rather than business claims, but they were written by an agent and
  two over claims were caught and corrected during the work.
