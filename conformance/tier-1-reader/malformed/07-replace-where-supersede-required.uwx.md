---
uw_version: "3.0"
deal_id: TEST-MAL-007
deal_name: "Malformed: replace-where-supersede-required (POL-02)"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:30:00Z"
property_address: "707 POL-02 Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Malformed — POL-02

The `noi_model` block is at `_meta.version: 2` and was written by an
agent (source `agent/L2`). The `agent/*` policy mandates
`supersede_on_edit: true`, but no superseded prior version exists in
this file — the v1 block was overwritten via `section_replace` instead
of `section_supersede`. `verifyProvenance` MUST emit `POL-02`.

## Property {#property}

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
    }
  },
  "address": "707 POL-02 Way",
  "asset_class": "multifamily",
  "units": 24
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=agent/L2 ts=2026-01-15T10:30:00Z v=2 confidence=medium
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "agent/L2",
      "actor": "agent/L2",
      "agent_id": "agent/L2",
      "agent_version": "1.0.0",
      "timestamp": "2026-01-15T10:30:00Z",
      "notes": "v2 written via section_replace; v1 was discarded — should have been section_supersede."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "expense_ratio": 0.41
}
```
