---
uw_version: "1.1"
deal_id: TEST-T3-IRR-02
deal_name: "IRR with an even number of roots"
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

# IRR with an even number of roots

Protocol §VIII.3 step 2 (RFC 0024). `irr(-100, 230, -132)` is zeroed by both
0.10 and 0.20, so `npv` carries the same sign at both ends of the bracket and
no sign change exists to bisect. The engine raises rather than returning one of
them: a cash flow with several sign changes has no single internal rate of
return. The pre-1.4.0 engine returned 0.1, an artifact of Newton's seed.
