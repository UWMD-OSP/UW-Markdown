---
uw_version: "1.1"
deal_id: TEST-MAL-001
deal_name: "Malformed: Missing _meta on a section block"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "1 Missing Meta Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 1.25
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
  equity_required: 2500000
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Malformed fixture — missing `_meta`

The `property` block below carries content keys but no `_meta`. The
validator MUST emit `META_MISSING` for that section.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1
{
  "total_units": 50,
  "year_built": 1995,
  "building_class": "B"
}
```
