---
uw_version: "2.0"
deal_id: "uw_2026_mhc_desert_palms"
deal_name: "Desert Palms MHC — Apache Junction, AZ"
created: "2026-10-10T12:00:00Z"
last_modified: "2026-10-10T12:00:00Z"
asset_class: "org.uwmd.manufactured_housing"
modules:
  - id: org.uwmd.manufactured_housing_module
    version: ">=0.1.0 <1.0.0"
scenario: "stabilized_acquisition"
currency: "USD"
status: "in_progress"
source_documents: []
---

# Desert Palms MHC — Apache Junction, AZ

Synthetic teaching example, not an actual property or source-document extraction.
The site inventory and rents below are the example underwriter's stated inputs.
The pad rent averages all sites (occupied at in-place rent, vacant at stated
asking rent); home rent averages all park-owned homes and excludes pad rent.
The module evaluates the six declared metrics; no rent potential is reconciled
with NOI. The standard sections remain available to a degraded multifamily
reader, while `property.total_units` is unstated to avoid a wrong denominator.

## Property

```json uw:section=property source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "example-author",
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": "Synthetic underwriter-stated example inputs, not extracted facts."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "name": "Desert Palms MHC",
  "address": {
    "street": "Example site",
    "city": "Apache Junction",
    "state": "AZ",
    "zip": "85119"
  },
  "property_type": "manufactured_housing"
}
```

## Valuation

```json uw:section=valuation source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "example-author",
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": "Synthetic underwriter-stated example inputs, not extracted facts."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "purchase_price": 12000000
}
```

## Noi Model

```json uw:section=noi_model source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "example-author",
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": "Synthetic underwriter-stated example inputs, not extracted facts."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "net_operating_income": 720000
}
```

## Debt Structure

```json uw:section=debt_structure source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "example-author",
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": "Synthetic underwriter-stated example inputs, not extracted facts."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "loan_amount": 7200000,
  "annual_debt_service": 480000
}
```

## Mhc Sites

```json uw:section=mhc_sites source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "mhc_sites",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "example-author",
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": "Synthetic underwriter-stated example inputs, not extracted facts."
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "total_sites": 0,
  "occupied_sites": 180,
  "park_owned_homes": 20,
  "weighted_pad_rent_monthly": 550,
  "poh_home_rent_monthly": 750,
  "as_of_date": "2026-09-30"
}
```

