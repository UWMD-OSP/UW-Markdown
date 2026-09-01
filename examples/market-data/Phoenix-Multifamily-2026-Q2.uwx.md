---
uw_version: "1.1"
document_profile: market-data-v1
document_id: md:phx-multifamily:2026-Q2
as_of: "2026-06-30"
provider: Example Research LLC
geo: Phoenix-Mesa-Chandler, AZ
asset_class: multifamily
---

# Phoenix Multifamily — Q2 2026

An observation set, not an underwriting record. It carries no `deal_id`, no
calculations, and no pack applies to it. Every figure below is something a
provider published; none of it is a conclusion about any particular property.

**What a receipt over a deal that used this document proves:** the deal's stated
outputs follow deterministically from its inputs, and *these particular
observations* were the ones used. It proves nothing about whether these
observations are accurate, current, or representative — see
`spec/UW_RECEIPT_v1.md` §10.3.

## Market Observations {#market_observations}

```json uw:section=market_observations v=1
{
  "_meta": {
    "section": "market_observations",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "market_data",
    "agent_id": null,
    "agent_version": null,
    "actor": "example-research-import",
    "ts": "2026-06-30T00:00:00Z"
  },
  "observations": [
    {
      "field_path": "valuation.going_in_cap_rate",
      "value": 0.0545,
      "unit": "fraction",
      "range": {
        "low": 0.051,
        "central": 0.0545,
        "high": 0.059
      },
      "basis": "42 closed sales of 100+ unit stabilized assets, trailing 12 months",
      "confidence": "medium"
    },
    {
      "field_path": "valuation.exit_cap_rate_pct",
      "value": 0.0595,
      "unit": "fraction",
      "range": {
        "low": 0.056,
        "central": 0.0595,
        "high": 0.064
      },
      "basis": "Going-in plus 50bps, the spread implied by the same 42 sales against their underwriting at acquisition",
      "confidence": "low"
    },
    {
      "field_path": "rent_roll.vacancy_pct",
      "value": 0.068,
      "unit": "fraction",
      "range": {
        "low": 0.054,
        "central": 0.068,
        "high": 0.089
      },
      "basis": "Submarket physical vacancy, 316 surveyed properties, Q2 2026",
      "confidence": "high"
    },
    {
      "field_path": "noi_model.expense_ratio",
      "value": 0.412,
      "unit": "fraction",
      "range": {
        "low": 0.368,
        "central": 0.412,
        "high": 0.461
      },
      "basis": "Operating expenses as a share of EGI, 188 properties reporting full-year 2025 actuals",
      "confidence": "medium"
    }
  ]
}
```

## Notes

`confidence` is the provider's, not the reader's, and promotion does not raise
it: accepting the exit cap rate above still means accepting a `low`-confidence
observation. It is `low` for a reason worth stating plainly — an exit cap
derived as a spread over going-in is a modelling convention, not a transaction
observation, and it is doing more work in a DCF than almost any other input.

Every rate is a fraction, per the repo-wide convention: `0.0545` is 5.45%.
