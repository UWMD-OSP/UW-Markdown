---
uw_version: "1.1"
deal_id: TEST-MAL-010
deal_name: "Malformed: No property section"
created: "2026-08-26T10:00:00Z"
last_modified: "2026-08-26T10:00:00Z"
property_address: "10 Absent Avenue"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: office
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Malformed fixture — the property section is missing

This deal record has a `debt_structure` section and nothing else. §4.1
requires a `property` section at every stage, so the validator MUST emit
`CC-14` (warning). The declared `screening` stage also requires `validation`,
which the file lacks — `DQ-06` (info) MUST name it. `DQ-06` MUST NOT also
name `property`: `CC-14` already carries that defect (one defect, one
diagnostic), and the frozen expectation would catch a duplicate as an
unexpected extra only in the tier-1 valid baselines, so the mutual exclusion
is additionally pinned by unit tests.

```json uw:section=debt_structure source=manual ts=2026-08-26T10:00:00Z v=1
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "source": "manual",
    "timestamp": "2026-08-26T10:00:00Z",
    "confidence": "high"
  },
  "loan_amount": 7500000,
  "interest_rate": 0.0619
}
```
