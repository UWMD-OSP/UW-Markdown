---
uw_version: "3.0"
deal_id: TEST-CONTENT-MEMBER
deal_name: "Content Member Fixture"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
property_address: "18 Bare Block Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---
# A payload member named `content` (RFC 0081 §3)

A Format 3.0 block is the bare section payload with an inline `_meta`. Its
reserved members are `_meta`, `_role`, `_overrides` and `_notes`; every other
member is payload, including one named `content`. Readers never treat it as a
wrapper: the property states 48 units, and the `content` object below is an
ordinary member whose own `total_units` (99) is not the property's.

```json uw:section=property source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-12T00:00:00Z",
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
  "total_units": 48,
  "year_built": 1999,
  "content": {
    "total_units": 99
  }
}
```
