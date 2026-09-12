# Next stage — RFC 0041 period addressing

Baseline: RFC 0040 implementation on PR #178, Protocol 2.7.0. Reconcile the
merged head before starting. This is the queued stage contract; RFC 0040 is
the only current implementation stage until its review submission is complete.

## Bounded first implementation

- Register the five standard series: `dcf.annual_cash_flows`,
  `noi_model.projections`, `lease_up_schedule.schedule`,
  `cash_flow_series.flows`, and `distribution_waterfall.stated_schedule`.
- Support explicit `Y<n>` year selectors and absolute `YYYY-MM`, `YYYY-Qn`,
  and `YYYY-MM-DD` identities on series with the corresponding grammar.
  Never compare a holding year to a calendar period without an anchor.
- Preserve generic `deepGet(obj, path)` literal-key behavior. Add a contextual
  resolver and wire it through calc lexer/parser/AST traversal, overrides,
  dependency extraction, public exports, and Excel emission/refusal.
- Refuse duplicate period matches at evaluation time, even without prior
  validation. Row order must not change a lookup. Preserve current
  missing-input behavior for missing periods; distinguish kind mismatch.
- Specify explicit calc variant scope. Reuse generic role eligibility where
  relevant, never a validator check's senior/detail preference.
- Defer relative `Q<n>`/`M<n>` aliases, wildcards, calendar conversions, and
  module-defined series until their anchors and registry contracts exist.
- Reconcile the next protocol minor (expected 2.8.0); keep package publication
  separate. Pin PS-01/02/03 and schema/runtime correspondence before coding.

## Ordered work

1. Reconcile RFC 0040's merged state and revise RFC 0041's conflicting draft.
2. Pin selector grammar, duplicate/missing/kind semantics, calc variant scope,
   and supported Excel translation or explicit typed refusal in the RFC.
3. Implement standard-series registry and contextual period resolution.
4. Integrate the calc/reference surfaces; add row-permutation, duplicate,
   missing-period, variant, override, dependency and Excel tests.
5. Add conformance fixtures and run every deterministic repository gate.

No financial formula, convergence criterion, precision tolerance, new npm
dependency, or calendar conversion is part of this stage.
