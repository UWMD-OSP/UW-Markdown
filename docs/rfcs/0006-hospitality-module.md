---
rfc: 0006
title: Hospitality reference module
status: draft
author: jaredmaxey
created: 2026-04-26
affects:
  - core-library
  - conformance-corpus
---

# RFC 0006: Hospitality reference module

## Summary

The protocol's module system has been specified ([Part X](../../spec/UW_PROTOCOL_v1.md))
and a worked example is sketched in Appendix E, but no module has actually
been built. This RFC commits to shipping `@uwmd/module-hospitality` as
the reference implementation of a module — the worked example, fully
realized — so that the module-system contract is exercised end-to-end
and so that hospitality (hotels, motels, extended-stay) becomes a
first-class supported asset class.

## Motivation

Two reasons to do this now:

1. **The module system has no consumer.** [`ModuleManifest`](../../packages/uwmd-core/src/protocol.ts:292),
   `ModuleSectionDecl`, `ModuleCalcDecl`, etc., are all defined in the
   protocol surface but never loaded by any code that ships. Until a
   real module exercises the loader, every assumption baked into the
   types is unverified.

2. **Hospitality is a real adopter ask.** The asset class `hospitality`
   exists in the v1 enum, but the standard sections (`property`,
   `noi_model`, etc.) lack the fields hotel underwriting actually needs:
   ADR, occupancy, RevPAR, STR comps, F&B revenue, complimentary breakfast
   cost, brand fees. A hotel deal authored against the v1 standard sections
   has to stuff hotel-specific fields into `noi_model.other_income` and
   lose the structure.

This RFC ships the module *and* uses the build process to discover any
module-system bugs that need fixing in `@uwmd/core` first.

## Proposed change

### New package: `@uwmd/module-hospitality`

```
packages/uwmd-module-hospitality/
├── package.json
├── manifest.yaml          # the canonical module manifest
├── manifest.json          # generated from manifest.yaml at build time
├── src/
│   ├── index.ts           # re-exports the manifest as a typed object
│   └── view-models.ts     # SectionViewModel definitions for hotel sections
├── README.md
└── test/
    └── fixtures/
        └── boutique-hotel-austin.uw.md
```

### Manifest contents

```yaml
manifest_version: "1"
id: org.uwmd.hospitality
name: Hospitality Underwriting Module
version: 0.1.0
description: |
  Adds hotel-specific sections (operating metrics, brand fees, F&B),
  RevPAR/ADR/occupancy calculations, and STR-comp validations.
authors: ["UW Markdown contributors"]
license: MIT
requires_protocol: ">=1.0.0 <2.0.0"
requires_format: ">=1.1 <2.0"
requires_tier: tier-3-calc-host
asset_classes: [hospitality]

sections:
  - id: hotel_metrics
    display_name: Hotel Operating Metrics
    schema:
      type: object
      required: [adr, occupancy, available_room_nights, key_count]
      properties:
        adr:                   { type: number, minimum: 0 }
        occupancy:             { type: number, minimum: 0, maximum: 1 }
        available_room_nights: { type: integer, minimum: 0 }
        key_count:             { type: integer, minimum: 0 }
        market_revpar:         { type: [number, "null"] }
    required: true

  - id: hotel_brand
    display_name: Brand & Franchise
    schema:
      type: object
      properties:
        flag:                       { type: [string, "null"] }
        franchise_fee_pct_of_rooms: { type: number, minimum: 0, maximum: 0.20 }
        marketing_fund_pct:         { type: number, minimum: 0, maximum: 0.10 }
        loyalty_program_pct:        { type: number, minimum: 0, maximum: 0.10 }

  - id: hotel_food_beverage
    display_name: Food & Beverage
    schema:
      type: object
      properties:
        fb_revenue:             { type: number, minimum: 0 }
        fb_cogs:                { type: number, minimum: 0 }
        fb_labor:               { type: number, minimum: 0 }
        complimentary_breakfast_cost_per_occupied_room: { type: number, minimum: 0 }

calculations:
  - id: revpar
    label: RevPAR
    formula: hotel_metrics.adr * hotel_metrics.occupancy
    unit: "$"
    deterministic: true
  - id: total_room_revenue
    label: Total Room Revenue
    formula: hotel_metrics.adr * hotel_metrics.occupancy * hotel_metrics.available_room_nights
    unit: "$"
    deterministic: true
  - id: room_revenue_per_key
    label: Room Revenue / Key
    formula: total_room_revenue / hotel_metrics.key_count
    unit: "$"
    deterministic: true
  - id: revpar_index
    label: RevPAR Index vs Market
    formula: revpar / hotel_metrics.market_revpar
    unit: "x"
    deterministic: true
  - id: fb_gross_margin
    label: F&B Gross Margin
    formula: (hotel_food_beverage.fb_revenue - hotel_food_beverage.fb_cogs - hotel_food_beverage.fb_labor) / hotel_food_beverage.fb_revenue
    unit: "%"
    deterministic: true

validations:
  - code: CC-MOD-HOSP-01
    severity: warning
    message: "RevPAR is more than 15% below market RevPAR — verify pricing strategy or comp set."
    rule: hotel_metrics.market_revpar == null || revpar >= hotel_metrics.market_revpar * 0.85
  - code: CC-MOD-HOSP-02
    severity: error
    message: "Occupancy must be between 0 and 1 (use a fraction, not a percentage)."
    rule: hotel_metrics.occupancy >= 0 && hotel_metrics.occupancy <= 1
  - code: CC-MOD-HOSP-03
    severity: warning
    message: "Total franchise fee burden exceeds 13% of room revenue — confirm flag economics."
    rule: |
      (hotel_brand.franchise_fee_pct_of_rooms + hotel_brand.marketing_fund_pct + hotel_brand.loyalty_program_pct) <= 0.13

view_models:
  # Section-by-section layout for hotel_metrics, hotel_brand, hotel_food_beverage.
  # Defined in src/view-models.ts and re-exported through the manifest at build time.
```

### Loader changes in `@uwmd/core`

Most of the loader infrastructure exists as types but not as code:

- `loadModule(manifest: ModuleManifest, options): ModuleRegistry` — registers sections, calcs, validations, view models.
- `validateAgainstModule(parsed, registry): ValidationResult` — runs both built-in validators *and* the module's `validations`.
- `evaluateCalc` already accepts a `ModuleCalcDecl` — needs an extension to resolve `formula` references that cross the module's declared sections (`hotel_metrics.adr`).

### Test fixtures

`packages/uwmd-module-hospitality/test/fixtures/boutique-hotel-austin.uw.md`
is a complete hotel deal: 80 keys, $180 ADR, 72% occupancy, Marriott
Autograph flag, full F&B program. The test suite:

1. Loads the manifest into a registry.
2. Parses the fixture file, which references the module via frontmatter.
3. Validates: expects no errors, two warnings (intentional — fixture has slight RevPAR underperformance and franchise burden right at the threshold to cover both branches).
4. Evaluates each of the five module calcs.
5. Asserts the `revpar`, `total_room_revenue`, `room_revenue_per_key`, `revpar_index`, and `fb_gross_margin` results match expected values within tolerance.

## Compatibility analysis

- **Existing `.uw.md` files** — no impact. Files that don't load this module continue to work.
- **Existing implementers** — Tier-1 readers without module support continue to render hotel files using the standard sections; the hotel-specific sections render as raw JSON (existing fallback behavior). Tier-2 editors preserve hotel sections on round-trip via the standard mechanism. Tier-3 calc hosts that don't load the module skip the calcs.
- **Spec changes** — none. This RFC is a *use* of the existing module system.

## Conformance impact

New fixtures in `conformance/tier-3-calc-host/fixtures/`:
- `module-hospitality-revpar/` — uses the hospitality module, computes RevPAR, expected `180 * 0.72 = 129.60`.
- `module-hospitality-validation-comp/` — file with `revpar < market_revpar * 0.85`, expected `CC-MOD-HOSP-01` warning.

New fixtures in `conformance/tier-2-editor/fixtures/`:
- `module-hospitality-section-replace/` — round-trips a hotel `noi_model` change without touching the hotel-specific sections.

The fixture file itself (`boutique-hotel-austin.uw.md`) ships in
`examples/` so external readers have a real hotel example to inspect.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-module-hospitality/` (new package).
  - `packages/uwmd-core/src/module-loader.ts` (new) — `loadModule`, `ModuleRegistry`.
  - `packages/uwmd-core/src/validator.ts` — invoke module validators.
  - `packages/uwmd-core/src/calc/evaluator.ts` — resolve module-section paths in formulas.
  - `examples/boutique-hotel-austin.uw.md` (new).
  - Conformance fixtures listed above.
- **API surface:** `loadModule`, `ModuleRegistry`, plus the `@uwmd/module-hospitality` package's exports.
- **Test plan:** the fixture-driven tests above; plus negative tests (bad manifest, missing section, calc references undeclared section).

## Alternatives considered

1. **Don't ship a reference module; document how to write one.** The status quo. Rejected — see Motivation; the module system has no consumer and the contract goes unverified.

2. **Build hospitality as a sample inside `@uwmd/core` rather than a separate package.** Rejected — defeats the demonstration. The whole point is to show the module system works *for an external module*.

3. **Add hospitality fields to the standard schema rather than as a module.** Rejected — bloats the standard for the 60% of adopters not in hospitality, and the same argument would apply to gas stations, life sciences, data centers, …

4. **Ship multiple reference modules at once (hospitality, life-sciences, data-center).** Rejected for v2.0 — one is enough to validate the contract; build the others against the proven contract afterwards.

5. **Use an existing hotel-underwriting taxonomy (STR, HotStats).** Considered. Their data dictionaries are excellent references; we draw vocabulary from them but ship our own normative schema rather than depend on a paid taxonomy.

## Unresolved questions

- **Manifest format.** YAML or JSON canonical? Recommend ship YAML as the source of truth (more readable for module authors), generate JSON at build time for consumers and schema validation.
- **View model definitions.** The manifest's `view_models` field accepts a free-form structure. Recommend a typed `SectionViewModel[]` shape (already in `protocol.ts`) and have the build step convert TypeScript exports into the JSON shape stored in the manifest.
- **Bundling.** Should the manifest ship as part of `@uwmd/module-hospitality`'s npm package, or as a standalone JSON artifact? Recommend both — the npm package for TS consumers, a `dist/manifest.json` that any host can fetch independently.
- **Versioning vs the asset class.** The asset class is `hospitality` (built-in v1 enum). The module is `@uwmd/module-hospitality@0.1.0`. If a future module also targets `asset_class: hospitality`, host policy decides which loads. Recommend the conflict-resolution rules from RFC 0003 (`MOD-DISPLAY-CONFLICT-001`) extend to overlapping sections too.

## Prior art

- **OpenAPI extensions (`x-*` fields)** — established pattern for spec extensions; module sections fill the same role but with stronger schemas.
- **STR's hospitality data dictionary** — vocabulary reference for ADR / RevPAR / occupancy fields.
- **HotStats benchmarking schema** — vocabulary reference for the F&B and brand-fee fields.
- **JSON Schema's `$defs` and reusable schemas** — mechanism we use to share schema fragments between the module manifest and the conformance fixtures.
- **The `crd` (Crossplane) pattern in Kubernetes** — declarative type extension via a manifest, with a registry that resolves references. Same shape as what we're doing, in a different domain.
