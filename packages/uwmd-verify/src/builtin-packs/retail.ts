// Canonical retail calc pack.
//
// Single source of truth for the retail derived metrics. Consumed by the web
// editor (via @uwmd/core/browser), the @uwmd/excel converter (via
// emitExcelFormula), conformance tests, and any future asset-class viewer.
// Add a metric here once and every tool picks it up.
//
// Each formula is a Tier-3 safe expression evaluable by `evaluateCalc()`
// against a parsed .uw.md file. Field paths reference the canonical retail
// schema (see UW_FORMAT_SPEC §4 and the Cactus Crossing example).
//
// Retail measures size in gross leasable area (`property.gross_leasable_area`)
// and occupancy in GLA (`rent_roll.occupied_gla` / `total_gla`). It adds an
// `expense_recovery_ratio` metric distinctive to NNN structures — the share of
// operating expenses recovered from tenants via reimbursements.

import type { ModuleManifest } from '../protocol.js';

export const RETAIL_PACK: ModuleManifest = {
  manifest_version: '1',
  id: 'org.uwmd.pack.retail',
  name: 'Retail Starter Pack',
  version: '1.0.1',
  description:
    'Twelve derived metrics for retail underwriting: cap rate, LTV, LTC, DSCR, debt yield, $/sqft, loan/sqft, NOI/sqft, expense ratio, expense recovery ratio, cash-on-cash, occupancy.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^4.0.0',
  requires_format: '^3.0',
  requires_conformance: 'verifier',
  asset_classes: ['retail'],
  calculations: [
    {
      id: 'cap_rate',
      label: 'Cap Rate',
      formula: 'noi_model.net_operating_income / valuation.purchase_price',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'ltv',
      label: 'LTV',
      formula: "debt_structure.loan_amount / (debt_structure.ltv_basis == 'purchase-price' ? valuation.purchase_price : (debt_structure.ltv_basis == 'underwritten-value' ? valuation.underwritten_value : (debt_structure.ltv_basis == 'total-project-cost' ? sources_uses.total_project_cost : null)))",
      unit: '%',
      deterministic: true,
      section_roles: { debt_structure: 'senior' },
    },
    {
      id: 'ltc',
      label: 'LTC',
      formula: 'debt_structure.loan_amount / sources_uses.uses.total',
      unit: '%',
      deterministic: true,
      section_roles: { debt_structure: 'senior' },
    },
    {
      id: 'dscr',
      label: 'DSCR',
      formula: 'noi_model.net_operating_income / debt_structure.annual_debt_service',
      unit: 'x',
      deterministic: true,
      section_roles: { debt_structure: 'senior' },
    },
    {
      id: 'debt_yield',
      label: 'Debt Yield',
      formula: 'noi_model.net_operating_income / debt_structure.loan_amount',
      unit: '%',
      deterministic: true,
      section_roles: { debt_structure: 'senior' },
    },
    {
      id: 'price_per_sqft',
      label: 'Price / SqFt',
      formula: 'valuation.purchase_price / property.gross_leasable_area',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'loan_per_sqft',
      label: 'Loan / SqFt',
      formula: 'debt_structure.loan_amount / property.gross_leasable_area',
      unit: '$',
      deterministic: true,
      section_roles: { debt_structure: 'senior' },
    },
    {
      id: 'noi_per_sqft',
      label: 'NOI / SqFt',
      formula: 'noi_model.net_operating_income / property.gross_leasable_area',
      unit: '$',
      deterministic: true,
    },
    {
      id: 'expense_ratio',
      label: 'Operating Expense Ratio',
      formula:
        'noi_model.expenses.total_operating_expenses / noi_model.income.effective_gross_income',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'expense_recovery_ratio',
      label: 'Expense Recovery Ratio',
      formula:
        'noi_model.income.expense_reimbursements / noi_model.expenses.total_operating_expenses',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'cash_on_cash',
      label: 'Cash-on-Cash',
      formula:
        'sources_uses.equity_metrics.equity_total == null ? null : (dcf.annual_cash_flows.Y1.net_cash_flow_levered != null ? dcf.annual_cash_flows.Y1.net_cash_flow_levered : noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.equity_metrics.equity_total',
      unit: '%',
      deterministic: true,
    },
    {
      id: 'occupancy',
      label: 'Occupancy',
      formula: 'rent_roll.occupied_gla / rent_roll.total_gla',
      unit: '%',
      deterministic: true,
    },
  ],
};
