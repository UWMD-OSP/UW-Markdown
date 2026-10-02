---
uw_version: "1.1"
deal_id: TEST-BEDS
deal_name: "Inconsistent Student Bed Counts Fixture"
created: "2026-10-02T00:00:00Z"
last_modified: "2026-10-02T00:00:00Z"
property_address: "1 Campus Way"
city: "Tempe"
state: "AZ"
zip: "85281"
asset_class: student_housing
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Inconsistent student-housing bed counts (RFC 0069)

```json uw:section=property source=manual v=1
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "total_units": 180,
  "total_beds": 600
}
```

```json uw:section=rent_roll source=manual v=1
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "rent_roll_type": "multifamily",
  "as_of_date": "2026-03-15",
  "occupied_beds": 567,
  "preleased_beds": 620,
  "preleased_as_of": "2026-09-01",
  "preleased_term_start": "2026-08-15"
}
```
