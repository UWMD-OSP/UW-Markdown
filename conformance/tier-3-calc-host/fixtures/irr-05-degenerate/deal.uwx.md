---
uw_version: "1.1"
deal_id: TEST-T3-IRR-05
deal_name: "IRR on degenerate flows"
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

# IRR on degenerate flows

Protocol §VIII.3 step 2 (RFC 0024). All-positive flows never cross zero, so no
bracket exists and the engine raises rather than returning a bracket endpoint as
though it were a root.
