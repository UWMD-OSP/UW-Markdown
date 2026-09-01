---
uw_version: "1.1"
deal_id: TEST-MAL-009
deal_name: "Malformed: partial block without field_overrides"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "909 DQ-03 Lane"
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

# Malformed — DQ-03

The `noi_model` block declares `_meta.partial: true` but provides no
`field_overrides` array enumerating which fields are missing. Validator
MUST emit `DQ-03` (warning).

## Property {#property}

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
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
  "address": "909 DQ-03 Lane, Phoenix, AZ 85001",
  "asset_class": "multifamily",
  "units": 18
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=agent/agent-L2 ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "agent/agent-L2",
    "resolution": "ai_extracted",
    "agent_id": "agent/L2",
    "agent_version": "1.0.0",
    "actor": "agent/L2",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "T-12 was partially illegible; some lines could not be extracted.",
    "partial": true
  },
  "expense_ratio": 0.42
}
```
