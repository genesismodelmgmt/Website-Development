# The Private Collection — catalogue accuracy audit

_1 September 2026. Triggered by an inbound enquiry, not by a scheduled review._

## What came in

A private enquiry arrived through the site form on The Private Collection
(reference `7fe15c1c-290f-4fab-a255-b44c21ccf33e`, enquiry type "Private
consultation", no budget and no pieces of interest given):

> Hello, you should have a (better) look at your website as descriptions of
> many watches are erroneous. Best regards, Pedro Reiser

No specific piece was named. The enquirer wrote from a Swiss consumer address
and left no telephone number. Treated as a good-faith accuracy report from
somebody who reads this catalogue closely, and audited on that basis.

The site is the Lovable project `the-private-collection`
(`fd88d2ee-9684-42a9-a1e0-dd8ee783e26e`), published at
`the-private-collection.lovable.app`. The inventory lives in a single module,
`src/lib/watches.ts`, which holds 68 public records and generates each piece's
public `description` from its structured attributes.

## What was actually wrong

The complaint is well founded. The errors fall into two groups, and the larger
group is systematic rather than per-piece — which is why "many watches" read
wrongly rather than one or two.

### Group 1 — the description generator

`buildDescription()` composes the prose that appears on every `/piece/{id}`
page and in the quick-view drawer. Four defects, affecting roughly 29 of the
68 public records between them:

1. **Skeleton published as a complication.** 19 pieces render
   `Complications: chronograph, skeleton` or similar. Skeletonisation is a
   construction feature, not a horological complication — any collector reads
   that as an error, and the project's own risk register says so at §6c. The
   `DesignFeature` type and the `designFeatures` field were both already
   declared for exactly this migration; the migration was never applied to the
   data, so every record still carried the legacy string.
2. **"Complications: time-only."** 10 pieces assert a complication list whose
   only member is the absence of complications.
3. **Proper nouns lower-cased.** `materials.join(" and ").toLowerCase()` turns
   Richard Mille's Carbon TPT and Quartz TPT into "carbon tpt" and "quartz
   tpt", and Cermet into "cermet".
4. **List grammar and duplication.** Materials join as "a and b and c";
   piece-49 reads "in two-tone and yellow gold and steel". The generated
   opening clause then repeats material and complication terms that the `spec`
   sentence states again immediately afterwards.

### Group 2 — five per-piece factual errors

Each checked against the manufacturer's published specification for the
reference the record itself names.

| Piece | Published | Correct |
| --- | --- | --- |
| piece-08 | RM 38-02 "G-sensor tourbillon" | The G-sensor is the RM 38-01. The 38-02 is a manual-winding tourbillon, cased in Quartz TPT **and** Carbon TPT |
| piece-18 | RM 61-01 Yohan Blake "Automatic" | Manual winding, calibre RMUL2 |
| piece-26 | Perpetual 1908 ice blue in "White gold" | Rolex reserves ice blue for platinum; the ice-blue guilloché 1908 is ref. 52506, platinum |
| piece-63 | Cubitus "5821/1R", rose gold, chocolate dial | 5821/1AR is the 45 mm steel-and-rose-gold with a blue dial. Rose gold with a brown sunburst dial is ref. 7128/1R-001 |
| piece-64 | Nautilus 7010/1R in "Yellow gold", sunburst dial, fabric strap | "R" denotes rose gold. Dial is lacquered purple, wave pattern. "/1" denotes the gold bracelet, contradicting the strap |

Separately, the annual calendar carried as standard by every RM 11-03 and
RM 11-05 was missing from the complication list on six records.

### Group 3 — the piece count

The homepage collection heading is hard-coded to "Seventy-five pieces, quietly
held." The site renders 68; seven records are suppressed pending verification.
The module header comment already states that "the public count is derived at
runtime" — the headline simply did not do so.

## What was changed

Applied on the Lovable project as commit `2ec72dde`. No restyling, no pricing
changes, no inventory added or removed.

- The Skeleton → `designFeatures` migration is now actually applied at record
  construction, mapping to "Openworked" where the piece's own name or spec uses
  that word and "Skeleton" otherwise.
- The complication sentence is omitted entirely rather than asserting
  "time-only"; material casing, list grammar, the Two-tone redundancy and the
  opening-clause duplication are all fixed.
- On the piece page the "Complications" row becomes "Functions", with a
  separate "Design" row for skeleton/openworked, and never renders empty.
- The homepage count derives from `PUBLIC_WATCHES.length` and is spelled as a
  word, so it now reads "Sixty-seven pieces, quietly held."
- The five factual corrections above, plus the six missing annual calendars.

Verified from source after the run: typecheck clean, `check-no-prices.mjs`
reports `OK` against a fresh production build. Lint does not fully pass, but it
did not before — the repo carries 565 pre-existing prettier formatting errors
across roughly 30 files, and the three touched files measured 206 errors both
before and after, so this pass added none.

Three loose ends were left open by this first pass, none of them an error: the
`numberToWords` helper sitting between the imports, the de-duplication only
catching exact material matches, and the intro line still saying "complication"
where the facet now says "Function". All three are closed in the second pass
below.

---

# Second pass — full catalogue survey

_2 September 2026. Applied on the Lovable project as commit `f49d2ee8`._

The first pass fixed the systematic generator faults and the errors that
surfaced while diagnosing them. This pass went further: every one of the 67
public records was checked record by record against the manufacturer's
published specification for the reference it names.

## Four further factual errors

| Piece | Published | Actually |
| --- | --- | --- |
| piece-41 | Daytona "Leopard" in **rose gold** with a **baguette-diamond** bezel | Reference 116598SACO is **yellow gold** with a bezel of 36 **cognac baguette sapphires** and diamond-set lugs. Wrong on both metal and stones |
| piece-15 | RM 21-01 as a "Carbon TPT case with rose-gold bezel" | Inverted. It is a **5N red gold case** reinforced by a **Carbon TPT exoskeleton** forming bezel and pillars |
| piece-33 | Daytona champagne with "**Paul Newman-style subdials**" | "Paul Newman" denotes the vintage 6239/6241 exotic dials and carries a large value implication. The modern yellow gold champagne reference simply has contrasting black subdials |
| piece-42 | Land-Dweller 36 on an "Integrated Jubilee" | Rolex's own name for it is the **Flat Jubilee** |

piece-33 is the one I would flag hardest commercially. Describing a modern
Daytona with a term that collectors associate with six- and seven-figure
vintage references is the kind of thing that reads as either ignorance or
sharp practice, and neither is what this site is trying to project.

## The dormant provenance field

`Watch` has declared an `attributeProvenance` object with a `gemSetting` slot —
`factory` / `aftermarket` / `unknown` / `verification_pending` — since before
this work began, and it was populated on **zero** records. That is a real gap
on a catalogue this heavily gem-set, and §6b already names aftermarket
disclosure as an open issue on piece-25.

It is now populated on the three records whose configuration is not a
manufacturer catalogue reference:

- **piece-70** — Patek's ruby-set Nautilus Joaillerie is reference
  5711/112P-001, in **platinum**. A rose gold 5711 with a salmon dial, ruby-set
  case and gradient sapphire bezel is not a Patek configuration.
- **piece-72** — a blue sapphire baguette bezel on a white gold 5711 is not a
  Patek configuration.
- **piece-75** — an emerald baguette bezel on a white gold 5711 is not a Patek
  configuration.

All three stay publicly visible. The flag is internal. Factory versus
aftermarket materially changes what these are worth, and it is the owner's call
to make from the pieces and their papers, not mine from a photograph.

## Two more flagged, two duplicates queried

- **piece-20** — the RM 21-02 Aerodyne case is grade 5 titanium, Carbon TPT
  *and* Quartz TPT; the record lists Carbon TPT alone, and the stated green
  with orange colourway could not be matched to a documented execution.
- **piece-56** — AP catalogues the yellow gold Royal Oak Chronograph 41
  (26240BA) with a yellow-gold-toned Grande Tapisserie dial. No blue variant.
- **piece-69 and piece-74** both describe Nautilus 5990/1400G in near-identical
  terms. Either two examples are genuinely held or one record was duplicated —
  the module's own comment claims two pieces never share copy, and these do.

## Records confirmed correct

Worth recording, because it is most of the catalogue. Checked and found
accurate: the platinum ice-blue Daytona and its chestnut bezel, both Pepsi
GMTs, the Sprite, the platinum and Everose Day-Dates, the white gold Rainbow
Daytona with its meteorite-look subdials, the Tahitian mother-of-pearl Daytona,
the rose gold SARU (126755SARU does exist, contrary to my first suspicion), the
Land-Dweller's white honeycomb dial, the Oyster Perpetual 41 lavender under its
current 134300 reference, RM 71-02, the Aquanaut Luce rainbow chronograph
7968/300R, the white gold Aquanaut Haute Joaillerie, and the AP 34 mm white
ceramic 77350CB.

## Verification

Typecheck clean. Production build succeeds. `node scripts/check-no-prices.mjs
dist/client` reports `OK`. Lint reports 202 errors on the touched files, all
pre-existing prettier debt of the same class as the 206 measured last pass; no
new rule violations, no unrelated files reformatted.

The commit also carries a change to `src/integrations/supabase/types.ts` that
nobody asked for — parenthesising conditional type parameters in Lovable's
auto-generated Supabase types, presumably a TypeScript version fix from the
platform.

## What was deliberately not changed

The risk register is explicit that **AI recognition is not final
authentication** — seven records were previously returned to public view on the
strength of image inspection alone and had to be re-suppressed. That precedent
was followed here. Corrections were made only where the record contradicts the
manufacturer's published specification for the reference it names, or
contradicts itself. Where the answer depends on which physical piece is in the
photograph, the record was flagged for the owner rather than rewritten:

- **piece-11** — the record says "Blue Quartz TPT", but the RM 11-05 Automatic
  Flyback Chronograph GMT is built with a grey Cermet bezel and a Carbon TPT
  caseband and was never produced in blue Quartz TPT. Either the reference or
  the material is wrong. Added to `SUPPRESSED_IDS`, taking the suppression list
  from seven to eight, because the stated configuration is impossible for the
  named reference.
- **piece-62** — "Slate-grey dial"; the Nautilus 5980/1R-001 is catalogued with
  a black or a brown dial. Flagged, kept public.
- **piece-61 and piece-66** — ref. 5072R-001 is the Aquanaut Luce Haute
  Joaillerie with a beige mother-of-pearl dial on a beige rubber strap, which
  matches piece-66's description more closely than piece-61's. The two records
  may be transposed. Flagged, kept public.

Each of these takes the owner seconds to settle with the piece in hand, and
piece-11 can be reinstated as soon as that happens.

## Suggested reply to the enquirer

He is a serious reader who took the trouble to write. Worth answering
personally, briefly, without over-explaining:

> Dear Mr Reiser,
>
> Thank you for writing, and for taking the trouble. You were right. A review
> found errors in how several pieces were described, including watches listed
> with the wrong case metal and one movement described as automatic when it is
> manual winding, along with a fault in how the descriptions were assembled
> that misdescribed skeletonised construction as a complication.
>
> These have been corrected. A small number of records where the description
> could not be settled without the piece in hand have been withdrawn from the
> site until they can be.
>
> If you noticed something specific, I would genuinely welcome hearing it.
>
> With thanks,

## Open

- **Publish is a separate step.** Both passes sit in the Lovable preview, now at
  commit `f49d2ee8`. The live site at `the-private-collection.lovable.app` still
  serves the old copy until it is deployed. Review, then publish.
- **The gem-set catalogue is only partly provenanced.** `attributeProvenance` is
  now populated on three records; every other gem-set piece still carries no
  factory-versus-aftermarket statement either way. Establishing that across the
  catalogue is owner work that cannot be done from photographs, and it is the
  single largest remaining accuracy exposure on the site.
- The commit also carries changes nobody asked for: Lovable bumped
  `@lovable.dev/vite-tanstack-config` from 2.12.0 to 2.13.1 and regenerated its
  Supabase preview-auth plumbing (`previewAuthStorage.ts`, plus a one-line
  change in `client.ts`). Both files are marked automatically generated. They
  are platform housekeeping, not part of this pass, but they will ship with it.
- The four flagged records are a work queue for the owner, not a permanent
  hide. §6b of the risk register applies.
- `docs/COMMERCIAL_READINESS.md` still lists the WhatsApp number
  `+44 7568 765929` in §4 and §7b, although WhatsApp was removed from the site
  on 13 August. Stale internal doc only, left alone deliberately.
