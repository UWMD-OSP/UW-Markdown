---
uw_version: "3.0"
deal_id: "uw_2026_mhc_desert_palms"
deal_name: "Desert Palms MHC — Apache Junction, AZ"
created: "2026-10-10T12:00:00Z"
last_modified: "2026-10-10T12:00:00Z"
asset_class: "manufactured_housing"
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
The builtin pack evaluates the six class-specific metrics; no rent potential is reconciled
with NOI. The standard sections carry the common income and financing metrics, while `property.total_units` is unstated to avoid a wrong denominator.

## Property

```json uw:section=property source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": null,
      "source": "manual"
    },
    "quality": {
      "confidence": "high",
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
  "name": "Desert Palms MHC",
  "address": {
    "street": "Example site",
    "city": "Apache Junction",
    "state": "AZ",
    "zip": "85119"
  },
  "property_type": "manufactured_housing",
  "total_sites": 200,
  "_notes": " Primary size is an identity of the stated mhc_sites.total_sites field."
}
```

## Rent Roll {#rent_roll}

Site-level rent roll summary, as of the same date as `mhc_sites`. It restates the
stated site inventory and rents — 180 of 200 sites occupied, a $550 weighted
monthly pad rent across all sites, and 20 park-owned homes renting at $750 a
month before pad rent — so the term-sheet stage has its rent roll like every
other income class. Synthetic, like the rest of this example; the per-site
records would live in the source file.

```json uw:section=rent_roll source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": null,
      "source": "manual"
    },
    "quality": {
      "confidence": "high",
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
  "rent_roll_type": "manufactured_housing",
  "as_of_date": "2026-09-30",
  "total_sites": 200,
  "occupied_sites": 180,
  "vacant_sites": 20,
  "physical_occupancy_pct": 0.9,
  "weighted_pad_rent_monthly": 550,
  "park_owned_homes": 20,
  "poh_home_rent_monthly": 750,
  "site_mix_summary": [
    {
      "site_status": "occupied",
      "count": 180,
      "avg_pad_rent_monthly": 550
    },
    {
      "site_status": "vacant",
      "count": 20,
      "avg_pad_rent_monthly": 550
    }
  ],
  "_notes": "Synthetic summary mirroring mhc_sites. Pad rent is per site (vacant sites at stated asking rent); park-owned-home rent is per home and excludes pad rent. No unit count is stated, so no dwelling-unit denominator is implied."
}
```

## Valuation

```json uw:section=valuation source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": null,
      "source": "manual"
    },
    "quality": {
      "confidence": "high",
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
  "purchase_price": 12000000,
  "cap_rate": 0.06,
  "ltv": 0.6,
  "ltc": 0.6,
  "dscr": 1.5,
  "debt_yield": 0.1,
  "cash_on_cash": 0.05,
  "physical_occupancy": 0.9,
  "annual_pad_rent_potential": 1320000,
  "poh_share": 0.1,
  "annual_poh_home_rent_potential": 180000,
  "price_per_site": 60000,
  "noi_per_site": 3600,
  "loan_per_site": 36000,
  "_notes": " RFC 0080 starter metrics are deterministic outputs of the stated inputs; no default or cascade was used."
}
```

## Noi Model

```json uw:section=noi_model source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": null,
      "source": "manual"
    },
    "quality": {
      "confidence": "high",
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
  "net_operating_income": 720000,
  "income": {
    "pad_rent": 1188000,
    "poh_home_rent": 180000,
    "other_income": 0,
    "effective_gross_income": 1368000
  },
  "expenses": {
    "payroll": 180000,
    "property_taxes": 140000,
    "insurance": 48000,
    "utilities": 50000,
    "repairs_maintenance": 110000,
    "management_fee": 70000,
    "general_admin": 50000,
    "marketing": 0,
    "total_operating_expenses": 648000
  },
  "_notes": " Synthetic starter operating statement: income and expenses are explicitly stated for workbook footing, preserving the original $720,000 NOI. The collected rents equal full collection at the stated rents with no credit loss: pad rent is 180 occupied sites x $550 x 12 = $1,188,000 and park-owned-home rent is 20 homes x $750 x 12 = $180,000. They are stated inputs; the pack does not derive them."
}
```

## Debt Structure

```json uw:section=debt_structure source=manual ts=2026-10-10T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": null,
      "source": "manual"
    },
    "quality": {
      "confidence": "high",
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
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T12:00:00Z",
      "notes": null,
      "source": "manual"
    },
    "quality": {
      "confidence": "high",
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
  "total_sites": 200,
  "occupied_sites": 180,
  "park_owned_homes": 20,
  "weighted_pad_rent_monthly": 550,
  "poh_home_rent_monthly": 750,
  "as_of_date": "2026-09-30"
}
```


## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=manual ts=2026-10-10T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "manual",
      "actor": "codex",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-10T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
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
  "_notes": "Synthetic starter example: total uses comprise only the stated $12M purchase price; the stated sources are $7.2M debt and $4.8M sponsor equity. equity_total is an identity of the single sponsor-equity line.",
  "sources": {
    "loan_amount": 7200000,
    "sponsor_equity": 4800000,
    "total": 12000000
  },
  "uses": {
    "purchase_price": 12000000,
    "total": 12000000
  },
  "equity_metrics": {
    "equity_total": 4800000
  }
}
```
