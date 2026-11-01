---
uw_version: "3.0"
deal_id: "uw_SYNTHETIC_QUICKSTART"
deal_name: "Synthetic Ten-Unit Example"
created: "2026-11-01T19:24:44.704Z"
last_modified: "2026-11-01T19:24:44.729Z"

property_address: ""
city: ""
state: ""
zip: ""
asset_class: multifamily
asset_subtype: null
loan_type: null
scenario: null

status: draft
deal_stage: screening
recommendation: null

quick_metrics:
  purchase_price: 1000000
  loan_amount: 600000
  noi_underwritten: 74000
  dscr: 1.85
  ltv: 0.6
  debt_yield: 0.123333
  cap_rate: 0.074
  irr_projected: null
  equity_required: 400000

flags: []
blocking_flags: []

tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# Synthetic Ten-Unit Example

> _Deal underwriting file — created 2026-11-01. Fill in sections via the wizard or directly._

## Deal Context {#deal_context}

_§4.0 — Add narrative here._

```json uw:section=deal_context source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "deal_context",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Property {#property}

_§4.1 — Add narrative here._

```json uw:section=property source=manual ts=2026-11-01T19:24:44.711Z v=2 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.711Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "asset_class": "multifamily",
  "total_units": 10,
  "total_nra_sqft": 10000
}
```

---

## Ownership & Acquisition {#ownership}

_§4.2 — Add narrative here._

```json uw:section=ownership source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "ownership",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Rent Roll {#rent_roll}

_§4.3 — Add narrative here._

```json uw:section=rent_roll source=manual ts=2026-11-01T19:24:44.713Z v=2 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.713Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "rent_roll_type": "multifamily",
  "unit_mix_summary": [
    {
      "unit_type": "Example unit",
      "count": 10,
      "avg_sqft": 1000,
      "avg_rent_inplace": 1000,
      "avg_rent_market": 1000,
      "occupancy_pct": 1
    }
  ],
  "total_units": 10,
  "occupied_units": 10,
  "physical_occupancy_pct": 1,
  "gross_potential_rent_monthly": 10000,
  "gross_potential_rent_annual": 120000,
  "in_place_rent_monthly": 10000,
  "in_place_rent_annual": 120000,
  "loss_to_lease_monthly": 0,
  "loss_to_lease_pct": 0
}
```

---

## Operating Statement {#operating_statement}

_§4.4 — Add narrative here._

```json uw:section=operating_statement variant=default source=manual ts=2026-11-01T19:24:44.713Z v=2 confidence=high
{
  "_meta": {
    "section": "operating_statement",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.713Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "income": {
    "gross_potential_rent": 120000,
    "less_vacancy_credit_loss": 6000,
    "vacancy_pct": 0.05,
    "effective_gross_income": 114000
  },
  "expenses": {
    "real_estate_taxes": 20000,
    "insurance": 10000,
    "repairs_maintenance": 10000,
    "total_operating_expenses": 40000
  },
  "net_operating_income": 74000,
  "expense_ratio": 0.3509,
  "noi_margin": 0.6491
}
```

---

## NOI Model {#noi_model}

_§4.5 — Add narrative here._

```json uw:section=noi_model source=manual ts=2026-11-01T19:24:44.714Z v=2 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.714Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "income": {
    "effective_gross_income": 114000
  },
  "expenses": {
    "total_operating_expenses": 40000
  },
  "net_operating_income": 74000
}
```

---

## Valuation {#valuation}

_§4.6 — Add narrative here._

```json uw:section=valuation source=manual ts=2026-11-01T19:24:44.715Z v=2 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.715Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "purchase_price": 1000000,
  "underwritten_value": 1000000
}
```

---

## Debt Structure {#debt_structure}

_§4.7 — Add narrative here._

```json uw:section=debt_structure source=manual ts=2026-11-01T19:24:44.716Z v=2 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.716Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "loan_amount": 600000,
  "annual_debt_service": 40000,
  "ltv_basis": "purchase-price"
}
```

---

## Sources & Uses {#sources_uses}

_§4.8 — Add narrative here._

```json uw:section=sources_uses source=manual ts=2026-11-01T19:24:44.718Z v=2 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "manual",
      "actor": "synthetic-example",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.718Z",
      "notes": "Invented teaching inputs; no real property or transaction."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 2,
      "superseded": false
    }
  },
  "sources": {
    "senior_debt": 600000,
    "sponsor_equity": 400000,
    "total": 1000000
  },
  "uses": {
    "purchase_price": 1000000,
    "total": 1000000
  },
  "equity_metrics": {
    "equity_total": 400000
  }
}
```

---

## DCF & Hold Period Analysis {#dcf}

_§4.9 — Add narrative here._

```json uw:section=dcf source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "dcf",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Stress Tests {#stress_tests}

_§4.10 — Add narrative here._

```json uw:section=stress_tests source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "stress_tests",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Market Analysis {#market_analysis}

_§4.11 — Add narrative here._

```json uw:section=market_analysis source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "market_analysis",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Borrower / Sponsor {#borrower_sponsor}

_§4.12 — Add narrative here._

```json uw:section=borrower_sponsor source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "borrower_sponsor",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Lease Schedule {#lease_schedule}

_Unnumbered section — Add narrative here._

```json uw:section=lease_schedule source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "lease_schedule",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Due Diligence {#due_diligence}

_§4.13 — Add narrative here._

```json uw:section=due_diligence source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "due_diligence",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Risk Assessment {#risk_assessment}

_§4.14 — Add narrative here._

```json uw:section=risk_assessment source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "risk_assessment",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Compliance {#compliance}

_§4.15 — Add narrative here._

```json uw:section=compliance source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "compliance",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Assumptions {#assumptions}

_§4.16 — Add narrative here._

```json uw:section=assumptions source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "assumptions",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Preliminary Sizing {#preliminary_sizing}

_Unnumbered section — Add narrative here._

```json uw:section=preliminary_sizing source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "preliminary_sizing",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Flags & Validation {#validation}

_§4.17 — Add narrative here._

```json uw:section=validation source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "validation",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Custom Calculations {#custom_calculations}

_§4.19 — Add narrative here._

```json uw:section=custom_calculations source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "custom_calculations",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Custom Scenarios {#custom_scenarios}

_§4.20 — Add narrative here._

```json uw:section=custom_scenarios source=manual ts=2026-11-01T19:24:44.704Z v=1 confidence=low
{
  "_meta": {
    "section": "custom_scenarios",
    "provenance": {
      "source": "manual",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-11-01T19:24:44.704Z",
      "notes": null
    },
    "quality": {
      "confidence": "low",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null
}
```

---

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=system/init ts=2026-11-01T19:24:44.704Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "provenance": {
      "source": "system/init",
      "actor": "system",
      "agent_id": null,
      "agent_version": "1.0.0",
      "timestamp": "2026-11-01T19:24:44.704Z",
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
      "entry_id": "log_1793561084706",
      "timestamp": "2026-11-01T19:24:44.704Z",
      "event_type": "file_created",
      "agent_or_actor": "uwmd:init",
      "section_affected": null,
      "status": "success",
      "input_sections": [],
      "output_sections": [],
      "flags_raised": [],
      "flags_cleared": [],
      "duration_ms": null,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": "File initialized via uwmd init for deal: Synthetic Ten-Unit Example"
    }
  ]
}
```
