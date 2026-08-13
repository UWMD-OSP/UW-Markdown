---
uw_version: "1.1"
deal_id: TEST-T3-HOSPITALITY-001
deal_name: "Hospitality RevPAR"
created: "2026-08-13T00:00:00Z"
last_modified: "2026-08-13T00:00:00Z"
property_address: "100 Hotel Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: hospitality
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Hospitality RevPAR

```json uw:section=rent_roll source=manual ts=2026-08-13T00:00:00Z v=1 confidence=high
{
  "section_id": "rent_roll",
  "_meta": {
    "section_id": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-13T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": { "available_room_nights": 36000 }
}
```

```json uw:section=noi_model source=manual ts=2026-08-13T00:00:00Z v=1 confidence=high
{
  "section_id": "noi_model",
  "_meta": {
    "section_id": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-13T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": { "income": { "rooms_revenue": 4320000 } }
}
```
