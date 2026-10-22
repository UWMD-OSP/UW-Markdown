---
uw_version: "3.0"
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

The `noi_model` block is `_meta.quality.provisional: true` but no `gaps`
section references it. Validator MUST emit `DQ-01` (warning).

## Property {#property}

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
  "address": "808 DQ-01 Lane, Phoenix, AZ 85001",
  "asset_class": "multifamily",
  "units": 30
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=system/uwmd ts=2026-01-15T10:00:00Z v=1 confidence=low
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "system/uwmd",
      "resolution": "asset_class_default",
      "actor": "agent/scope-reviewer",
      "agent_id": "agent/scope-reviewer",
      "agent_version": "1.0.0",
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": true
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "expense_ratio": 0.4
}
```
