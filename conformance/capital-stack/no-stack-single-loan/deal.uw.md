---
uw_version: "1.1"
deal_id: TEST-CS-NO-STACK
deal_name: "Single-Loan Deal Without A Capital Stack"
created: "2026-08-22T10:00:00Z"
last_modified: "2026-08-22T10:00:00Z"
property_address: "200 Single Loan Ln"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: full_underwrite
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 20000000
  loan_amount: 14000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Single-Loan Deal Without A Capital Stack

The regression pin for RFC 0026's additivity claim: a document with only
`debt_structure` and no `capital_stack` computes every single-loan pack metric
exactly as it did before the RFC, and trips none of the CS-* validator rules.

```json uw:section=property source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
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
  "total_units": 100,
  "total_nra_sqft": 90000
}
```

```json uw:section=noi_model source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
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
  "income": { "effective_gross_income": 3250000 },
  "expenses": { "total_operating_expenses": 1950000 },
  "net_operating_income": 1300000
}
```

```json uw:section=valuation source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
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
  "purchase_price": 20000000
}
```

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
  "loan_amount": 14000000,
  "interest_rate": 0.06,
  "amortization_months": 360,
  "annual_debt_service": 1010000
}
```

```json uw:section=sources_uses source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
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
  "sources": { "loan_amount": 14000000, "equity_sponsor": 6000000 },
  "total_sources": 20000000,
  "total_uses": 20000000
}
```
