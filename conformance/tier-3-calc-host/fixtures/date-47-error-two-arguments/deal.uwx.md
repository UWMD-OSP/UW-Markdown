---
uw_version: "2.0"
deal_id: TEST-T3-DATE
deal_name: "Calendar-date predicate probes"
created: "2026-10-04T00:00:00Z"
last_modified: "2026-10-04T00:00:00Z"
property_address: "1 Calendar Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: office
deal_stage: screening
status: draft
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
probe_quoted: "2026-10-03"
probe_unquoted: 2026-10-03
probe_null: null
probe_number: 20261003
probe_bool: true
---

# Calendar-date predicate probes (RFC 0071)

Shared input for the `date-NN` fixtures. Literal cases ignore it. Document cases
read the frontmatter extension keys above (§XII.1), including an unquoted YAML
date that the strict subset keeps as a string, and the `date_probe` section
below, which carries the shapes YAML cannot.

```json uw:section=date_probe source=manual confidence=high
{
  "section_id": "date_probe",
  "_meta": {
    "section_id": "date_probe",
    "version": 1,
    "timestamp": "2026-10-04T00:00:00Z",
    "source": "manual",
    "actor": "test-fixture",
    "confidence": "high"
  },
  "content": {
    "impossible": "2026-02-30",
    "number": 20261003,
    "boolean": false,
    "null_value": null,
    "array": ["2026-10-03"],
    "object": { "date": "2026-10-03" }
  }
}
```
