---
uw_version: "3.0"
deal_id: "uw_2026_dc7q4m1"
deal_name: "Mesa Gateway Data Center — Mesa, AZ"
created: "2026-09-09T08:00:00Z"
last_modified: "2026-09-09T11:00:00Z"

property_address: "6200 S Basalt Ridge Rd"
city: "Mesa"
state: "AZ"
zip: "85212"
asset_class: "data_center"
loan_type: "permanent"
scenario: "stabilized_acquisition"

status: "in_progress"
deal_stage: "full_underwrite"
recommendation: "pending"

quick_metrics:
  purchase_price:    160000000
  loan_amount:       96000000
  noi_underwritten:  11200000
  dscr:              1.579
  ltv:               0.6
  debt_yield:        0.1167
  cap_rate:          0.07
  irr_projected:     0.135
  equity_required:   69000000

flags:
  - "phase_2_pre_lease_rent_commencement_gap"
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "mesa_gateway_rent_roll_aug2026.xlsx"
  - "mesa_gateway_t12_2025.pdf"
  - "mesa_gateway_arroyo_power_capacity_letter_2026.pdf"
  - "mesa_gateway_appraisal_2026.pdf"
---

> Synthetic example: every name, party and figure in this record is fictional.

# Mesa Gateway Data Center — Mesa, AZ

> **Deal ID:** uw_2026_dc7q4m1 | **Scenario:** Stabilized Acquisition | **Status:** In Progress  
> **10.0 MW Commissioned / 12.5 MW Planned** | **11.0 MW Contracted** | **PUE 1.25** | **$160,000,000 Purchase** | **$16,000/kW** | **7.00% Cap Rate (in-place)**

This is the standard's builtin data-center example (RFC 0080).
Its three `dc_*` sections state capacity in **kilowatts**, PUE, redundancy,
power billing, and rent per kW-month alongside the standard real-estate inputs.

The record carries two documented review conditions: 1,000 kW
of phase 2 is pre-leased ahead of commissioning (`CC-DC-04`), and the
in-place rent runs 20% under the comp set, a 25% mark-to-market (`CC-DC-07`). Both appear as warnings in the stored validation result and runtime output.

---

## Deal Context {#deal_context}

Mesa Gateway is a 10 MW (critical IT) wholesale data center in the Elliot Road corridor, 100% contracted to two tenants on power-metered leases, with a permitted 2.5 MW phase 2 already pre-leased to the anchor. Thesis: acquire a modern N+1 facility with a secured 15 MW utility feed at $16,000/kW — well below the cost of new powered capacity in a market where the utility queue, not land, is the constraint.

```json uw:section=deal_context source=manual ts=2026-09-09T08:20:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T08:20:00Z",
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
  "_notes": "Utility feed is 15 MW under an executed Arroyo Power capacity agreement, which covers the 12.5 MW build-out at design PUE. Phase 2 (2.5 MW) is permitted; 1 MW of it is pre-leased to the anchor with rent commencing on delivery.",
  "deal_summary": "10 MW commissioned wholesale data center in Mesa, 100% contracted to two tenants under metered pass-through power, with a permitted 2.5 MW phase 2 of which 1 MW is pre-leased.",
  "investment_thesis": "Secured utility capacity is the scarce asset in the East Valley. Buying commissioned, contracted megawatts at $16,000/kW, with an expansion phase already permitted and partly pre-leased, captures the utility-queue premium without development risk.",
  "value_creation_strategy": "Deliver phase 2 into the pre-lease, mark the anchor's 2029 renewal to a market that is 25% above the in-place rate, and hold the interconnection and services lines as they scale with density.",
  "hold_strategy": "core_plus_hold",
  "exit_strategy_description": "Sell into the institutional bid for stabilized wholesale capacity at year 5-7, or refinance once phase 2 is delivered and the anchor renews at market.",
  "deal_goal": "13-14% levered IRR with contracted cash flow and a permitted expansion."
}
```

---

## Property {#property}

`rentable_square_feet` explicitly states rentable building area as a secondary size; it does not state the building footprint or infer area from power. White space (`raised_floor_sf`) is separately stated in the capacity section. Commissioned critical IT kW remains the primary size for this data center. No area measurement standard is asserted here.

```json uw:section=property source=manual ts=2026-09-09T08:40:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T08:40:00Z",
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
  "rentable_square_feet": null,
  "year_built": 2021,
  "building_class": "A",
  "stories": 1,
  "site_acres": 22.4,
  "parking_spaces": 120,
  "parking_type": "surface",
  "condition": "excellent",
  "occupancy_pct": 1,
  "submarket": "Elliot Road corridor / East Valley",
  "critical_it_load_kw": 10000,
  "_notes": " Primary size is an identity of the stated dc_capacity.critical_it_load_kw field."
}
```

---

## Rent Roll {#rent_roll}

Two in-place tenants on wholesale leases, rent quoted per kW-month and carried here as annual base rent over the white space each occupies. The 1,000 kW phase-2 pre-lease is **not** in the roll — rent commences on delivery — and appears only in `dc_capacity.contracted_it_load_kw`.

```json uw:section=rent_roll source=manual ts=2026-09-09T09:10:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T09:10:00Z",
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
  "_notes": "Both leases are metered pass-through on power. Anchor rolls 2029-12-31; in-place at $150/kW-mo vs ~$187.50 market. Phase-2 pre-lease (1,000 kW, $150/kW-mo) commences on delivery, targeted 2027-07-01.",
  "as_of_date": "2026-08-01",
  "total_rentable_sf": 60000,
  "occupied_sf": 60000,
  "vacant_sf": 0,
  "occupancy_pct": 1,
  "weighted_avg_rent_psf": 300,
  "tenants": [
    {
      "tenant_id": "T-A",
      "tenant_name": "Helios Cloud Services",
      "suite": "Hall 1-2",
      "leased_sf": 36000,
      "annual_base_rent": 10800000,
      "rent_psf": 300,
      "lease_start": "2022-01-01",
      "lease_expiration": "2029-12-31",
      "lease_type": "NNN",
      "tenant_credit": "investment_grade",
      "anchor_tenant": true
    },
    {
      "tenant_id": "T-B",
      "tenant_name": "Meridian Colo Partners",
      "suite": "Hall 3",
      "leased_sf": 24000,
      "annual_base_rent": 7200000,
      "rent_psf": 300,
      "lease_start": "2023-04-01",
      "lease_expiration": "2033-03-31",
      "lease_type": "NNN",
      "tenant_credit": "non_investment_grade",
      "anchor_tenant": false
    }
  ]
}
```

---

## NOI Model {#noi_model}

Year-1 underwritten on the 10,000 kW in place. Power is a pass-through: the $8.76M utility bill on the commissioned load at design PUE is recovered under `expense_reimbursements` and expensed under `utilities`, so it nets to zero at NOI.

```json uw:section=noi_model source=system/calculations.ts ts=2026-09-09T10:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "system/calculations.ts",
      "actor": "system",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T10:30:00Z",
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
  "_notes": "Base rent = 10,000 kW x $150 x 12. Reimbursements = 10,000 kW x 1.25 PUE x 8,760 h x $0.08/kWh, matched by utilities expense. Other income = interconnection ($660,000) + remote hands and services ($264,000).",
  "income": {
    "base_rent": 18000000,
    "vacancy_credit_loss": 0,
    "expense_reimbursements": 8760000,
    "other_income": 924000,
    "effective_gross_income": 27684000
  },
  "expenses": {
    "property_taxes": 2400000,
    "insurance": 520000,
    "cam": 2023480,
    "utilities": 8760000,
    "repairs_maintenance": 1650000,
    "management_fee": 830520,
    "general_admin": 300000,
    "total_operating_expenses": 16484000
  },
  "net_operating_income": 11200000,
  "noi_per_sf": 62.22
}
```

---

## Operating Statement (T-12) {#operating_statement}

Trailing-twelve summary reconciled to the NOI model — same revenue, expense and NOI totals, with power billed through at cost on both sides. The line-item detail lives in the source statement.

```json uw:section=operating_statement source=system/extractor ts=2026-09-09T11:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "operating_statement",
    "provenance": {
      "source": "system/extractor",
      "resolution": "ai_extracted",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T11:00:00Z",
      "notes": "T-12 summary reconciled to the NOI model; line detail retained in the source statement."
    },
    "quality": {
      "confidence": "medium",
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
  "period": "t12",
  "period_end": "2026-06-30",
  "statement_basis": "accrual",
  "income": {
    "total_revenue": 27684000
  },
  "expenses": {
    "total_operating_expenses": 16484000
  },
  "net_operating_income": 11200000,
  "reconciles_to_noi_model": true
}
```

---

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-09-09T10:45:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T10:45:00Z",
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
  "_notes": "Fixed-rate permanent debt at 60% LTV, sized inside a 1.58x DSCR / 11.7% debt yield. Lender underwrote the in-place 10 MW only; phase 2 is unencumbered upside.",
  "loan_type": "permanent",
  "lender_type": "life_co",
  "loan_amount": 96000000,
  "ltv": 0.6,
  "ltc": 0.58,
  "interest_rate_type": "fixed",
  "all_in_rate_at_close": 0.0625,
  "term_months": 120,
  "amortization_months": 360,
  "amortization": "30yr_amortizing",
  "io_months": 0,
  "annual_debt_service": 7093062,
  "underwritten_noi": 11200000,
  "dscr": 1.579,
  "debt_yield": 0.1167,
  "recourse": "non_recourse_with_carve_outs",
  "prepayment": "yield_maintenance"
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=system/calculations.ts ts=2026-09-09T10:50:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "system/calculations.ts",
      "actor": "system",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T10:50:00Z",
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
  "sources": {
    "loan_amount": 96000000,
    "sponsor_equity": 69000000,
    "total": 165000000
  },
  "uses": {
    "purchase_price": 160000000,
    "closing_costs": 3200000,
    "ti_lc_reserve": 1800000,
    "total": 165000000
  },
  "total_sources": 165000000,
  "total_uses": 165000000,
  "equity_metrics": {
    "equity_total": 69000000
  },
  "_notes": " equity_total equals the single stated sponsor-equity source (identity of stated fields)."
}
```

---

## Valuation {#valuation}

`price_per_sf` uses the explicitly stated `property.rentable_square_feet` as a secondary price comparison. The primary pricing denominator remains commissioned critical IT kW, through the builtin `price_per_commissioned_kw` calculation. No conversion between kW, rentable area and raised-floor area is implied. RFC 0125 binds the SF figure to data-center dictionary verification.

```json uw:section=valuation source=manual ts=2026-09-09T11:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T11:00:00Z",
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
  "purchase_price": 160000000,
  "appraised_value": 162500000,
  "underwritten_value": 160000000,
  "going_in_cap_rate": 0.07,
  "exit_cap_rate_assumption": 0.0725,
  "valuation_method": "income_capitalization",
  "price_per_sf": 888.89,
  "stabilized_value_estimate": 172000000,
  "cap_rate": 0.07,
  "ltv": 0.6,
  "ltc": 0.581818,
  "dscr": 1.579,
  "debt_yield": 0.116667,
  "cash_on_cash": 0.059521,
  "utilization": 1.1,
  "commissioned_share": 0.8,
  "facility_load_kw": 12500,
  "annual_facility_kwh": 82676880,
  "annual_power_cost": 0,
  "power_cost_per_kw_month": 0,
  "annual_rent_revenue": 19800000,
  "blended_revenue_per_kw_month": 157,
  "mark_to_market": 0.25,
  "price_per_commissioned_kw": 16000,
  "noi_per_commissioned_kw": 1120,
  "price_per_kw": 16000,
  "noi_per_kw": 1120,
  "loan_per_kw": 9600,
  "_notes": " RFC 0080 starter metrics are deterministic outputs of the stated inputs; no default or cascade was used."
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is LTV; the proposed loan of $96,000,000 fits inside it.

```json uw:section=preliminary_sizing source=manual ts=2026-09-09T10:40:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "preliminary_sizing",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T10:40:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
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
  "sizing_basis": {
    "noi_underwritten": 11200000,
    "value_basis": 160000000,
    "annual_debt_constant": 0.0739
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 120000000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 121244925
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 124444444
    }
  ],
  "max_supportable_loan": 120000000,
  "governing_constraint": "ltv",
  "proposed_loan": 96000000,
  "proposed_within_constraints": true,
  "cushion": 24000000
}
```

## Borrower / Sponsor {#borrower_sponsor}

Mesa Gateway Holdings LLC, a single-asset borrower controlled by one sponsor entity. Principals only: sponsor financial statements are requested for the diligence period, so no net-worth or liquidity figure is stated yet.

```json uw:section=borrower_sponsor source=manual ts=2026-09-09T11:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "borrower_sponsor",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T11:00:00Z",
      "notes": "Principals only; sponsor PFS and liquidity statements requested for the DD period."
    },
    "quality": {
      "confidence": "medium",
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
  "principals": [
    {
      "name": "Sonoran Digital Infrastructure Partners LP",
      "role": "sponsor",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": false,
      "pfs_received": false,
      "tax_returns_received": false,
      "figures_verified": false
    }
  ],
  "entity": {
    "name": "Mesa Gateway Holdings LLC",
    "type": "llc",
    "state": "DE"
  }
}
```

---

## Market Analysis

East Valley wholesale fundamentals as of 2026-08. Rent is quoted per kW-month; the comp set is carried in `dc_revenue.market_rent_per_kw_month`.

```json uw:section=market_analysis source=manual ts=2026-09-09T09:30:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "market_analysis",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T09:30:00Z",
      "notes": "Broker survey and published capacity reports; refresh before credit committee."
    },
    "quality": {
      "confidence": "medium",
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
  "market": "Phoenix Metro",
  "submarket": "Mesa / East Valley",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.03,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.08,
    "trend": "rising"
  },
  "cap_rates": {
    "range_low": 0.065,
    "range_high": 0.0725,
    "subject_going_in": 0.07
  },
  "supply": {
    "note": "Announced capacity is large but utility-gated; delivered megawatts remain scarce through 2028."
  }
}
```

---

## Capacity & Topology {#dc_capacity}

Every figure is in **kW** — capacity is quoted in MW and rent in $/kW-month, and one unit throughout is what prevents a x1000 error. Contracted load (11,000 kW) exceeds commissioned load (10,000 kW) because 1,000 kW of phase 2 is pre-leased; that is `CC-DC-04`, a schedule question and not a defect.

```json uw:section=dc_capacity source=manual ts=2026-09-09T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_capacity",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T09:00:00Z",
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
  "_notes": "Commissioned 10 MW in three halls; permitted phase 2 adds 2.5 MW. Utility feed 15 MW per the Arroyo Power capacity agreement — covers full build-out at design PUE (12,500 kW x 1.25 = 15,625 kW is the future check, not today's). Measured PUE 1.32 on the T-12, within 15% of the 1.25 design.",
  "critical_it_load_kw": 10000,
  "planned_it_load_kw": 12500,
  "contracted_it_load_kw": 11000,
  "utility_feed_kw": 15000,
  "design_pue": 1.25,
  "measured_pue": 1.32,
  "redundancy": "n_plus_1",
  "raised_floor_sf": 60000,
  "design_density_kw_per_rack": 12.5
}
```

## Power Economics {#dc_power}

Metered pass-through: tenants pay their own metered power at cost, so the landlord earns no power margin, `power_margin` is null, and the landlord's power cost is zero (RFC 0103). No metered facility total is carried; the operator's stated average draw of 65% of contracted load, at the trailing measured PUE of 1.32, gives the facility's annual energy. Full draw is never assumed.

```json uw:section=dc_power source=manual ts=2026-09-09T09:05:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_power",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T09:05:00Z",
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
  "utility_rate_per_kwh": 0.08,
  "billing": "metered_pass_through",
  "power_margin": null,
  "stated_annual_power_cost": null,
  "metered_annual_kwh": null,
  "draw_factor": 0.65
}
```

## Revenue {#dc_revenue}

Weighted-average contracted rent of $150/kW-month on the 11,000 kW contracted, against a $187.50 comp set — a 25% mark-to-market (market above in-place: upside at the anchor's 2029 roll), which is what fires `CC-DC-07`.

```json uw:section=dc_revenue source=manual ts=2026-09-09T09:15:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_revenue",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T09:15:00Z",
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
  "lease_type": "wholesale_turnkey",
  "rent_per_kw_month": 150,
  "interconnection_revenue_annual": 660000,
  "services_revenue_annual": 264000,
  "market_rent_per_kw_month": 187.5
}
```

---

## Validation {#validation}

Financial-validity engine run over the sections above.

```json uw:section=validation source=system/financialValidityChecker ts=2026-09-09T11:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "provenance": {
      "source": "system/financialValidityChecker",
      "actor": "system",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T11:00:00Z",
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
  "overall_status": "warnings",
  "financial_validity": [],
  "completeness": [],
  "cross_section_consistency": [
    {
      "flag_id": "CC-DC-04",
      "sections_involved": ["dc_capacity"],
      "description": "Contracted load exceeds commissioned load — pre-leased phases; confirm the delivery schedule and any rent-commencement gaps.",
      "severity": "warning",
      "field_a": { "section": "dc_capacity", "field": "contracted_it_load_kw", "value": 11000 },
      "field_b": { "section": "dc_capacity", "field": "critical_it_load_kw", "value": 10000 },
      "variance": null
    },
    {
      "flag_id": "CC-DC-07",
      "sections_involved": ["dc_revenue"],
      "description": "Contracted rent more than 15% below market — verify the comp set or the lease vintage.",
      "severity": "warning",
      "field_a": { "section": "dc_revenue", "field": "rent_per_kw_month", "value": 150 },
      "field_b": { "section": "dc_revenue", "field": "market_rent_per_kw_month", "value": 187.5 },
      "variance": null
    }
  ]
}
```
