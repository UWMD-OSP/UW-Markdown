---
uw_version: "3.0"
document_profile: deal-underwriting-v1
deal_id: uw_standalone_parkview_inline
deal_name: Parkview Standalone Kit — Inline
asset_class: multifamily
---

> Synthetic example: every name, party and figure in this record is fictional.

# Parkview Standalone Kit — Inline Record

The rent roll is carried in one record in this form.

## Property {#property}

```json uw:section=property v=1
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "system/uwmd",
      "actor": "example-kit",
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
  "address": "100 Parkview Drive",
  "city": "Glendale",
  "state": "AZ",
  "total_units": 3,
  "total_nra_sqft": 3000
}
```

## Rent Roll {#rent_roll}

```json uw:section=rent_roll external=true v=1
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "system/uwmd",
      "actor": "example-kit",
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
      "rent-roll-210",
      "rent-roll-215",
      "rent-roll-220"
    ],
    "collection_key": "unit_id",
    "collection_path": "units",
    "part_count": 3
  }
}
```
