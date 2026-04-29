---
uw_version: "1.1"
deal_id: TEST-MAL-006
deal_name: "Malformed: wrong actor for section policy (POL-01)"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:30:00Z"
property_address: "606 POL-01 Way"
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

# Malformed — POL-01

`risk_assessment` was written by `agent/L1`. The (custom, fixture-bound)
policy at `06-wrong-actor.policies.json` declares that `agent/L1` is
restricted to `human_only` authority. `verifyProvenance` MUST emit
`POL-01`.

## Property {#property}

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
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
  "address": "606 POL-01 Way",
  "asset_class": "multifamily",
  "units": 24
}
```

## Risk Assessment {#risk_assessment}

```json uw:section=risk_assessment source=agent/L1 ts=2026-01-15T10:30:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "risk_assessment",
    "version": 1,
    "superseded": false,
    "source": "agent/L1",
    "agent_id": "agent/L1",
    "agent_version": "1.0.0",
    "actor": "agent/L1",
    "timestamp": "2026-01-15T10:30:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Risk write by L1 — under fixture policy this section requires human authority."
  },
  "summary": "Auto-generated risk score.",
  "risk_score": 0.42
}
```
