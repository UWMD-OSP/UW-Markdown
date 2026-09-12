---
rfc: 0042
title: Stated period inputs in refinement
status: active
author: jaredmaxey
created: 2026-09-12
affects:
  - protocol-spec
  - core-library
---

# RFC 0042: Stated period inputs in refinement

Proposed contract and reference implementation for owner review after PR #181.
Merging this RFC accepts this bounded stage; package publication is separate.

## Outcome

For `dcf.annual_cash_flows@Y3.noi * noi_model.expense_ratio`, use the stated
year-three NOI as a fixed input while ranking the ordinary expense-ratio gap.
Reordering rows cannot change the ranking. A missing year-three NOI must be
reported, rather than replaced by zero or an assumption from a different year.

This implements the refinement stage of the
[period-consumer brief](../../docs/roadmap/period-consumers.md). Excel needs its own
workbook-binding contract and continues to refuse selector formulas.

## Contract

The normative contract is Protocol §VIII.2b. Refinement remains optional; no
conformance tier acquires a new requirement.

1. Collect period references from target ASTs, preserving the canonical full
   selector path, including bracket-string leaf keys. Resolve each distinct
   reference once per rankGaps invocation. Use RFC 0041's registry, complete
   series checks, calendar identity and role selection for all five series.
2. `RankGapsOptions.periodContext` optionally supplies `sectionVariants` and
   `overrides` with the same meaning as CalcEvaluationContext, only for period
   dependencies. Validate the registry path and selector before applying an
   own-property, full-path override. Null is an explicit missing value. A valid
   override bypasses document lookup, including series/variant errors, exactly
   as in the calc evaluator. Other override keys have no effect.
3. Finite numeric values stay fixed in every perturbation environment. Never
   call resolveValue, an external market lookup, or any default/profile/
   inheritance provider for a period reference. Do not create a period gap or
   infer a range. Ordinary scalar resolution and ranking are unchanged.
4. Null or absent values, including kind mismatch and blocked traversal, report
   `REFINE-PERIOD-MISSING`. Non-numeric values and nonfinite numbers report
   `REFINE-PERIOD-NONNUMERIC`. Do not coerce strings, booleans, objects or arrays.
   Resolver errors retain CALC-PERIOD-001/002/003. Unexpected internal errors
   propagate rather than being reclassified as missing data.
5. Each affected target receives one PeriodRefinementIssue per distinct failed
   reference, in target order then first AST occurrence. An issue carries
   output_id, field_path, code and message. Exclude that output from numeric
   ranking; retain unaffected targets. Emit diagnostics even if there are no
   ordinary gaps. Consumers must inspect them before treating an empty ranking
   as evidence of completeness. Omit diagnostics.period_inputs for scalar-only
   targets; include it (possibly empty) when a selected target has a selector.
6. A period leaf itself is supported by the numeric interpreter. Calls,
   conditionals and other existing unsupported/non-monotonic expressions keep
   their existing behavior and warnings. This adds no monotonicity proof or
   interval algorithm. diagnostics.resolved keeps its historical meaning:
   distinct dependency entries processed, not a count of known numeric inputs.

## Reference usage

```ts
const result = rankGaps(parsed, {
  packs: [],
  targets: ['year_three_expenses'],
  periodContext: { sectionVariants: { dcf: 'base' } },
});
// The custom calculation is:
// dcf.annual_cash_flows@Y3.noi * noi_model.expense_ratio
// Inspect issues before interpreting the ranking as input completeness.
const issues = result.diagnostics.period_inputs ?? [];
```

`by_voi` ranks the expense-ratio gap when NOI is stated. When that selected NOI
is absent, `issues` identifies the excluded output; it is not filled by a default.
The optional context is unnecessary when generic role selection is sufficient.

## Compatibility and versioning

Protocol advances to 2.9.0 for this optional consumer contract and diagnostic
schema. Format stays 2.0. Core/CLI publication remains 2.7.0 until a separately
reviewed release. No new package, dependency, formula, unit or precision rule.
RankGapsResult's new diagnostic member is optional and scalar-only result objects
remain unchanged. The new type is exposed from core and its browser entry.

The existing perturbation approximation is retained. In particular this work
does not claim a rigorous interval enclosure, add stochastic VOI, or change the
calc engine's boundary quantization. It ranks existing ordinary gaps only.

## Verification

Test all five registered series, both monthly and quarterly calendars, reordered
rows and keyed aliases; duplicate/malformed/absent periods and missing leaf
values; generic primary versus explicit component selection; typed resolution
errors; full-path and null overrides; literal dot/@ leaves; no cascade lookup;
target filtering, repeated references, partial successful results, finite-value
requirements, browser exports and scalar-only compatibility. Compare the
supported arithmetic example to evaluateCalc using the same stated period and
explicit scalar endpoints. Validate emitted issues against the new schema.

Period defaults/ranges and workbook export are separate follow-ups, not implied
by acceptance of this RFC.
