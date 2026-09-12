# RFC 0044 implementation

Owner explicitly approved the bounded adapter on 2026-09-12. Implement
`projectLeaseUpCashFlows(parsed, plan)` against RFC 0044: exact variant,
existing lease-up structure and verification, complete explicit cash dates,
exact stated amounts, semantic source digest and candidate-only output.

Authorized normative changes: Protocol 2.11.0, LeaseUpCashFlowPlan,
LeaseUpCashFlowProjection, LeaseUpCashFlowProjectionIssue, their schemas,
and CALC-LU-PROJECTION. Preserve existing verifier diagnostics and math.
Export browser-safe APIs from both entries. A read-only CLI may consume the
verified API. No package release, dependency change, new DCF economics,
document writes, or signing is included.

Done means acceptance tests, a named default conformance suite, API/CLI docs,
roadmap/status updates, every deterministic gate and a separate stacked PR.
