// Multifamily workbook layout.
//
// Layout-only: which sections become which sheet rows, which inputs become
// workbook-scope named ranges. The derived-metric formulas themselves are NOT
// defined here — they come from MULTIFAMILY_PACK in @uwmd/core and are emitted
// as Excel syntax by the shared engine (see layout.ts / toWorkbook.ts), so
// adding a metric only happens in one place.
//
// Income deductions (vacancy, concessions, loss-to-lease) carry sign:-1 so the
// operating statement's `EGI = SUM(income lines)` foots to the stored
// effective_gross_income (they are stored as positive magnitudes in the .uw.md).

import { MULTIFAMILY_PACK } from '@uwmd/core';
import { sizeNamedInputs } from './layout.js';
import type { WorkbookLayout, IncomeLine, ExpenseLine, NamedInput } from './layout.js';

const incomeLines: readonly IncomeLine[] = [
  { label: 'Gross Potential Rent', path: 'gross_potential_rent.value' },
  { label: '(Less) Vacancy & Credit Loss', path: 'vacancy_credit_loss.value', sign: -1 },
  { label: '(Less) Concessions', path: 'concessions.value', sign: -1 },
  { label: '(Less) Loss to Lease', path: 'loss_to_lease.value', sign: -1 },
  { label: 'Other Income', path: 'other_income.value' },
];

const expenseLines: readonly ExpenseLine[] = [
  { label: 'Real Estate Taxes', path: 'real_estate_taxes.value' },
  { label: 'Insurance', path: 'insurance.value' },
  { label: 'Management Fees', path: 'management_fees.value' },
  { label: 'Payroll & Benefits', path: 'payroll_benefits.value' },
  { label: 'Utilities', path: 'utilities.value' },
  { label: 'Repairs & Maintenance', path: 'repairs_maintenance.value' },
  { label: 'Contract Services', path: 'contract_services.value' },
  { label: 'Marketing & Advertising', path: 'marketing_advertising.value' },
  { label: 'Administrative', path: 'administrative.value' },
  { label: 'Professional Fees', path: 'professional_fees.value' },
  { label: 'Replacement Reserves', path: 'replacement_reserves.value' },
];

const namedInputs: readonly NamedInput[] = [
  { name: 'purchase_price',      label: 'Purchase Price',      source: { section: 'valuation',      path: 'purchase_price' },          format: 'currency' },
  { name: 'loan_amount',         label: 'Loan Amount',         source: { section: 'debt_structure', path: 'loan_amount' },             format: 'currency' },
  { name: 'annual_debt_service', label: 'Annual Debt Service', source: { section: 'debt_structure', path: 'annual_debt_service' },     format: 'currency' },
  ...sizeNamedInputs('multifamily', { total_units: 'Total Units', total_nra_sqft: 'Total NRA (sqft)' }),
  { name: 'equity_sponsor',      label: 'Sponsor Equity',      source: { section: 'sources_uses',   path: 'sources.equity_sponsor' },  format: 'currency' },
];

export const MULTIFAMILY_LAYOUT: WorkbookLayout = {
  assetClass: 'multifamily',
  pack: MULTIFAMILY_PACK,
  incomeLines,
  expenseLines,
  namedInputs,
};
