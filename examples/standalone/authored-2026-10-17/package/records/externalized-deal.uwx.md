---
uw_version: "3.0"
document_profile: deal-underwriting-v1
deal_id: uw_standalone_authored_2026_10_17
deal_name: Standalone Authored Kit — 2026-10-17
asset_class: multifamily
---

# Standalone Authored Kit — 2026-10-17 Record

Newly authored fictional fixture; these figures illustrate stated data, not a verified real property. The inline and externalized carriers represent the same new logical record.

## Property {#property}

```json uw:section=property v=1
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "system/standalone-kit",
      "actor": "codex/standalone-kit-2026-10-17",
      "timestamp": "2026-10-17T21:34:15Z",
      "notes": "This deliberately authored fictional property only demonstrates structure and requires no human fact-review for that purpose; revision 1 is the new record head."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false,
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
      "source": "system/standalone-kit",
      "actor": "codex/standalone-kit-2026-10-17",
      "timestamp": "2026-10-17T21:34:15Z",
      "notes": "Human review is required before relying on these illustrative tenant rows as underwriting inputs; revision 1 is the new record head."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": true,
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
      "authored-2026-10-17-rent-roll-210",
      "authored-2026-10-17-rent-roll-215",
      "authored-2026-10-17-rent-roll-220"
    ],
    "collection_key": "unit_id",
    "collection_path": "units",
    "part_count": 3
  }
}
```
