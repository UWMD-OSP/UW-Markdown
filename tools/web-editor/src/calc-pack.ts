// Calc starter pack — multifamily.
//
// Each entry is a ModuleCalcDecl evaluated by @uwmd/core's Tier-3 calc engine
// against the parsed file. Formulas reference real field paths in the
// canonical multifamily schema (see UW_FORMAT_SPEC §4 and the Parkview
// example). When a path is missing, the calc returns ok:false with a
// CALC-RESOLVE-001 ProtocolError — the dashboard surfaces that as "—".
//
// Why this lives in the editor (not in @uwmd/core): per-asset-class calc packs
// are the module-author surface of the protocol. Bundling a default pack with
// the editor gives users live derived metrics out of the box; later, modules
// loaded at runtime will replace or extend this list.

import type { ModuleCalcDecl } from '@uwmd/core/browser';

export const MULTIFAMILY_STARTER_PACK: readonly ModuleCalcDecl[] = [
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
    formula: 'debt_structure.loan_amount / valuation.purchase_price',
    unit: '%',
    deterministic: true,
  },
  {
    id: 'dscr',
    label: 'DSCR',
    formula: 'noi_model.net_operating_income / debt_structure.annual_debt_service',
    unit: 'x',
    deterministic: true,
  },
  {
    id: 'debt_yield',
    label: 'Debt Yield',
    formula: 'noi_model.net_operating_income / debt_structure.loan_amount',
    unit: '%',
    deterministic: true,
  },
  {
    id: 'loan_per_unit',
    label: 'Loan / Unit',
    formula: 'debt_structure.loan_amount / property.total_units',
    unit: '$',
    deterministic: true,
  },
  {
    id: 'loan_per_sqft',
    label: 'Loan / SqFt',
    formula: 'debt_structure.loan_amount / property.total_nra_sqft',
    unit: '$',
    deterministic: true,
  },
  {
    id: 'price_per_unit',
    label: 'Price / Unit',
    formula: 'valuation.purchase_price / property.total_units',
    unit: '$',
    deterministic: true,
  },
  {
    id: 'cash_on_cash',
    label: 'Cash-on-Cash',
    formula:
      '(noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.sources.equity_sponsor',
    unit: '%',
    deterministic: true,
  },
];
