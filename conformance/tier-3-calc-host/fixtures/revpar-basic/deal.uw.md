---
uw_version: "1.1"
deal_id: TEST-T3-001
deal_name: "RevPAR Basic"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "500 Hospitality Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: hospitality
deal_stage: full_underwrite
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 25000000
  adr: 145.50
  occupancy: 0.72
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# RevPAR Basic Calc Fixture

Tests literal-input calc evaluation: `RevPAR = adr * occupancy`. No section
data needed — both inputs come from frontmatter.quick_metrics.
