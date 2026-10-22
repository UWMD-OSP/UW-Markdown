---
uw_version: "3.0"
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
status: in_progress
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
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-27T00:00:00Z",
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
  "net_operating_income": 600000,
  "effective_gross_income": 900000
}
```

```json uw:section=dcf source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dcf",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-27T00:00:00Z",
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
  "exit_cap_rate": 0.06,
  "hold_period_years": 5
}
```

```json uw:section=debt_structure source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-27T00:00:00Z",
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
  "loan_amount": 7500000,
  "annual_debt_service": 480000
}
```

