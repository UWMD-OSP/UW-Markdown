---
uw_version: "1.1"
deal_id: "uw_TEMPLATE_SCREEN"
deal_name: "Untitled Deal"
created: "2026-01-01T00:00:00.000Z"
last_modified: "2026-01-01T00:00:00.000Z"
property_address: ""
city: ""
state: ""
zip: ""
asset_class: multifamily
asset_subtype: null
loan_type: null
scenario: null
pipeline_state:
  L0_ingestion: pending
  L1_screening: pending
  L2_underwriting: pending
  L4_structuring: pending
  L5_compliance: pending
  L6_risk: pending
  L7_assembly: pending
status: draft
deal_stage: screening
recommendation: null
quick_metrics:
  purchase_price: null
  loan_amount: null
  noi_underwritten: null
  dscr: null
  ltv: null
  debt_yield: null
  cap_rate: null
  irr_projected: null
  equity_required: null
flags: []
blocking_flags: []
tier: screener
institution_config_id: null
created_by: template
source_documents: []
---

# Untitled Deal

> Replace the template identifiers and dates when creating a deal file.

## Deal Context {#deal_context}

Add the request, purpose, key dates, and transaction summary.

## Property {#property}

Add the property description, location, unit or area counts, and condition.

## Ownership & Acquisition {#ownership}

Add seller, buyer, purchase price, basis, and transaction terms.

## Rent Roll {#rent_roll}

Add occupancy, rents, lease terms, and tenant or unit detail.

## Operating Statement {#operating_statement}

Add historical and underwritten income and expenses using structured blocks
defined by the format specification.

## Debt Structure {#debt_structure}

Add requested loan terms. Store rates as fractions, not display percentages.

## Valuation {#valuation}

Add valuation inputs and narrative. Use deterministic tools for the math.

## Borrower / Sponsor {#borrower_sponsor}

Add ownership, experience, liquidity, net worth, and track record.

## Risk Assessment {#risk_assessment}

Add strengths, risks, mitigants, missing information, and open questions.

## Flags & Validation {#validation}

Run `npx uwmd validate this-file.uw.md` and resolve blocking issues.
