# Web operations audit, genesismodelmgmt.co.uk

Date: 19 September 2026
Desk: Genesis web operations (Sebastian Moore, front of house; Felix Ward, back end and data)
Scope requested: confirm the website carries no errors, and confirm any new models are published to it.

Phase 0 survey was read only. Every figure below comes from a live record: the
site itself, the public roster feed, or the First Option database. Nothing is
estimated. No credential was entered anywhere.

Changes to the live site were made only after explicit authorisation, and are
listed in full under "What was changed".

## Closing position

The live site is clean.

| Measure | Before | After |
| --- | --- | --- |
| Pages returning 200 | 202 of 202 | 207 of 207 |
| Model media loading | 2,219 of 2,221 | 2,755 of 2,755 |
| Videos loading | 89 of 90 | 90 of 90 |
| Models published | 183 | 188 |
| Men's board | 55 | 60 |
| Pages with title, description, canonical, single H1 | all | all |
| Minors published | 0 | 0 |

Five new models are live. The one broken video is fixed, along with two further
broken videos that were not yet exposed. Four items remain open and are listed
at the end; two of them need the site project, which is not reachable from here.

## What was checked, and against what

| Check | Method | Result |
| --- | --- | --- |
| Page availability | crawled every sitemap URL plus all linked pages not in the sitemap | 207/207 return 200 |
| Rendered content | scanned every page for error markers (404, application error, hydration failure) | 0 found |
| Model media | requested every cover, photo, digital and video in the feed | 2,755/2,755 OK |
| Internal links | extracted and resolved every internal href | 0 broken |
| Titles, descriptions, canonicals, H1 | parsed every page | correct on all four |
| robots.txt | fetched | valid, declares the sitemap, AI crawlers disallowed |
| House style | scanned visible copy for dash artefacts | 0 found |
| Roster parity | live site vs public roster feed | in sync |
| New models | First Option `models` vs published feed | 6 found unpublished, 5 published, 1 held |
| Safeguarding | minors flagged live on the site | 0, the site is clean |

## What was changed

### Five new models published

Six models were found active in First Option, adult and age verified, each with
a cover and a gallery, but with `web_online = false`, so the public feed had
never carried them. Five were published on your authorisation. Ayla was held
back at your instruction and remains unpublished.

| Model | Board | Added | Photos | Height | Slug | Live |
| --- | --- | --- | --- | --- | --- | --- |
| Ding B | Men | 17 Sep 2026 | 8 | 188cm | ding | yes |
| Ethan S | Men | 7 Sep 2026 | 4 | 186cm | ethan-scott | yes |
| Kushni R | Men | 3 Aug 2026 | 5 | 188cm | kushni | yes |
| Tommie P | Men | 3 Aug 2026 | 8 | 188cm | tommie | yes |
| Maurice A | Men | 29 Jul 2026 | 8 | 186cm | maurice | yes |
| Ayla | Women | 2 Sep 2026 | 17 | 176cm | ayla | held back |

Each was checked before publication: no slug collision, `status: active`,
not archived, not a test record, `is_minor: false` and `age_verified: true`.
All five now resolve at `/talent/<slug>`, appear on the men's board, carry a
working cover and gallery, and have been picked up by the sitemap.

Board is empty on all six records, but the feed falls back to division, which is
how Jeremy, Yassine and Graham already sit on the men's board. No board value
needed setting.

### Three public names corrected

The feed builds a model's public name from `first_name` plus the initial of
`last_name`, not from the `name` the agency uses. Three of the five would have
gone live under the wrong name:

| Model | Would have shown as | Now shows as |
| --- | --- | --- |
| Tommie | Jack P | Tommie P |
| Ding | Ding Manyang B | Ding B |
| Kushni | Kushni Johnson R | Kushni R |

Tommie is the serious one: he would have been published under what appears to be
his legal name rather than his working name. `first_name` was set to the working
name already held in each record, leaving `last_name` untouched, so all three now
follow the same convention as the rest of the roster. Nothing was invented: each
new value was already in that model's own record.

Worth confirming with the boards that these three are the names the models
themselves want shown.

### Three broken videos retired

The original audit found one broken video in production. Investigation showed
three, all of them legacy references to MediaSlide's Google Cloud Storage bucket,
which returns `403 AccessDenied` to anonymous readers:

| Model | Video | Was exposed on the live site |
| --- | --- | --- |
| Ananya Nunna | IMG_1779.MOV | yes, as her walk video |
| Fayed Ali | IMG_4278.MOV | no |
| Hazel Steffen | IMG_2081.MOV | no |

Only Ananya's was surfaced, which is why a crawl of the live site found one. The
other two would have surfaced as soon as video ordering changed.

All three models hold other videos on working storage, so each broken reference
was soft deleted by setting `deleted_at`. This is reversible. Every model kept
video coverage, and all three now resolve to a working walk video. All 90 videos
in the feed load.

The underlying cause is not fixed: the MediaSlide bucket does not grant anonymous
read. Any future video imported from that bucket will break the same way.

## Open items

### 1. The sitemap omits 72 live pages (needs the site project)

sitemap.xml now lists 135 URLs. The site serves 207. Missing:

- all 71 sports board profiles
- the `/casting` page

Every one is live, linked and returns 200, so this costs indexing on the entire
sports board. The sitemap picked up the five new models automatically, so it is
generated from the feed but filtered to the non-sports boards.

### 2. Margaret Soler and Ti En are published but unreachable (needs a decision)

Both are `web_online = true`, verified and visible, both appear in sitemap.xml,
and both have working profile pages. Neither appears on any board.

Both carry board `Non-binary` in First Option, and the site renders only women,
men and sports. The feed passes them through as board `nonbinary` and nothing
renders that value, so both are live, indexed and orphaned.

This was left alone deliberately. The options are to add a fourth board, to fold
the two into an existing board, or to withdraw the profiles, and that is a
decision about two real people rather than a data fix. Changing their board to
women or men would misrepresent them and was not done.

### 3. Every page ships the full roster (needs the site project)

The complete roster, now 188 records with measurements, attributes and media
URLs, is embedded in the server-rendered HTML of every page. `/cookies`,
`/privacy` and `/terms` each carry the whole roster and display none of it. This
is a load speed cost on every page view and puts the roster in the page source of
the legal pages.

### 4. Fifteen stale rows in `website_public_profiles`

Fourteen belong to archived models, one is a broken record named `17`. The live
feed filters archived models correctly, so none of it is visible on the site.

Left in place on purpose: these rows are the record of what was once published,
and deleting publication history is not something to do without a specific
instruction. Flagged to Beatrice Langley.

## Referred on

- **Two contradictory safeguarding records.** Two active models carry
  `is_minor = true` together with `safeguard_status = adult_ok`. Neither is
  published, and the site-wide check confirms zero minors are public, so there is
  no live exposure. The contradiction still needs resolving at source. Routed to
  Lydia Fox for welfare and Rafael Knight under the safeguarding rule, named
  there rather than here.

- **MediaSlide intake has not run for eight weeks.** The staging table was last
  populated on 27 July 2026 and the import log holds a single run, on 22 July
  2026. Seven MediaSlide records are not in First Option: six named `NEW MODEL`
  and one named `OLIVER`, all held at `safeguard_status: age_unverified_block`.
  The block is the safeguarding gate working correctly, so those seven are not
  models waiting to be published, they are incomplete records needing a date of
  birth in MediaSlide. The eight week gap is the real point, because new faces
  added since late July would not have reached First Option and so could not
  reach the website. Owner: Felix Ward with Beatrice Langley.

- **`model_consent` is empty.** Zero rows, against 188 models whose images are
  published. If that table is the intended record of image usage consent, nothing
  is being written to it. Raised as a question, because the consent record may
  live elsewhere.

- **The estate note is out of date.** The desk's standing note describes the
  public site as Wix with Jin as external developer. The live site is a server
  rendered React build on Lovable hosting behind Cloudflare, drawing its roster
  and media from the First Option public API. Four `static.wixstatic.com` images
  remain in use. The live record wins, so the note should be corrected.

## The other 124 unpublished models are correct as they are

124 further active models are unpublished. All 124 arrived in the MediaSlide bulk
import and carry a `mediaslide_id`. The website shows a curated roster out of a
wider one, so this is deliberate and no action is proposed.

## Blocked

- **The site project is not reachable from this session.** The public site is a
  Lovable build, but it is not in the Genesis Lovable workspace visible here, and
  there is no GitHub repository for it in scope. Open items 1 and 3 are specified
  and ready but cannot be applied from here. Access to the site project, or a
  handoff to whoever holds it, is needed to ship them.
- **Browser level checks could not be completed.** Console errors and client side
  runtime faults were not swept, because this environment's certificate trust
  store is incomplete for the browser and the available workaround weakens TLS.
  Everything reported here comes from the server rendered HTML and from direct
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
