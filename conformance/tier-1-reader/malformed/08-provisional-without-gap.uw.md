---
uw_version: "1.1"
deal_id: TEST-MAL-008
deal_name: "Malformed: provisional block without gaps reference"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "808 DQ-01 Lane"
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

# Malformed — DQ-01

The `noi_model` block is `_meta.provisional: true` but no `gaps`
section references it. Validator MUST emit `DQ-01` (warning).

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
  "address": "808 DQ-01 Lane, Phoenix, AZ 85001",
  "asset_class": "multifamily",
  "units": 30
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=asset_class_default ts=2026-01-15T10:00:00Z v=1 confidence=low
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "asset_class_default",
    "agent_id": "agent/L0a",
    "agent_version": "1.0.0",
    "actor": "agent/L0a",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "low",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null,
    "provisional": true
  },
  "expense_ratio": 0.40
}
```
