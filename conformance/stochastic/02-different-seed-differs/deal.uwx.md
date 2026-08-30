---
uw_version: "1.1"
deal_id: TEST-STOCH-001
deal_name: "Stochastic Base"
created: "2026-08-27T00:00:00Z"
last_modified: "2026-08-27T00:00:00Z"
property_address: "77 Grid Street"
city: "Tempe"
state: "AZ"
zip: "85281"
asset_class: multifamily
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Stochastic Base

The same round numbers the sensitivity fixtures use. What the scenarios beside
this file pin is not the shape of a distribution — that is a statistics
question — but that the SAME SEED PRODUCES THE SAME NUMBERS. A stochastic calc
two hosts disagree about is not a model, it is a rumor.

```json uw:section=noi_model source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "noi_model",
  "_meta": {
    "section_id": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "net_operating_income": 600000,
    "effective_gross_income": 900000
  },
  "_notes": null
}
```

```json uw:section=dcf source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "dcf",
  "_meta": {
    "section_id": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "exit_cap_rate": 0.06,
    "hold_period_years": 5
  },
  "_notes": null
}
```

```json uw:section=debt_structure source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "debt_structure",
  "_meta": {
    "section_id": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "loan_amount": 7500000,
    "annual_debt_service": 480000
  },
  "_notes": null
}
```

