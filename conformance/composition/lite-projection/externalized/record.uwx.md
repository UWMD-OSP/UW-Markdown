---
uw_version: "3.0"
deal_id: uw_composition
asset_class: multifamily
---

## Rent Roll {#rent_roll}

```json uw:section=rent_roll external=true v=1
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
