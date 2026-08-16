---
uw_version: "1.1"
deal_id: TEST-T3-IRR-04
deal_name: "IRR with a root on the bracket endpoint"
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

# IRR with a root on the bracket endpoint

Protocol §VIII.3 step 3 (RFC 0024). `npv(10.0)` is exactly zero for
`irr(-1, 11)`, and bisection cannot reach it — the retention test multiplies by
the endpoint value, which is zero for every midpoint. The endpoint check returns
it exactly.

Only the high endpoint is testable this way: `1.0 + (-0.999)` is
`0.001000000000000001` in binary64, so a root "exactly at" the low endpoint is
not a well-defined quantity. §VIII.3 says so.
