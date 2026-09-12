---
rfc: 0043
title: Contextual Excel period bindings
status: active
author: jaredmaxey
created: 2026-09-12
affects:
  - protocol-spec
  - core-library
  - tooling
---

# RFC 0043: Contextual Excel period bindings

Implementation for owner review, stacked on RFC 0042. Protocol 2.10.0 in source;
Format stays 2.0 and package publication remains a separate step.

## Outcome

Export an explicitly selected formula such as
`dcf.annual_cash_flows@Y3.noi / property.total_units` to an editable workbook.
The formula still selects year three after sorting rows. Missing data stays
unavailable, a real zero remains zero, and duplicate period identities refuse.

The normative contract is Protocol §VIII.2c. It extends the first downstream
consumer brief without adding period defaults or financial models.

## Reference API and workbook

```ts
const workbook = await toWorkbook(parsed, {
  calculations: ['year_three_noi_per_unit'],
  calculationContext: { sectionVariants: { dcf: 'base' } },
});
```

```sh
uwmd-excel deal.uwx.md --calculations year_three_noi_per_unit -o deal.xlsx
```

Only requested custom-calculation IDs export; omission preserves the existing
pack workbook. IDs must select exactly one declaration. The first exporter
supports numeric literals, ordinary/period paths, unary minus and +, -, *, /.
Other AST forms explicitly refuse until their numeric/null parity is specified.
Ordinary values use unrounded calc resolution, with no inferred defaults or
prior-result chaining. Ambiguous ordinary path spellings refuse explicitly.

Additional sheets contain the selected results, shared ordinary inputs/overrides,
and one table per selected standard period series. All five registered series,
absolute months/quarters/dates and keyed-year aliases use the core resolver.
Multiple references to the same field reuse its column. Source variants are
visible; an explicit component stays separate from generic primary selection.
Full-path overrides (including null) bypass source lookup after contract validation.

Each series table contains canonical identities, stated values, per-row identity
guards and the original identity set. Exact INDEX/MATCH lookup uses explicit
workbook-scoped names. The whole-series guard validates a permutation of the
original keys, including case, blanks and duplicates. Editable values and whole-
row sorting are supported. Adding/removing/changing periods requires editing the
source and re-exporting. Hidden helper cells are inspectable implementation data,
not a security boundary against deliberate workbook tampering.

Missing periods/blank values produce #N/A. Nonnumeric inputs and invalid identity
sets produce #VALUE!, never zero. ROUND applies the existing declaration boundary
once. The shared class-pack sheets and their input/metric dictionary are unchanged.
The additional sheets are export-only: reverse import refuses marked extended
workbooks rather than silently discarding their edits.

`resolvePeriodColumn` exposes complete, validated column snapshots from core and
its browser entry. `PeriodColumnSnapshot` and `PeriodExcelBinding` have matching
protocol types and JSON schemas. Static namedRanges entries alone still cannot
emit a selector; the host must supply trusted contextual bindings.

## Compatibility and verification

The formulas use Excel 2016-compatible functions, avoiding dynamic-array or
newer lookup requirements. Exact-match behavior follows Microsoft's
[MATCH documentation](https://support.microsoft.com/en-us/Excel/functions/match-function).
Compatibility with that function set is distinct from tested application versions.
Native tests ran in Excel 16.0 build 20326; other engines/versions were not run.

The [native verification record](../../docs/reviews/2026-09-12-excel-period-bindings.md)
documents 14 scenarios and 48 cell checks: all series, row sorting, editable
values, zero versus blank, nonnumeric values, duplicate/changed/case-changed keys,
ordinary-input absence, zero/null overrides, monthly lookup, rounding, a $100M
fractional spread and save/reopen. Numeric comparisons are exact at the existing
calc boundary. Seven changed sheet views were exported and visually inspected.

Normal tests cover binding refusal, source validation, variants, aliases, literal
keys, no mutation, snapshots/schemas, serialization, CLI and reverse-import
refusal. Native Excel checks are a separate maintainer procedure, not silently
substituted by a formula-string evaluator in CI. No dependency or lockfile change.

## Deferred

Period-set editing inside Excel, reverse import of additional inputs, custom
function/conditional export, result chaining, period defaults and automatic
lease-rollover or DCF model generation require separate contracts. This RFC does
not promise that every arbitrary binary64 input is representable in every
spreadsheet engine; evidence states the concrete tested cases and versions.
