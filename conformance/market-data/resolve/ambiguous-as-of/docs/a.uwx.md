---
uw_version: "1.1"
document_profile: market-data-v1
document_id: md:vendor-a
as_of: "2026-06-30"
provider: Example Research LLC
geo: Phoenix-Mesa-Chandler, AZ
asset_class: multifamily
---

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
    "actor": "conformance",
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
      "basis": "42 closed sales, trailing 12 months",
      "confidence": "medium"
    }
  ]
}
```
