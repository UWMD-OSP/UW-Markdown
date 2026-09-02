# conformance/cash-flow

Fixtures for the `cash_flow_series` section (RFC 0034, UW_FORMAT_SPEC §4.26 /
Protocol §VIII.9): the CF-01…CF-03 structural rules, the three-state
`verifyCashFlowSeries` verifier, and the `CashFlowMetricDecl` evaluator
(`evaluateCashFlowMetrics`) with its two refusal codes.

Scenario kind is dispatched by the files a directory carries (see
`scripts/run-conformance.mjs`):

- `case.json` + `expected.json` — a bare payload run through
  `verifyCashFlowSeries`; `expected.json` pins the verdict (and optionally one
  issue code).
- `deal.uwx.md` + `decl.json` + `expected.json` — the document is parsed and
  `decl.json`'s `decls` (plus optional `overrides`) run through
  `evaluateCashFlowMetrics`; `expected.json.results` pins each result's
  `ok`/`value` (and optionally `unit`, `round_to`, or `error_code`).
- `deal.uwx.md` + `expected.json` — a full document run through the validator;
  `expected_codes` must each appear, `absent_code_prefixes` must not, and an
  optional `verdict` additionally verifies the base/default variant
  end-to-end.

Every pinned value was computed by the reference implementation, never
asserted — including the §4.26 worked example, which `verify-all-metrics`
holds verbatim so the spec and the verifier cannot drift apart.

| Scenario | Pins |
|---|---|
| `verify-all-metrics` | The §4.26 worked example: all four stated metrics `verified`. |
| `verify-stated-xirr-disagrees` | A stated xirr off beyond the 6dp quantum → `failed`, `CF-METRIC-DISAGREES`. |
| `verify-moic-no-outflows` | MOIC on an all-inflow series → `unverifiable`, never `failed`. |
| `verify-same-day-flows` | Ties are legal and not merged; `total_net` verifies. |
| `verify-procedure-refuses` | A stated xirr the §VIII.9.3 procedure cannot bracket → `failed`, `CF-PROCEDURE-REFUSES`. |
| `valid-hold-period` | Clean codes end-to-end + `verified` through the parsed document. |
| `reject-bad-date` | `2026-02-30` → CF-01 (the schema pattern alone cannot check month lengths). |
| `reject-unordered` | Descending dates → CF-02. |
| `reject-xirr-no-sign-change` | Stated xirr over all-positive flows → CF-03. |
| `calc-xirr-decl` | Declaration xirr, quantized at the `%` default (6dp). |
| `calc-xnpv-decl` | Declaration xnpv at a declared rate, `$` default (2dp). |
| `calc-override-shadow` | `overrides` shadow one row's amount; the root moves, the document does not. |
| `calc-missing-variant` | An explicit variant that does not exist → `CALC-CF-SERIES` (no default fallback). |
| `calc-diverge` | Declaration xirr over all-positive flows → `CALC-XIRR-DIVERGE`. |
| `calc-day-count-trio` | The same two-flow series under all three §VIII.9.1 conventions: three distinct pinned roots. |
