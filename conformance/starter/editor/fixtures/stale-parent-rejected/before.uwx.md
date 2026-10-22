---
uw_version: "3.0"
deal_id: TEST-T2-INT02
deal_name: "Stale Parent Hash"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "500 Stale Parent Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Stale parent_hash

The `property` head carries a real `content_hash`. The edit operation
will be issued with a `parentHash` that does NOT match — applyEdit MUST
reject with INT-02.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
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
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": null,
      "content_hash": "49ee85b9160e410d51318fac4e06a8681b88648e5eb3f55ac2971bd662f46f3f"
    }
  },
  "address": "500 Stale Parent Way",
  "asset_class": "multifamily",
  "units": 24
}
```
