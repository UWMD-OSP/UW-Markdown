# Period consumers — next implementation brief

Status: **workbook planning brief; refinement stage implemented for review in
[RFC 0042](../rfcs/0042-period-refinement.md)**. Reconciled after PR #181 on
2026-09-12. Published core 2.7.0 / Protocol 2.8.0 still refuses both consumers;
the source adds bounded period refinement under Protocol 2.9.0. Workbook binding
decisions below remain proposals. No package release is included in this stage.

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
| Refinement | `packages/uwmd-core/src/refinement.ts` | RFC 0042 resolves stated numeric period inputs separately from the cascade and reports per-output issues. Period ranges/defaults remain unsupported. |
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
3. **Review the implemented refinement scope (RFC 0042).** Valid stated period
   values stay fixed while ordinary scalar gaps are ranked. Missing/nonnumeric
   or invalid period values yield structured per-output issues and exclude only
   affected outputs. No period defaults or ranges are inferred.
4. **Extend period defaults/ranges only with a contract.** A generic year-one
   assumption must never be applied to year five merely by removing the selector.

## Remaining workbook decisions before coding

- Must workbook lookup survive a user sorting/reordering the exported table?
  Recommended: yes; use a lookup by canonical identity rather than a fixed cell
  address. The exact formula and duplicate-check strategy must be part of the RFC.
- How does a missing period render in Excel without coercing a missing input to
  zero? Pin that behavior and distinguish it from duplicate/invalid identities.
- Which variants and custom calculations are explicitly exported? Pin the API,
  lookup scope and how bindings are tied to the parsed document used for export.
- Which Excel versions are supported, and how will real formula recalculation
  be tested? Formula-string snapshots alone do not establish numeric parity.
Refinement diagnostics are pinned by RFC 0042: inspect `period_inputs` before
treating an empty ranking as completeness. Its issue schema preserves the full
selector and identifies each affected output; period defaults remain deferred.

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
