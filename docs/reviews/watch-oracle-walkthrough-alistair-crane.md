# Watch Oracle — an authenticator's walkthrough

> **Filing note.** This review has nothing to do with the Website-Development repository. It lives here only because it is the available web-development workspace on this machine. The subject is the Lovable project `watch-oracle` (id `f2f184f8-0c1f-48da-ab33-1c87cb4165d2`, published as `watch-oracle.lovable.app`, display name "Watch Authenticator Elite", in-app brand "The Watch Authenticator"). Everything below was read through read-only Lovable MCP tools at commit `c3bf6783603b55099af81c034bf779f4ec0a9a34`. No code was changed, no message was sent to the builder, no credits were spent.

## Who I am

Alistair Crane. Twenty-two years in the trade, six of them on the bench before I moved to dealing. I trade Rolex, Patek, AP, Omega and a few independents — mostly pre-owned, mostly London trade with a handful of private clients. Authentication is how I earn: I am the call you make when a £40,000 Daytona feels wrong in the hand.

My order of work does not change. Provenance and paperwork first, because the story is where most fakes die. Then case geometry and lug proportions, because a superclone rarely gets the lug taper right. Then dial printing under 10x. Then the crown etch and the rehaut. Then bracelet stretch and clasp codes. Then, decisively, I open it. The movement is the only place the argument ends.

I am professionally allergic to any tool that returns a confidence percentage from a photograph, because a photograph cannot see a movement, and because a wrong "authentic" costs a young couple their house deposit. I am equally allergic to the opposite error — condemning an honest watch because a service department fitted a later dial in 1994. Both failures put me in a room with someone in tears.

So I came to this app with the question I ask of any tool a customer waves at me across the counter: what is it actually doing when it says the word "authentic", and would I put my name near it?

## What I was trying to do

Real scenario, the kind that walks in weekly. A 2019 Rolex Submariner Date, reference 126610LN, offered privately at about 18% below the going trade figure. Box, no papers. Seller says it was a gift, sold to fund a house move, will meet in a bank foyer, wants a same-day answer. Nine times out of ten that watch is genuine and the discount is impatience. The tenth time it is a Clean-factory superclone with a decorated 3235 homage inside, and the loss is total.

I want one thing from a screening tool before I book bench time: obviously wrong, obviously plausible, or genuinely undecidable. Not a verdict. Triage.

## What the app actually is, technically

Stripped of the presentation, this is what runs.

**One vision call, one model, one prompt.** `src/lib/analyze-watch.functions.ts` builds an evidence payload and calls `generateText({ model: gateway("google/gemini-3.5-flash"), … })`. The gateway is Lovable's own, defined in `src/lib/ai-gateway.server.ts` (`baseURL: "https://ai.gateway.lovable.dev/v1"`). That is the entire "forensic vision engine": a single call to a budget-tier general multimodal model. There is no second opinion, no ensemble, no detector, no embedding search.

**The prompt is better than I expected.** It is versioned `twa.photo-verification.v3` and opens:

> `You are a forensic vision analyst for The Watch Authenticator, performing PHOTO-ONLY SCREENING.`
> `You do NOT authenticate. You do NOT certify. You do NOT estimate market value, price, history or trivia.`

and closes with rules that most builders never write:

> `- If evidence is thin or fails the quality gate, use "insufficient_evidence".`
> `- Never say "confirmed authentic" or "confirmed replica". Never use a numeric score.`
> `- Prefer "specialist_review_required" over a positive conclusion when in doubt.`
> `- Do not invent identity confidence beyond what the pixels support.`

**There is no confidence percentage.** The output is three ordinal bands — identity confidence, visual authenticity risk, evidence completeness — each one of `insufficient_evidence | low | moderate | high`, plus a result drawn from a ten-value enum (`ResultSchema`, same file). Nothing is blended into a single number anywhere in the analysis path.

**There is a real deterministic guard.** `synthesiseResult()` sits between the model and the user and refuses to let a positive conclusion through on thin evidence: a "consistent with claimed reference" is downgraded to `specialist_review_required` unless identity confidence is `high`, risk is `low`, completeness is at least `moderate`, **and** there are at least two images with an 80% quality-gate pass rate. If the model says "consistent" while flagging high risk, that is forced to `concerns_identified`. This is the single best piece of engineering in the project and I want to say so plainly: someone thought about the failure mode where the model gets excited.

**There is genuine non-AI measurement.** `src/lib/image-intake.ts` parses EXIF with `exifr`, computes a Laplacian sharpness figure, mean luminance, a highlight-clipping fraction and megapixels, and raises flags — `no_exif`, `software_edited` (regex over Photoshop/Lightroom/Snapseed/Affinity/GIMP/Facetune/VSCO), `heic_transcoded`, `low_sharpness`, `under_exposed`, `highlight_clipped`, `low_resolution`. Those are measurements, not opinions. That part I trust.

**There is no reference data. None.** The tables exist — `reference_models`, `reference_rules` — and I queried them: **zero rows in each.** Nothing in `runPhotoAnalysis` ever queries them. The project's own file says it out loud (`docs/analysis-methodology.md`): *"Reference retrieval: none. Model output is not cross-checked against a catalog."* Every reference number, production year and calibre the app prints comes from the language model's memory, unvalidated.

**There is no valuation.** The prompt forbids it, no code computes it, and `docs/release-readiness.md` lists "Valuation comparables" as an unticked Phase 5 item. Good. I will come back to why the app nevertheless *tells the user* it is doing valuation.

**The storage and security work is serious.** All 33 public tables have row-level security enabled with policies. Evidence originals go to a private bucket at server-generated opaque paths, are SHA-256 hashed, MIME-validated against magic bytes (`cases.functions.ts`, `detectMimeFromMagic`), and are read back only through 60-second signed URLs. Version stamps are server constants and are never accepted from the client. The public certificate lookup goes through a `SECURITY DEFINER` RPC returning masked brand/model and a constant-shape not-found. `.env` contains only Supabase publishable keys — **no secret key or API key is exposed anywhere I looked.**

## The walkthrough

### 1. First impression

Credible. Genuinely. The rendered landing page is a restrained near-black grid with "Upload your watch. / Get a real read." and a subhead that says the pipeline "returns a structured screening across three separate confidence dimensions" (`src/routes/index.tsx`). The footer carries a standing line: *"Photo Verification is an AI-assisted screening, not a legal certification, and it does not prove ownership or clean title."* The landing page makes no accuracy claim, no percentage, no "in seconds". It splits itself into Service 01 (photo screening) and Service 02 (full-set, human) and says of the latter: *"Intake only. Pricing, turnaround and shipping terms are not live yet."*

I have reviewed a lot of these. This is the first landing page I have read that does not commit a professional offence in the first screen.

### 2. Submitting the watch

`/verify` offers six slots: front/dial, side & lugs, bracelet/clasp, caseback, serial area, box & papers. That is a properly chosen list — whoever picked it has held a watch. The clasp and the serial area are on it, which most apps forget.

Then it undoes itself. **Every slot is optional**, and the copy actively encourages the minimum: *"Even one photo is enough"* (`verify.index.tsx`) and, on the landing page, *"One clear photo is enough to start"*. One photo of a dial is enough to start a conversation and not enough to start a conclusion.

Worse, from where I sit: **nothing structured is ever asked.** There is one free-text box, capped at 500 characters, labelled "Anything we should know". No field for the claimed reference. No field for the serial. No asking price. No "does it have papers". No service history. No provenance. The `watches` table has `reference`, `serial_masked` and `approximate_year` columns sitting empty, and the full-set intake form at `/authenticate` collects brand/model/reference/year properly — so the schema and the other flow both know better. The photo flow just doesn't ask.

And here is the hole that follows from it. The headline positive verdict is `consistent_with_claimed_reference`. **Nothing is ever claimed.** When you save a case, `SaveButton` in `verify.index.tsx` posts `reference: result.reference` — the model's *own* guess — into the watch record. So the app identifies the watch, then reports that the watch is consistent with its own identification. That is not a check. That is a mirror.

For my Submariner, the single most informative thing I know is that the seller says 2019 and the price is 18% light. The app has no way to hear either fact.

### 3. The authentication itself

Path: `verify.index.tsx` → `ingest()` (EXIF + quality + downscale) → `analyzeWatch` server fn → `runPhotoAnalysis` → one Gemini Flash call → JSON extracted, Zod-validated, band-normalised → `synthesiseResult()` guard → rendered.

What it can genuinely see, at 1536px long edge, JPEG quality 0.85 (`renderScaled`): overall proportion, dial layout, obvious font and spacing errors, gross date-window misalignment, wrong bezel insert colour, crude finishing — the low-end fakes that make up most of what walks in off eBay.

What it is pretending to see: everything that matters at the top of the market. At 1536px you cannot resolve the laser-etched coronet at 6 o'clock, the rehaut engraving alignment, the platinum fill in Cerachrom numerals, or a clasp code. And the "forensic crops" do not help, because `pickCropRegions()` computes them from a **hardcoded assumption** — `ingest()` passes `{ cx: 0.5, cy: 0.5, r: 0.4 }`, an assumed centred watch. Nothing detects the watch. If it isn't dead centre and roughly 80% of frame, the crop labelled "bezel + crown" is a crop of your worktop.

### 4. The confidence score

Credit where due: **there isn't one.** No percentage is computed and none is invented in the analysis path. Bands, not numbers, and a hard guard on the positive band. This is the correct answer to the question the original brief asked ("almost 100% accurate") and someone had the spine to refuse it.

But the app still shows the user manufactured numbers. On `/verify/photo`, the progress bar runs `setProgress((x) => x + Math.max(0.4, (96 - x) * 0.035))` on a 200ms interval — an easing curve toward 96% with no relationship to anything. The tracker prints "Detection 62%". A user reading "94%" and a user reading a bar that climbs to 96% take away the same thing.

### 5. Reference data

Zero rows in `reference_models`. Zero in `reference_rules`. Nothing queries them. Everything the app tells you about your watch's reference number, production years, calibre, case size and material is a language model recalling from training.

That is dangerous in a specific, checkable way. `ResultSchema` types `reference` as `z.string()` and `clean()` merely trims it — there is no validation that the string names a reference that exists. A model that returns "126610LV" for a black-bezel Submariner, or dates a 16610 to 1987 (three years before the reference existed), passes straight through to the report and into the `watches` table, where it becomes the "claimed reference" the next verdict is measured against. Hallucinated provenance, laundered into a record.

### 6. Valuation

The app does not value watches. The prompt forbids it, no code does it, the roadmap defers it. Right call — you price off recent *sold* comparables, condition, completeness and market direction, none of which is available here. Except the app tells the user it is doing exactly that. See below.

### 7. The report

If you sign in and save, you get a real case: `cases` row with a case number, evidence originals hashed and stored privately, an `analysis_jobs` row holding the raw model output, a `confidence_assessments` row, `component_findings` rows, and a `reports` row — and this is important — stamped `status = 'system_generated_unreviewed'`, `service_level = 'photo_verification.ai_screening.v1'`. The code comment reads *"AI-only screening reports are NEVER 'issued'."* The `certificates` table is empty and no code path issues one from an AI screening.

The case page (`cases.$caseId.tsx`) leads with an amber band: *"Photo-only screening. Not a physical authentication or legal certification."* It shows the three bands, the result, the narrative, requested evidence, component findings, a case activity log, and a footer citing report version, service level and prompt version.

Would I accept it? As a triage note in my own file, yes. Would an insurer accept it? No — it names no serial, no valuation, no inspector, no methodology, no accreditation. Would an auction house? Not for a second. To be professionally usable it needs, at minimum: the serial and full reference as declared *and* as observed; the exact images relied on, reproduced in the report; a named human reviewer with a signature and a date; an explicit "not examined" list (movement, serial-to-reference match, papers verification); and a stable versioned identifier that a third party can verify without seeing the customer's data — which, to be fair, the certificate route already knows how to do.

### 8. Liability and honesty

The disclaimers on the main flows are good and unusually specific — the standing `disclaimer` string names the right risks: *"A low visual-authenticity risk band is NOT proof of authenticity, and authentication of manufacture does not prove ownership, clean title, absence of theft or finance, seller identity or transaction legitimacy."* That last clause is one most professionals forget.

But the live-camera route is a different app wearing the same coat, and that is where the exposure sits. It is covered in the table below.

### 9. Business sense

There is a real product here, and it is not the one on the tin. Nobody in the trade will pay for an AI verdict — it is worthless in a dispute and we all know it. What we *would* pay for: **triage** ("obviously wrong / plausible / cannot say" before I spend £150 and half a day on bench time); **a documented evidence record** (hashed originals, EXIF preserved, timestamped, retrievable — valuable for consignment, insurance schedules and shipping disputes, and the schema already does it); and **the seller-honesty screen**, which is the sharpest thing in this app and nobody markets it. "This seller's photos are screenshots re-exported through Lightroom, not photographs taken today" is a finding I would pay for and cannot easily produce myself.

## What's genuinely good

- **The prompt refuses to authenticate**, in writing, in the system message. Rare.
- **No blended confidence score anywhere in the analysis.** Three orthogonal ordinal bands.
- **`synthesiseResult()`** — a deterministic guard that blocks positive conclusions from thin evidence. Best thing in the codebase.
- **Real image measurement** (EXIF, Laplacian sharpness, clipping, editing-software detection) rather than asking the model to grade its own inputs.
- **Reports are never "issued"** — `system_generated_unreviewed` is a category with teeth, and no certificate is minted from AI output.
- **RLS on all 33 tables**, private evidence bucket, magic-byte validation, SHA-256 originals, 60-second signed URLs, server-owned version stamps, masked public certificate lookup. No secrets in `.env`.
- **Full-set intake refuses to take money** and tells the customer not to ship anything yet.
- **The slot list** (caseback, serial area, clasp) shows real domain knowledge.

## Where it breaks down

| # | Severity | What happens | Evidence | Why it matters |
|---|---|---|---|---|
| 1 | **Critical** | During analysis, the live-camera page streams fabricated forensic measurements with tick marks — "caseback engraving depth 0.18mm ✓", "end-link fit gap 0.4mm — nominal ✓", "serial font matched to proprietary set ✓", "triplock geometry confirmed ✓", "luminova emission within spec ✓" | `src/routes/verify.photo.tsx` lines 88–99 (`LIVE_COMMENTS`), rendered at line 866 via `<LiveTicker>` | These are the exact findings a real authenticator produces, with plausible metric values and pass marks, on the screen where a buyer decides. Nothing measures any of them. This is fabricated evidence. |
| 2 | **Critical** | The analysis milestone stream claims capabilities that do not exist: "Building 3D mesh from parallax", "Movement signature match / Reading finish & caliber fingerprints", "Cross-referencing archive / 12M references", "Market valuation / Dealer + auction comps · last 24 months" | `verify.photo.tsx` lines 121–130 (`ANALYSIS_STAGES`), advanced by a 1400ms `setInterval` at line 1596 | There is no mesh, no calibre matching, no archive (0 rows), and no valuation code at all. Time-driven theatre presented as pipeline stages. |
| 3 | **High** | The site ticker still advertises "40+ authenticity vectors" and "Calibrated 0–100 confidence" | `verify.photo.tsx` lines 158–167, rendered twice at lines 2010–2011 | The project's own binding rules name these two strings as claims to remove. Nothing is calibrated and nothing is 0–100. |
| 4 | **High** | Zero reference data; every reference number, year and calibre is model recall, unvalidated | `reference_models` = 0 rows, `reference_rules` = 0 rows (queried); `docs/analysis-methodology.md` "Reference retrieval: none" | Hallucinated references and impossible production years reach the report and are then written into the customer's watch record. |
| 5 | **High** | The verdict `consistent_with_claimed_reference` measures the watch against the model's own guess — nothing is ever claimed by the user | `verify.index.tsx` `SaveButton` posts `reference: result.reference`; no reference/serial input exists in the photo flow | The one check that would catch most frankenwatches — declared reference vs. observed watch — is structurally impossible. |
| 6 | **Medium** | "Forensic crops" are blind centre crops from a hardcoded box | `image-intake.ts` `pickCropRegions()`; `verify.index.tsx` `ingest()` passes `{ cx: 0.5, cy: 0.5, r: 0.4 }` | If the watch isn't centred and large, the "bezel + crown" crop contains no watch. |
| 7 | **Medium** | Images are downscaled to 1536px long edge before analysis; the quality gate passes anything over 0.6MP | `image-intake.ts` `renderScaled(image, 1536, 0.85)`; `measureQuality` threshold `megapixels < 0.6` | Every top-market authentication marker lives below that resolution. |
| 8 | **Medium** | `specialist_review_required` and `escalationRequired` lead nowhere | `specialist_reviews` = 0 rows; no specialist queue route exists in the file listing | The safest verdict in the enum is also a dead end for the customer. |
| 9 | **Low** | Docs are stale by a full product generation | `docs/current-system-audit.md` "Backend: None enabled"; `docs/implementation-status.md` marks Phases 1–2 "❌ not started" — both false | Anyone auditing this app from its docs will get the wrong picture in the wrong direction. |

**On items 1 and 2.** I want to be exact about why this is the severe finding and not a cosmetic one. Everything else in this app is defensible — the prompt refuses to authenticate, the guard blocks weak positives, the disclaimers are specific and honest. And then, on the page where a person is standing in a bank foyer pointing a phone at a £12,000 watch, the app prints "serial font matched to proprietary set ✓" and "caseback engraving depth 0.18mm ✓". A buyer does not read those as decoration. They read them as the app doing the thing an authenticator does. The careful disclaimer three screens later does not survive contact with a tick mark next to a millimetre figure. If this app is ever cited in a dispute, this is the screenshot that gets produced, and no amount of correct architecture behind it will help.

**On item 4.** The empty catalogue is the difference between a screening tool and a guessing tool. Everything the pipeline needs to be genuinely useful — serial-range-to-year windows, reference-to-calibre mapping, which dials shipped on which references in which years, which parts a service centre legitimately fits — is a data problem, not an AI problem, and the schema for it is already built and sitting empty.

## Watches this app would get wrong

**Rolex Submariner 126610LN, current-generation superclone (Clean/VS factory).** Dial print, bezel, proportion and bracelet are all correct enough at 1536px. Identity confidence lands `high`, visual risk `low`, and with four decent photos the guard's positive gate opens. Verdict: "Consistent with the claimed reference." The tells — coronet etch, rehaut alignment, the 3235's finishing — are all below the resolution the app works at or inside the case. **False clear on a £10,000 watch. This is my Submariner, and this is the failure that matters.**

**Rolex GMT-Master 1675, redialled with fake patina.** Genuine case, genuine 1570, aftermarket dial. The app sees a plausible vintage GMT and no reference table to tell it that this dial variant never shipped with that serial's production window. Verdict: plausible. **A £5,000 error on a £22,000 watch.**

**Omega Speedmaster 145.022 with a service-replaced dial and hands.** Entirely honest watch, Omega's own parts, fitted in 1994. The model sees an inconsistency it cannot categorise. The app *has* a `possible_service_replacement` category — genuinely thoughtful — but with no reference data it cannot tell a service part from a fake part, so it will land on `concerns_identified` as often as not. **A false condemnation, and I have watched those kill honest private sales.**

**Genuine Rolex Datejust on a fake jubilee with a correctly-stamped clasp.** No clasp-code table exists, so a stamp that reads right passes. The gap-and-stretch feel that gives it away in the hand is invisible in a photo.

**AP Royal Oak 15400 on an aftermarket bracelet.** The single most valuable part of that watch is the bracelet and its integration. Photo screening at this resolution reads the case and the tapisserie and calls it a Royal Oak, which it is — while missing the £6,000 problem.

**Any Patek — say a 5711/1A.** The model will confidently name a reference and a production year from memory. There is no catalogue to catch it when the year is impossible for that dial. The confident wrong answer is the worst output a tool like this can produce, and nothing here prevents it.

**One it gets right, and I'll say so:** a genuine watch photographed as a screenshot lifted from a dealer's listing. `no_exif` fires, evidence completeness drops, the guard refuses a positive, and the app asks for a real photograph. That is exactly correct behaviour and better than most humans manage.

## What I'd change, concretely

**Problem: fabricated forensic findings on screen.**
Change: delete `LIVE_COMMENTS` (`verify.photo.tsx` lines 88–99) and `ANALYSIS_STAGES` (lines 121–130) outright; replace the ticker and milestone stream with the *actual* per-image measurements already computed in `image-intake.ts` — "sharpness 0.62 · EXIF present · no editing software detected". Delete the two prohibited strings from `TickerRow` (lines 162, 165). Delete the invented progress easing at line 1597 and show an indeterminate spinner.
Verify: grep the built bundle for `0.18mm`, `40+`, `0–100`, `12M references`, `Market valuation`. Zero hits is the test.

**Problem: nothing is ever claimed, so "consistent with claimed reference" is circular.**
Change: add a short declared-details step before capture on `/verify` — claimed reference, serial (stored masked; `watches.serial_masked` already exists), asking price, papers yes/no, service history. Pass them into the prompt as a clearly-labelled `DECLARED (UNVERIFIED)` block. Stop writing `result.reference` into `watches.reference`; write the declared value there and the observed value beside it.
Verify: a case where the user declares 116610LN and photographs a 126610LN must return `inconsistent_with_claimed_reference`. Today it cannot.

**Problem: the empty catalogue.**
Change: seed `reference_models` for the top 200 references by trade volume — reference, production years, calibre, case size, dial variants, bracelet reference, known service-part substitutions — and add a validation step after the model call: if `reference` is not in the catalogue, blank it and drop identity confidence one band. The knowledge rules already say to use clearly-labelled demonstration records with an admin import path.
Verify: an invented reference must never reach the report. Assert it in a test with a fixture that forces a bogus reference through `runPhotoAnalysis`.

**Problem: resolution destroys the markers that matter.**
Change: keep the 1536px overview for identity, but send one full-density crop of the declared-critical region per slot. Drive `pickCropRegions` from an actual detection (the watch tracker already in `verify.photo.tsx` produces a bounding box) instead of the hardcoded `{0.5, 0.5, 0.4}`. Raise the gate to 2MP for any slot the verdict depends on.
Verify: crop a known rehaut engraving and confirm the characters are legible in the payload.

**Problem: escalation goes nowhere.**
Change: when `escalationRequired` is true, offer the full-set intake as the next action with the case pre-attached, and write a `specialist_reviews` row in `pending` state.
Verify: a `specialist_review_required` case must produce a row and a visible next step.

## The honest product this could be

Stop selling a verdict. Sell **a pre-purchase screening and evidence record**.

What it should claim: *"We grade your photographs, read their metadata, flag the obvious fakes and the obvious red flags, tell you exactly what a photograph cannot settle, and give you a permanent, hashed, timestamped record of the watch as it was presented to you. We do not authenticate. Authentication requires opening the watch."*

What it should do: catch the bottom 60% of fakes reliably; refuse to conclude on the top 10% and say so loudly; detect dishonest seller photography; produce a record I can attach to a consignment or an insurance schedule; and route anything real to a human.

Who pays: private buyers, £5–£15 per screening before a face-to-face sale — that is cheap against a £10,000 mistake and expensive enough to be taken seriously. Dealers and consignment platforms pay a subscription for the evidence record and an API. Nobody pays for the verdict, ever, and the moment you charge for one you own the liability.

## The five things I'd do first

1. **(S)** Delete `LIVE_COMMENTS`, `ANALYSIS_STAGES`, the two ticker claims and the fake progress bar in `verify.photo.tsx`. One afternoon. Removes the entire critical exposure.
2. **(S)** Add the declared-details step to `/verify` and stop writing the model's own guess into `watches.reference`. Makes "consistent with claimed reference" mean something.
3. **(M)** Seed `reference_models` for the top 200 references and add post-call validation that blanks unknown references and drops confidence. Turns guessing into checking.
4. **(M)** Detection-driven, full-density crops for the slots the verdict rests on; raise the resolution gate. Gives the model something worth looking at.
5. **(L)** Wire escalation to the full-set intake and a real `specialist_reviews` queue, then refresh `docs/` to describe the app that actually exists.

## What I could not check

- **The live site and preview.** Both `watch-oracle.lovable.app` and the preview URL were blocked by the network egress proxy. My reading of what renders comes from the code and from the rendered screenshot returned by `get_project`, not from a fetched page. **UNVERIFIED:** anything only observable at runtime.
- **Actual model behaviour.** I did not run a screening. Every judgement about what Gemini Flash would conclude on a given watch is my professional inference from the prompt, the resolution and the absence of reference data — not observed output.
- **`verify.photo.tsx` in full.** 2,732 lines; I read the constants, the analysis and reveal components, the call site and the claim-bearing strings by targeted search. There may be further claims in the parts I did not read.
- **Storage bucket configuration and the RLS policy bodies.** I confirmed RLS is enabled with policies on all 33 tables and read the access code, but did not read each policy's predicate.
- **The auth flow and dashboard**, and whether any admin surface exists beyond the routes in the file listing.

## Verdict

**Status: Amber.**

The engine underneath is more honest than almost anything else in this category — no blended score, a hard guard against weak positives, reports that can never be "issued", real image forensics, and a security posture I would not be embarrassed to explain to a client. Then the live-camera page prints fabricated measurements with tick marks, claims a twelve-million-reference archive that contains zero rows, and announces a market valuation the app is explicitly forbidden to perform. Delete those strings and seed the catalogue and this becomes a tool I would actually keep on my phone; leave them and one bad verdict puts everything careful behind them in front of a judge.

---
*Alistair Crane · independent dealer and authenticator · review conducted read-only against commit `c3bf6783` on 1 September 2026.*
