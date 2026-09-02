---
uw_version: "1.1"
deal_id: TEST-T2-003
deal_name: "Supersede Fixture"
created: "2026-01-15T10:00:00Z"
last_modified: "<volatile>"
property_address: "400 Test Place"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: credit_approval
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

```json uw:section=risk_assessment superseded=true source=agent/L6 ts=<volatile> v=1 confidence=medium
{
  "section_id": "risk_assessment",
  "_meta": {
    "section_id": "risk_assessment",
    "version": 1,
    "superseded": true,
    "source": "agent/L6",
    "agent_id": "L6-risk-rating",
    "agent_version": "0.1.0",
    "actor": "bancroft-l6",
    "timestamp": "<volatile>",
    "confidence": "medium",
    "human_review_required": true,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "overall_rating": "moderate",
    "risk_score": 5,
    "key_risks": ["market softening", "concentration"]
  },
  "_notes": null
}
```


```json uw:section=risk_assessment source=agent/L6 ts=<volatile> v=2 confidence=medium
{
  "overall_rating": "elevated",
  "risk_score": 7,
  "key_risks": [
    "market softening",
    "concentration",
    "rate environment"
  ],
  "review_notes": "Updated post-rate-shock analysis.",
  "_meta": {
    "section": "risk_assessment",
    "version": 2,
    "superseded": false,
    "source": "agent/L6",
    "agent_id": "L6-risk-rating",
    "agent_version": "0.2.0",
    "actor": "bancroft-l6",
    "timestamp": "<volatile>",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  }
}
```
