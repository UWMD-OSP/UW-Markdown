---
uw_version: "3.0"
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

The `noi_model` block declares `_meta.quality.partial: true` but provides no
`field_overrides` array enumerating which fields are missing. Validator
MUST emit `DQ-03` (warning).

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
  "address": "909 DQ-03 Lane, Phoenix, AZ 85001",
  "asset_class": "multifamily",
  "units": 18
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=agent/agent-underwriter ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "agent/agent-underwriter",
      "resolution": "ai_extracted",
      "actor": "agent/underwriter",
      "agent_id": "agent/underwriter",
      "agent_version": "1.0.0",
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": "T-12 was partially illegible; some lines could not be extracted."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false,
      "flags": [],
      "partial": true,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "expense_ratio": 0.42
}
```
