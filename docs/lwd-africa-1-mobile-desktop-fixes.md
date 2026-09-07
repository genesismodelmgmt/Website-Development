# LWD Africa: mobile and desktop journey fixes

Sent to the `west-africa-auto-connect` Lovable project (id
`649a6cb1-98fc-49e4-9cc3-77a39d8680f0`, published to lwdcarsafrica.com) after the
owner reported the mobile menu printing over the page on an iPhone.

The site is a Lovable project, not a checkout: there is no GitHub repo for it, so
this file plus the accompanying diff is the durable record of what changed and
why.

## How the work was done

Reading the source was not enough to judge a layout, so the project was mirrored
to disk from the Lovable API, run locally, and driven with Chromium at ten widths
from 320px to 1920px, in both first visit and returning visitor states. Every
finding below is a measurement, not an impression. Car photographs could not be
mirrored (binaries do not come through the API) so they were greyed placeholders
locally; the site's real Google Fonts were served from a local cache so that text
metrics, wrapping and overflow matched production.

## What was wrong

Three defects were serious enough to be costing enquiries.

**The mobile menu did not work at all.** The drawer is `position: fixed` nested
inside the sticky `<header>`, and that header carried `backdrop-blur`. A
backdrop-filter makes the element the containing block for fixed descendants, so
`top-16 bottom-0` resolved against the 64px header rather than the viewport: the
drawer measured 0px tall, its 95 per cent opaque scrim covered nothing, and the
menu links printed down the page over the content behind. This is what the owner
photographed. Reproduced in Chromium, so it was never Safari specific.

**The WhatsApp button, the site's primary call to action, was never on screen.**
The page load animation on `<body>` ended on `filter: blur(0)`, and with
`animation-fill-mode: both` that filter is retained permanently. A computed
`blur(0px)` still counts as a filter, so `<body>` stayed the containing block for
every fixed element on the site. The floating WhatsApp button measured
`top: 15111px` inside a 15191px document: visible only to someone who scrolled to
the very bottom. The cookie banner was pinned there too.

**Every first time visitor was thrown to the footer.** The cookie banner focuses
its Accept button 40ms after mount. Because the banner was pinned to the bottom of
the document by the bug above, and `html` carries `scroll-behavior: smooth`, that
focus call smooth scrolled the whole document to the bottom. Measured on the home
page at 390px: `scrollY` 0, 819, 7893, 14439. The visitor never saw the hero.

Six more, all measured: the vehicle directory scrolled sideways at every phone
width (`scrollWidth` 420px against a 390px viewport, from a six button filter row
that neither wrapped nor shrank); its sticky filter bar took 206px, a third of a
phone screen, before a single car was visible; filter pills, the brand selector,
the search box, the burger and the country rows were all between 16px and 40px
tall against a 44px touch target; nav anchors landed 13px to 29px behind the
sticky header; the cookie banner covered the bottom 240px of the enquiry dialog on
a first visit, including the destination selector and both call to action buttons;
and both dialogs dropped keyboard focus to `<body>` on close.

## What changed

Eight files, listed in `lwd-africa-1-mobile-desktop-fixes.diff`. The changes are
mechanical and deliberately conservative: no colours, type, spacing, copy or
structure were altered, and no dependency was added. The scroll driven reveal
animation was tested at more than fifty scroll offsets across seven viewport sizes
and left alone, because it works.

The two structural fixes are worth stating plainly, because both are traps that
will catch the next person:

1. The header's tint and blur now live on an inner layer rather than on
   `<header>` itself, and the drawer is positioned against the header with
   `top-full` and a `dvh` height rather than fixed to the viewport. Nothing about
   the header's appearance changed.
2. The page load keyframe is opacity only. A comment in `styles.css` records that
   the reveal keyframe still leaves a retained `blur(0px)` on every `section` and
   `article`, so no fixed positioned element may be placed inside one.

## Verification

Twenty six acceptance checks, run against the running site, all passing:

- No horizontal overflow on six routes at each of 320, 360, 375, 390, 430, 768,
  1024, 1280, 1440 and 1920.
- First visit stays at the top of the page at 390 and 1440.
- The drawer covers the viewport below the header at 320, 375, 390, 430 and 768,
  and the point at its centre belongs to the drawer rather than the page behind.
- All four home page anchors land clear of the sticky header at 390 and 1440.
- Every section reaches full opacity at four viewport sizes including a short
  1280x700 and a tall 1440x1100.
- Reduced motion leaves nothing faded, with smooth scrolling off.
- Filter and navigation controls all at least 44px tall on a phone.
- No console errors or failed local requests across eight routes.

Typecheck clean. Agent B additionally asserted no horizontal overflow across 220
page and width combinations including filtered, empty and dialog open states.

## Applied to Lovable

Commit `3fe6f9af` on the Lovable project, "Applied LWD responsive fixes", against
baseline `dc5a71e9`. The agent applied all eight files as sent. Two changes came
with it that were not requested, both from Lovable's own toolchain: the
`@lovable.dev/vite-tanstack-config` devDependency moved from 2.7.7 to 2.13.1, and
the generated `routeTree.gen.ts` gained a `declare module` block. Neither is a
content change; the dependency bump is worth knowing about before the next build.

**Nothing was published.** The owner's instruction is that lwdcarsafrica.com is
never updated without explicit approval, so the fixes sit on the Lovable preview
only and the live domain still serves the July build.

## Known and not fixed

- The vehicle filters are lost on back navigation from a car page. The honest fix
  is to hold them in the URL, which changes the route's type contract and every
  `Link to="/cars"` in the site, so it was left for a deliberate change.
- The empty state on the directory is a bare sentence with no panel and no clear
  filters affordance. It reads as an accident rather than a designed state.
- The floating WhatsApp button still clips the tail of the "Image credits" footer
  link between 360px and 372px. The link's centre stays tappable at every width.
  Fixing it changes the footer spacing at widths where nothing is wrong.
- The vehicle detail page's own call to action sits about 1.4 screens down.
- Everything was verified in Chromium. No real iOS Safari or Firefox testing was
  possible from this environment, and the iOS scroll lock technique in particular
  is less reliable on real iOS than the `position: fixed` approach.

## Reproducing

`verify.mjs` and `shot.mjs` in `tools/lwd-africa/` are the harness. They expect a
local mirror of the Lovable project running on port 5199. `shot.mjs` takes a path,
a width, a height and an output file; `verify.mjs` runs the whole acceptance list
and exits non zero on failure.
