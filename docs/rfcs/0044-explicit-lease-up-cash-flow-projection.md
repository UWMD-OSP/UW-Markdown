---
rfc: 0044
title: Project verified lease-up amounts onto explicitly stated cash dates
status: draft
author: codex
created: 2026-09-12
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0044: Explicit lease-up cash-flow projection

## Summary

Propose a browser-safe adapter that copies a selected, verified lease-up
schedule's stated `net_cash_flow` amounts into a dated `CashFlowSeries`, using
one explicitly supplied cash date per source period. Return binding evidence
alongside the candidate payload. This is a partial receipt/TI-LC stream; it does
not create a complete DCF, NOI, property cash flow or equity return.

**Draft only.** This PR supplies a worked example using existing APIs, not the
production adapter or a normative amendment. Protocol remains 2.10.0 in source;
published core/CLI remain 2.7.0 with Protocol 2.8.0. Acceptance and synchronized
implementation are separate steps.

## Motivation

RFC 0008 states `net_cash_flow = rent_revenue + concessions + ti_lc_capex`.
The name does not imply operating expenses, debt service, acquisition or exit.
Feeding that amount directly into an equity IRR or substituting it for NOI would
misstate its economic meaning. `stabilized_summary.annualized_noi` is a separate
stabilized figure and cannot fill every missing lease-up period.

RFC 0034 supplies dated series and deterministic cash-flow metrics. RFC 0041
selects stated periods; RFC 0043 exports requested arithmetic calculations.
The missing seam is a reviewable assignment of stated period amounts to actual
cash dates, with full source/variant identity and no hidden period-end convention.

## Proposed change

Add `projectLeaseUpCashFlows(parsed, plan)` after owner acceptance. The plan and
result below are proposed API shapes, not currently exported types:

```ts
interface LeaseUpCashFlowPlan {
  source_variant: string;
  day_count: DayCountConvention;
  cash_dates: Array<{ period: string; date: string }>;
}
interface LeaseUpCashFlowProjection {
  source_envelope_digest: string;
  source_variant: string;
  series: CashFlowSeries;
  bindings: Array<{ source_path: string; date: string; amount: number }>;
}
```

The intended Protocol addition is a subsection following VIII.2c, consuming the
existing format sections 4.25/4.26 and VIII.9 calendar procedures. If accepted,
the new type/schema/protocol prose must land together with a protocol minor bump.
Existing section schemas and the expression grammar need no expansion.

### Proposed source and mapping rules

1. The caller MUST provide an exact `source_variant`; no generic/default-role
   fallback is applied by the adapter. Resolve through the existing explicit
   period-selection contract, including eligible component variants.
2. The selected schedule MUST satisfy existing lease-up structural rules and
   return `verified` from `verifyLeaseUpSchedule` using existing context and
   quantization. `failed` and `unverifiable` both refuse projection, preserving
   their distinct diagnostics. Missing summary inputs are not manufactured.
3. Every source period MUST occur exactly once in `cash_dates`. Missing, extra
   or duplicate period mappings refuse. The first adapter supports the complete
   selected schedule; partial windows need a later explicit contract.
4. Every mapped date MUST be a real YYYY-MM-DD date. The caller MUST provide a
   registered day count. No month-end, quarter-end, acquisition-date or day-count
   default is introduced. Dates may differ from the source accrual period:
   collecting cash later is an explicit caller assertion, not something this
   adapter can infer. Dates MUST be non-decreasing in source-period order.
5. Each selected stated `net_cash_flow` MUST be finite. Copy its exact binary64
   value without arithmetic, rescaling or early rounding. Zero is valid; null,
   missing or nonnumeric amounts refuse. Do not recompute a substitute amount
   into the output when the source omitted or misstated it.
6. Output order follows the structurally validated source schedule. Same-day
   cash flows remain separate rows, as RFC 0034 permits. They are never merged;
   RFC 0041 date selectors will correctly refuse ambiguous duplicate dates.
7. The result MUST carry each canonical source path, exact variant, cash date
   and copied amount, plus the source document's existing semantic envelope
   digest. This evidence identifies what was projected; it is not a signature
   or proof that the underlying economics are complete.

### Proposed result scope and errors

The output label identifies **lease-up receipts and TI/LC only**. Use advisory
row kind `other` because the source amount mixes receipts and capital costs.
Do not label it NOI, operating free cash flow, equity cash flow or a full DCF.
The output omits `stated_metrics`: the adapter copies amounts; callers invoke
existing cash-flow metric APIs with their own explicit declarations.

The first output date remains the VIII.9 valuation anchor. It MUST NOT be
described as a purchase-date present value unless the caller has separately
assembled a complete, dated stream with that anchor. No synthetic zero flow is
inserted to change the anchor.

The adapter returns a candidate content payload without writing a document,
changing `_meta`, signing a block or applying overrides to source values. A host
that accepts it uses the Tier-2 editor and append-only provenance. Source/plan
refusals should use a dedicated typed `CALC-LU-PROJECTION` code with source or
mapping pointers and nested verifier evidence, registered with its normative
schema in the implementation PR. Existing period and verifier codes retain
their meanings; diagnostics must not be flattened into one generic failure.

## Compatibility analysis

The adapter is opt-in. Existing Lite/UWX records and Tier-1/2/3/4 implementations
remain valid. No stage requires lease-up modeling, no pack silently consumes the
new output, and no module manifest changes. Modules can continue to own their
own projection engines. Existing calendar metrics retain their formulas,
brackets, convergence criteria, units and quantization. Receipts and signing
keep their current contracts; a newly authored output is a new document state.

## Conformance impact

No existing fixture or expected value changes in this proposal. After acceptance,
add a named projection suite with these acceptance cases:

| Case | Required outcome |
|---|---|
| Monthly and quarterly schedules, including leap dates | Exact copied amounts and explicitly supplied dates; no date derivation. |
| Distinct base/component variants | Exact requested source; no fallback or cross-variant mixing. |
| Missing/wrong variant, malformed/gapped/duplicate source periods | Typed refusal with source identity. |
| Missing/extra/duplicate period mapping; invalid or decreasing dates | Typed plan refusal; no partial output. |
| Source verification failed vs unverifiable | Both refuse and retain the actual source verdict. |
| Real zero vs null/nonfinite/nonnumeric amount | Zero copies; other cases refuse. |
| Fractional source amount | Exact copy; rounding only in a later metric's existing boundary. |
| Same-day distinct periods | Separate rows retained; no aggregation and no ambiguous date lookup. |
| Source bytes, `_meta` and context | No mutation, default inference or hidden scenario override. |
| Digest/binding evidence | Correct document digest and exact source paths/variant. |

End-to-end acceptance must include existing cash-flow metric evaluation on the
candidate output. Full DCF or investment-return claims require the separate
cash-flow assembly contract described below.

## Reference implementation

Production follow-up, after acceptance:

- `packages/uwmd-core/src/lease-up-cash-flows.ts` plus sibling tests: projection
  and typed refusal; reuse period selection, lease-up validation/verifier,
  calendar validation and semantic envelope digest code.
- Export proposed types/function from core and browser. Synchronize
  `protocol.ts`, protocol prose and new plan/result/error schemas in one commit.
- Add conformance fixtures and a consumer CLI only after the API is verified.
  Excel support must use existing explicit calculation/period bindings; a full
  cash-flow metric workbook is a separate parity contract.

The current [worked example](../LEASE_UP_CASH_FLOW_WORKFLOW.md) runs through
existing public APIs. Its runner verifies a fixed authored scenario; it does not
implement generic plan validation, the proposed refusal code, digest evidence,
or the production API. Its CI smoke test proves the example remains runnable,
not that the future acceptance matrix is already implemented.

## Alternatives considered

- **Implicit period-end dates:** easy to generate, but assumes collection timing
  and conceals acquisition/valuation-anchor choices.
- **Derive DCF from stabilized NOI:** conflates the stabilized model with the
  trajectory and omits unprovided operating/capital/financing flows.
- **Export the period schedule only:** useful and already possible with RFC 0043,
  but does not identify a cash date for VIII.9 metrics.
- **Add general AST iteration:** does not resolve any economic or timing choice
  and widens the evaluator before a consumer needs that capability.

## Unresolved questions

Owner acceptance is needed for this deliberately narrow first adapter: complete
schedule mapping, verified source only, and `net_cash_flow` as the sole source
field. Support for split rent/concession/TI/LC flows, partial windows and lag
policies is deferred instead of being hidden in implementation defaults.

The next full-DCF contract must pin valuation date, expense/reserve/capex coverage,
acquisition and disposition, debt service, currency identity and levered/unlevered
basis, prevent double counting between source modules, and define any treatment
of missing periods. Speculative renewal probabilities, vacancy, market resets
and TI/LC amortization belong to a separate leasing module. None of these
economics is authorized by this projection proposal.

## Prior art

The in-repository contracts are the direct precedents:
[RFC 0008](0008-lease-up-modeling.md) for stated component verification,
[RFC 0034](0034-calendar-anchored-cash-flows.md) for dates/day counts and metrics,
[RFC 0041](0041-period-indexed-addressing.md) for identity/variant selection, and
[RFC 0043](0043-contextual-excel-period-bindings.md) for bounded consumers.
