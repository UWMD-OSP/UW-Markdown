---
uw_version: "1.1"
deal_id: TEST-T4-001
deal_name: "L6 Risk Rating Fixture"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "700 Risk Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: credit_approval
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 25000000
  loan_amount: 18750000
  noi_underwritten: 1500000
  dscr: 1.30
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# L6 Risk Rating Fixture

Provides the L6 layer with enough upstream context (property, debt_structure,
noi_model, market_analysis) to produce a `risk_assessment` block. The expected
post-run shape is in `expected-after-shape.json`.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "total_units": 100,
    "year_built": 2005,
    "building_class": "B+"
  },
  "_notes": null
}
```
