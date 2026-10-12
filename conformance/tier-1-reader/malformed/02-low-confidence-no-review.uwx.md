---
uw_version: "3.0"
deal_id: TEST-MAL-002
deal_name: "Malformed: Low confidence without human review flag"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "2 Low Confidence Way"
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
created_by: "test-fixture"
---

# Malformed fixture — low confidence, no human-review flag

The `property` section below carries `_meta.quality.confidence: "low"` but does
NOT set `_meta.quality.human_review_required: true`. The validator MUST emit
`META_LOW_CONFIDENCE_NO_REVIEW_FLAG` (severity: info).

```json uw:section=property source=agent/unattributed ts=2026-01-15T10:00:00Z v=1
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "agent/unattributed",
      "resolution": "ai_extracted",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1
    }
  },
  "total_units": 50,
  "year_built": 1995,
  "building_class": "B"
}
```
