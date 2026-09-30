# LWD Africa: SEO and user-flow review

The owner's brief on 30 September 2026: review the website and improve its flow
and SEO. Three review agents worked in parallel (technical SEO, programmatic
content, user flow), and their changes were checked and merged into one diff,
`lwd-africa-4-seo-flow-review.diff` (33 files under `src/` and `public/`).
Owner decision taken during the review: every priced `/buy-now` listing is
reported to search engines as in stock.

**The site is live.** Published 30 September 2026 from Lovable commit
`2367ff6e`. Checked on lwdcarsafrica.com: `/`, `/buy-now`, `/shipping`,
`/robots.txt` and `/sitemap.xml` return 200; robots disallows `/admin` and
`/api/`; the site-wide googlebot tag is gone; a live listing carries
`schema.org/InStock` and the port and door-to-door line.

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

## Owner decisions (30 September 2026)

1. **Resolved: port and door to door are both offered.** Owner decision: the
   checkout price ships to the destination port; door-to-door delivery with
   clearance is quoted on request; import duty and taxes are the buyer's, as
   is standard for vehicle imports; pre-order wording is removed. Applied as
   `lwd-africa-4-delivery-terms.diff` (6 files, copy only): a line under every
   listing price, how-buying-works step 06, the landed-cost customs and
   inland notes, the home page process step, the hub fallback description
   and the order-now header comment.
2. **Resolved: the shipping cap stays.** "The final shipping cost will never
   exceed the estimate" matches how checkout works (freight is paid once, up
   front, with no top-up), is in the terms and is a selling point. The terms
   now scope it to shipping to the destination port and say door-to-door
   delivery is optional, quoted separately and agreed in writing.
3. **Resolved: kept.** "Ready to ship" beside the 4 to 8 week delivery period
   is correct: the car is ready, the time is the shipping.
4. **Resolved: kept.** "RHD available from UK stock" and "we inspect it" are
   true (owner, 30 September 2026).
5. **Resolved: identical duplicates removed.** Five cars were listed twice.
   - **Mercedes G 500, G 63, GLE 450 and S 500.** A generic line showed the
     same photographs as the owner's numbered unit (LWD-212, 213, 215, 217)
     but at the model guide price, not the owner's price. Live prices before
     removal: G 500 $166,800 against $196,500; G 63 $166,800 against
     $271,500; GLE 450 $78,900 against $122,300; S 500 $97,100 against
     $175,300. The generic lines are removed and their links 301 to the
     numbered unit, so only the owner's own prices remain on sale.
   - **Toyota Hilux SR5.** The UAE unit (`toyota-hilux-double-cab-sr5-manual-lhd-uae`)
     is unpublished by the owner in admin, so the generic 2026 SR5 is the one
     buyers see. The hidden UAE twin is removed and its link 301s to the
     published listing. This also fixes a live fault: the published Hilux
     page had pointed its canonical tag at the hidden page and was left out
     of the sitemap (`lwd-africa-4-hilux-fix.diff`).
   - Kept on purpose: the two Cybertruck Cyberbeasts (LWD-096 and LWD-098,
     different mileage) and the two Isuzu D-Max LS (LWD-027 red in Jebel Ali,
     LWD-074 grey in Dubai), which are separate vehicles, and listings that
     share photos but are a different grade. A new test fails if the same
     name is ever listed twice without separate stock numbers.
6. Low-demand `/buy` model-and-country combinations could be set to `noindex`.
7. **Resolved: already verified.** Search Console verified lwdcarsafrica.com on
   10 September 2026 by the `google-site-verification` meta tag in
   `__root.tsx`, which this review kept. Both sitemaps are declared in
   robots.txt.
8. **For the owner: generic lines use the model average price.** The G 63
   case shows the risk: a generic line for a high trim inherits the price of
   the whole model. Worth a look in admin: Nissan Patrol LE, Toyota Fortuner
   VX and Hilux GR-S reuse the photographs of a different trim (PRO-4X,
   VXR 4.0 V6 and Hilux Adventure 4.0 V6), so their price and photos should
   be checked against each other.
