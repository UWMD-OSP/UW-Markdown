---
uw_version: "3.0"
deal_id: RFC0094-36
deal_name: "RFC0094 synthetic 36-meta-leaf-parents-order"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "100 Test Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: in_progress
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

# RFC0094 synthetic 36-meta-leaf-parents-order

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

# Authored diagnostic controls

```json uw:section=x_leaf_oldshape
{"_meta":{"section":"x_leaf_oldshape","provenance":[],"quality":{"confidence":null,"human_review_required":false},"lifecycle":{"revision":0,"superseded":false}},"value":1}
```

```json uw:section=x_leaf_quality
{"_meta":{"section":"x_leaf_quality","provenance":{"source":"manual","actor":"analyst","timestamp":"bad"},"quality":null,"lifecycle":{"revision":0,"superseded":false}},"value":1}
```

```json uw:section=x_leaf_combined
{"before":1,"_meta":{"section":"different","provenance":{"source":"manual","actor":"","timestamp":"bad"},"quality":{"confidence":"unknown","human_review_required":null},"lifecycle":{"revision":false,"superseded":null}},"value":1}
```

```json uw:section=x_leaf_later
{"_meta":{"section":"x_leaf_later","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z"},"quality":{"confidence":"LOW","human_review_required":"false"},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

