---
uw_version: "3.0"
deal_id: TEST-ACLS-001
deal_name: "Cascade Ridge Data Center"
created: "2026-08-27T00:00:00Z"
last_modified: "2026-08-27T00:00:00Z"
property_address: "900 Server Way"
city: "Mesa"
state: "AZ"
zip: "85201"
asset_class: com.example.specialty_facility
deal_stage: screening
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Cascade Ridge Data Center

A document whose asset class is module-declared (RFC 0003). It is the *same
bytes* across the resolution scenarios beside it — only the host's loaded
modules differ, which is the point: the verdict changes because the reader
changed, never because the document is ambiguous.

## Property

```json uw:section=property source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-27T00:00:00Z",
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
  "_notes": null,
  "total_nra_sqft": 88000,
  "year_built": 2019,
  "condition": "excellent",
  "stories": 1
}
```

## Power Capacity

The section the custom class requires and no builtin has.

```json uw:section=power_capacity source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "power_capacity",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-27T00:00:00Z",
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
  "_notes": null,
  "critical_load_mw": 12.5,
  "pue": 1.28,
  "utility_provider": "Arroyo Power",
  "redundancy": "N+1"
}
```

