---
uw_version: "3.0"
deal_id: uw_lite_decimal_exact
deal_name: "Saguaro Terrace"
created: "2026-08-25T00:00:00Z"
last_modified: "2026-08-25T00:00:00Z"
asset_class: multifamily
created_by: conformance
---

```json uw:section=assumptions confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "provenance": {
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "notes": null,
      "source": "manual",
      "timestamp": "2026-08-25T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "flags": [],
      "human_review_required": false,
      "partial": false,
      "provisional": false
    },
    "section": "assumptions"
  },
  "rent_growth": -0.0247,
  "vacancy": {
    "year_1": 0.0307
  }
}
```

```json uw:section=debt_structure confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "provenance": {
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "notes": null,
      "source": "manual",
      "timestamp": "2026-08-25T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "flags": [],
      "human_review_required": false,
      "partial": false,
      "provisional": false
    },
    "section": "debt_structure"
  },
  "interest_rate": 0.0619
}
```

```json uw:section=valuation confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "provenance": {
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "notes": null,
      "source": "manual",
      "timestamp": "2026-08-25T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "flags": [],
      "human_review_required": false,
      "partial": false,
      "provisional": false
    },
    "section": "valuation"
  },
  "going_in_cap_rate": 0.0551,
  "purchase_price": 10000000
}
```

```json uw:section=x_uw_lite_source confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "provenance": {
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "notes": null,
      "source": "manual",
      "timestamp": "2026-08-25T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "flags": [],
      "human_review_required": false,
      "partial": false,
      "provisional": false
    },
    "section": "x_uw_lite_source"
  },
  "markdown": "---\nuw_lite_version: 1.0\ndeal_id: uw_lite_decimal_exact\ndeal_name: Saguaro Terrace\ncreated: 2026-08-25T00:00:00Z\ncreated_by: conformance\nasset_class: multifamily\n---\n\n## Rate assumptions\n\n* Vacancy assumption (first year): 0.0307 <!-- uw:assumptions.vacancy.year_1 unit=fraction -->\n* Annual rent trend: -0.0247 <!-- uw:assumptions.rent_growth unit=fraction -->\n* Coupon: 0.0619 <!-- uw:debt.interest_rate unit=fraction -->\n\n## Pricing\n\n+ Basis: $10,000,000 <!-- uw:acquisition.purchase_price -->\n+ Cap rate at close: 0.0551 <!-- uw:valuation.going_in_cap_rate unit=fraction scenario=base -->\n\nThe twin of `06-decimal-exact-percents`: the same five values, spelled as bare\nfractions with an explicit `unit=fraction` attribute instead of percent\nnotation, under different labels, headings, bullets, and field order. Spec §6\nexcludes all of those axes from the financial canonical form, so both\nfixtures must share one digest — which holds only if `5.51%` normalizes to\nexactly the double `0.0551` denotes (RFC 0025).\n",
  "profile": "deal-summary-v1",
  "representation": "uw-lite-markdown",
  "representation_version": "1.0"
}
```
