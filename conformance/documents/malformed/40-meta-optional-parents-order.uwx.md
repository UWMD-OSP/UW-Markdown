---
uw_version: "3.0"
deal_id: 40-meta-optional-parents-order
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

```json uw:section=x_missing
{"value":1,"_overrides":[null]}
```

```json uw:section=x_parents
{"_meta":{"section":"x_parents","provenance":null,"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1,"_overrides":{}}
```

```json uw:section=x_quality
{"_meta":{"section":"x_quality","provenance":{"source":"manual","actor":"synthetic reviewer","timestamp":"2026-10-18T00:00:00Z","notes":4},"quality":null,"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_order
{"_meta":{"section":"x_order","provenance":{"source":"manual","actor":"","timestamp":"2026-10-18T00:00:00Z"},"quality":{"confidence":"invalid","human_review_required":null,"flags":[1]},"lifecycle":{"revision":1,"superseded":null}},"value":1,"_overrides":[{"path":"value","resolution":"inherited_assumption"}]}
```

