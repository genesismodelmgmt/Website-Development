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

Sent to the Lovable agent as a single scoped instruction. No restyling, no
pricing changes, no inventory added or removed.

- The Skeleton → `designFeatures` migration is now actually applied at record
  construction, mapping to "Openworked" where the piece's own name or spec uses
  that word and "Skeleton" otherwise.
- The complication sentence is omitted entirely rather than asserting
  "time-only"; material casing, list grammar, the Two-tone redundancy and the
  opening-clause duplication are all fixed.
- On the piece page the "Complications" row becomes "Functions", with a
  separate "Design" row for skeleton/openworked, and never renders empty.
- The homepage count derives from `PUBLIC_WATCHES.length`.
- The five factual corrections above, plus the six missing annual calendars.

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

- Publish is a separate step. The changes sit in the Lovable preview until
  the site is deployed; review before publishing.
- The four flagged records are a work queue for the owner, not a permanent
  hide. §6b of the risk register applies.
