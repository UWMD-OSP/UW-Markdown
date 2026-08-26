---
uw_version: "1.1"
deal_id: "uw_2026_cs7r4t"
deal_name: "Agave Court Apartments — Scottsdale, AZ"
created: "2026-08-21T09:00:00Z"
last_modified: "2026-08-22T15:00:00Z"

property_address: "7350 E Osborn Rd"
city: "Scottsdale"
state: "AZ"
zip: "85251"
asset_class: "multifamily"
asset_subtype: "midrise"
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
deal_stage: "screening"
recommendation: "pending"

quick_metrics:
  purchase_price:    48000000
  loan_amount:       24000000
  noi_underwritten:  2600000
  dscr:              1.514
  ltv:               0.4938
  debt_yield:        0.1083
  cap_rate:          0.0542
  equity_required:   16000000

flags: []
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "agave_court_rent_roll_aug2026.xlsx"
  - "agave_court_t12_2025.pdf"
  - "agave_court_term_sheets_2026.pdf"
---

# Agave Court Apartments — Scottsdale, AZ

> **Deal ID:** uw_2026_cs7r4t | **Scenario:** Stabilized Acquisition | **Status:** In Progress  
> **180 Units** | **2016 Vintage** | **$48,000,000 Purchase** | **Senior + Mezz + Pref** | **5.42% Cap Rate**

This file is the **capital-stack worked example** for the corpus (RFC 0026,
`UW_FORMAT_SPEC` §4.24). Agave Court is a conventionally underwritten 180-unit
midrise whose financing is a four-layer stack rather than a single loan: a
$24.0M amortizing senior, a $4.5M interest-only mezzanine note, $3.5M of
current-pay preferred equity, and $16.0M of common equity.

The stack **foots** — tranche amounts sum to the $48.0M total capitalization,
which equals total sources and total uses — and every stated `sizing` figure
**verifies**: `verifyCapitalStack` recomputes each one from the tranche terms
and agrees at its quantum. The senior tranche reconciles with
`debt_structure` (the generalized `CC-03`), which continues to describe the
same senior loan for single-loan consumers.

---

## Deal Context {#deal_context}

```json uw:section=deal_context source=user ts=2026-08-21T09:15:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-21T09:15:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Moderate senior leverage on purpose: the marginal dollars above 50% LTV are cheaper as mezz and pref than as a bigger senior at a worse spread, and the sponsor keeps refinance flexibility. The stack's blended coverage, not the senior DSCR, is the binding figure.",
  "deal_summary": "180-unit 2016-vintage midrise in south Scottsdale. Stabilized acquisition at a 5.42% in-place cap, financed with a senior + mezzanine + preferred-equity stack over $16.0M of common equity.",
  "investment_thesis": "Newer-vintage asset in a supply-constrained submarket at replacement-cost-adjacent pricing. Modest senior leverage with structured subordinate capital keeps cash-on-cash competitive without pushing the senior past comfortable coverage.",
  "value_creation_strategy": "Operational: push renewals to market, add smart-home package at turn, and refinance the mezzanine at year 3-4 when NOI seasoning supports a larger senior.",
  "hold_strategy": "core_plus_hold",
  "exit_strategy_description": "Sell in years 5-7 to a core buyer, or refinance the whole stack into a single agency loan once the mezz burns off.",
  "deal_goal": "Mid-teens levered IRR to common with the pref's current pay fully covered by in-place NOI."
}
```

---

## Property {#property}

```json uw:section=property source=user ts=2026-08-21T09:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-21T09:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": null,
  "total_units": 180,
  "total_nra_sqft": 171000,
  "year_built": 2016,
  "building_class": "A-",
  "buildings": 3,
  "stories": 4,
  "submarket": "South Scottsdale / Osborn corridor"
}
```

---

## Underwritten NOI {#noi_model}

```json uw:section=noi_model source=engine:calculations.ts ts=2026-08-21T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-08-21T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Foots: 4,600,000 − 276,000 − 46,000 − 92,000 + 234,000 = 4,420,000 EGI; 4,420,000 − 1,820,000 = 2,600,000 NOI. This NOI is the numerator of every coverage and debt-yield figure in the capital stack's sizing block.",
  "income": {
    "gross_potential_rent":  { "value": 4600000 },
    "vacancy_credit_loss":   { "value": 276000 },
    "concessions":           { "value": 46000 },
    "loss_to_lease":         { "value": 92000 },
    "other_income":          { "value": 234000 },
    "effective_gross_income": 4420000
  },
  "expenses": {
    "real_estate_taxes":     { "value": 520000 },
    "insurance":             { "value": 155000 },
    "management_fees":       { "value": 132600 },
    "payroll_benefits":      { "value": 360000 },
    "utilities":             { "value": 168000 },
    "repairs_maintenance":   { "value": 175000 },
    "contract_services":     { "value": 78000 },
    "marketing_advertising": { "value": 45000 },
    "administrative":        { "value": 56400 },
    "professional_fees":     { "value": 40000 },
    "replacement_reserves":  { "value": 90000 },
    "total_operating_expenses": 1820000
  },
  "net_operating_income": 2600000
}
```

---

## Valuation {#valuation}

```json uw:section=valuation source=user:appraisal ts=2026-08-21T14:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "user:appraisal",
    "actor": "jared",
    "timestamp": "2026-08-21T14:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "underwritten_value is the LTV denominator the stack's ltv_through divides by; the appraisal came in slightly above it.",
  "purchase_price": 48000000,
  "appraised_value": 49000000,
  "underwritten_value": 48600000,
  "going_in_cap_rate": 0.0542,
  "valuation_method": "income_capitalization"
}
```

---

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=user ts=2026-08-21T15:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-21T15:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "This section continues to describe the SENIOR loan only, for every single-loan consumer. The full stack — including the mezz and pref this section cannot express — lives in capital_stack, and the senior tranche there reconciles with these figures (generalized CC-03).",
  "loan_type": "permanent",
  "lender_type": "life_co",
  "loan_amount": 24000000,
  "ltv": 0.4938,
  "interest_rate_type": "fixed",
  "all_in_rate_at_close": 0.0595,
  "term_months": 120,
  "amortization_months": 360,
  "io_months": 0,
  "annual_debt_service": 1717458,
  "underwritten_noi": 2600000,
  "dscr": 1.514,
  "debt_yield": 0.1083,
  "recourse": "non_recourse_with_carve_outs"
}
```

---

## Capital Stack {#capital_stack}

```json uw:section=capital_stack source=user ts=2026-08-21T16:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-08-21T16:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "The stack foots: 24.0 + 4.5 + 3.5 + 16.0 = 48.0M = total sources = total uses. Every sizing value below is the correctly-rounded recomputation from the tranche terms (verifyCapitalStack agrees at each figure's quantum). The pref is current-pay, so its 297,500 return sits inside the blended coverage denominator; had it been accrued, combined_dscr_thru_pref would rise to the thru-mezz figure and debt_yield_thru_mezz would not move.",
  "tranches": [
    { "id": "senior", "class": "senior_debt", "position": 1, "amount": 24000000, "rate": 0.0595, "amortization_months": 360, "io_months": 0, "term_months": 120, "accrual": "cash" },
    { "id": "mezz", "class": "mezzanine_debt", "position": 2, "amount": 4500000, "rate": 0.105, "amortization_months": 0, "io_months": 120, "term_months": 120, "accrual": "cash" },
    { "id": "pref", "class": "preferred_equity", "position": 3, "amount": 3500000, "rate": 0.085, "accrual": "cash" },
    { "id": "common", "class": "common_equity", "position": 4, "amount": 16000000 }
  ],
  "sizing": [
    { "id": "senior_dscr", "fn": "coverage", "over": "senior", "value": 1.51 },
    { "id": "combined_dscr_thru_pref", "fn": "blended_coverage", "through": 3, "value": 1.05 },
    { "id": "debt_yield_thru_mezz", "fn": "debt_yield_through", "through": 2, "value": 0.0912 },
    { "id": "ltc_thru_mezz", "fn": "ltc_through", "through": 2, "value": 0.5938 },
    { "id": "ltv_thru_mezz", "fn": "ltv_through", "through": 2, "value": 0.5864 },
    { "id": "wacc", "fn": "weighted_cost", "over": "*", "value": 0.0687 }
  ]
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=engine:calculations.ts ts=2026-08-21T16:05:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-08-21T16:05:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Sources are the capital stack, layer by layer: each source line equals its tranche's amount, and the totals equal the stack's total capitalization.",
  "sources": {
    "loan_amount": 24000000,
    "mezzanine_debt": 4500000,
    "preferred_equity": 3500000,
    "equity_sponsor": 16000000,
    "total": 48000000
  },
  "uses": {
    "purchase_price": 48000000,
    "total": 48000000
  },
  "total_sources": 48000000,
  "total_uses": 48000000
}
```

---

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=engine ts=2026-08-21T16:10:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "engine",
    "actor": "system",
    "timestamp": "2026-08-21T16:10:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-08-21T09:00:00Z",
      "event_type": "file_created",
      "agent_or_actor": "wizard",
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
      "notes": "Deal created from term sheets and T-12"
    },
    {
      "entry_id": "log_002",
      "timestamp": "2026-08-21T16:00:00Z",
      "event_type": "section_written",
      "agent_or_actor": "jared",
      "section_affected": "capital_stack",
      "status": "success",
      "input_sections": ["noi_model", "debt_structure", "sources_uses"],
      "output_sections": ["capital_stack"],
      "flags_raised": [],
      "flags_cleared": [],
      "duration_ms": null,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": "Capital stack entered; sizing figures stated and verified"
    }
  ]
}
```

## Validation

Financial-validity engine run over the capital stack and operating sections above.

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
    "notes": "Senior-only metrics; stack-aware coverage is stated and verified in the capital_stack section."
  },
  "overall_status": "clean",
  "financial_validity": [
    {
      "flag_id": "FV-001",
      "metric": "dscr",
      "value": 1.5139,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "pass",
      "message": "DSCR (1.5139x) clears the 1.20x warning threshold.",
      "suppressed": false,
      "suppress_reason": null
    },
    {
      "flag_id": "FV-002",
      "metric": "ltv",
      "value": 0.5,
      "threshold": {
        "type": "max",
        "min": null,
        "max": 0.75
      },
      "severity": "pass",
      "message": "LTV at 50.0% is within the 75% policy maximum.",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": []
}
```
