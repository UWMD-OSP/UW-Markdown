---
uw_version: "1.1"
deal_id: TEST-T4-REPLAY-001
deal_name: "L6 Risk Rating Replay Fixture"
created: "2026-08-09T00:00:00Z"
last_modified: "2026-08-09T00:00:00Z"
property_address: "410 Cedar Ct"
city: "Mesa"
state: "AZ"
zip: "85201"
asset_class: multifamily
deal_stage: credit_approval
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 24000000
  loan_amount: 15600000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# L6 Risk Rating Replay Fixture

Input document for the Tier-4 recorded-replay scenario. It carries the sections
the L6 Risk Rating layer reads (`property`, `valuation`, `noi_model`,
`debt_structure`) so the layer's context check passes and the run actually
proceeds. Replaying `cassette.json` against this file MUST reproduce
`after.uwx.md` byte for byte.

```json uw:section=property source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
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
    "timestamp": "2026-08-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "total_units": 160,
    "total_nra_sqft": 142000,
    "year_built": 1998
  },
  "_notes": null
}
```

```json uw:section=valuation source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "section_id": "valuation",
  "_meta": {
    "section_id": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "purchase_price": 24000000
  },
  "_notes": null
}
```

```json uw:section=noi_model source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "section_id": "noi_model",
  "_meta": {
    "section_id": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "effective_gross_income": 2400000,
    "operating_expenses": 1020000,
    "net_operating_income": 1380000
  },
  "_notes": null
}
```

```json uw:section=debt_structure source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "section_id": "debt_structure",
  "_meta": {
    "section_id": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "loan_amount": 15600000,
    "interest_rate": 0.0575,
    "amortization_months": 360,
    "annual_debt_service": 1092000
  },
  "_notes": null
}
```

```json uw:section=sources_uses source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "section_id": "sources_uses",
  "_meta": {
    "section_id": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-09T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "sources": {
      "senior_debt": 15600000,
      "equity_sponsor": 9200000
    },
    "uses": {
      "purchase_price": 24000000,
      "closing_costs": 800000
    }
  },
  "_notes": null
}
```
