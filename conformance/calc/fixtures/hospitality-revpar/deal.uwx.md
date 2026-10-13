---
uw_version: "3.0"
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
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-13T00:00:00Z",
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
  "available_room_nights": 36000
}
```

```json uw:section=noi_model source=manual ts=2026-08-13T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-13T00:00:00Z",
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
  "income": {
    "rooms_revenue": 4320000
  }
}
```
