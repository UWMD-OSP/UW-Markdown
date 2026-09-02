---
uw_version: "1.1"
deal_id: TEST-T3-IRR-03
deal_name: "IRR on a conventional cash flow"
created: "2026-08-15T10:00:00Z"
last_modified: "2026-08-15T10:00:00Z"
property_address: "1 Determinism Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: full_underwrite
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# IRR on a conventional cash flow

The load-bearing fixture for RFC 0024: it proves the change does **not** move
the numbers on real deals. One sign change, unique root, and bisection agrees
with the pre-1.4.0 Newton pass to roughly 5e-13 — far below the six-decimal
quantum §VIII.5 reports a rate at.
