# conformance/lease-up

Fixtures for the `lease_up_schedule` section (RFC 0008, UW_FORMAT_SPEC §4.25):
the LU-01…LU-04 structural rules, the tolerance-checked CC-15 seam to
`noi_model`, and the three-state `verifyLeaseUpSchedule` verifier.

Scenario kind is dispatched by the files a directory carries (see
`scripts/run-conformance.mjs`):

- `case.json` + `expected.json` — a bare payload run through
  `verifyLeaseUpSchedule` with the supplied context; `expected.json` pins the
  verdict (and optionally one issue code).
- `deal.uw.md` + `expected.json` — a full document run through the validator;
  `expected_codes` must each appear, `absent_code_prefixes` must not, and an
  optional `verdict` additionally verifies the base/default variant
  end-to-end through `leaseUpContext` (the Protocol §XIII denominator).

| Scenario | Pins |
|---|---|
| `valid-value-add-turnover` | Clean codes + `verified`; the downside variant is exempt from CC-15. |
| `valid-ground-up-absorption` | Monthly grammar; no rent_roll without LU-04 (absorption_curve). |
| `verify-stated-sum-disagrees` | One cent off post-quantization → `failed`. |
| `verify-missing-denominator` | No sqft denominator → `unverifiable`, distinct from `failed`. |
| `reject-bad-period` | LU-01: mixed granularity. |
| `reject-gapped-periods` | LU-02: gap in the period axis. |
| `reject-empty-schedule` | LU-03: empty schedule array. |
| `warn-turnover-no-rent-roll` | LU-04 warning: turnover with no stated starting point. |
| `warn-stabilized-mismatch` | CC-15 warning: 12.5% endpoint drift, structure clean. |
