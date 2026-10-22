---
uw_version: "3.0"
deal_id: TEST-T2-GAPS
deal_name: "Gaps Section Auto-Update"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "600 Gaps Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: scope
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Gaps section is rewritten after every edit when maintainGaps is on.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
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
      "revision": 1,
      "superseded": false
    }
  },
  "address": "600 Gaps Way",
  "asset_class": "multifamily",
  "units": 18
}
```
