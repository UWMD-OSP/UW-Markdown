---
rfc: 0069
title: Declare the student rent-roll bed counts and pre-leasing dates the student pack already reads
status: draft
author: claude-code (agent proposal)
created: 2026-09-28
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0069: Declare the student rent-roll bed counts and pre-leasing dates the student pack already reads

**Draft agent proposal.** A coding agent wrote this RFC. StackUW's
student-housing export and its app-side note UPSTREAM-014 are adopter
requirements evidence, not UWMD authority or owner authorship.

The owner recorded three decisions on 2026-10-01 that settle specific
validation semantics (see [Decision status](#decision-status)):

1. a stated bed count may not exceed `property.total_beds`;
2. a stated `preleased_beds` requires both pre-leasing dates;
3. a stated `occupied_beds` requires the roll's `as_of_date`.

The owner has not accepted the RFC as a whole: not the field names, the code
family, any Format or Protocol text, or implementation.

## Summary

`org.uwmd.pack.student_housing` computes `occupancy` as
`rent_roll.occupied_beds / property.total_beds` and `pre_lease_rate` as
`rent_roll.preleased_beds / property.total_beds`. The tier-3 fixture
`student-housing-pre-lease-rate` states `preleased_beds`. The format spec
declares neither field, and no field carries the date either count was
measured on.

This draft proposes four OPTIONAL §4.3 roll-total fields for
`student_housing` documents, and a registered `BED-NN` validator family:

- **An absent count is not an issue.** Incomplete screening data may omit the
  counts and the whole pre-leasing tuple.
- **A stated count must be a complete, well-typed fact.** It must be a
  nonnegative integer, within `property.total_beds`, and dated: the roll's
  `as_of_date` for `occupied_beds`, both pre-leasing dates for
  `preleased_beds`. Every violation is an error.

A producer could then state the fields without copying a fixture. Pack formulas
do not change.

## Motivation

Re-measured on `main` at `c1a807b` (2026-10-01). References name files, symbols
and spec sections rather than line numbers.

- **The fields are undeclared.** Format §4.1 declares `property.total_beds` and
  nothing else about beds. Its field notes call `total_beds` the primary size
  field for `student_housing` and a secondary for `senior_housing`, and say both
  classes carry two counts (RFC 0027). The §4.3 `rent_roll` Multifamily Variant
  template, which a `student_housing` roll uses (`rent_roll_type: multifamily`),
  states `as_of_date` and unit totals (`total_units` through
  `month_to_month_pct`) only. No file under `spec/` mentions `occupied_beds`,
  `preleased_beds` or a pre-leasing date.
- **The pack, fixture and example already use them.**
  - In `packages/uwmd-core/src/packs/student-housing.ts`, the `occupancy` and
    `pre_lease_rate` calculations read `rent_roll.occupied_beds` and
    `rent_roll.preleased_beds`.
  - `conformance/tier-3-calc-host/fixtures/student-housing-pre-lease-rate/`
    states `property.total_beds: 600` and `rent_roll.preleased_beds: 570`, and
    expects `0.95`.
  - The worked example `examples/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md`
    states `occupied_beds: 567` and `preleased_beds: 573` in its roll. It has no
    `as_of_date` and no date for the pre-leased count. Its roll also states
    fields the template does not declare: a `rent_roll.total_beds` that repeats
    `property.total_beds`, stored `occupancy` and `pre_lease_rate` ratios, and a
    `unit_mix` array with per-floor-plan `beds` and `occupied_beds` (the
    template's key is `unit_mix_summary`).
  - The calc-pack wiki (`docs/wiki/05-calc-packs.md`, `STUDENT_HOUSING_PACK`)
    says the two counts are deliberately separate because they are measured on
    different dates: next academic year's pre-leasing against today's in-place
    occupancy. `student-housing.test.ts` asserts that they differ.
- **The consequence.** A conforming producer that states only declared fields
  cannot make `occupancy` or `pre_lease_rate` evaluate. A producer that copies
  the fixture states undeclared fields with no type, bound or measurement date.
  StackUW reported this on 2026-09-28 while exporting a student-housing deal (its
  note UPSTREAM-014).
- **No family to extend.** The validator has no rent-roll code family. The
  roll-adjacent rules today are:
  - `CC-01`, a cross-section check;
  - `REC-NN`, expense recoveries (RFC 0058);
  - `LSE-NN`, lease clauses (RFC 0055).

  The last two are each owned by the feature that introduced them. Protocol
  §III.6a is the registered-family table. `npm run verify-codes` fails when an
  emitted family is not registered there, or when a rule bullet in the format
  spec is not emitted.

## Proposed change

Everything in this section is a proposal. None of it is accepted.

### Format spec §4.3 (normative, proposed)

**Template.** In the Multifamily Variant template of `spec/UW_FORMAT_SPEC_v1.md`
§4.3, insert four keys after `"month_to_month_pct"` and before `"units"`. They
default to `null` because, like the §4.1 size fields, a count that does not
apply is an absence and not a zero:

```json
  "month_to_month_pct": 0.0,
  "occupied_beds": null,
  "preleased_beds": null,
  "preleased_as_of": null,
  "preleased_term_start": null,
  "units": [
```

**Prose.** Insert the following after the Multifamily Variant template and
before `#### Commercial Variant`, in the style of the RFC 0058 "Expense
recoveries and the CAM true-up" paragraph:

> **Student-housing bed counts (RFC 0069).** `occupied_beds`, `preleased_beds`,
> `preleased_as_of` and `preleased_term_start` are OPTIONAL. They are
> meaningful when `asset_class` is `student_housing`; other classes SHOULD
> leave them `null` or absent. Student housing leases by the bed and re-leases
> nearly its whole roll on one date, so the roll carries two bed counts
> measured on different dates.
>
> - `occupied_beds` (integer, ≥ 0) — beds under a lease in place as of the
>   roll's `as_of_date`.
> - `preleased_beds` (integer, ≥ 0) — beds under a signed lease for the
>   academic term that begins on `preleased_term_start`, counted as of
>   `preleased_as_of`.
> - `preleased_as_of` (`YYYY-MM-DD`) — the date `preleased_beds` was measured.
> - `preleased_term_start` (`YYYY-MM-DD`) — the first day of the term
>   `preleased_beds` describes. The term is in the future relative to
>   `preleased_as_of`, not relative to the date a tool reads the file.
>
> The fields are optional as a group. A roll may omit either count, and with
> `preleased_beds` the whole pre-leasing tuple. A count that is stated is a
> complete typed fact only with its measurement date:
>
> - A stated `occupied_beds` MUST be accompanied by the roll's `as_of_date` as a
>   real date.
> - A stated `preleased_beds` MUST be accompanied by both `preleased_as_of` and
>   `preleased_term_start`.
>
> The two counts are **stated, never derived**. Pre-leasing never sets
> occupancy, neither count is inferred from the other, and no rule compares the
> two. `property.total_beds` (§4.1) remains the size field and the denominator
> of every per-bed metric (Protocol §XIII.1). Neither count may exceed it.
>
> An absent count is not an issue. A roll that omits a count draws no `BED-*`
> issue for it, and a pack metric over an absent count resolves to `null`
> (Protocol §VIII.2). Stage requirements for absent facts belong to
> incomplete-data policies, not to this family. A pre-leasing date stated
> without `preleased_beds` is inert context: it must still be a real date, and
> the pair must still be in order, but it requires nothing else. Every rule
> compares stated values with each other, never with the current date or file
> metadata.
>
> - `BED-01` — **error** when a stated `occupied_beds` or `preleased_beds` is
>   not a finite, nonnegative integer. This is checked whether or not
>   `property.total_beds` is stated.
> - `BED-02` — **error** when a valid `occupied_beds` or `preleased_beds`
>   exceeds `property.total_beds`. The comparison runs only when
>   `property.total_beds` is a finite number. Otherwise only this comparison is
>   skipped; `CC-13` already reports an absent or non-numeric primary size
>   field.
> - `BED-03` — **error** when `occupied_beds` is stated and the roll's
>   `as_of_date` is absent or not a real `YYYY-MM-DD` date.
> - `BED-04` — **error** when `preleased_beds` is stated and `preleased_as_of`
>   or `preleased_term_start` is absent.
> - `BED-05` — **error** when a stated `preleased_as_of` or
>   `preleased_term_start` is not a real `YYYY-MM-DD` date. This is checked
>   whenever the date is stated, with or without `preleased_beds`.
> - `BED-06` — **error** when both pre-leasing dates are real and
>   `preleased_as_of` is on or after `preleased_term_start`. A count measured on
>   or after the day the term began describes occupancy, not pre-leasing.

### Why each condition is treated this way

| Condition | Proposed | Basis |
|---|---|---|
| A count is absent because underwriting is incomplete | No `BED-*` issue; the metric resolves to `null` | New §4.3 fields are OPTIONAL and absence is unchanged ("a tenant stating none of them is unchanged", RFC 0055/0058). Stage gating of absent data is `IncompleteDataPolicy` (`halt`, `degrade`, `substitute`, `defer` per section, field and stage); its built-in `rent_roll` entries already degrade at screening and halt at full underwrite. |
| A stated count is non-numeric, non-integer, non-finite or negative | `BED-01` error | Feature families refuse a stated value that breaks its typed contract: `REC-01` (fractions out of range), `LSE-09` (amounts finite and nonnegative). |
| A valid count exceeds `property.total_beds` | `BED-02` error, for either count | **Owner decision 1.** `property.total_beds` is the normative student-housing size denominator the pack uses. A future-phase capacity is not admitted through a warning; representing it needs its own explicit contract. In-family bounds are errors elsewhere too (`LSE-09`, `REC-07`). |
| `occupied_beds` stated without a real roll `as_of_date` | `BED-03` error | **Owner decision 3.** `occupied_beds` is defined as measured on `as_of_date`, so a count without it is not a complete typed fact. A malformed `as_of_date` leaves the count just as undated, so it falls under the same rule. No `BED-*` rule checks `as_of_date` when `occupied_beds` is absent; that remains a general roll field. |
| `preleased_beds` stated, a pre-leasing date absent | `BED-04` error | **Owner decision 2.** MUST plus error, as `LSE-03`, `LSE-06` and `LSE-08` treat required companion fields. The tuple as a whole stays optional. |
| A stated pre-leasing date is not a real `YYYY-MM-DD` date | `BED-05` error | `REC-04`, `LSE-01`, `LSE-04` and `CAPX-01` refuse a stated non-date. |
| `preleased_as_of` ≥ `preleased_term_start` | `BED-06` error | Date-order contracts are errors: `REC-05` (a true-up ends strictly before the roll's `as_of_date`) and `LSE-02` (steps inside the lease term). |
| A pre-leasing date stated without `preleased_beds` | No requirement beyond `BED-05`/`BED-06` | Inert context. Nothing in the existing contract requires a count to accompany a date, and the pack reads only the counts. No rule is added for symmetry. |

### Protocol §III.6a (normative, proposed)

Add one row to the registered-family table:

| Prefix | Family | Owning capability | Default severity |
|---|---|---|---|
| `BED-NN` | Student-housing bed counts — in-place and pre-leased beds and the dates they were measured on (format §4.3, RFC 0069). Counts are stated, never derived from one another. | `validate` | `error` |

**One family.** A feature-scoped family is how §III.6a registers rule sets
such as `REC-NN`, `LSE-NN` and `CAPX-NN`. Every `BED-NN` code is an error,
because each one refuses a stated value that is malformed, out of bounds, or
missing its required companion. Absence of a count emits nothing, so the family
never reports incomplete underwriting.

### Library (proposed)

`@uwmd/core` would gain six validator rules (`BED-01`..`BED-06`), emitted from
`packages/uwmd-core/src/validator.ts` beside the other feature families. Each
issue's message is its description, as with `REC-NN` and `LSE-NN`; there is no
separate description registry in `protocol.ts`.

The change is **additive**: no export changes shape, no pack formula changes,
and `STUDENT_HOUSING_PACK` is untouched. `UW_FORMAT_SPEC_v2.md` is a delta
specification that incorporates v1 Part IV by reference, so the v1 edit
governs 2.0 files without a second edit. No JSON Schema declares `rent_roll`,
so none changes.

Because `verify-codes` fails a format-spec rule bullet that nothing emits, the
§4.3 bullets and the validator rules must land in the same change.

## Compatibility analysis

- **Existing `.uw.md` files** — absent fields draw nothing, so a document that
  never states a count is unaffected. A document that states a count must now
  state it completely:
  - The Mill Ave example states both counts as integers within `total_beds`,
    but its roll has no `as_of_date` and no pre-leasing dates. Under this
    proposal it would draw `BED-03` and `BED-04` errors. The reference
    implementation therefore adds those dates to it in the same change.
  - The tier-3 fixture `student-housing-pre-lease-rate` states
    `preleased_beds` without dates. Tier-3 cases evaluate the calculation
    only, so its expected result does not move. The implementation still adds
    the dates, so the corpus never shows a count the validator would refuse.
  - Any other document stating these previously undeclared names without
    their dates, or with a malformed value, would gain errors. None is known
    in the corpus. An adopter export (UPSTREAM-014) would need to state the
    dates alongside the counts, or omit the counts.
- **Tier-1 Reader** — unaffected. The parser already carries undeclared
  content keys, which is how the pack reads these fields today. Rendered
  summaries are unchanged unless a renderer chooses to show the counts.
- **Tier-2 Editor** — four more editable fields; no edit-semantics change.
- **Tier-3 Calc Host** — no formula changes. `occupancy` and `pre_lease_rate`
  evaluate exactly as they do today; the draft declares the inputs they already
  read. A `BED-*` error is a validation result and does not change calc
  evaluation.
- **Tier-4 Agent Host** — none.
- **Modules** — no manifest schema change; `STUDENT_HOUSING_PACK` is
  unchanged.
- **Excel** — `packages/uwmd-excel/src/student-housing.ts` already carries
  `occupied_beds` and `preleased_beds` as `NamedInput`s (`format: 'count'`).
  `NamedInput.format` is `'currency' | 'count'` (`layout.ts`), so the dates
  have no workbook representation and the layout does not change. Exposing
  dates as workbook inputs is a separate, demand-gated change. Excel ↔ calc
  parity is unaffected because no formula or input path changes.

No deprecation path is needed: the fields were never declared, so no conforming
document relied on an undated count.

## Conformance impact

Existing files the reference implementation would update in the same change:

- `conformance/tier-3-calc-host/fixtures/student-housing-pre-lease-rate/deal.uwx.md`
  gains `preleased_as_of` and `preleased_term_start` beside `preleased_beds`.
  `calc.json` and `expected-result.json` are unchanged (`0.95`).
- `examples/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` gains `as_of_date`,
  `preleased_as_of` and `preleased_term_start` in its roll. The pack test that
  reads it keeps passing because the counts do not move. The example's other
  undeclared roll fields are outside this RFC and are neither declared nor
  read here.

Proposed new tier-1 reader fixtures (next free numbers 14 and 15), each with
the four standard baselines (`.parsed.json`, `.rendered-chat.txt`,
`.rendered-summary.md`, `.validation.json`):

- `14-student-bed-counts.uwx.md` — a `student_housing` deal whose roll states
  everything consistently: `as_of_date: 2026-03-15`, `total_beds: 600`,
  `occupied_beds: 567`, `preleased_beds: 573`, `preleased_as_of: 2026-03-15`,
  `preleased_term_start: 2026-08-15`. Baseline: no `BED-*` issue.
- `15-student-bed-counts-inconsistent.uwx.md` — the same roll with
  `preleased_beds: 620` over `total_beds: 600` and `preleased_as_of` after
  `preleased_term_start`. Baseline: `BED-02` and `BED-06` errors, and nothing
  for the valid, dated `occupied_beds`.

Unit tests (`validator.test.ts`) would pin each condition separately:

- **`BED-01`.** A string, a fraction, a negative and a non-finite count each
  error, including **when `property.total_beds` is absent**. That absence skips
  only `BED-02`.
- **`BED-02`.** Each count at, above and below the total; skipped when
  `total_beds` is absent or non-numeric.
- **`BED-03`.** `occupied_beds` with no `as_of_date`, and with a malformed one;
  no issue for a malformed `as_of_date` when `occupied_beds` is absent.
- **`BED-04`.** `preleased_beds` missing each date in turn, and both.
- **`BED-05`.** A malformed pre-leasing date stated with `preleased_beds`, and
  without it.
- **`BED-06`.** Equality and later, with and without `preleased_beds`; no
  `BED-06` when either date is invalid, since `BED-05` covers that.
- **Inert dates.** Valid, ordered pre-leasing dates with no `preleased_beds`
  draw no issue.
- **Absent counts.** No `BED-*` issue for a roll stating none of the fields,
  and `occupancy` and `pre_lease_rate` evaluate to `null` (Protocol §VIII.2).
  No issue for a non-student class that states nothing, or states valid, dated
  counts.
- **No cross-comparison.** No rule ever compares `occupied_beds` with
  `preleased_beds`, or either with the current date.

## Reference implementation (if accepted)

This draft authorizes no implementation. If accepted, the implementation would
land with the acceptance or in a linked follow-up PR. The RFC would not be
`implemented` until it ships in a release with a CHANGELOG entry.

**Files likely affected:**

- `spec/UW_FORMAT_SPEC_v1.md` (§4.3 template and prose);
- `spec/UW_PROTOCOL_v1.md` (§III.6a row);
- `packages/uwmd-core/src/validator.ts` (a `checkStudentBedCounts` pass over
  the resolved `rent_roll` block, honoring RFC 0040 role selection through the
  existing `roleAwareDirectRead`);
- `docs/wiki/05-calc-packs.md` (link the fields from the
  `STUDENT_HOUSING_PACK` entry);
- the fixture and example listed above.

**API surface:** none. No new export and no type change.

**Test plan:**

- the unit tests above;
- the two new tier-1 fixtures with baselines;
- the existing `student-housing.test.ts`, unchanged;
- `npm run verify-codes`, with the new family registered and all six codes
  emitted;
- `npm run conformance`.

## Alternatives considered

- **Per-floor-plan bed columns in the roll detail.** A `beds` array beside
  `units`, with per-type occupied and pre-leased counts. The Mill Ave example
  already carries an undeclared per-type `unit_mix`, so there is some producer
  shape to learn from. But it is a larger schema change and the pack reads
  only totals. Deferred.
- **A single `pre_lease` object** (`{ beds, as_of, term_start }`). Keeps the
  three pre-leasing facts together. But the pack already reads the flat path
  `rent_roll.preleased_beds`. Separate top-level fields match the flat
  roll-totals shape the template already uses and keep the pack formulas'
  paths unchanged. `BED-04` gives the flat fields the same all-or-nothing
  completeness an object would.
- **Storing the ratios** (`occupancy`, `pre_lease_rate`) on the roll instead of
  the counts. The Mill Ave example does this today beside the counts. The pack
  computes the ratios deterministically. Storing them invites disagreement with
  no check to catch it, which is the failure mode the calc engine exists to
  prevent.
- **A warning for a pre-leased count above `total_beds`**, to allow for a phase
  delivering before the coming term. Rejected by owner decision 1:
  `property.total_beds` is the denominator, and future capacity needs its own
  explicit contract rather than a warning.
- **SHOULD plus a warning for missing pre-leasing dates**, as in an earlier
  revision of this draft. Rejected by owner decision 2: an undated pre-leased
  count is not a complete fact, and the tuple's optionality already covers
  incomplete screening data.
- **No date requirement for `occupied_beds`.** Rejected by owner decision 3:
  the count is defined as measured on the roll's `as_of_date`.
- **All warnings.** This was the original draft's choice. It would let a
  malformed typed value (a negative or fractional bed count, a non-date)
  through as advisory, unlike every other feature family's typed-field rules,
  and it paired RFC 2119 MUST with a warning.
- **A count required whenever a pre-leasing date is stated.** Not adopted.
  Nothing in the existing contract requires it, the pack reads only the counts,
  and a rule added only for symmetry would refuse harmless context.
- **Extending an existing family** (`CC-NN`, `LSE-NN`, `REC-NN`). `CC-NN` is
  for two sections disagreeing about one fact, and the others are owned by
  their features. A new feature-scoped family is how §III.6a has registered
  rule sets since RFC 0008 (`LU-NN`).

## Unresolved questions

- **Senior housing.** Whether `senior_housing`, which also states `total_beds`
  as a secondary size (§4.1), should be allowed `occupied_beds` under this rule
  set. The draft scopes the fields to `student_housing`. Senior housing has no
  pre-leasing term, and its pack does not read these names.
- **Mixed-use components.** Whether the fields apply to a `student_housing`
  component of a `mixed_use` deal (Format §4.23), whose component metrics are
  read under `components.student_housing`.
- **Other classes stating the fields.** Whether a non-student class stating
  them should draw an `info` issue rather than nothing. The typed rules apply
  whenever the fields are stated.
- **Future capacity.** If a phase delivering before the coming term must be
  represented, that needs its own explicit contract (owner decision 1). This
  draft does not propose one.

## Decision status

RFC 0069 remains `draft`. The owner decisions below settle specific semantics;
they do not accept the RFC.

| Item | Source | State |
|---|---|---|
| `property.total_beds` is the student-housing size field and per-bed denominator | Format §4.1, Protocol §XIII.1 (RFC 0027) | Existing normative rule. Unchanged. |
| Pack formulas for `occupancy` and `pre_lease_rate` | `STUDENT_HOUSING_PACK` | Existing. Unchanged. |
| A stated `occupied_beds` or `preleased_beds` may not exceed `property.total_beds`; both are errors (`BED-02`); no future-phase exception through a warning | Owner decision 1, 2026-10-01 | Decided. Future capacity needs its own contract. |
| A stated `preleased_beds` requires `preleased_as_of` and `preleased_term_start`: MUST plus error (`BED-04`); the tuple stays optional | Owner decision 2, 2026-10-01 | Decided. |
| A stated `occupied_beds` requires the roll's `as_of_date`; a missing companion date is an error (`BED-03`) | Owner decision 3, 2026-10-01 | Decided. Treating a malformed `as_of_date` the same way is this draft's reading of that decision. |
| The four field names, types and date semantics | This draft | Proposal. |
| One `BED-NN` family, every code an error | This draft, following §III.6a precedent | Proposal. |
| Malformed counts and dates are errors; an absent count is not an issue; dates without a count are inert | This draft, following feature-family convention | Proposal. |
| Format, Protocol, validator, fixture and example changes | This draft | Proposal. None made. |
| Acceptance of RFC 0069 as a whole, and implementation | — | Not decided. Not authorized. |

## Prior art

- RFC 0027 (asset-class size intensives) declared `total_beds`, and Protocol
  §XIII.1 made it the student-housing denominator. This draft completes the
  roll-side pair the pack assumed.
- RFC 0055 and RFC 0058 are the pattern for optional §4.3 fields with a
  feature-scoped family, a §III.6a row and typed-contract errors.
- Student-housing operators commonly report pre-leasing as a share of beds for
  the coming academic year as of a stated date. That is the pair
  `preleased_beds` / `preleased_as_of` records. No specific report is cited.
