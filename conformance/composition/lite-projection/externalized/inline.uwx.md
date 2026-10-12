---
uw_version: "3.0"
deal_id: uw_composition
asset_class: multifamily
---

## Rent Roll {#rent_roll}

```json uw:section=rent_roll v=1
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "document/rent_roll",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "notes": null
    },
    "quality": {
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "rent_roll_type": "multifamily",
  "units": [
    {
      "unit_id": "210",
      "tenant_name": "Anchor Tenant LLC",
      "monthly_rent": 15400
    },
    {
      "unit_id": "215",
      "tenant_name": "Second Tenant LLC",
      "monthly_rent": 9100
    },
    {
      "unit_id": "220",
      "tenant_name": "Third Tenant LLC",
      "monthly_rent": 7350
    }
  ]
}
```

## Valuation {#valuation}

```json uw:section=valuation v=1
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "document/om",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "notes": null
    },
    "quality": {
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "purchase_price": 4250000,
  "going_in_cap_rate": 0.0551
}
```
