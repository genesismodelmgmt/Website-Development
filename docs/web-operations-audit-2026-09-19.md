# Web operations audit, genesismodelmgmt.co.uk

Date: 19 September 2026
Desk: Genesis web operations (Sebastian Moore, front of house; Felix Ward, back end and data)
Scope requested: confirm the website carries no errors, and confirm any new models are published to it.

Phase 0 survey was read only. Every figure below comes from a live record: the
site itself, the public roster feed, or the First Option database. Nothing is
estimated. No credential was entered anywhere.

## Headline position

The live site is healthy. All 202 real pages return 200, every page carries a
title, a meta description, a correct canonical and exactly one H1, and 2,219 of
2,221 model media files load.

Two things are not right, and one of them is about people:

1. One model video is broken in production.
2. Two published models are unreachable from anywhere on the site.

Separately, six new models sit in First Option complete and ready but have never
been published to the website. They are listed in the approvals section, because
a roster import is not the desk's to ship.

## What was checked, and against what

| Check | Method | Result |
| --- | --- | --- |
| Page availability | crawled all 130 sitemap URLs plus 72 linked pages not in the sitemap | 202/202 return 200 |
| Rendered content | scanned every page for error markers (404, application error, hydration failure) | 0 found |
| Model media | requested all 2,221 cover, photo and video URLs | 2,219 OK, 1 broken, 1 transient |
| Internal links | extracted and resolved every internal href | 0 broken |
| Titles, descriptions, canonicals, H1 | parsed all 130 pages | 130/130 correct on all four |
| robots.txt | fetched | valid, declares the sitemap, AI crawlers disallowed |
| House style | scanned visible copy for dash artefacts | 0 found |
| Roster parity | live site vs public roster feed | 183 vs 183, in sync |
| New models | First Option `models` vs published feed | 6 unpublished, listed below |
| Safeguarding | minors flagged live on the site | 0, the site is clean |

## Findings

### 1. Ananya Nunna's walk video is broken in production (live, user facing)

Her walk video returns `403 AccessDenied` from Google Cloud Storage:

```
https://www.firstoption.app/api/public/website-media/video/153ab105-e44d-40d9-bc8e-c4d8be0ab530?domain=genesismodelmgmt.co.uk
```

The underlying object has no anonymous read permission, so the player fails on
her profile page. This is the only failure among 90 videos, which points at the
permissions on that single stored object rather than at the media route. It
reproduces on every attempt, so it is not a transient fault.

Owner: Felix Ward. Fix is on the storage object, not on the website.

### 2. Margaret Soler and Ti En are published but unreachable

Both are `web_online = true`, `source_status: verified`, `visibility: visible`,
and both appear in sitemap.xml with working profile pages. Neither appears on
any board.

Root cause: both carry board `Non-binary` in First Option, and the website
renders only three boards (women, men, sports). The feed passes them through as
board `nonbinary`, and nothing on the site renders that value. The result is two
live, indexed, orphaned profiles that a visitor can only reach from the sitemap.

This one touches real people, so it is flagged and routed rather than quietly
corrected. Steven's decision: add a fourth board, fold the two into an existing
board, or withdraw the two profiles.

### 3. The sitemap is missing 72 live pages

sitemap.xml lists 130 URLs. The site actually serves 202. Missing:

- all 71 sports board profiles
- the `/casting` page

Every one of those 72 pages is live, linked from the site and returns 200, so
this costs indexing on the entire sports board. The 71 sports profiles are
linked from `/sports`, so they are reachable by crawl, but they are not declared.

### 4. Every page ships the full 183 model roster

The complete roster payload, all 183 records with measurements, attributes and
media URLs, is embedded in the server-rendered HTML of every page. `/cookies` is
182 KB, `/privacy` is 187 KB and `/terms` is 184 KB, almost entirely roster data
that those pages never display.

This is a load speed and Core Web Vitals cost on every page view, and it puts the
roster in the page source of legal pages.

### 5. Fifteen stale rows in `website_public_profiles`

The table holds 198 rows against 183 live models. Fourteen belong to models since
archived (Natasha Mackey, Skeels Thomas, Someya, Tash Knox, Theodore Matthews,
Shinkyo Li, Katie T, India Dale, Tenaya Maumbe, Nico Suarez, Luke Partridge,
Oliver Knight, Suraj Aku, Taj Dealmeida). One is a broken record named `17`.

The live feed filters archived models correctly, so none of this is visible on
the site. It is data hygiene, not a public error.

Owner: Beatrice Langley.

### 6. Two active models are flagged as minors and as adults at the same time

Two records carry `is_minor = true` together with `safeguard_status = adult_ok`.
Neither is published to the website, so there is no live exposure, and the
site-wide check confirms zero minors are public. The contradiction still needs
resolving at source.

Routed to Lydia Fox for welfare and Rafael Knight under the safeguarding rule.
Named in the approvals note rather than here.

### 7. `model_consent` is empty

The table holds zero rows, against 183 models whose images are published. If that
table is the intended record of image usage consent, nothing is being written to
it. Raising it as a question rather than a finding, because the consent record
may live elsewhere.

### 8. The estate note is out of date

The desk's standing note describes the public site as Wix with Jin as external
developer. The live site is a server-rendered React build on Lovable hosting
behind Cloudflare, drawing its roster and media from the First Option public API.
Four `static.wixstatic.com` images remain in use. The live record wins, so the
estate note should be corrected.

## New models: six are ready and not published

The website is in sync with the published feed, so nothing has been dropped. The
gap is upstream: six models are active in First Option, not archived, not test
records, adult and age verified, each with a cover and photos, and all six have
`web_online = false`, so the feed has never carried them.

| Model | Board | Added | Photos | Height | Proposed slug |
| --- | --- | --- | --- | --- | --- |
| Ding | Men | 17 Sep 2026 | 10 | 188cm | ding |
| Ethan Scott | Men | 7 Sep 2026 | 4 | 186cm | ethan-scott |
| Ayla | Women | 2 Sep 2026 | 17 | 176cm | ayla |
| Kushni | Men | 3 Aug 2026 | 4 | 188cm | kushni |
| Tommie | Men | 3 Aug 2026 | 7 | 188cm | tommie |
| Maurice | Men | 29 Jul 2026 | 16 | 186cm | maurice |

Checks already done on all six:

- No slug collides with an existing profile.
- All six are `status: active`, `archived: false`, `is_test: false`.
- All six are `is_minor: false` with `age_verified: true`.
- All six have a cover photo and a gallery.
- Board is empty on all six, but the feed falls back to division. Jeremy, Yassine
  and Graham are already live on the men's board on that same fallback, so the
  six will land on the correct boards without a board value being set.

Gaps worth filling before they go live, none of them blocking:

- Ding and Ethan Scott have no bust, waist or hips recorded.
- Hair colour is missing on five of the six, eye colour on four.
- No Instagram handle on any of the six.
- `adult_confirmed_at` is empty on all six, although `age_verified` is true.

Publishing is a single change per model in First Option, setting `web_online` to
true, which regenerates the public feed the website reads. It has not been done,
because a roster import is Phase B and ships only on Steven's sign off.

## The other 124 unpublished models are correct as they are

124 further active models are unpublished. All 124 arrived in the MediaSlide bulk
import and carry a `mediaslide_id`. The website shows a curated 183 out of a
wider roster, so this is deliberate and no action is proposed.

## MediaSlide intake has not run for eight weeks

The MediaSlide staging table was last populated on 27 July 2026, and the import
log holds a single run, on 22 July 2026. Seven MediaSlide records are not in
First Option at all: six named `NEW MODEL` and one named `OLIVER`. All seven are
held at `safeguard_status: age_unverified_block`.

The block is the safeguarding gate working correctly, so those seven are not
models waiting to be published. They are incomplete records that need a date of
birth in MediaSlide before they can move. The eight week gap in intake is the
real point: new faces added to MediaSlide since late July would not have reached
First Option, and so could not reach the website.

Owner: Felix Ward with Beatrice Langley.

## Phase A, prepared and waiting on one approval

These are safe, do not touch copy about people, rates or clients, and are ready
to hand to whoever holds the site project:

1. Add the 71 sports profiles and `/casting` to sitemap.xml.
2. Trim the embedded roster payload so a page ships only the records it renders,
   starting with `/privacy`, `/terms` and `/cookies`, which need none.

## Phase B, each needing Steven item by item

1. Publish the six new models listed above.
2. Decide what happens to Margaret Soler and Ti En, given the site has no
   non-binary board.
3. Restore Ananya Nunna's walk video by correcting the storage object permission.
4. Clear the 15 stale rows from `website_public_profiles`.
5. Resolve the two contradictory safeguarding records, with Lydia Fox.
6. Confirm whether image usage consent is recorded, and where.
7. Restart MediaSlide intake and complete the seven blocked records.

## Blocked

- **The site project is not reachable from this session.** The public site is a
  Lovable build, but it is not in the Genesis Lovable workspace visible here, and
  there is no GitHub repository for it in scope. The Phase A fixes are specified
  and ready but cannot be applied from here. Access to the site project, or a
  handoff to whoever holds it, is needed to ship them.
- **Browser level checks could not be completed.** Console errors and client side
  runtime faults could not be swept, because this environment's certificate trust
  store is incomplete for the browser and the available workaround weakens TLS.
  Everything reported above comes from the server-rendered HTML and from direct
  requests, which covers content, links, media, metadata and the roster in full.
  A console sweep is still worth running from a normal browser.
- Four inputs remain Steven's to confirm and are unchanged: the low credit
  threshold, the higher than normal usage baseline, the analytics source and
  property, and the agreed scope of the security checks. Credits, usage and
  visitor analytics are therefore not reported in this run.

## Client portal repository

Checked alongside the public site, on branch `claude/eager-gauss-bsyrou`:
typecheck passes on both workspaces, all 16 server tests pass, and both the
client and server builds succeed. No errors.
