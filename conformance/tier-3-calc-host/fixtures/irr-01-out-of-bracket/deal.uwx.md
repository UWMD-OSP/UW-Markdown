---
uw_version: "1.1"
deal_id: TEST-T3-IRR-01
deal_name: "IRR out of bracket"
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

# IRR out of bracket

Protocol §VIII.3 step 6 (RFC 0024). `irr(-1, 20)` has its root at 1900%,
outside the `[-0.999, 10.0]` search interval. The pre-1.4.0 engine ran Newton
first and returned ≈19.0 — a root from outside the domain the spec claims to
search. It must now raise `CALC-IRR-DIVERGE`.
