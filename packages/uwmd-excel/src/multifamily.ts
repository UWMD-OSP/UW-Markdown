// Multifamily workbook layout.
//
// Single source of truth for the schema-to-cells mapping. The converter
// (`toWorkbook.ts`) is generic; everything asset-class-specific lives here.
//
// Layout shape:
//   - Sheet "Underwriting" — executive summary. Header (deal name / address)
//     + inputs block (named-range cells the user can edit) + derived metrics
//     block (formulas referencing those named ranges).
//   - Sheet "Operating Statement" — income/expense breakdown. Sub-totals are
//     formulas (=SUM of line items) so editing any line ripples through to
//     NOI, which the Underwriting sheet references via named range.
//   - Sheet "Pipeline Log" — flat audit table of every pipeline_log entry.
//
// Named ranges defined here are the workbook's *contract*: as long as a
// downstream sheet references `=cap_rate` or `=noi`, it can be reorganized
// without breaking the formulas.
//
// The eight derived-metric formulas mirror @uwmd/core's MULTIFAMILY_STARTER_PACK
// from the web editor, so Excel and `evaluateCalc()` produce identical numbers
// by construction. That's the calc-integrity rule on the Excel side.

export interface IncomeLine {
  label: string;
  path: string;             // dot-path inside noi_model.income for the value
}

export interface ExpenseLine {
  label: string;
  path: string;             // dot-path inside noi_model.expenses for the value
}

export const INCOME_LINES: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent',   path: 'gross_potential_rent.value' },
  { label: '(Less) Vacancy & Credit Loss', path: 'vacancy_credit_loss.value' },
  { label: '(Less) Concessions',     path: 'concessions.value' },
  { label: '(Less) Loss to Lease',   path: 'loss_to_lease.value' },
  { label: 'Other Income',           path: 'other_income.value' },
];

export const EXPENSE_LINES: readonly ExpenseLine[] = [
  { label: 'Real Estate Taxes',      path: 'real_estate_taxes.value' },
  { label: 'Insurance',              path: 'insurance.value' },
  { label: 'Management Fees',        path: 'management_fees.value' },
  { label: 'Payroll & Benefits',     path: 'payroll_benefits.value' },
  { label: 'Utilities',              path: 'utilities.value' },
  { label: 'Repairs & Maintenance',  path: 'repairs_maintenance.value' },
  { label: 'Contract Services',      path: 'contract_services.value' },
  { label: 'Marketing & Advertising', path: 'marketing_advertising.value' },
  { label: 'Administrative',         path: 'administrative.value' },
  { label: 'Professional Fees',      path: 'professional_fees.value' },
  { label: 'Replacement Reserves',   path: 'replacement_reserves.value' },
];

/** Inputs the user can edit; each surfaces as a named range. */
export interface NamedInput {
  name: string;             // workbook-scope name (`purchase_price`, etc.)
  label: string;
  /** Source field path on the parsed UW file. */
  source: { section: string; path: string };
  format: 'currency' | 'count';
}

export const NAMED_INPUTS: readonly NamedInput[] = [
  { name: 'purchase_price',       label: 'Purchase Price',         source: { section: 'valuation',      path: 'purchase_price' },              format: 'currency' },
  { name: 'loan_amount',          label: 'Loan Amount',            source: { section: 'debt_structure', path: 'loan_amount' },                 format: 'currency' },
  { name: 'annual_debt_service',  label: 'Annual Debt Service',    source: { section: 'debt_structure', path: 'annual_debt_service' },         format: 'currency' },
  { name: 'total_units',          label: 'Total Units',            source: { section: 'property',       path: 'total_units' },                 format: 'count' },
  { name: 'total_nra_sqft',       label: 'Total NRA (sqft)',       source: { section: 'property',       path: 'total_nra_sqft' },              format: 'count' },
  { name: 'equity_sponsor',       label: 'Sponsor Equity',         source: { section: 'sources_uses',   path: 'sources.equity_sponsor' },      format: 'currency' },
];

/** Derived metric — formula references named inputs (and `noi`, defined on the Operating Statement sheet). */
export interface DerivedMetric {
  name: string;
  label: string;
  formula: string;          // Excel formula, leading "=" included
  format: 'percent' | 'ratio' | 'currency';
}

export const DERIVED_METRICS: readonly DerivedMetric[] = [
  { name: 'cap_rate',       label: 'Cap Rate',       formula: '=noi/purchase_price',                           format: 'percent' },
  { name: 'ltv',            label: 'LTV',            formula: '=loan_amount/purchase_price',                   format: 'percent' },
  { name: 'dscr',           label: 'DSCR',           formula: '=noi/annual_debt_service',                      format: 'ratio'   },
  { name: 'debt_yield',     label: 'Debt Yield',     formula: '=noi/loan_amount',                              format: 'percent' },
  { name: 'price_per_unit', label: 'Price / Unit',   formula: '=purchase_price/total_units',                   format: 'currency' },
  { name: 'loan_per_unit',  label: 'Loan / Unit',    formula: '=loan_amount/total_units',                      format: 'currency' },
  { name: 'loan_per_sqft',  label: 'Loan / SqFt',    formula: '=loan_amount/total_nra_sqft',                   format: 'currency' },
  { name: 'cash_on_cash',   label: 'Cash-on-Cash',   formula: '=(noi-annual_debt_service)/equity_sponsor',     format: 'percent' },
];
