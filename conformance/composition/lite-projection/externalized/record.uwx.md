---
uw_version: "1.1"
deal_id: uw_composition
asset_class: multifamily
---

## Rent Roll {#rent_roll}

```json uw:section=rent_roll external=true v=1
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "document/rent_roll",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "ts": "2026-06-01T00:00:00Z"
  },
  "rent_roll_type": "multifamily",
  "external": {
    "parts": [
      "lease-suite-210",
      "lease-suite-215",
      "lease-suite-220"
    ],
    "collection_key": "unit_id",
    "collection_path": "units",
    "part_count": 3
  }
}
```

## Valuation {#valuation}

```json uw:section=valuation v=1
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "document/om",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "ts": "2026-06-01T00:00:00Z"
  },
  "purchase_price": 4250000,
  "going_in_cap_rate": 0.0551
}
```
