// RFC 0080: class metrics and RFC 0079 standard income metrics.
import type { ModuleManifest } from '../protocol.js';

export const MANUFACTURED_HOUSING_PACK: ModuleManifest = {
  "manifest_version": "1",
  "description": "RFC 0080 full builtin starter calculations, including RFC 0079 standard income metrics.",
  "id": "org.uwmd.pack.manufactured_housing",
  "name": "Manufactured Housing Starter Pack",
  "version": "1.0.0",
  "authors": [
    "UW Markdown Working Group"
  ],
  "license": "MIT",
  "requires_protocol": ">=2.25.0",
  "requires_format": ">=2.1.0",
  "requires_tier": "tier-3-calc-host",
  "asset_classes": [
    "manufactured_housing"
  ],
  "calculations": [
    {
      "id": "cap_rate",
      "label": "Cap Rate",
      "formula": "noi_model.net_operating_income / valuation.purchase_price",
      "unit": "%",
      "section_roles": {},
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
      "section_roles": {},
      "deterministic": true
    },
    {
      "id": "physical_occupancy",
      "label": "Physical Occupancy",
      "formula": "mhc_sites.occupied_sites / mhc_sites.total_sites",
      "unit": "%",
      "round_to": 4,
      "deterministic": true
    },
    {
      "id": "annual_pad_rent_potential",
      "label": "Annual Pad Rent Potential",
      "formula": "mhc_sites.weighted_pad_rent_monthly * mhc_sites.total_sites * 12",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "poh_share",
      "label": "Park-Owned Home Share",
      "formula": "mhc_sites.park_owned_homes / mhc_sites.total_sites",
      "unit": "%",
      "round_to": 4,
      "deterministic": true
    },
    {
      "id": "annual_poh_home_rent_potential",
      "label": "Annual Park-Owned Home Rent Potential",
      "formula": "mhc_sites.poh_home_rent_monthly * mhc_sites.park_owned_homes * 12",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "price_per_site",
      "label": "Price per Site",
      "formula": "valuation.purchase_price / property.total_sites",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "noi_per_site",
      "label": "NOI per Site",
      "formula": "noi_model.net_operating_income / property.total_sites",
      "unit": "$",
      "round_to": 2,
      "deterministic": true
    },
    {
      "id": "loan_per_site",
      "label": "Loan / Site",
      "formula": "debt_structure.loan_amount / property.total_sites",
      "unit": "$",
      "deterministic": true,
      "section_roles": {
        "debt_structure": "senior"
      }
    }
  ]
};
