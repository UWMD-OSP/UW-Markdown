---
uw_version: "1.1"
deal_id: TEST-YAML-016
deal_name: "Caf\u00e9 \"Tower\" at C:\\deals"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: 'O''Brien Plaza, Suite 4: North'
city: "Smith: &Co *North* !Phase #2 {x} [y]"
state: AZ # two-letter code; the comment is not part of the value
zip: '85001' # quoted, then a comment
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 1.25 # a nested value with a comment
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
  equity_required: 2500000
flags: []
blocking_flags: []
source_documents:
  - "T12 \"trailing\" report.pdf"
  - rent_roll.xlsx # a sequence item with a comment
  - 'it''s: &a *b !c'
tier: screener # a plain token with a comment
created_by: 'fixture: &a *b !c #d {e} [f]'
---

# Minimal Screening Fixture

This is the smallest possible conformant file at the screening stage —
property and quick_metrics only.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "total_units": 50,
    "year_built": 1995,
    "building_class": "B",
    "asset_subtype": "garden",
    "total_nra_sqft": 45000,
    "land_area_acres": 2.1,
    "stories": 2,
    "parking_spaces": 75,
    "parking_type": "surface",
    "zoning": "R-3",
    "condition": "good",
    "amenities": ["pool", "laundry"]
  },
  "_notes": null
}
```
