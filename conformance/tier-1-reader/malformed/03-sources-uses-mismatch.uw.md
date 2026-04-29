---
uw_version: "1.1"
deal_id: TEST-MAL-003
deal_name: "Malformed: Sources do not equal Uses"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "3 Mismatch Boulevard"
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

# Malformed fixture — Sources & Uses do not balance

`total_sources` = $10,000,000 but `total_uses` = $10,500,000. The
validator MUST emit `CC-04` (severity: error) with the $500,000 delta.

```json uw:section=sources_uses source=manual ts=2026-01-15T10:00:00Z v=1
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "source": "manual",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high"
  },
  "sources": {
    "loan_amount": 7500000,
    "sponsor_equity": 2500000
  },
  "uses": {
    "purchase_price": 10000000,
    "closing_costs": 500000
  },
  "total_sources": 10000000,
  "total_uses": 10500000
}
```
