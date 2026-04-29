---
uw_version: "1.1"
deal_id: TEST-DEPGRAPH-001
deal_name: "Dependency Graph Fixture (Multifamily)"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "1 Graph Way"
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

# Dependency-graph fixture

The fixture has no `custom_calculations`. The expected graph reflects
the multifamily pack only.

## Property {#property}

```json uw:section=property source=user_input ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "user_input",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "address": "1 Graph Way",
  "asset_class": "multifamily",
  "units": 24
}
```
