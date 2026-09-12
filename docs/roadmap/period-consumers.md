# Period consumers — next implementation brief

Status: **planning brief, not an accepted RFC**. Reconciled against release
2.7.0 / Protocol 2.8.0 on 2026-09-12. The current explicit Excel/refinement
refusals remain correct behavior until a consumer contract is accepted.

## User outcome

A formula selecting a stated year, quarter, month or date should retain that
identity when exported to a workbook or used to rank missing inputs. Neither
consumer may silently substitute a row index, a different variant or a default
for another holding period. This extends RFC 0041's existing selectors; it does
not create speculative lease cash flows.

## What exists

| Surface | Entry point | Gap |
|---|---|---|
| Reference resolution | `packages/uwmd-core/src/period-path.ts` | Canonical identity, full-series duplicate/malformed checks and explicit/generic variants exist. |
| Excel formula emission | `packages/uwmd-core/src/packs/excel-emit.ts` | ExcelEmitOptions contains only a static named-range map; period_path raises EXCEL-EMIT-PATH. |
| Workbook construction | `packages/uwmd-excel/src/toWorkbook.ts`, `layout.ts` | Class layouts construct named ranges and pack metrics. There is no common period-series table/binding contract for all five series or general custom-calculation export. |
| Refinement | `packages/uwmd-core/src/refinement.ts` | Its numeric interpreter rejects period_path; every dependency goes through generic resolveValue. |
| Cascade/defaults | `packages/uwmd-core/src/cascade.ts` | Literal paths and ordinary defaults are supported; period identities have no inherited/default-resolution contract. |

## Proposed sequence

1. **Accept an RFC for contextual workbook bindings.** Pin the target Excel
   feature baseline, the representation of period-key columns and selected
   variants, and the mapping from a period reference to an identity lookup.
   Start with the named holding-year series and a concrete workbook example;
   keep unsupported calendar series explicit until their sheet representation
   exists. Expand coverage only after each series passes the same acceptance set.
2. **Build an export path that actually consumes the bindings.** Adding a map
   option to the emitter alone would not deliver working workbook export. The
   workbook builder must create the period tables and export an explicit set of
   requested calculations. Keep the existing class-pack exports compatible.
3. **Accept a separate refinement scope.** A bounded first step can use valid,
   explicitly stated period values as fixed inputs while ranking existing scalar
   gaps. Missing period values remain unresolved; no period defaults or ranges
   are inferred. Decide how invalid references are reported before implementing.
4. **Extend period defaults/ranges only with a contract.** A generic year-one
   assumption must never be applied to year five merely by removing the selector.

## Decisions required before coding

- Must workbook lookup survive a user sorting/reordering the exported table?
  Recommended: yes; use a lookup by canonical identity rather than a fixed cell
  address. The exact formula and duplicate-check strategy must be part of the RFC.
- How does a missing period render in Excel without coercing a missing input to
  zero? Pin that behavior and distinguish it from duplicate/invalid identities.
- Which variants and custom calculations are explicitly exported? Pin the API,
  lookup scope and how bindings are tied to the parsed document used for export.
- Which Excel versions are supported, and how will real formula recalculation
  be tested? Formula-string snapshots alone do not establish numeric parity.
- How are refinement's unresolved/invalid selector inputs surfaced? Avoid
  returning an empty ranking that appears to prove there are no important gaps.

## Acceptance tests

Use RFC 0041 fixtures as the source cases. Test shuffled source rows and worksheet
rows; keyed year aliases; duplicate identities; absent/malformed periods; explicit
components versus generic primary selection; null overrides and literal @/dot
leaf names. For supported exports, compare recalculated workbook results with
evaluateCalc at its existing quantization boundary. For refinement, preserve all
existing scalar-only results and prove no default is invented for a missing period.

## Scope boundaries

No relative Qn/Mn, currency conversion, new financial formula, new precision rule,
lease-rollover module or general module-series registry is part of this first
consumer extension. No new dependency is selected by this brief. Tooling choices
and normative behavior need explicit review in the follow-up RFC.
