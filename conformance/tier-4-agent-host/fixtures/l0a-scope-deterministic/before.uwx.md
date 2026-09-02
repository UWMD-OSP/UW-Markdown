---
uw_version: "1.1"
deal_id: TEST-T4-L0A
deal_name: "L0a Scope Agent — deterministic baseline"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "1 L0a Lane"
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

# L0a deterministic input

The L0a Scope agent walks the asset-class fallback cascade for every
required input field and stamps results provisional. With this fixture,
a deterministic agent (no LLM) MUST produce a stable output — that
output's shape is captured in `expected-after-shape.json`.

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
  "address": "1 L0a Lane, Phoenix, AZ 85001",
  "asset_class": "multifamily",
  "units": 30,
  "asking_price": 6000000
}
```
