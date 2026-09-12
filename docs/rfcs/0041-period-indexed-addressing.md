---
rfc: 0041
title: Explicit period addressing for the standard series
status: implemented
author: jaredmaxey
created: 2026-09-10
accepted: 2026-09-12
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0041: Explicit period addressing

**Released in [core/CLI 2.7.0](https://github.com/UWMD-OSP/UW-Markdown/releases/tag/v2.7.0), 2026-09-12.**
The implementation and conformance cases are shipped; remaining extensions are
explicitly deferred below.


The owner authorized the bounded next stage after RFC 0040. This revision
replaces the earlier draft's positional calendar keys and first-match behavior.
The [readiness review](../reviews/2026-09-11-rfc-0040-0041-readiness.md) records
the conflicts. Protocol 2.8.0 implements explicit year and absolute calendar
selectors; Format 2.0 and package publication remain separate.

## Why

A reference such as `dcf.annual_cash_flows@Y3.net_operating_income` identifies
year 3 even when rows move. Calendar schedules need the same stable addressing,
but a holding year is not a calendar quarter or date. Treating the first row of
unrelated schedules as the same period would silently compare different facts.

## Accepted contract

The normative contract is [Protocol §VIII.2a](../../spec/UW_PROTOCOL_v1.md#viii2a-explicit-period-addressing-rfc-0041).
The five standard series retain their current fields and storage shapes.

- One selector per reference: Y1 and higher, YYYY-Q1..Q4, YYYY-MM, or a valid
  Gregorian YYYY-MM-DD. Calendar identities preserve absolute years.
- Canonical kinds never convert implicitly. No relative Qn/Mn aliases,
  wildcards, acquisition-date inference or module-defined series in this stage.
- Contextual lookup inspects the whole target series and refuses malformed
  periods or duplicates before returning a row. Missing periods return null.
  A kind mismatch returns null and can produce a static PS-03 warning.
- Default section selection follows generic RFC 0040 roles and eligibility;
  explicit sectionVariants context selects exactly the requested block. It may
  intentionally select a component. Never inherit a validator check's senior
  or detail preference. Unresolvable variant selection refuses explicitly.
- A dedicated period_path AST node leaves existing expression ASTs and literal
  bracket-string keys unchanged. Generic deepGet and metadata pointers are
  unchanged. Prototype access stays blocked.
- Overrides and dependencies retain the full selector identity. A null override
  is a value. Literal dot/@ leaf names remain distinct from nested path syntax.
- Excel raises EXCEL-EMIT-PATH for selector expressions until contextual workbook
  bindings are implemented. Refinement records dependencies and reports its
  current inability to perturb period-selector expressions numerically.

## Diagnostics and API

PS-01 warns for malformed series or periods in every active variant; PS-02
errors for duplicates; PS-03 warns for static calc/scenario kind mismatches.
The new PS family and remediation rows are registered. Older documents missing
period identities can acquire warnings; authors must correct source data rather
than deriving dates from row positions.

Evaluation uses CALC-PERIOD-001 for malformed/unregistered references or data,
CALC-PERIOD-002 for duplicate identities, and CALC-PERIOD-003 for unresolvable
variant selection. These are typed CalcErrors captured by evaluateCalc.

Both package entries expose PeriodKey, PeriodSeriesEntry, PERIOD_SERIES,
canonicalPeriod, parsePeriodSelector, periodKeyIdentity, resolvePeriodPath and
PeriodResolutionOptions. CalcEvaluationContext gains optional sectionVariants.
Period-key and registry-entry schemas accompany the protocol and source changes.
The standard registry is frozen; it is not a runtime plugin registration API.

## Compatibility and verification

Existing expression syntax, mathematical formulas, units and quantization do
not change. Structural PS diagnostics are additive. Receipt protocol labels
advance separately from their unchanged mathematical results.

Tests cover the five series, row permutations, year-key aliases, duplicates
without validation, missing/malformed/kind-mismatched periods, explicit and
generic variant selection, safe traversal, override/dependency identity,
static diagnostics, Excel refusal and refinement reporting. Conformance fixtures
pin success, missing and refusal cases. The full repository gates apply.
