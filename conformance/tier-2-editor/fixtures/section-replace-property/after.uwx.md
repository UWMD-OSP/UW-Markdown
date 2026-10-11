---
uw_version: "3.0"
deal_id: TEST-T2-002
deal_name: "Section Replace Fixture"
created: "2026-01-15T10:00:00Z"
last_modified: "<volatile>"
property_address: "300 Test Boulevard"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

```json uw:section=property source=manual ts=<volatile> v=2 confidence=high
{
  "total_units": 60,
  "year_built": 1995,
  "building_class": "B+",
  "renovated_year": 2022,
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "analyst-jane",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "<volatile>",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  }
}
```
