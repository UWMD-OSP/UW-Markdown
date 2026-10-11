---
uw_version: "3.0"
deal_id: TEST-REGISTRY-001
deal_name: "Registry Conflict Fixture"
created: "2026-10-05T00:00:00Z"
last_modified: "2026-10-05T00:00:00Z"
property_address: "100 Example Way"
city: "Mesa"
state: "AZ"
zip: "85201"
asset_class: multifamily
deal_stage: screening
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Registry Conflict Fixture

The document every `registry/` scenario runs against. It deliberately lacks
`shared_section`, so a scenario can show which module's section declaration
is in effect: a required one reports `MOD-SECTION-MISSING`, an optional one
does not.

## Property

```json uw:section=property source=manual ts=2026-10-05T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-05T00:00:00Z",
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
  "units": 12,
  "year_built": 2001
}
```
