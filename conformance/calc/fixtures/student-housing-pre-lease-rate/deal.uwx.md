---
uw_version: "3.0"
deal_id: TEST-T3-STUDENT-001
deal_name: "Student Housing Pre-Lease Rate"
created: "2026-08-13T00:00:00Z"
last_modified: "2026-08-13T00:00:00Z"
property_address: "300 Campus Way"
city: "Tempe"
state: "AZ"
zip: "85281"
asset_class: student_housing
deal_stage: full_underwrite
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Student Housing Pre-Lease Rate

```json uw:section=property source=manual ts=2026-08-13T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
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
  "total_beds": 600
}
```

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
  "preleased_beds": 570,
  "preleased_as_of": "2026-03-15",
  "preleased_term_start": "2026-08-15"
}
```
