---
uw_version: "3.0"
deal_id: TEST-0098-DEBT-UNKNOWN
deal_name: "Debt structure states an unknown point in time"
created: "2026-10-19T00:00:00Z"
last_modified: "2026-10-19T00:00:00Z"
property_address: "100 Stack Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

# Debt structure states an unknown point in time

RFC 0098: DS-01.

```json uw:section=property source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "address": "100 Stack Way",
  "total_units": 120
}
```

```json uw:section=debt_structure source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "loan_amount": 18000000,
  "point_in_time": "permanent"
}
```
