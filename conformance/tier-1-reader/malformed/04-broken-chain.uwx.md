---
uw_version: "3.0"
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
      "superseded": true
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": null,
      "content_hash": "930f7cfebf6ed49621b0b6f59c8ebd1833ed42ba2d0d652f8ac0bcb4e493acf0"
    }
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
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:05:00Z",
      "notes": "Bumped unit count after re-walk."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": "930f7cfebf6ed49621b0b6f59c8ebd1833ed42ba2d0d652f8ac0bcb4e493acf0",
      "content_hash": "01f499e7d0af9d8b293d4ecbf22b2fc5d7b1ed0094939fa81cb06c0e870c3851"
    }
  },
  "address": "404 Broken Chain Way",
  "asset_class": "multifamily",
  "units": 30
}
```
