---
uw_version: "3.0"
deal_id: TEST-T2-PARENTHASH
deal_name: "Parent Hash Stamp"
created: "2026-01-15T10:00:00Z"
last_modified: "<volatile>"
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

```json uw:section=property superseded=true source=manual ts=<volatile> v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "<volatile>",
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
      "superseded": true
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": null,
      "content_hash": "80b42de6702a102a5ffc7f084e2ec9267e6854ca7583ad58a981e986527649ae"
    }
  },
  "address": "700 Parent Hash Way",
  "asset_class": "multifamily",
  "units": 24
}
```


```json uw:section=property source=manual ts=<volatile> v=2 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "analyst-jane",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "<volatile>",
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
      "revision": 2,
      "superseded": false
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": "80b42de6702a102a5ffc7f084e2ec9267e6854ca7583ad58a981e986527649ae",
      "content_hash": "5e1d2bcfbfe419cec452baf18b4339748320afe62f4368f07b7521ae17c7c9e7"
    }
  },
  "address": "700 Parent Hash Way",
  "asset_class": "multifamily",
  "units": 36
}
```
