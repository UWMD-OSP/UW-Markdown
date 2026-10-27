---
rfc: 0125
title: Verify data-center purchase price per stated rentable square foot
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0125: Verify data-center purchase price per stated rentable square foot

## Resolution

The UWMD maintainers accepted this contract on 2026-10-22. D1–D5 stand as
written; the synchronized current contract is implemented.

## Summary

Extend the existing `price_per_sqft` dictionary definition to `data_center`,
using only explicit `property.rentable_square_feet`. Keep commissioned critical
IT kW as primary size. D1–D5 define the accepted contract.

## Motivation

The Mesa-Gateway example states rentable area and `valuation.price_per_sf`, but
the current dictionary makes `price_per_sqft` applicable only to office, retail
and industrial. RFC 0099's existing aliases therefore do not check that figure
for data centers. Tampering it does not produce a stated-metric disagreement.
The example also calls rentable area a building footprint/fallback and calls the
builtin commissioned-kW metric a module. This PR corrects those narrative claims
without changing numbers or authoring an unstated measurement standard.

## Proposed change

A Verifier MUST select this entry for `data_center`:

```json
{
  "id": "price_per_sqft",
  "asset_classes": ["data_center"],
  "formula": "valuation.purchase_price / property.rentable_square_feet",
  "input_paths": ["valuation.purchase_price", "property.rentable_square_feet"],
  "section_roles": {},
  "unit": "$",
  "round_to": 2,
  "minimum_stated_decimals": 2,
  "null_semantics": "positive_size_denominator",
  "deterministic": true
}
```

This is the office/industrial definition and comparison contract, applied to one
additional class. Use the existing label `Price / SqFt`. RFC 0099's existing canonical homes,
`quick_metrics.price_per_sqft`, `valuation.price_per_sf` and
`valuation.purchase_price_per_sqft` all bind the same metric. Check every stated
home and current variant separately. Retain Protocol VIII.2 section selection;
ambiguous or unavailable inputs are unverifiable, never selected by fence order.

The denominator MUST be the explicitly stated rentable area. Do not substitute
building footprint, raised-floor area, gross area, or a quantity inferred from
kW, rack counts, power density or another class. Missing/null area yields an
unverifiable statement; zero division retains its calc refusal; a negative size
retains RFC 0100's `negative_size_denominator` outcome and Format SIZE-01.

Recompute unrounded in binary64 and compare once under RFC 0079 / Protocol
VIII.5.1 at two decimals, half away from zero, with no epsilon. A finite
mismatch is failed. Lack of source precision retains existing refusal behavior.
The optional `property.area_measurement` declaration (RFC 0114) retains its
current meaning; no area conversion or new required measurement declaration.

Register `rentable_square_feet` in the data-center size entry's `secondary`
array, mirrored by `SIZE_INTENSIVES` and the property-size description. Current
main's data-center secondary array is empty; this explicit registry addition is
required so RFC 0100's denominator lookup recognizes the new SF metric. The
field is already in the class-independent Format 5.5 SIZE-01 table; add no new
size finding or mandatory area requirement.

The primary-size path stays `property.critical_it_load_kw`. Neither
`price_per_kw`, `price_per_commissioned_kw` nor their existing consistency checks
changes. No land or other-class entry changes.

## Decisions for acceptance

| # | Question | Recommendation | Precedent |
|---|---|---|---|
| D1 | Denominator | Explicit property.rentable_square_feet only | Office/industrial price_per_sqft; owner fifth set |
| D2 | Binding | Existing price_per_sqft id and closed aliases | RFC 0099, no label inference |
| D3 | Precision/null | $; round_to 2; minimum 2; positive_size_denominator | RFCs 0079/0100; same SF definition |
| D4 | Size registry | Keep commissioned critical IT kW primary; add rentable_square_feet as an explicit secondary | RFC 0080 primary identity; RFC 0100 denominator lookup needs a registered size |
| D5 | Example | Describe stated rentable SF as secondary; builtin commissioned kW remains primary; no numeric edits | Accepted wording correction; RFC 0114 |

## Current contract and versions

The synchronized spec/dictionary/pack and conformance changes implement the
accepted contract. No version
is allocated; prelaunch packages remain 4.x under the owner rule. No historical
artifact repair or compatibility path.

## Conformance impact

Add portable metric cases for correct/wrong SF statements, all existing homes,
agreeing quick metric with disagreeing section copy, missing/null/zero/negative
area, ambiguous property/valuation selection, and distinct current variants.
Prove secondary-registry parity and negative rentable area are guarded. kW-only
inputs never supply missing area; changing kW alone does not change
this SF metric. Keep existing primary-size and kW controls unchanged. Include
cent-boundary and source-precision controls under the existing quantizer.

## Reference implementation

This implementation synchronizes Format property/valuation text, Protocol metric
contract and executable mirror/descriptions, dictionary, generated dictionary,
data-center builtin pack and Excel output/parity, independent Python calculation controls,
metric conformance, size registry/`SIZE_INTENSIVES` secondary-path parity,
wiki and changelog in one implementation PR. Update current
counts from actual dictionary contents. No new API or external dependency.

## Alternatives considered

Use `price_per_kw` only: leaves an explicitly stated SF price unverified. Infer
SF from power: invents a financial input and conflates distinct measurements.
Add a data-center-only id: needlessly duplicates the identical rentable-SF rule.

## Unresolved questions

D1–D5 are accepted. No further formula or tolerance is delegated to the
implementer. Implementation evidence follows the synchronized contract.

## Prior art

RFCs 0078/0079 define dictionary meaning and precision; RFCs 0099/0100 define
closed statement homes and positive-size denominators. RFC 0114 records optional
measurement standards without conversions.
