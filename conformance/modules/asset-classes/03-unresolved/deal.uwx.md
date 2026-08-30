---
uw_version: "1.1"
deal_id: TEST-ACLS-001
deal_name: "Cascade Ridge Data Center"
created: "2026-08-27T00:00:00Z"
last_modified: "2026-08-27T00:00:00Z"
property_address: "900 Server Way"
city: "Mesa"
state: "AZ"
zip: "85201"
asset_class: com.example.data_center
modules:
  - id: com.example.datacenters
    version: ">=0.1.0 <1.0.0"
deal_stage: screening
status: under_review
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
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "total_nra_sqft": 88000,
    "year_built": 2019,
    "condition": "excellent",
    "stories": 1
  },
  "_notes": null
}
```

## Power Capacity

The section the custom class requires and no builtin has.

```json uw:section=power_capacity source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "power_capacity",
  "_meta": {
    "section_id": "power_capacity",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "critical_load_mw": 12.5,
    "pue": 1.28,
    "utility_provider": "SRP",
    "redundancy": "N+1"
  },
  "_notes": null
}
```

