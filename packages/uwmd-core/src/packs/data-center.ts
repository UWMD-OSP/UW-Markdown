// RFC 0080: class metrics and RFC 0079 standard income metrics.
import type { ModuleManifest } from '../protocol.js';

export const DATA_CENTER_PACK: ModuleManifest = {
  "manifest_version": "1",
  "description": "RFC 0080 full builtin starter calculations, including RFC 0079 standard income metrics.",
  "id": "org.uwmd.pack.data_center",
  "name": "Data Center Starter Pack",
  "version": "1.0.0",
  "authors": [
    "UW Markdown Working Group"
  ],
  "license": "MIT",
  "requires_protocol": "^4.0.0",
  "requires_format": "^3.0",
  "requires_conformance": "verifier",
  "asset_classes": [
    "data_center"
  ],
  "calculations": [
    {
      "id": "cap_rate",
      "label": "Cap Rate",
      "formula": "noi_model.net_operating_income / valuation.purchase_price",
      "unit": "%",
      "deterministic": true
    },
    {
      "id": "ltv",
      "label": "LTV",
      "formula": "debt_structure.loan_amount / (valuation.underwritten_value != null ? valuation.underwritten_value : valuation.purchase_price)",
      "unit": "%",
      "section_roles": {
        "debt_structure": "senior"
      },
      "deterministic": true
    },
    {
      "id": "ltc",
      "label": "LTC",
      "formula": "debt_structure.loan_amount / sources_uses.uses.total",
      "unit": "%",
      "section_roles": {
        "debt_structure": "senior"
      },
      "deterministic": true
    },
    {
      "id": "dscr",
      "label": "DSCR",
      "formula": "noi_model.net_operating_income / debt_structure.annual_debt_service",
      "unit": "x",
      "section_roles": {
        "debt_structure": "senior"
      },
      "deterministic": true
    },
    {
      "id": "debt_yield",
      "label": "Debt Yield",
      "formula": "noi_model.net_operating_income / debt_structure.loan_amount",
      "unit": "%",
      "section_roles": {
        "debt_structure": "senior"
      },
      "deterministic": true
    },
    {
      "id": "cash_on_cash",
      "label": "Cash-on-Cash",
      "formula": "sources_uses.equity_metrics.equity_total == null ? null : (dcf.annual_cash_flows.Y1.net_cash_flow_levered != null ? dcf.annual_cash_flows.Y1.net_cash_flow_levered : noi_model.net_operating_income - debt_structure.annual_debt_service) / sources_uses.equity_metrics.equity_total",
      "unit": "%",
      "deterministic": true
    },
    {
      "id": "utilization",
      "label": "Utilization",
      "formula": "dc_capacity.contracted_it_load_kw / dc_capacity.critical_it_load_kw",
      "unit": "%",
      "round_to": 4,
      "deterministic": true
    },
    {
      "id": "commissioned_share",
      "label": "Commissioned Share of Build-Out",
      "formula": "dc_capacity.critical_it_load_kw / dc_capacity.planned_it_load_kw",
      "unit": "%",
      "round_to": 4,
      "deterministic": true
    },
    {
      "id": "facility_load_kw",
      "label": "Facility Load at Design PUE",
      "formula": "dc_capacity.critical_it_load_kw * dc_capacity.design_pue",
      "unit": "kW",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "annual_facility_kwh_at_contract",
      "label": "Annual Facility kWh at Contracted Load",
      "formula": "dc_capacity.contracted_it_load_kw * dc_capacity.design_pue * 8760",
      "unit": "kWh",
      "round_to": 0,
      "deterministic": true
    },
    {
      "id": "annual_power_cost",
      "label": "Annual Power Cost",
      "formula": "dc_power.stated_annual_power_cost != null ? dc_power.stated_annual_power_cost : round((dc_capacity.contracted_it_load_kw * dc_capacity.design_pue * 8760), 0) * dc_power.utility_rate_per_kwh",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "power_cost_per_kw_month",
      "label": "Power Cost per kW-Month",
      "formula": "round((dc_power.stated_annual_power_cost != null ? dc_power.stated_annual_power_cost : round((dc_capacity.contracted_it_load_kw * dc_capacity.design_pue * 8760), 0) * dc_power.utility_rate_per_kwh), 2) / (dc_capacity.contracted_it_load_kw * 12)",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "annual_rent_revenue",
      "label": "Annual Rent Revenue",
      "formula": "dc_revenue.rent_per_kw_month * dc_capacity.contracted_it_load_kw * 12",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "blended_revenue_per_kw_month",
      "label": "Blended Revenue per kW-Month",
      "formula": "(round((dc_revenue.rent_per_kw_month * dc_capacity.contracted_it_load_kw * 12), 2) + dc_revenue.interconnection_revenue_annual + dc_revenue.services_revenue_annual) / (dc_capacity.contracted_it_load_kw * 12)",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "rent_index",
      "label": "Rent Index vs Market",
      "formula": "dc_revenue.rent_per_kw_month / dc_revenue.market_rent_per_kw_month",
      "unit": "x",
      "round_to": 4,
      "deterministic": true
    },
    {
      "id": "price_per_commissioned_kw",
      "label": "Price per Commissioned kW",
      "formula": "quick_metrics.purchase_price / dc_capacity.critical_it_load_kw",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "noi_per_commissioned_kw",
      "label": "NOI per Commissioned kW",
      "formula": "noi_model.net_operating_income / dc_capacity.critical_it_load_kw",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "price_per_kw",
      "label": "Price / Critical IT kW",
      "formula": "valuation.purchase_price / property.critical_it_load_kw",
      "unit": "$",
      "deterministic": true
    },
    {
      "id": "noi_per_kw",
      "label": "NOI / Critical IT kW",
      "formula": "noi_model.net_operating_income / property.critical_it_load_kw",
      "unit": "$",
      "deterministic": true
    },
    {
      "id": "loan_per_kw",
      "label": "Loan / Critical IT kW",
      "formula": "debt_structure.loan_amount / property.critical_it_load_kw",
      "unit": "$",
      "deterministic": true,
      "section_roles": {
        "debt_structure": "senior"
      }
    }
  ]
};
