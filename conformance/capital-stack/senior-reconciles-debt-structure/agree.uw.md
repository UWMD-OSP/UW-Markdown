---
uw_version: "1.1"
deal_id: TEST-CS-CC03-AGREE
deal_name: "Senior Reconciles With Debt Structure"
created: "2026-08-22T10:00:00Z"
last_modified: "2026-08-22T10:00:00Z"
property_address: "100 Stack Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: full_underwrite
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 40000000
  loan_amount: 26000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Senior Reconciles With Debt Structure

The `capital_stack` senior_debt tranche states the same amount as
`debt_structure.loan_amount`, so the generalized CC-03 (RFC 0026 §4.24) must
NOT fire: one senior view, stated once, agreeing everywhere.

```json uw:section=debt_structure source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-22T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "loan_amount": 26000000,
  "interest_rate": 0.0625,
  "amortization_months": 360,
  "annual_debt_service": 1920950
}
```

```json uw:section=capital_stack source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-22T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "tranches": [
    { "id": "senior", "class": "senior_debt", "position": 1, "amount": 26000000, "rate": 0.0625, "amortization_months": 360, "accrual": "cash" },
    { "id": "mezz", "class": "mezzanine_debt", "position": 2, "amount": 6000000, "rate": 0.11, "amortization_months": 0, "accrual": "cash" },
    { "id": "common", "class": "common_equity", "position": 3, "amount": 8000000 }
  ]
}
```
