---
uw_version: "3.0"
deal_id: TEST-T3-002
deal_name: "DSCR From Section"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "600 Office Park Dr"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: office
deal_stage: full_underwrite
status: in_progress
recommendation: pending
quick_metrics:
  purchase_price: 30000000
  loan_amount: 21000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# DSCR From Section Calc Fixture

Tests deepGet path resolution: NOI comes from a section block, debt service
from another. Result = noi_model.net_operating_income / debt_structure.annual_debt_service.

```json uw:section=noi_model source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
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
  "_notes": null,
  "effective_gross_income": 3200000,
  "operating_expenses": 1100000,
  "net_operating_income": 2100000
}
```

```json uw:section=debt_structure source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
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
  "_notes": null,
  "loan_amount": 21000000,
  "interest_rate": 0.06,
  "amortization_months": 360,
  "annual_debt_service": 1511250
}
```
