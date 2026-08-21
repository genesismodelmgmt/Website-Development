# Public website roster feed — social reach & discipline

**Endpoint:** `GET /api/public/website-roster?domain=genesismodelmgmt.co.uk`
(served by the First Option Lovable project, `src/routes/api/public/website-roster.ts`
+ `src/lib/public-website-roster.ts`)

## What changed

Each published model record now carries the athlete's discipline and social
reach, so the Genesis site can show them without fabricating data:

```json
{
  "sport": "Football",
  "following": {
    "platform": "Instagram",
    "handle": "alexiwobi",
    "url": "https://instagram.com/alexiwobi",
    "followers": "1200000"
  }
}
```

Previously every record emitted `"following": { "followers": "0" }` with no
handle, platform or sport.

## Field rules

- `sport` — plain label ("Football", "BMX", "Muay Thai"). Emitted only when the
  `models.sport` column (new, nullable text) holds a value. No derivation, no
  defaults. Populated for the sports board from verified public disciplines;
  men's and women's boards emit it only if staff record one.
- `following.platform` — explicit: `"Instagram"` when the handle comes from
  `instagram_handle`, `"TikTok"` when it comes from `tiktok_handle` (used only
  when there is no Instagram handle). Emitted only alongside a handle.
- `following.handle` — the account name as stored (leading `@` optional; the
  site accepts both).
- `following.url` — optional; the stored `instagram_url` when present and
  `https://`. When absent the site derives
  `https://www.instagram.com/<handle>/`. Never emitted for TikTok handles.
- `following.followers` — the real recorded count as a digit string. **Never
  `"0"` or a placeholder**: when `instagram_followers` is 0/unknown the key is
  omitted so the site hides the line. (At launch no counts are recorded, so no
  record emits `followers` until staff record real counts in First Option.)
- The `following` object is omitted entirely when it would be empty.

## Anonymised athletes

When the public name is anonymised (sports-board names beginning
"Pro Athlete", "Athlete" or "Sports Talent" are passed through verbatim by
`publicModelName`), `handle`, `platform` and `url` are omitted — the handle
would identify the athlete — but `followers` and `sport` may still be sent for
the anonymous option cards.

## Compatibility

- No shape change to any other field; `following` was not renamed, only
  extended (all new keys are additive and optional).
- Public-safe names, board mapping, media URLs, ETag/revision and the anon
  behaviour are unchanged.
- The Genesis site picks the change up within 60 seconds through the existing
  cache (`s-maxage=60`); no site redeploy needed.

## Sports board restored (site side)

The `/sports` board had been temporarily hidden (redirect to home, nav/footer/
sitemap entries removed) while profiles were broken. With the feed fixed and
all 71 sports records verified healthy (every record has a cover + photos, all
spot-checked media URLs return real images, and profiles render sport label,
height and Instagram handle), the hide was reverted and republished:

- `/sports` renders the shared board again from the live feed (71 athletes,
  all card images loading), with its original metadata, canonical and JSON-LD.
- Sports links restored in nav, footer, sitemap, robots.txt and llms.txt;
  `/sports-division` 301s to `/sports` again; homepage CTA, casting copy and
  the concierge tour step restored.
- Safeguards kept: anonymised records stay out of the sitemap and
  `/talent/gsx-` stays disallowed in robots.txt.

## Data backfill (production, scoped to the Genesis customer account)

- `models.sport` populated for the sports board only, from verified public
  record: `Football` for the 69 professional footballers, `BMX` for Kye Whyte,
  `Muay Thai` for Jonathan Haggerty.
- No follower counts were invented; `instagram_followers` stays 0 (= unknown,
  hidden) until real counts are recorded.
