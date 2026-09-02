---
uw_version: "1.1"
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
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Student Housing Pre-Lease Rate

```json uw:section=property source=manual ts=2026-08-13T00:00:00Z v=1 confidence=high
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
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
  "content": { "total_beds": 600 }
}
```

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
  "content": { "preleased_beds": 570 }
}
```
