---
uw_version: "3.0"
deal_id: TEST-T4-REPLAY-001
deal_name: "L6 Risk Rating Replay Fixture"
created: "2026-08-09T00:00:00Z"
last_modified: "2026-08-13T00:00:00.000Z"
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

Input document for the agent recorded-replay scenario. It carries the sections
the L6 Risk Rating layer reads (`property`, `valuation`, `noi_model`,
`debt_structure`) so the layer's context check passes and the run actually
proceeds. Replaying `cassette.json` against this file MUST reproduce
`after.uwx.md` byte for byte.

```json uw:section=property source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-09T00:00:00Z",
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
  "total_units": 160,
  "total_nra_sqft": 142000,
  "year_built": 1998
}
```

```json uw:section=valuation source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-09T00:00:00Z",
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
  "purchase_price": 24000000
}
```

```json uw:section=noi_model source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-09T00:00:00Z",
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
  "effective_gross_income": 2400000,
  "operating_expenses": 1020000,
  "net_operating_income": 1380000
}
```

```json uw:section=debt_structure source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-09T00:00:00Z",
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
  "loan_amount": 15600000,
  "interest_rate": 0.0575,
  "amortization_months": 360,
  "annual_debt_service": 1092000
}
```

```json uw:section=sources_uses source=manual ts=2026-08-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-09T00:00:00Z",
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
  "sources": {
    "senior_debt": 15600000,
    "equity_sponsor": 9200000
  },
  "uses": {
    "purchase_price": 24000000,
    "closing_costs": 800000
  }
}
```


```json uw:section=risk_assessment source=agent/L6-01 ts=2026-08-13T00:00:00.000Z v=1 confidence=medium
{
  "_meta": {
    "section": "risk_assessment",
    "provenance": {
      "source": "agent/L6-01",
      "actor": "system",
      "agent_id": "L6-01",
      "agent_version": "1.0.0",
      "timestamp": "2026-08-13T00:00:00.000Z",
      "notes": "DSCR is the binding constraint. Recommend conditioning approval on the interest reserve being funded at close."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": true,
      "flags": [
        "dscr_below_threshold",
        "concentration_single_tenant"
      ],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": "DSCR is the binding constraint. Recommend conditioning approval on the interest reserve being funded at close.",
  "overall_risk_rating": "moderate",
  "risk_factors": [
    {
      "factor": "debt_service_coverage",
      "severity": "high",
      "note": "DSCR of 1.12x sits below the 1.20x policy floor."
    },
    {
      "factor": "market_concentration",
      "severity": "medium",
      "note": "Submarket absorption has slowed for three consecutive quarters."
    }
  ],
  "mitigants": [
    "Sponsor has committed a 12-month interest reserve.",
    "In-place rents are 8% below comparable properties, leaving headroom."
  ],
  "recommendation": "proceed_with_conditions"
}
```


```json uw:section=pipeline_log source=system/uwmd ts=2026-08-13T00:00:00.000Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "provenance": {
      "source": "system/uwmd",
      "actor": "system",
      "agent_id": null,
      "agent_version": "1.0.0",
      "timestamp": "2026-08-13T00:00:00.000Z",
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
  "entries": [
    {
      "entry_id": "log_1786579200000_L6-01_0",
      "timestamp": "2026-08-13T00:00:00.000Z",
      "event_type": "agent_run",
      "agent_or_actor": "L6-01",
      "section_affected": "risk_assessment",
      "status": "success",
      "input_sections": [
        "deal_context",
        "property",
        "noi_model",
        "valuation",
        "debt_structure",
        "market_analysis",
        "borrower_sponsor",
        "stress_tests",
        "dcf",
        "compliance"
      ],
      "output_sections": [
        "risk_assessment"
      ],
      "flags_raised": [
        "dscr_below_threshold",
        "concentration_single_tenant"
      ],
      "flags_cleared": [],
      "duration_ms": 0,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": null
    }
  ]
}
```
