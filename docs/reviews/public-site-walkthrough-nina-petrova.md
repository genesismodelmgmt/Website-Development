# genesismodelmgmt.co.uk — a casting director's walkthrough

*Nina Petrova, Casting Director (London / Paris). Review conducted 1 September 2026.*

## Who I am

Eighteen years casting. Editorial, campaign, runway. I work for magazines, two large high-street brands and one luxury house, which means my week is a permanent negotiation between a client who wants "fresh but proven" and a board that has eleven girls on option elsewhere.

On a heavy week I open forty agency websites. I am not browsing. I have a brief, a shoot date and a producer asking me for a package by six. I decide whether an agency is worth my time in about eight seconds, and that judgement is almost entirely: can I see faces, and can I trust the numbers under them.

What I need is unglamorous. A board that loads. Cards cropped the same way so I can scan a grid without my eye snagging. Stats — height, bust/waist/hips, shoe, hair, eyes — visible without hunting or emailing. Digitals, because a retouched book tells me what a photographer can do, not what a girl looks like at 7am in a fitting. Video where it exists. And a contact route that lands on a booker's desk, not in a void.

What loses me: slow galleries, models with no stats, no polaroids, a site that fails in the back of a cab, a form that goes nowhere. And lately, an AI toy bolted onto the front that stands between me and the board.

I am polite. I have no patience.

## What I was trying to do

I gave myself one real brief and worked it the way I would on a Tuesday morning: **a 5'11" girl, UK size 8, natural hair, available for a Tuesday, who has not shot for a competing high-street brand this season.** Then I tried to get her in front of a booker.

## The three surfaces I looked at

**The live public site.** I could not reach it. `WebFetch` on `https://www.genesismodelmgmt.co.uk/` and `https://genesismodelmgmt.co.uk/` both returned `EGRESS_BLOCKED` from the network proxy; `curl` returned `CONNECT tunnel failed, response 403`. The published Lovable preview at `genesismm.lovable.app` was blocked identically. **I never rendered a live page.** Everything I say about live behaviour is inference from source code I read directly and from the public search index, and I have flagged it as such. What the search index does tell me is that `/women`, `/men`, `/story` and `/contact` are indexed with real, distinct titles ("Women's Board, Genesis Model Management"; "Men Models London, Genesis Model Management"; "About Genesis Model Management, London"), and that the women's board result reads **"134 models currently on the board"** — which is the exact output of the string `{models.length} models currently on the board.` in `src/routes/women.tsx`. So the live domain is being served by the Lovable rebuild, not by Wix.

**The Wix sites.** `GetSiteContext` on `eb5c078e-0f76-4451-b286-4231a0a774a0` ("Genesis Models") returns: Published, Premium plan, Custom Domain, URL `https://www.genesismodelmgmt.co.uk/`, Velo enabled, created Sept 2020, last updated 16 June 2026. Apps: Instagram Feed, Promote SEO, Wix Forms & Payments, Wix Invoices, Members Area. The second site, `c43a9e5f-9b1e-4171-9239-6052c7d1cdcc` ("GENESIS MODEL MANAGE"), is **Draft, Free plan, never published**, created March 2023, last touched 11 June 2026, carrying nine apps including Bookings, Events, Groups and Portfolio. Read as: one legacy production site that still *claims* the custom domain but is no longer what answers it, and one abandoned 2023 experiment.

**The Lovable rebuild.** Project `24db8413-d76d-4629-a829-bae09fdee220`, internal name `genesismm`, display name **"Genesis Matchmaker AI"**, TanStack Start + TypeScript, last edited 27 August 2026. This is the real site. And I want to say this plainly before I start criticising: it is not a vanity rebuild. It is a properly engineered casting tool that happens to have a website wrapped round it.

## The walkthrough

### 1. Eight seconds

I lose the first several of them to a black screen.

`src/components/site-layout.tsx` mounts nothing unusual, but `src/routes/index.tsx` line 588 renders `<GenesisIntro />`, and `src/components/genesis-intro.tsx` is a full-screen `fixed inset-0 z-[100]` black overlay that sets `document.body.style.overflow = "hidden"` and `document.documentElement.style.overflow = "hidden"`. It is a three.js WebGL scene: up to **85,000 particles** (`capped = targets.slice(0, 85000)`) assembling the wordmark over a `ASSEMBLE_MS = 2600` window, on top of a seven-octave fractal-noise cloud shader. Nothing of the agency is visible until I press **Explore**.

I want to be fair, because the engineering is careful: there is a hard 1.8-second ceiling that forces the Explore button interactive regardless of assembly progress; `detectLowPower()` bails to a static logo on weak hardware or `prefers-reduced-motion`; it plays once per session via `sessionStorage` key `gmm-intro-played-v1`; and the button is autofocused for keyboard users.

It is still a door in front of a shop window. On my first visit of the day I get black, then a wordmark, then a button — and *then* the site. That is my eight seconds spent on the agency's logo rather than on its faces.

Past the door, `<h1>` reads **"Tell us what you need."** with the sub-line "Describe your brief in your own words." — a search box with a rotating typewriter placeholder cycling through `EXAMPLES` ("Tall brunette woman for an editorial cover shoot in March", "Athletic male model for a sportswear campaign, 185cm+"), a microphone button for voice briefs, and a Search button. Faces do exist below it — a `featured` grid at four columns with staggered offsets, each card linking to `/talent/$slug` — but above the fold I get an instruction, not a board.

**My reaction:** the copy is confident and the input is genuinely inviting. But the agency has put a text box where every one of its competitors puts girls. That is a bet, and it only pays if the box is faster than scrolling. (It sometimes is. See below.)

### 2. Find the board

Two taps on a phone. `navItems` in `site-layout.tsx` puts Women, Men and Sports inside a "Divisions" group; the mobile nav renders group children as an already-expanded nested list, so it is hamburger → Women. There is also a footer "Boards" column. Fine.

Segmentation is **Women / Men / Sports**. There is no New Faces and no Development board, which is a real omission for an agency that runs a scouting funnel — `/join-us` exists, but new faces are folded into the main boards rather than given the separate shelf casting directors expect.

More concerning: `src/lib/models.ts` types `board` as `"men" | "women" | "sports" | "nonbinary"`, and `src/lib/roster-feed.server.ts` accepts `nonbinary` in its `BOARDS` set — but `src/components/roster-context.tsx` only ever computes `women`, `men` and `sports`, and `public/llms.txt` lists no fourth board page. A record published from First Option as `nonbinary` would be fetched, pass `isPublic`, be fed to the AI matcher — and appear on **no board page at all**.

### 3. Scan the board

This is the best part of the site. `src/routes/women.tsx` gives me: a 2/3/4-column grid, name and **height printed on every card**, an A–Z jump, first-name search, sort by height, waist, shoe or name, and **range sliders for height, bust, waist and hips** whose domains are computed from the actual roster. Selected models tick into a persistent selection bar; "Share this board" mints a private tear-sheet package link at `/package/{token}` and simultaneously logs a lead so a booker knows it happened.

That is a board built by someone who has watched a casting director work.

The image handling is where it slips. Every card is `<img src={m.thumb} alt={...} loading="lazy">`. Lazy-loading: good. Descriptive alt (`"${label}, Genesis women's board model, London"`): good. But there is **no `srcSet` anywhere in the codebase** — I grepped `src/routes/index.tsx` and found zero occurrences, and the board and profile templates confirm it. Whatever resolution First Option publishes as `thumb` is what my phone downloads, 134 times over as I scroll.

The profile page makes this vivid: portfolio images carry `sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"` — a correct, thoughtful `sizes` string — attached to an `<img>` with **no `srcset`**. A `sizes` attribute without `srcset` does nothing. Someone did half of responsive images and the browser ignores all of it.

### 4. Open a model

`src/routes/talent.$slug.tsx` is, honestly, the best model profile I have reviewed this year.

- **Stats block**, canonical per board: women get `height, bust, waist, hips, shoe, dress, hair, eyes`; men get `height, chest, waist, shoe, hair, eyes`. Missing values are filtered by a presentation guard rather than rendered as empty shells, and an incomplete profile says "Full measurements coming soon. Contact the board for details." instead of lying.
- **Book**, paged twelve at a time through `ProgressiveGrid` with a real keyboard-reachable "Load more" button.
- **Digitals**, in their own section, alt-texted "unretouched digital". Thank you.
- **Walk / Video**, behind a `DeferredVideo` click-to-load placeholder because "walk videos run to tens of megabytes".
- **Enquire**, inline on the page, pre-scoped to that model.
- Prev/next through the board, an "Aesthetically similar" row driven by stored image embeddings, `ProfilePage`/`Person` JSON-LD, canonical URL, and a per-model title and description.

Units are right — centimetres with the dual notation completed by `formatHeightDisplay`, shoe sizes spaced across EU/US/UK. This is a casting-grade profile.

### 5. The specific brief

Here is where I hit the wall, and it is worth being precise about *which* wall.

**5'11":** the site can do this — but only if I type it in centimetres. `src/lib/hard-constraints.ts` is excellent work: it partitions the roster arithmetically *before* the language model sees it, so a stated height is a requirement rather than a suggestion. The comment is candid about why ("previously the assistant surfaced 7 of 16 in-range women and none of them by height"). But read the regexes: the floor, ceiling and exact-height patterns all require `(\d{3})` followed by `cm|centimetres?`. Feet and inches are only parsed for *ranges* (`5'9" to 5'11"`). So **"5'11" and above" or "5'10 plus" produces no gate at all** and falls back to the model's own conversion table. The site's own example prompt uses "185cm+" — which does gate. Half of London casting speaks in feet.

**Size 8:** cannot be done. `stats.dress` is captured by the feed, and it *is* displayed on women's profiles — but `buildRoster()` in `src/lib/search.functions.ts` passes `chest, bust, waist, hips, shoe` to the matcher and **omits `dress` entirely**. The board's range sliders are `height, bust, waist, hips` in centimetres. There is no dress-size filter and no dress-size signal in the AI. I can approximate via waist, which is not the same thing and every booker knows it.

**Natural hair:** yes. Hair is a first-class attribute with its own arithmetic gate (`parseHairRequirement` in `brief-gates.ts`), and the system prompt is explicit that `stats.hair`/`stats.eyes` are the only source of truth for colour.

**Available Tuesday:** no, by deliberate design. The prompt states `AVAILABILITY: you have no diary or booking data. Never say or imply a model is available, free, bookable or has no clashes.` and `guardReason(..., { dateVerified: false })` strips availability claims from the output before I ever see them. I respect the honesty enormously. It also means every single brief ends in an email.

**Not shot for a competing high-street brand this season:** no. There is no client-history, usage or conflict field anywhere in the `Model` type. Nothing to query.

So: two of five answerable on the site, one answerable only in metric, two force an email.

### 6. The AI feature

I typed the brief the way I would say it out loud. Full judgement is in its own section below, because it deserves it.

### 7. Make contact

I did **not** submit anything. I read the pipeline instead: `src/lib/leads.functions.ts`.

A submission writes a row to `leads` and returns a client-visible reference in the form `GMM-XXXXXXXX`. It then calls `notifyAgency` with a structured detail table containing **Reference, Name, Email, Company, Phone, Project, End client, Enquiry stage, Shoot dates, Budget, Usage, Territory, Exclusivity, Location, Options deadline, Number of talent**, plus resolved talent names and links for any models I ticked, plus attachments. `divisionCcForRoute` CCs a named women's-board inbox for women's routes; men's routes have no dedicated inbox configured and stay on `contact@` — and the code says so honestly rather than inventing an address. If I consented and gave an email, `sendClientConfirmation` sends me back my own reference.

Abuse handling is properly done: honeypot field, a 1.2-second time trap, an SHA-256-hashed-IP rate limit of ten per hour, and idempotency on `submission_key` so a double-click or a refresh cannot create two leads or two notifications. Attachments are MIME-whitelisted, capped at 10 MB, and land in a private bucket behind a 30-day signed URL.

That is a better enquiry pipeline than most agencies have in their CRM, let alone on their website.

The gap is not plumbing, it is *requirement*. Per `.lovable/plan.md`, every one of those brief fields sits inside a collapsed **"Add project details (optional)"** disclosure and "Nothing required inside." Only name, email, message and a consent tick are mandatory. So the fields a booker needs exist, and a rushed caster will skip all of them, and the booker emails me back asking for dates and usage anyway. And nowhere does the site tell me when someone will reply.

### 8. The professional checks

**Mobile:** genuinely considered. Filters collapse behind a "Filters · N applied" toggle below `sm`; the concierge dock starts as a compact pill so it does not cover the last row of cards; there is a `md:hidden` compact header search on board pages.

**Weight and load:** the intro ships three.js on the homepage critical path. The roster feed is cached 60 seconds in-process with a last-known-good copy and **no static fallback in production** — a deliberate choice so a withdrawn model can never be re-exposed, at the cost of showing a `RosterUnavailable` state if First Option is down. Correct trade. Image weight is the unfixed problem (no `srcSet`).

**Image protection:** none beyond the `robots.txt` and `ai.txt` reservations. Thumbs are plain `src` URLs from the feed. Anonymised sports records *are* protected properly — blurred, `noindex, nofollow`, `Disallow: /talent/gsx-`, enquiry-gated.

**SEO:** strong. Per-page titles and descriptions, canonicals, OG and Twitter images, `CollectionPage` + `BreadcrumbList` + `ItemList` JSON-LD on boards, `ProfilePage` + `Person` on profiles, and a retired profile correctly returns its own `noindex, nofollow` page rather than a soft 404. Legacy slugs 301 via `TALENT_SLUG_REDIRECTS`. Confirmed live in the index for four page types.

One strategic note: `public/robots.txt` and `public/ai.txt` block GPTBot, ClaudeBot, PerplexityBot, Google-Extended and roughly twenty others, and assert an EU TDM Article 4 opt-out. Defensible for a business whose asset is photography. But casting directors increasingly ask an assistant "who represents tall editorial girls in London" — and Genesis has opted out of being the answer. That is a decision to make on purpose, not by default.

**Accessibility:** better than most. Skip-to-content link, `aria-label` on every icon button, `aria-pressed` on selection ticks, `aria-expanded` on disclosures, labelled form inputs with `aria-describedby` error wiring, focus-visible rings throughout, a focus-managed `role="status"` on submit success, descriptive alt on faces and `alt=""` + `aria-hidden` on decorative blurs.

**Broken or stale:** no lorem ipsum, no dead placeholder copy — `.lovable/plan.md` explicitly requires "All text is authored copy". One live label bug: in `concierge-dock.tsx`, `TourBlock`'s primary advance button renders `{isLast ? "Finish" : "Skip"}`. The button that moves you to the *next step* is labelled **"Skip"**, while the actual skip control is the separate "End chat". Users will exit a tour they meant to continue.

## What's genuinely good

- **The profile page.** Stats, book, digitals, deferred video, inline enquiry, prev/next, similar faces. Nothing to add.
- **The board controls.** Range sliders on real measurements, multi-select, and one-click generation of a shareable tear sheet that also logs itself as a lead.
- **The anti-hallucination architecture.** Detailed below. It is the difference between a demo and a tool.
- **The enquiry pipeline.** Structured, referenced, deduplicated, division-routed, rate-limited, with client confirmation.
- **The data-integrity posture.** First Option is the single publication authority; there is no static roster fallback in production; `integrity.visibility: "hidden"` quarantines records; `hasValidName` rejects junk records like a model named "17".
- **Honesty about what it doesn't know.** "Height is not on file for this model... Confirm before presenting." That sentence buys more trust than any amount of polish.

## Where it breaks down

| # | Severity | What happens | Evidence | What it costs the agency |
|---|---|---|---|---|
| 1 | High | Full-screen WebGL intro gates the homepage; no faces for the first seconds of a first visit | `src/components/genesis-intro.tsx` — `fixed inset-0 z-[100]`, body scroll locked, three.js, 85,000 particles, `ASSEMBLE_MS = 2600` | The eight seconds that decide whether I stay |
| 2 | High | Full-resolution images shipped to phones; `sizes` present with no `srcset` | No `srcSet` anywhere; `src/routes/talent.$slug.tsx` sets `sizes=` on plain `<img src>` | Slow board on 4G; the classic reason a caster closes a tab |
| 3 | High | Heights in feet and inches are not gated | `src/lib/hard-constraints.ts` — floor/ceiling/exact regexes all require `(\d{3})` + `cm` | "5'10 plus" silently returns ungated results to a client who thinks they filtered |
| 4 | Medium | Dress size cannot be searched or filtered | `buildRoster()` omits `stats.dress`; board sliders are height/bust/waist/hips only | Every size-specific brief becomes an email |
| 5 | Medium | No availability and no client-conflict data | System prompt: "you have no diary or booking data"; no usage/conflict field on `Model` | Every brief ends in an email regardless of how good the match was |
| 6 | Medium | `nonbinary` board records render on no page | `models.ts` type + `BOARDS` set include it; `roster-context.tsx` exposes only women/men/sports | A published model is invisible to clients |
| 7 | Low | Tour's "next" button is labelled "Skip" | `concierge-dock.tsx` — `{isLast ? "Finish" : "Skip"}` | Users exit a tour they meant to continue |
| 8 | Low | Two dormant Wix properties, one Premium and still claiming the domain | `GetSiteContext` on both site IDs | Ongoing spend, and a live-domain record that contradicts reality |

**On (1).** The intro is beautifully made and I would keep it — for the brand pages. Not in front of the board. Every mitigation in that file (the 1.8s ceiling, the low-power bail, the session key) is an admission that it is in the way.

**On (2).** This is the single highest-leverage fix on the site and it is not a redesign, it is an attribute. The `sizes` strings are already written and already correct. They are simply attached to images that have nothing to choose from.

**On (3).** The height gate is the most sophisticated thing on the site and it has a blind spot in the unit half of its users speak. `readFtIn()` already exists and already works — it is just only wired into the range branch.

**On (5).** I am not asking for a live diary on a public website; that would be commercially insane. I am asking to be told *when* the office will answer.

## The AI model-finder, judged as a casting tool

First, a naming problem the agency should fix internally: there are **two** things here and they are not the same. The **Genesis Matchmaker** (`src/lib/search.functions.ts`) is a real casting instrument. The **Genesis Concierge** (`src/components/concierge/concierge-dock.tsx`) is a scripted onboarding tour with a persona picker and a spotlight ring — no AI in it at all. It auto-opens 1.2 seconds after load for every new visitor. Calling both "the AI" muddies a genuinely strong story.

Now the Matchmaker. I came to this expecting a chatbot that would invent three girls and lose me a client. It does not, and the reason is structural.

**It cannot hallucinate a model.** The handler builds `const valid = new Set(liveModels.map((m) => m.slug))` from the live First Option feed and filters every returned match through it. A slug the language model invents is dropped before rendering. This is the whole ballgame and they got it right.

**It cannot invent a height.** `reconcileHeightClaims` rewrites any height stated in the prose against the recorded value and demotes the match from "strong" if it had to correct one. **It cannot invent hair or eye colour** — `reconcileAttributeClaims` does the same against the profile fields, with a comment explaining that `attrs.hair_color` was deliberately excluded because it disagreed with what the profile displays. **It cannot claim availability** — `guardReason` strips it. **It will not volunteer ethnicity as a casting merit** unless the brief asked; that is stripped too, and the system prompt says so in terms.

**It shows its working.** Matches come back tiered strong / medium / low, with stretch options separated visually, and a gate note spelling out the miss in centimetres: *"Outside the brief: 173cm against a 175cm and above requirement, under by 2cm."* When a height constraint is parsed, the response carries `constraint: { label, eligibleCount }` so I can see how many of the roster were even eligible.

**It hands off to the board rather than replacing it.** The same matcher is embedded on `/women` and `/men` via `BoardSearch`, where it re-orders and filters the actual grid instead of producing a separate answer. That is exactly the right relationship between an AI and a board. And every result card ticks straight into the selection bar that feeds the enquiry form, with "Add all N strong matches to selection" — so the AI's output becomes a package, not a dead end.

**Is it faster than scrolling?** For a look brief — "alt, edgy energy for a streetwear lookbook", "freckled redhead, soft beauty" — yes, meaningfully, because it searches `style_tags`, `suitable_for`, `vibe` and `distinctive_features` that no filter UI exposes. For a numeric brief it is roughly a wash with the sliders, and if I write my height in feet it is currently worse than the sliders because it is ungated. For a multi-role brief — "a bride and three bridesmaids" — the `roles` output with primary and "also worth considering" tiers is something no competitor board does at all, and it is the strongest argument for the whole feature.

**Would I trust it?** Provisionally, yes — which is not a sentence I expected to write. Not because the model is clever, but because the engineers assumed it would lie and built five deterministic layers to catch it. The reasons are hedged, the caveats are stated, and nothing reaches me that contradicts the profile page.

**Two things hold it back.** One is unit blindness on height (finding 3) — a confidence-destroying bug precisely because the gate is otherwise so trustworthy. The other is that the entire roster JSON is serialised into the system prompt on every single turn, twice over when a height constraint splits it into eligible and stretch sets. At 134 women plus men plus sports, with a dozen attributes each, that is a large prompt per keystroke-to-submit, and it will get slower as the board grows.

**What would make it genuinely useful to me:** dress size in the payload; the height gate speaking feet; a "conflicts" field even if it only says "ask"; and a stated response time on the handoff.

## What I'd change, concretely

| Problem | Change | Where | How you'd know it worked |
|---|---|---|---|
| Full-res images on phones | Add `srcSet` with 400/800/1200w variants alongside the existing `sizes` strings; request width-parameterised URLs from the First Option feed | `talent.$slug.tsx`, `women.tsx` (`BoardPage`), `index.tsx` featured grid | Board page transfer weight on a 375px viewport drops; LCP on `/women` improves on throttled 4G |
| Intro blocks the board | Keep the intro, but only on `/` for direct entry, and drop the body-scroll lock so the grid is reachable by scrolling past it | `genesis-intro.tsx`, `index.tsx` line 588 | Bounce rate on `/` from mobile referrers falls; scroll-depth events fire before Explore clicks |
| Feet-and-inches ungated | Wire the existing `readFtIn()` into the floor / ceiling / exact branches, not just ranges | `src/lib/hard-constraints.ts` | "5'10 plus" returns a populated `constraint.label` and an `eligibleCount` |
| Size 8 unanswerable | Add `dress` to the matcher payload and a dress-size filter to the women's board | `buildRoster()` in `search.functions.ts`; `sliders` array in `women.tsx` | A "size 8" brief returns a gated set instead of a waist approximation |
| Brief fields optional | Make shoot dates and usage required on talent-booking and casting routes only; leave general contact lean | `inline-enquiry-form.tsx`, `talent.$slug.tsx` | Share of `leads` rows with non-null `shoot_dates` and `usage` rises |
| No stated response time | Put "We reply to booking enquiries within one working day" on the enquiry form and in the confirmation email | `inline-enquiry-form.tsx`, `notify-agency.server.ts` | Fewer chase emails before first reply |
| Nonbinary records invisible | Either render a fourth board or map `nonbinary` onto an existing board for display | `roster-context.tsx` | Every `isPublic` record appears on exactly one board |
| Tour "next" says "Skip" | Change to `{isLast ? "Finish" : "Next"}` | `concierge-dock.tsx` `TourBlock` | Tour completion rate rises |

## The five things I'd do first

1. **Add `srcSet` to every model image.** (S) The `sizes` strings are already written and currently inert. This is the cheapest large win on the site.
2. **Teach the height gate feet and inches.** (S) `readFtIn()` already exists; wire it into three more branches. It closes the one hole in the site's most trustworthy component.
3. **Let the intro be scrolled past.** (S) Keep the animation, remove the `overflow: hidden` lock and the hard gate. Faces within eight seconds.
4. **Put dress size into the matcher and onto the board filters.** (M) It is already in the feed and already on the profile page; it is just not searchable.
5. **Require shoot dates and usage on booking enquiries, and publish a response time.** (M) The pipeline already captures fourteen structured fields — make the two that matter mandatory and tell me when someone will call.

## What I could not check

- **Anything about live rendering.** All three live URLs were blocked by the network proxy (`EGRESS_BLOCKED`; `curl` → 403). I have not seen a rendered page, measured a real load time, tested a real tap target, or run the AI search against the live matcher. Every performance and behaviour statement above is read from source or inferred from the search index, and marked as such.
- **Actual image file sizes.** `thumb` URLs come from the First Option feed at runtime; I could not fetch one to weigh it. The absence of `srcSet` is confirmed from code; the resulting payload is inferred.
- **Whether the AI hallucinates in practice.** I could not send a live query. I verified the *mechanisms* that prevent it by reading `search.functions.ts` and `hard-constraints.ts`. I did not read `height-claims.ts`, `attribute-claims.ts`, `reason-guards.ts`, `prose-repair.ts` or `brief-gates.ts` line by line — I confirmed they are imported and applied in the correct order.
- **The Wix sites' page structure.** I have plan, status, domain and installed apps from `GetSiteContext`. I deliberately made no write calls and did not enumerate pages.
- **Roster freshness.** Whether models on the live board are current depends on First Option, which I did not query. The architecture (60s cache, no production static fallback, `visibility: "hidden"` quarantine) is designed to make staleness impossible; I could not confirm it in practice.
- **Real contact behaviour.** I submitted nothing and triggered no email, per instruction.

## Verdict

**Status: Amber.**

Underneath a black screen and some unshipped image attributes, this is one of the two or three best-engineered agency sites I have looked at — the profile pages are casting-grade, the board filters are built by someone who has watched a caster work, and the AI matcher is the first one I have seen that was built by people who assumed it would lie and stopped it. The Amber is for the eight seconds: a WebGL door in front of the shop window, full-resolution images going to phones, and a height gate that does not speak feet — three fixes, none of them large, all of them standing between a very good tool and the person it was built for. Fix those and the honest answer to "would I use this to cast" changes from "provisionally" to "yes, and I'd tell people".
