---
uw_version: "1.1"
deal_id: DEAL-CAP-01
deal_name: "Capability Token Conformance Deal"
created: "2026-09-01T10:00:00Z"
last_modified: "2026-09-01T10:00:00Z"
property_address: "700 Coordinator Ct"
city: "Denver"
state: "CO"
zip: "80202"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Capability Token Conformance Deal

The shared base document for the RFC 0011 capability suite. Every scenario
edits this file under a different token; the tokens themselves are generated
(`scripts/gen-capability-fixtures.mjs`) with the published conformance TEST
key, which authenticates nothing.

```json uw:section=noi_model source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "net_operating_income": 480000
}
```

```json uw:section=risk_assessment source=manual ts=2026-09-01T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "risk_assessment",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "overall_rating": "moderate"
}
```

```json uw:section=validation source=system/uwmd ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "status": "clean"
}
```
