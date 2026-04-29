---
uw_version: "1.1"
deal_id: TEST-T2-PARENTHASH
deal_name: "Parent Hash Stamp"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "700 Parent Hash Way"
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

# Parent-hash stamp

The `property` head carries a real `content_hash`. After applyEditAsync
with `options.integrity: true`, the new head MUST be stamped with
`parent_hash` equal to the prior head's `content_hash`, plus a freshly
computed `content_hash`.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null,
    "content_hash": "3d38dcfda27e58c1bdd9cced400763082f86277efe2dab9cc110e65581935ec0"
  },
  "address": "700 Parent Hash Way",
  "asset_class": "multifamily",
  "units": 24
}
```
