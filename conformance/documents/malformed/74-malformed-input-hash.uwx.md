---
uw_version: "3.0"
deal_id: HASH-74
deal_name: Synthetic hash shape
asset_class: multifamily
deal_stage: scope
property_address: 100 Synthetic Way
city: Test City
state: AZ
zip: "85001"
---

```json uw:section=property
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "tester",
      "timestamp": "2026-01-01T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "integrity": {
      "input_hash": "sha256:abcd"
    }
  },
  "address": "100 Synthetic Way",
  "asset_class": "multifamily",
  "units": 10,
  "asking_price": 1000000
}
```
