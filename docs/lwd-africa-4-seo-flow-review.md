# LWD Africa: SEO and user-flow review

The owner's brief on 30 September 2026: review the website and improve its flow
and SEO. Three review agents worked in parallel (technical SEO, programmatic
content, user flow), and their changes were checked and merged into one diff,
`lwd-africa-4-seo-flow-review.diff` (33 files under `src/` and `public/`).
Owner decision taken during the review: every priced `/buy-now` listing is
reported to search engines as in stock.

## Technical SEO

- New `src/lib/seo/site.ts` holds the site URL, the organisation `@id`, and
  helpers for absolute URLs and `noindex,follow` meta, so every page's JSON-LD
  points at one organisation node instead of redefining it.
- `__root.tsx` no longer sends a site-wide `googlebot: index` tag (it
  contradicted the per-page `noindex` on transactional pages) or a keywords
  tag. Fallback title and description fit Google's display limits and there is
  a default share image.
- `sitemap.xml` and `image-sitemap.xml` build each section independently, so
  one failing data source no longer empties the whole sitemap. Entries are XML
  escaped and duplicate listings are left out (only the canonical unit is
  listed).
- `robots.txt` keeps crawlers out of `/admin` and `/api/`, apart from the
  public freight, FX and geo endpoints.
- Stock reference pages are `noindex,follow` rather than `noindex`, so links on
  them are still followed.

## Programmatic pages

Car, buy-now, buy model-by-country, make, brand, body type and ship-to pages:

- Every title is 60 characters or fewer and every description 158 or fewer.
- Same-model `/buy` pages are less alike: average text similarity fell from
  0.768 to 0.574, which reduces the risk of them being treated as doorway pages.
- `/buy-now` listings now link to their make pages (0 links before, 308 after).
- Priced listings emit `schema.org/InStock` offers (308, previously PreOrder).
- Duplicate listings point their canonical tag at the numbered unit.
- Unknown slugs return a proper not-found page marked `noindex`.

## User flow

- Home: a "three ways we help" block (cars in stock, sourcing, shipping and
  freight), six stock cards on phones, freight quote straight to WhatsApp, one
  FAQ source for both the page and its schema, and a stable hero line break.
- Navigation: Cars in stock, Car sourcing, Ship your car, Freight, Contact; the
  footer now links the market price guides.
- Shipping hub and service pages: the freight quote dead end is fixed. The
  quote button opens WhatsApp with the service and region already named.
- How to buy: the steps now match what checkout actually does; FAQ and
  breadcrumb added.
- Market price guides: the call to action sits in the first screen on phones.
- `styles.css` defines `container-page`, which several pages used but nothing
  defined, and the font fallback includes Liberation Sans and Arimo so text does
  not jump while Inter loads.

No payment, pricing, checkout, admin or server logic was changed. The checkout
page change is its meta description only.

## Checks

- Type check clean.
- Vitest: 664 pass, 5 fail. The 5 failures (`dialogs.test` focus return and 4
  in `not-found-metadata.test`) fail identically on the untouched baseline.
- `tools/lwd-africa/verify.mjs`: 26 of 26. `verify-shipping.mjs`: 45 of 45,
  including the new check that the WhatsApp freight route is in the first
  screen at 320px with a 44px touch target.

## Open decisions for the owner

1. **"Door to door" versus "to the port".** Several pages promise delivery to
   the buyer's address, but checkout prices shipping to the destination port
   and excludes duty, VAT and clearance. One of the two must change; the site
   should not promise more than checkout sells.
2. The claim that the final shipping cost will never exceed the estimate.
3. Supplier copy "supplied new in stock and ready to ship" next to "Delivery 4
   to 8 weeks".
4. `/ship-to` pages say "RHD available from UK stock" and "we inspect it".
5. Duplicate listings should be removed from the catalogue rather than only
   canonicalised.
6. Low-demand `/buy` model-and-country combinations could be set to `noindex`.
7. Google Search Console verification token is still to be added.
