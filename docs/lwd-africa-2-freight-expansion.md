# LWD Africa: export freight and logistics alongside the car business

Sent to the `west-africa-auto-connect` Lovable project (id
`649a6cb1-98fc-49e4-9cc3-77a39d8680f0`, published to lwdcarsafrica.com) after the
owner decided on 7 September 2026 to widen the business.

Owner decisions on the day, recorded because they shape everything below:

- Services expand to **full export logistics for all cargo, on any route**, plus
  shipping a vehicle the customer already owns from A to B worldwide. The car
  sourcing business is unchanged and keeps its prominence.
- **Nothing is published to lwdcarsafrica.com without explicit approval, ever.**
  All of this sits on the Lovable preview.
- Real photography is to be sourced for the new services.

## What was built

Eleven services, defined once in `src/lib/services.ts` and rendered everywhere
from that one source: vehicle shipping A to B, container freight (FCL and LCL),
RO-RO, breakbulk and project cargo, air freight, plant and machinery, personal
effects and removals, customs clearance and documentation, inland haulage and
delivery, cargo insurance, and warehousing and consolidation.

On top of that: a `/shipping` hub, a page per service, and a freight quote flow.
The site has no backend and no web forms by design, so the quote flow collects
five short answers and composes a WhatsApp message the visitor reads before it
sends, exactly as the existing vehicle enquiry does.

Joined to the existing site with a Shipping nav item, a footer link, a freight
section on the home page, a wider header tagline, one sentence and one button in
the hero, and a cross-link from the vehicle directory.

## The content rule, and why it is written into the code

The catalogue file opens with a discipline note: state capability, never invent
specifics. No prices, transit times, guarantees, named carriers, ports, agents,
partners, certifications, licences, fleet, facilities, staff numbers or years in
business. Nothing on these pages claims anything the owner has not confirmed.

Where a page wanted a specific claim, the claim was left out rather than guessed.
Deliberately absent: any response-time promise (the car side says "within 24
hours"; that was not carried over to freight), any sailing frequency, any
minimum charge, any named port or warehouse, and any insurer.

**Air freight was held back, then added.** It was not in the scope the owner
originally chose, so it was not built: a service the owner has not confirmed does
not belong on a commercial site. The owner confirmed it on the same day and it
went in as the eleventh service, to the same discipline as the rest. It carries
no transit times, no named airlines or airports, and no claim to handle dangerous
goods; whether any of the cargo is restricted is asked as a question rather than
answered as a capability, because that is a certification question that has not
been confirmed.

The catalogue heading now counts itself, spelled out in words to match the site's
other headings, so a twelfth service cannot leave the page saying eleven.

## Three findings that changed the work

**The home page argued against the new business.** It read "Not a shipping line.
A private buying office." over "Most exporters only move a car you already own.
We do the harder part", a few sections above the new freight section selling
exactly that, and one click from the vehicle shipping page. It now reads "More
than a shipping line." over "Plenty of exporters will move a car you already own,
and so will we. Sourcing is the harder part". The argument survives, the denial
does not. This was the single strongest signal on the site against the new
positioning and it would have been easy to miss.

**The ten service pages started as near duplicates of each other.** Measured with
three word shingles, page chrome stripped: 169 shingles identical across all ten,
only 24 to 32 per cent of each page unique, pairwise similarity 0.45 to 0.53.
That is the templated variant pattern search engines consolidate, which would
have wasted the section. Fixed by giving each page an FAQ generated from its own
"what we need to quote" list, and by showing four related services instead of the
other nine. After: 136 common shingles, 34 to 42 per cent unique, pairwise 0.22
to 0.35. No new copy was invented to achieve it. Against `/cars` and the country
pages the overlap was never a problem: 0.001 to 0.008.

**The header had no slack at all.** At 1024px, the narrowest desktop width, the
content box was exactly full before a sixth nav item existed. The item was paid
for by tightening the nav gap until xl and hiding the header phone number across
1024 to 1279 only, where the gold Quote button opens the same WhatsApp thread.
This is a genuine trade off and it is reversible: the alternative is dropping a
nav item. There is a comment in `site-nav.tsx` warning that a seventh item does
not fit.

## Search visibility

The existing metadata, schema and sitemap were heavily weighted to car export to
West Africa, which is what the site ranks for. The approach was to add rather
than dilute: the home page title and the hero headline were not touched, the
`AutomotiveBusiness` schema kept its type, and freight was added as a second
entity. A site wide `@id` was added to the Organization node so the two business
lines resolve to one company instead of two fragments. The sitemap now generates
the freight pages from the catalogue: 109 URLs before, 121 after, all returning
200.

## Verification

- Original acceptance harness: **26 of 26**.
- New freight harness (`verify-shipping.mjs`): **50 of 51**, re-run after air
  freight was added: 11 of 11 service pages render, 121 of 121 sitemap URLs
  resolve. Coverage includes every service page at ten widths from 320 to 1920,
  sitemap validity with every entry resolving, the quote dialog reachable and dismissible at 320x844 and
  390x600, unique titles and self referencing canonicals on all eleven pages, and
  the previous fixes re-tested on the new routes.
- Typecheck clean.

The single failure is pre existing and was not introduced here: footer and header
text links are 17px tall against a 44px target, identically on `/cars`. Raising
them properly means changing the footer's mobile rhythm, which is a design
decision rather than a bug fix, so it was left and is recorded here instead.

While the work was in progress the three button utilities were found to render at
40px everywhere against a 44px touch target. They now carry a 44px minimum below
768px. Desktop button sizes are unchanged.

## Applied to Lovable

Three commits on top of `3fe6f9af`:

- `97346f02` the freight build.
- `ccf28d81` the photography.
- `06e1f3d9` air freight as the eleventh service.

The photography was commissioned separately, because the environment this was
built in cannot reach any image host and a guessed URL would ship as a broken
image on a live commercial site. Every service now carries a real Wikimedia
Commons photograph under a Creative Commons licence, with alt text describing the
photograph rather than the service, a credit line generated onto `/image-credits`
from the same data, and a cropped share image per page. Nothing pictured is
presented as LWD Africa's own vessels, terminals or equipment.

**Nothing published.** lwdcarsafrica.com still serves the July build.

Note for whoever picks this up next: the local mirror used to build and test this
work is now behind the Lovable project, which carries the photography fields, the
generated share images and the credits page changes. Re-mirror before generating
another diff against it.

## Open items for the owner

- Decide whether the header phone number should stay hidden between 1024 and
  1279, or whether a nav item should be dropped instead.
- Review the photography once it lands, and the credits on `/image-credits`.
- Vehicle filters on `/cars` are still lost on back navigation. The fix is to
  hold them in the URL, which changes the route's type contract and every link to
  `/cars` on the site, so it wants a deliberate change of its own.
