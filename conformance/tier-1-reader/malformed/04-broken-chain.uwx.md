---
uw_version: "1.1"
deal_id: TEST-MAL-004
deal_name: "Malformed: broken supersede-chain (parent_hash mismatch)"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:05:00Z"
property_address: "404 Broken Chain Way"
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

# Malformed — INT-01

Two versions of the `property` block. v1 declares a `content_hash`; v2
declares its own `content_hash` AND a `parent_hash` that does NOT match
v1's `content_hash`. `verifyChain` MUST emit `INT-01` for v2.

## Property — v1 (superseded) {#property-v1}

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": true,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null,
    "content_hash": "1111111111111111111111111111111111111111111111111111111111111111"
  },
  "address": "404 Broken Chain Way",
  "asset_class": "multifamily",
  "units": 24
}
```

## Property — v2 (current head) {#property}

```json uw:section=property source=manual ts=2026-01-15T10:05:00Z v=2 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 2,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-15T10:05:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Bumped unit count after re-walk.",
    "content_hash": "2222222222222222222222222222222222222222222222222222222222222222",
    "parent_hash": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "address": "404 Broken Chain Way",
  "asset_class": "multifamily",
  "units": 30
}
```
