---
uw_version: "1.1"
deal_id: "uw_2026_mx8k2p"
deal_name: "Roosevelt Row Commons — Mixed-Use, Phoenix, AZ"
created: "2026-08-10T09:00:00Z"
last_modified: "2026-08-14T16:00:00Z"

property_address: "801 N 2nd St"
city: "Phoenix"
state: "AZ"
zip: "85004"
asset_class: "mixed_use"
asset_subtype: "apartments_over_retail_with_hotel"
loan_type: "permanent"
scenario: "stabilized_acquisition"

pipeline_state:
  L0_ingestion:    "complete"
  L1_screening:    "complete"
  L2_underwriting: "complete"
  L4_structuring:  "complete"
  L5_compliance:   "pending"
  L6_risk:         "pending"
  L7_assembly:     "pending"

status: "in_progress"
deal_stage: "full_underwrite"
recommendation: "pending"

flags: []
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "roosevelt_row_rent_roll_aug2026.xlsx"
  - "roosevelt_row_t12_2025.pdf"
  - "roosevelt_row_appraisal_2026.pdf"
---

# Roosevelt Row Commons — Mixed-Use, Phoenix, AZ

> **Deal ID:** uw_2026_mx8k2p | **Scenario:** Stabilized Acquisition | **Status:** In Progress  
> **Three uses, one price, one loan** | **$40,000,000 Purchase** | **6.43% Cap Rate (in-place)**

This file is the **mixed-use worked example** for the conformance corpus (RFC 0019,
`UW_FORMAT_SPEC` §4.23). Roosevelt Row Commons is a single property with three
distinct uses under one purchase price and one loan: 120 apartments over
ground-floor retail, plus an adjacent boutique hotel. It demonstrates the
`components` section — each use states its own EGI, operating expenses, and NOI,
its allocation of the single purchase price, and (for the hotel) the
operating-business intermediate the mixed-use pack surfaces per component.

The property NOI **foots to the sum of the component NOIs**
(`1,300,000 + 372,000 + 900,000 = 2,572,000`, RFC 0019 §3a), and the
allocations sum to `1.0` (`0.55 + 0.15 + 0.30`). No single denominator describes
this property, so the pack emits no property-level price-per-unit; each use's
intensive metric divides its own allocated share instead.

---

## Deal Context {#deal_context}

```json uw:section=deal_context source=user ts=2026-08-10T09:15:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-10T09:15:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Live-work-stay block in the Roosevelt Row arts district. The residential tower drives the majority of NOI; the boutique hotel adds operating-business upside but also operating risk. Allocation of the single price across uses is the underwriter's judgment, stated as an input.",
  "deal_summary": "Three-use mixed property in downtown Phoenix: 120 apartments over 18,000 SF of street retail, plus a 90-key boutique hotel. Stabilized acquisition at a 6.43% in-place cap.",
  "investment_thesis": "Own the whole block in a supply-constrained arts district. Residential provides durable base cash flow; retail captures foot traffic; the hotel harvests event- and tourism-driven RevPAR.",
  "value_creation_strategy": "Hold residential for stable distributions, mark inline retail rents to market on rollover, and drive hotel GOP through revenue management.",
  "hold_strategy": "core_plus_hold",
  "exit_strategy_description": "Sell the residential-plus-retail podium and the hotel either together or as separated condominium interests at year 7-10.",
  "deal_goal": "12-13% levered IRR with a durable residential floor under the operating-business upside."
}
```

---

## Property {#property}

```json uw:section=property source=user ts=2026-08-10T09:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-10T09:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Property-level counts (units, SF, keys) live inside each component; there is no single property denominator for a mixed-use block.",
  "year_built": 2019,
  "building_class": "A",
  "buildings": 2,
  "submarket": "Downtown Phoenix / Roosevelt Row"
}
```

---

## Components {#components}

```json uw:section=components source=user ts=2026-08-10T11:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "components",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-10T11:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Each use rolls up by use type (not by tenancy). Component NOIs sum to the property NOI (CC-12). allocation_pct is a stated underwriter judgment and sums to 1.0 (MU-05); it gates every price-per metric.",
  "multifamily": {
    "component_class": "multifamily",
    "effective_gross_income": 2180000,
    "operating_expenses": 880000,
    "net_operating_income": 1300000,
    "total_units": 120,
    "nra_sqft": 96000,
    "allocation_pct": 0.55
  },
  "retail": {
    "component_class": "retail",
    "effective_gross_income": 520000,
    "operating_expenses": 148000,
    "net_operating_income": 372000,
    "nra_sqft": 18000,
    "allocation_pct": 0.15
  },
  "hospitality": {
    "component_class": "hospitality",
    "effective_gross_income": 6900000,
    "operating_expenses": 6000000,
    "net_operating_income": 900000,
    "gross_operating_profit": 1400000,
    "allocation_pct": 0.30
  }
}
```

---

## NOI Model {#noi_model}

```json uw:section=noi_model source=engine:calculations.ts ts=2026-08-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-08-10T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Property NOI is the plain sum of the component NOIs — the §3a footing invariant. There is no property-level income/expense breakdown; the breakdown lives per component.",
  "net_operating_income": 2572000
}
```

---

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=user ts=2026-08-10T13:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-10T13:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "One property-level loan covers all three uses (RFC 0019 §4). No component carries its own debt_structure (MU-06); component-level tranches are deferred to RFC 0026.",
  "loan_type": "permanent",
  "lender_type": "bank",
  "loan_amount": 26000000,
  "ltv": 0.65,
  "interest_rate_type": "fixed",
  "all_in_rate_at_close": 0.0625,
  "term_months": 120,
  "amortization_months": 360,
  "io_months": 24,
  "annual_debt_service": 1900000,
  "underwritten_noi": 2572000,
  "dscr": 1.354,
  "debt_yield": 0.0989,
  "recourse": "non_recourse_with_carve_outs"
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=engine:calculations.ts ts=2026-08-10T13:35:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-08-10T13:35:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "sources": {
    "loan_amount": 26000000,
    "equity_sponsor": 14000000,
    "total": 40000000
  },
  "uses": {
    "purchase_price": 40000000,
    "total": 40000000
  },
  "total_sources": 40000000,
  "total_uses": 40000000
}
```

---

## Valuation {#valuation}

```json uw:section=valuation source=user:appraisal ts=2026-08-10T14:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "user:appraisal",
    "actor": "jared",
    "timestamp": "2026-08-10T14:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "One purchase price buys the whole block. The going-in cap rate is the property NOI over that single price — an arithmetic fact about this deal, not a blended market cap rate.",
  "purchase_price": 40000000,
  "appraised_value": 40500000,
  "underwritten_value": 40000000,
  "going_in_cap_rate": 0.0643,
  "valuation_method": "sum_of_the_parts",
  "stabilized_value_estimate": 43000000
}
```

## Validation

Financial-validity engine run over the consolidated property figures; per-component figures live in the components section.

```json uw:section=validation source=engine:financialValidityChecker ts=2026-08-26T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "version": 1,
    "superseded": false,
    "source": "engine:financialValidityChecker",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-26T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Consolidated-property basis; component NOIs foot to the property NOI (CC-12)."
  },
  "overall_status": "clean",
  "financial_validity": [
    {
      "flag_id": "FV-001",
      "metric": "dscr",
      "value": 1.3537,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "pass",
      "message": "DSCR (1.3537x) clears the 1.20x warning threshold.",
      "suppressed": false,
      "suppress_reason": null
    },
    {
      "flag_id": "FV-002",
      "metric": "ltv",
      "value": 0.65,
      "threshold": {
        "type": "max",
        "min": null,
        "max": 0.75
      },
      "severity": "pass",
      "message": "LTV at 65.0% is within the 75% policy maximum.",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": []
}
```

## Preliminary Sizing

Consolidated-property sizing against the three standard constraints; the governing test is dscr and the proposed loan fits inside it. Component-level debt stays refused (MU-06); a component capital_stack is the sanctioned shape.

```json uw:section=preliminary_sizing source=manual ts=2026-08-26T15:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "preliminary_sizing",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T15:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "sizing_basis": {
    "noi_underwritten": 2572000,
    "value_basis": 40000000,
    "annual_debt_constant": 0.0731
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 30000000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 28156632
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 28577778
    }
  ],
  "max_supportable_loan": 28156632,
  "governing_constraint": "dscr",
  "proposed_loan": 26000000,
  "proposed_within_constraints": true,
  "cushion": 2156632
}
```

## Borrower / Sponsor

Roosevelt Row Mixed-Use Ventures LLC — single-principal sponsorship; figures PFS-stated pending CPA verification.

```json uw:section=borrower_sponsor source=manual ts=2026-08-26T15:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "borrower_sponsor",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T15:00:00Z",
    "confidence": "medium",
    "human_review_required": true,
    "flags": [],
    "input_hash": null,
    "notes": "Figures are PFS-stated; CPA verification requested for the DD period."
  },
  "principals": [
    {
      "name": "Alicia Fontaine",
      "role": "managing_member",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": true,
      "net_worth_stated": 46800000,
      "liquid_assets_stated": 2860000,
      "contingent_liabilities_stated": 0,
      "years_cre_experience": 18,
      "pfs_received": true,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "pfs_stated"
    }
  ],
  "entity": {
    "name": "Roosevelt Row Mixed-Use Ventures LLC",
    "type": "llc",
    "state": "AZ"
  },
  "financial_summary": {
    "global_net_worth": 46800000,
    "global_liquidity": 2860000,
    "nw_to_loan_ratio": 1.8,
    "nw_to_loan_policy_min": 1,
    "liquidity_to_loan_ratio": 0.11,
    "liquidity_to_loan_policy_min": 0.1,
    "all_figures_verified": false,
    "unverified_flag": true
  }
}
```

## Market Analysis

Roosevelt Row / Downtown Phoenix mixed-use fundamentals as of 2026-08.

```json uw:section=market_analysis source=manual ts=2026-08-26T15:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "market_analysis",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T15:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Broker survey and published market reports; refresh before credit committee."
  },
  "market": "Phoenix Metro",
  "submarket": "Roosevelt Row / Downtown Phoenix",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "residential_rate": 0.055,
    "retail_rate": 0.07,
    "trend": "stable"
  },
  "rents": {
    "residential_yoy_growth_pct": 0.028,
    "retail_yoy_growth_pct": 0.018,
    "trend": "moderate"
  },
  "cap_rates": {
    "range_low": 0.06,
    "range_high": 0.0675
  },
  "supply": {
    "note": "Two mixed-use projects (410 units, 28k SF retail combined) delivering through 2027 within the arts district; hotel supply stable."
  }
}
```
