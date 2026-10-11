---
uw_version: "3.0"
deal_id: TEST-T2-GAPS
deal_name: "Gaps Section Auto-Update (Edited)"
created: "2026-01-15T10:00:00Z"
last_modified: "<volatile>"
property_address: "600 Gaps Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: scope
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Gaps section is rewritten after every edit when maintainGaps is on.

```json uw:section=property source=manual ts=<volatile> v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
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
      "revision": 1,
      "superseded": false
    }
  },
  "address": "600 Gaps Way",
  "asset_class": "multifamily",
  "units": 18
}
```


```json uw:section=gaps source=system/gaps-maintainer ts=<volatile> v=1 confidence=high
{
  "items": [],
  "summary": {
    "total_open": 0,
    "blocking_current_stage": 0,
    "blocking_next_stage": 0
  },
  "_meta": {
    "section": "gaps",
    "provenance": {
      "source": "system/gaps-maintainer",
      "actor": "system/gaps-maintainer",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "<volatile>",
      "notes": "Auto-maintained by editor; see FORMAT_SPEC §4.22."
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
  }
}
```
