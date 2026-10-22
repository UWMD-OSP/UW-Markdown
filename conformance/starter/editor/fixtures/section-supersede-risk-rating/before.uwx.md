---
uw_version: "3.0"
deal_id: TEST-T2-003
deal_name: "Supersede Fixture"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "400 Test Place"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: credit_approval
status: in_progress
recommendation: pending
quick_metrics:
  purchase_price: 10000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

```json uw:section=risk_assessment source=agent/risk-rater ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "risk_assessment",
    "provenance": {
      "source": "agent/risk-rater",
      "actor": "risk-rating-agent",
      "agent_id": "risk-rater",
      "agent_version": "0.1.0",
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": true,
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
  "overall_rating": "moderate",
  "risk_score": 5,
  "key_risks": [
    "market softening",
    "concentration"
  ]
}
```
