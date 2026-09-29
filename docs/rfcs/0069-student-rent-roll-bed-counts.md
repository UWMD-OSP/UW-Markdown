---
rfc: 0069
title: Declare the student rent-roll bed counts and pre-leasing dates the student pack already reads
status: draft
author: jaredmaxey (StackUW)
created: 2026-09-28
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0069: Declare the student rent-roll bed counts and pre-leasing dates the student pack already reads

## Summary

`org.uwmd.pack.student_housing` computes `occupancy` as
`rent_roll.occupied_beds / property.total_beds` and `pre_lease_rate` as
`rent_roll.preleased_beds / property.total_beds`, and the tier-3 fixture
`student-housing-pre-lease-rate` states `preleased_beds`. Neither field is
declared by the format spec, and no field carries the date either count was
measured on. This RFC declares four OPTIONAL §4.3 roll-total fields for
`student_housing` documents, with three validator **warnings** (never errors)
for the inconsistent cases, in a new registered code family, so a producer can
state the fields without copying a fixture. Pack formulas do not change.

## Motivation

- `spec/UW_FORMAT_SPEC_v1.md` §4.1 declares `property.total_beds` (line 740 in
  the template; field note at lines 781–782; the two-count note for student and
  senior housing at lines 790–793, RFC 0027) and nothing else about beds. The
  §4.3 `rent_roll` Multifamily Variant template (lines 849–920) states unit
  totals only: `total_units` through `month_to_month_pct` (lines 854–872), with
  `as_of_date` at line 853. A `student_housing` document uses this variant
  (`rent_roll_type: multifamily`); there is no bed total anywhere in it.
- `packages/uwmd-core/src/packs/student-housing.ts:103` reads
  `rent_roll.occupied_beds` and `:110` reads `rent_roll.preleased_beds`.
  `conformance/tier-3-calc-host/fixtures/student-housing-pre-lease-rate/deal.uwx.md`
  states `total_beds: 600` (line 41) and `preleased_beds: 570` (line 63), and
  `expected-result.json` expects `0.95`. The worked example
  `examples/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md:123–128` states
  `occupied_beds: 567` and `preleased_beds: 573` with no `as_of_date` and no
  date for the pre-leased count. The calc-pack wiki
  (`docs/wiki/05-calc-packs.md:196–210`) says the two counts are deliberately
  separate because they are measured on different dates — the next academic
  year's pre-leasing against today's in-place occupancy — and a pack test pins
  that they differ.
- A conforming producer that states only declared fields therefore cannot make
  `occupancy` or `pre_lease_rate` evaluate, and a producer that copies the
  fixture states undeclared fields with no type, bound, or measurement date.
  StackUW hit this on 2026-09-28 while exporting a student-housing deal (its
  app-side note UPSTREAM-014).
- The validator has no rent-roll code family to extend. Roll-adjacent rules
  today are `CC-01` (`packages/uwmd-core/src/validator.ts:476–484`, a
  cross-section check), `REC-NN` (recoveries, §4.3 lines 1058–1091) and
  `LSE-NN` (lease clauses, §4.3 lines 1106–1131), each owned by the feature
  that introduced it. Protocol §III.6a (`spec/UW_PROTOCOL_v1.md:569–598`) is
  the registered-family table, and `npm run verify-codes` fails a family that
  is emitted but not registered there (check 3) and a rule bullet documented in
  the format spec but not emitted (check 2).

## Proposed change

### Format spec §4.3 (normative)

Two edits to `spec/UW_FORMAT_SPEC_v1.md`, both inside § 4.3 — Rent Roll.

**Template.** In the Multifamily Variant template (lines 849–920), insert four
keys after `"month_to_month_pct": 0.0,` (line 872) and before `"units": [`
(line 873). They default to `null` because, like the §4.1 size fields, a count
that does not apply is an absence and not a zero:

```json
  "month_to_month_pct": 0.0,
  "occupied_beds": null,
  "preleased_beds": null,
  "preleased_as_of": null,
  "preleased_term_start": null,
  "units": [
```

**Prose.** Insert the following paragraph after the template's closing fence
(line 920) and before `#### Commercial Variant` (line 922), in the style of
the "Expense recoveries and the CAM true-up (RFC 0058)" paragraph at line 1045:

> **Student-housing bed counts (RFC 0069).** `occupied_beds`, `preleased_beds`,
> `preleased_as_of` and `preleased_term_start` are OPTIONAL and meaningful when
> `asset_class` is `student_housing`; other classes SHOULD leave them `null` or
> absent. Student housing leases by the bed and re-leases nearly its whole roll
> on one date, so the roll carries two bed counts measured on different dates.
>
> - `occupied_beds` (integer, ≥ 0) — beds under a lease in place as of the
>   roll's `as_of_date`.
> - `preleased_beds` (integer, ≥ 0) — beds under a signed lease for the
>   academic term beginning `preleased_term_start`.
> - `preleased_as_of` (`YYYY-MM-DD`) — the date `preleased_beds` was measured.
> - `preleased_term_start` (`YYYY-MM-DD`) — the first day of the term
>   `preleased_beds` describes.
>
> When `preleased_beds` is stated, `preleased_as_of` and `preleased_term_start`
> MUST both be stated. The two counts are **stated, never derived**: pre-leasing
> describes a future term and never sets occupancy, and no validator may infer
> one from the other. `property.total_beds` (§4.1) remains the size field and
> the denominator of every per-bed metric (Protocol §XIII).
>
> - `BED-01` — a **warning** when `occupied_beds` or `preleased_beds` is not a
>   nonnegative integer, or exceeds `property.total_beds` when that field is
>   stated. Skipped, not refused, when `property.total_beds` is absent.
> - `BED-02` — a **warning** when `preleased_beds` is stated and either
>   `preleased_as_of` or `preleased_term_start` is absent or not a real date.
> - `BED-03` — a **warning** when `preleased_as_of` is on or after
>   `preleased_term_start`. A pre-leasing count measured after the term began
>   is an occupancy figure, not a pre-lease figure.
>
> These are warnings and MUST NOT be errors: a screening-stage roll legitimately
> states a bed count before the leasing office has dated it, and the
> `gaps` / provisional machinery already owns "not known yet". An institution
> wanting a hard gate expresses it through `INCOMPLETE_DATA_POLICIES`.

### Protocol §III.6a (normative)

Add one row to the registered-family table (`spec/UW_PROTOCOL_v1.md:569–598`):

| Prefix | Family | Owning capability | Default severity |
|---|---|---|---|
| `BED-NN` | Student-housing bed counts — in-place and pre-leased beds and the dates they were measured on (format §4.3, RFC 0069). Counts are stated, never derived from one another. | `validate` | `warning` |

### Library

`@uwmd/core` gains three validator rules (`BED-01`..`BED-03`) emitted from
`packages/uwmd-core/src/validator.ts`, with descriptions and remediation copy
registered beside the other families in `protocol.ts`. The change is
**additive**: no export changes shape, no pack formula changes, and
`STUDENT_HOUSING_PACK` is untouched. `UW_FORMAT_SPEC_v2.md` is a delta
specification that incorporates v1 Part IV by reference, so the v1 edit governs
2.0 files without a second edit. No JSON Schema declares `rent_roll`, so none
changes.

## Compatibility analysis

- **Existing `.uw.md` files** — none become invalid; every new field is
  optional and every new rule is a warning. The Mill Ave example states both
  counts today and would draw `BED-02` until it gains the two dates, which the
  reference implementation adds (below). A document that already states these
  names with some other meaning is not known to exist; the names were only ever
  read by this pack.
- **Tier-1 Reader** — unaffected; readers already surface unknown fields
  (Protocol §XII.2). Rendered summaries are unchanged unless a renderer chooses
  to show the counts.
- **Tier-2 Editor** — four more editable fields; no edit-semantics change.
- **Tier-3 Calc Host** — no formula changes. `occupancy` and `pre_lease_rate`
  evaluate exactly as they do today; the RFC declares the inputs they already
  read.
- **Tier-4 Agent Host** — none.
- **Modules** — no manifest schema change; `STUDENT_HOUSING_PACK` is unchanged.
- **Excel** — `packages/uwmd-excel/src/student-housing.ts:42–43` already
  carries `occupied_beds` and `preleased_beds` as `NamedInput`s
  (`format: 'count'`). `NamedInput.format` is `'currency' | 'count'`
  (`layout.ts:45`), so the two dates have no workbook representation and the
  layout does not change; exposing dates as workbook inputs is a separate,
  demand-gated change.

No deprecation path is needed: nothing breaks.

## Conformance impact

Existing fixtures to update:

- `conformance/tier-3-calc-host/fixtures/student-housing-pre-lease-rate/deal.uwx.md`
  gains `preleased_as_of` and `preleased_term_start` beside `preleased_beds`
  (line 63) so the corpus states the fields the way the spec now requires.
  `calc.json` and `expected-result.json` are unchanged (`0.95`).
- `examples/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` gains `as_of_date`,
  `preleased_as_of` and `preleased_term_start` in its roll (lines 123–128);
  the pack test that reads it keeps passing because the counts do not move.

New fixtures (tier-1 reader corpus, next free number 14, each with the four
standard baselines `.parsed.json`, `.rendered-chat.txt`,
`.rendered-summary.md`, `.validation.json`):

- `14-student-bed-counts.uwx.md` — a `student_housing` deal whose roll states
  all four fields consistently (`total_beds: 600`, `occupied_beds: 567`,
  `preleased_beds: 573`, `preleased_as_of: 2026-03-15`,
  `preleased_term_start: 2026-08-15`). Baseline: no `BED-*` issue.
- `15-student-bed-counts-inconsistent.uwx.md` — `preleased_beds: 620` over
  `total_beds: 600` with `preleased_as_of` after `preleased_term_start`, and
  `occupied_beds: 567` with no dates required. Baseline: `BED-01` and `BED-03`
  as warnings, zero errors; a second roll variant omitting `preleased_as_of`
  is not used, because a single-variant roll is the common case — instead the
  missing-date case is a unit test.

A `student_housing` document that states none of the fields (the tier-3
fixture `student-housing-pre-lease-rate` minus its `preleased_beds`) validates
with no `BED-*` issue and evaluates `occupancy` and `pre_lease_rate` to `null`
under Protocol §VIII.2 ("a missing path resolves to `null`"); that is asserted
as a unit test rather than a fixture, since the corpus already covers the null
path.

## Reference implementation

- **Files affected:** `spec/UW_FORMAT_SPEC_v1.md` (§4.3 template and prose
  above); `spec/UW_PROTOCOL_v1.md` (§III.6a row); `packages/uwmd-core/src/validator.ts`
  (three rules in a `checkStudentBedCounts` pass over the resolved `rent_roll`
  block, honoring RFC 0040 role selection through the existing
  `roleAwareDirectRead`); `packages/uwmd-core/src/protocol.ts` (descriptions
  and remediation copy); `docs/wiki/05-calc-packs.md` (link the fields to the
  pack in the `STUDENT_HOUSING_PACK` entry); the fixture and example listed
  above.
- **API surface:** none. No new export; no type change.
- **Test plan:** `validator.test.ts` cases for each rule firing and for each
  skip (no `total_beds`; non-student class stating the fields is not refused);
  the two new tier-1 fixtures with baselines; the existing
  `student-housing.test.ts` continues to pass; `npm run verify-codes` passes
  with the new family registered and all three codes emitted; `npm run
  conformance` passes.

The reference implementation lands with this RFC or in a linked follow-up PR;
the RFC is not `implemented` until it ships in a release with a CHANGELOG
entry.

## Alternatives considered

- **Per-floor-plan bed columns in the roll detail** (a `beds` array beside
  `units`, with per-type occupied and pre-leased counts). Richer, but a larger
  schema change with no consumer yet: no real student package has been run
  through the corpus. Deferred; the four totals are what the pack reads.
- **A single `pre_lease` object** (`{ beds, as_of, term_start }`). Keeps the
  three pre-leasing facts together, but the two counts are measured on
  different dates and one legitimately exists without the other; separate
  top-level fields match the flat roll-totals shape the template already uses
  and keep the pack formulas' paths unchanged.
- **Storing the ratios** (`occupancy`, `pre_lease_rate`) on the roll instead of
  the counts. The Mill Ave example does this today beside the counts. The pack
  computes the ratios deterministically; storing them invites disagreement
  with no check to catch it, which is the failure mode the calc engine exists
  to prevent.
- **Errors instead of warnings.** Refused for the same reason `CC-13` and
  `CC-14` are warnings (§5.3): a screening-stage document legitimately does
  not know these facts yet, and hard gates belong to `INCOMPLETE_DATA_POLICIES`.
- **Extending an existing family** (`CC-NN`, `LSE-NN`, `REC-NN`). `CC-NN` is
  reserved for two sections disagreeing about one fact; the others are owned by
  their features. A new family is how the protocol has registered every
  feature-scoped rule set since RFC 0008.

## Unresolved questions

- Whether `occupied_beds` should carry its own measurement date rather than
  rely on the roll's `as_of_date`. This RFC relies on `as_of_date`, which is
  what the roll's other in-place figures already do; a separate date can be
  added later without breaking anything.
- Whether `senior_housing`, which also states `total_beds` as a secondary size
  (§4.1 lines 790–793), should be allowed `occupied_beds` under this rule set.
  This RFC scopes the fields to `student_housing`; senior housing has no
  pre-leasing term and its pack does not read these names.

## Prior art

- RFC 0027 (asset-class size intensives) declared `total_beds` and Protocol
  §XIII made it the student-housing denominator; this RFC completes the
  roll-side pair the pack assumed.
- RFC 0058 and RFC 0055 are the pattern for adding optional §4.3 fields with a
  feature-scoped warning/error family and a §III.6a row.
- Industry practice (the NMHC/student-housing operators' pre-leasing reports)
  quotes pre-leasing as a percentage of beds for the coming academic year as of
  a stated date, which is exactly the pair `preleased_beds` /
  `preleased_as_of` records.
