---
uw_version: "3.0"
deal_id: TEST-0098-E-STACK-ABSENT
deal_name: "Stack states no point in time"
created: "2026-10-19T00:00:00Z"
last_modified: "2026-10-19T00:00:00Z"
property_address: "100 Stack Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

# Stack states no point in time

RFC 0098: CS-04.

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

```json uw:section=capital_stack source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
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
  "tranches": [
    {
      "id": "senior",
      "class": "senior_debt",
      "position": 1,
      "amount": 18000000,
      "rate": 0.06
    },
    {
      "id": "mezz",
      "class": "mezzanine_debt",
      "position": 2,
      "amount": 2000000,
      "rate": 0.11
    }
  ]
}
```
