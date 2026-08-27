---
rfc: 0029
title: Make stage requirements class-aware
status: implemented
author: jaredmaxey
created: 2026-08-26
accepted: 2026-08-26
implemented: 2026-08-26
affects:
  - format-spec
  - core-library
  - conformance-corpus
---

# RFC 0029: Make stage requirements class-aware

> **Accepted and implemented 2026-08-26**, as proposed. The two deferred
> questions (land-specific `dcf`/`stress_tests` treatment; an author-stated
> consolidated mixed-use operating statement) remain open for future
> evidence. The conformance fixtures landed in the Tier-1 valid set as this
> RFC preferred, pinning the exemption, the substitution, and the office
> control through the frozen validation verdicts.

## Summary

Format spec §5.1's per-stage required-section lists are class-agnostic, so a
land deal is required to produce a `rent_roll` — a section raw land cannot
honestly have — before it may declare `full_underwrite`, and a mixed-use deal
is required to produce a property-level `rent_roll` that would wrongly
duplicate the per-component income detail its `components` section already
carries. RFC 0028 made these requirements visible (`DQ-06`,
`stage_readiness`); this RFC makes them true.

The proposal is one small normative **overlay table** in §5.1, mirrored by an
executable registry in core (the RFC 0027 pattern: declare per-class
variation once): `land` is **exempt** from `rent_roll` and
`operating_statement` at every stage, and `mixed_use` **substitutes**
`components` for both. Every other class keeps the base lists unchanged —
including hospitality, whose `rent_roll` section already carries
keys/ADR/segmentation rather than unit rents, the existing precedent that a
section id is a class-neutral container.

## Motivation

Found by doing, twice:

1. **The RFC 0028 example cleanup could not make the land and mixed-use
   examples honest at their real depth.** `Sundance-Ranch-Land-Buckeye-AZ`
   carries a NOI carry model, valuation, debt, sources & uses, and a DCF —
   real underwriting depth — but had to restage to `screening`, because no
   stage above `screening` is declarable without a `rent_roll` and raw land
   has no tenants. `Roosevelt-Row-MixedUse-Phoenix-AZ` restaged for the same
   reason while its `components` section holds exactly the income detail the
   requirement wants, per use, as RFC 0019 designed. The workaround is
   recorded in `docs/wiki/13-status.md` with this RFC named as the fix.

2. **The requirement contradicts decisions the project already made.**
   RFC 0019 ruled that mixed-use income lives per-component in `components`
   (`CC-12` foots the property NOI from component NOIs), and the `LAND_PACK`
   deliberately computes no income-tenancy metrics at all — the format
   already knows these classes diverge; §5.1 is the one table that was never
   told.

3. **The scan evidence.** Every class but two reuses the base sections with
   class-appropriate payloads (the hotel example's `rent_roll` is
   keys/ADR/segmentation; senior housing's is unit/acuity mix) — reuse
   works. Only `land` (a section that cannot exist) and `mixed_use` (a
   section that must not exist at property level, per MU-design) genuinely
   diverge. The overlay is therefore two rows, not a matrix.

## Proposed change

### 1. §5.1 gains a normative overlay table

After the base per-stage table, add:

> **Class overlays.** The base lists assume an income property with direct
> tenancy. Two asset classes diverge structurally, and for them the
> requirements are adjusted as follows — exhaustively; an asset class not
> listed here (including an unrecognized one) takes the base lists verbatim:
>
> | `asset_class` | Adjustment |
> |---|---|
> | `land` | `rent_roll` and `operating_statement` are **exempt** at every stage: raw land has no tenancy and no operating statement — its carry lives in `noi_model` and `dcf`, and nothing stands in for the exempted sections. |
> | `mixed_use` | `components` **substitutes** for `rent_roll` and `operating_statement`: wherever a stage's base list requires either, the requirement is satisfied by (and only by) a `components` section — which RFC 0019 §4.23 already makes the home of per-component income and operating detail. |
>
> A substitution is checkable — the substitute section is *required* at the
> stage where the replaced section would have been — where an exemption
> simply removes the requirement. Section ids remain class-neutral
> containers otherwise: hospitality's `rent_roll` carries
> keys/ADR/segmentation, senior housing's carries unit/acuity mix, and no
> overlay entry exists for them because reuse is the design, not a gap.

### 2. Core mirrors it once (`validator.ts`)

```ts
export const STAGE_SECTION_OVERLAYS: Partial<Record<AssetClass, {
  exempt?: readonly string[];
  substitute?: Readonly<Record<string, string>>;
}>> = {
  land:      { exempt: ['rent_roll', 'operating_statement'] },
  mixed_use: { substitute: { rent_roll: 'components', operating_statement: 'components' } },
};
```

One resolution function (`requiredSectionsFor(stage, asset_class)`) applies
the overlay to the base list, deduplicating a substitute that replaces two
sections. **Both consumers use it**: `computeStageReadiness` and the RFC 0028
`DQ-06` check — the booleans and the issues stream must never disagree about
what a stage requires. `CC-14` is untouched: `property` is never exempt for
any class. An unrecognized `asset_class` (or none) takes the base lists.

- **Files affected:** `packages/uwmd-core/src/validator.ts` (the registry,
  the resolver, both consumers); `validator.section-readiness.test.ts`
  (new cases); spec §5.1; conformance fixtures below.
- **API surface:** `STAGE_SECTION_OVERLAYS` and `requiredSectionsFor`
  exported from `validator.ts`; whether they join `index.ts` follows the
  existing precedent of `STAGE_REQUIREMENTS` (export where it is exported,
  not otherwise).
- Additive; no deprecation.

## Compatibility analysis

- **Existing files:** pure relaxation — no document that validates today
  stops validating, and no code fires that did not fire. For `land` and
  `mixed_use` documents, some `DQ-06` info notes disappear and
  `stage_readiness` booleans can flip `false → true`. Neither is pinned by
  any receipt, digest, or Tier-1 baseline (`stage_readiness` is not part of
  the frozen validation verdict, which records codes and severities only —
  a mixed-use or land Tier-1 fixture with a `DQ-06` baseline entry would
  regenerate, and none exists today).
- **Tier-1 Readers:** must consult the overlay when computing readiness or
  emitting `DQ-06`; a reader that ignores it over-reports info-severity
  gaps, which is the pre-RFC behavior — nonconforming but not dangerous.
- **Tiers 2–4, modules, receipts, Excel:** untouched; no number moves.
- **The mixed-use substitution tightens nothing today**: a `mixed_use`
  document without `components` already refuses (`MU-01` machinery requires
  ≥2 components), so requiring `components` at `full_underwrite` cannot
  newly reject any currently-valid document.

## Conformance impact

New fixtures (a `stage-overlay` addition to the tier-1 valid set or a small
named group — implementation's choice, with the tier-1 valid set preferred
because its validation-verdict baselines freeze exactly the assertion
wanted):

- A land deal at `full_underwrite` with no `rent_roll`/`operating_statement`
  but the rest of the list: **zero `DQ-06`**, and `stage_readiness.full_underwrite`
  true.
- A mixed-use deal at `full_underwrite` whose `components` satisfies the
  substitution: zero `DQ-06` for the substituted sections.
- A control: an office deal missing `rent_roll` at `full_underwrite` still
  gets its `DQ-06` — the overlay is two rows, not a loophole.

Existing fixtures: none change — the capital-stack `agree`/`mismatch` pair
and the RFC 0028 malformed fixture use multifamily/office shapes the overlay
does not touch.

Follow-up (not gating): `Sundance-Ranch-Land-Buckeye-AZ` and
`Roosevelt-Row-MixedUse-Phoenix-AZ` may restage upward once the overlay
lands — to the stage their contents then satisfy, which for both still means
first adding `borrower_sponsor` / `preliminary_sizing` / `market_analysis`
for anything above `term_sheet`'s neighborhood. Restaging is example
authoring, not protocol work.

## Reference implementation

Registry + resolver + two consumer edits + tests, sized like RFC 0027's core
change. Test plan: the resolver against all seven stages × {land, mixed_use,
office, unrecognized}; the substitution-dedup (two replaced sections, one
`components` requirement); `DQ-06` and `stage_readiness` agreement pinned by
a test that diffs their verdicts over the same documents; `CC-14` still
fires on a property-less land deal.

## Alternatives considered

- **Full per-class requirement matrices** (each class declares its own seven
  lists). Ten near-identical copies of the base table that can drift
  independently — the exact shape RFC 0027 §XIII was built to avoid. The
  overlay expresses the two real divergences in two rows.
- **Drop `rent_roll` from the base lists entirely.** Under-requires the
  eight classes where direct tenancy is the business; the info-severity gap
  reports would stop naming the most load-bearing missing section.
- **A `not_applicable` marker in the document** (author writes
  `rent_roll: null` with a reason). Moves a class-structural fact into every
  instance document, invites boilerplate, and leaves the requirement wrong
  by default. Class structure belongs to the class, not the file.
- **Leave it: `screening` is good enough for land/mixed-use.** Caps two
  classes' declarable stage below their actual underwriting depth forever,
  and makes `deal_stage` mean different things per class — the opposite of
  what RFC 0028 established.

## Unresolved questions

- Whether `dcf`/`stress_tests` at `credit_approval` want land-specific
  treatment (a land carry stresses differently). No evidence yet; the
  overlay table is the natural home if one emerges.
- Whether `operating_statement`'s mixed-use substitution should *also*
  accept a consolidated property-level statement when an author states one.
  Deferred: CC-12 foots NOI from components, and a second statement is a
  second thing to reconcile.

## Prior art

- **RFC 0027** — the declare-per-class-variation-once registry pattern and
  its "no silent per-consumer re-derivation" rationale, reused directly.
- **RFC 0019 §4.23** — establishes `components` as the mixed-use income
  home, which is what makes the substitution well-defined.
- JSON Schema's conditional `required` (`if`/`then`) solves the same shape —
  requirements that depend on a discriminating field — and is why the
  overlay is keyed on `asset_class` rather than free-form predicates.
