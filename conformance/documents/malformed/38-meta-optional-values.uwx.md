---
uw_version: "3.0"
deal_id: 38-meta-optional-values
deal_name: "RFC0095 authored admission control"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "100 Test Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 1.25
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
  equity_required: 2500000
flags: []
blocking_flags: []
tier: screener
created_by: "analyst"
---

# RFC0095 authored admission control

The initial property block is a positive screening control. The appended
blocks deliberately violate only the diagnostic conditions stated below.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null,
  "total_units": 50,
  "year_built": 1995,
  "building_class": "B",
  "asset_subtype": "garden",
  "total_nra_sqft": 45000,
  "land_area_acres": 2.1,
  "stories": 2,
  "parking_spaces": 75,
  "parking_type": "surface",
  "zoning": "R-3",
  "condition": "good",
  "amenities": [
    "pool",
    "laundry"
  ]
}
```

# Independently authored RFC0095 predicates

```json uw:section=x_optional
{"_meta":{"section":"x_optional","provenance":{"source":"manual","actor":"synthetic reviewer","timestamp":"2026-10-18T00:00:00Z","agent_id":4,"agent_version":[],"notes":{}},"quality":{"confidence":"high","human_review_required":false,"flags":null,"partial":1,"provisional":"false","field_overrides":null},"lifecycle":{"revision":1,"superseded":false}},"value":1,"_overrides":[null,{"path":4,"confidence":"verified","reason":null,"note":false,"source":"manual","resolution":"user_input"},{"path":"","confidence":"low","reason":"computed","note":"","future":{}}]}
```

```json uw:section=x_flags
{"_meta":{"section":"x_flags","provenance":{"source":"manual","actor":"synthetic reviewer","timestamp":"2026-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false,"flags":["lawful",5,null]},"lifecycle":{"revision":1,"superseded":false}},"value":1,"_overrides":{}}
```

