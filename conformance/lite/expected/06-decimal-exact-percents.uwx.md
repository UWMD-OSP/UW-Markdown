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
    "section": "assumptions",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-25T00:00:00Z",
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
  "rent_growth": -0.0247,
  "vacancy": {
    "year_1": 0.0307
  }
}
```

```json uw:section=debt_structure confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-25T00:00:00Z",
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
  "interest_rate": 0.0619
}
```

```json uw:section=valuation confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-25T00:00:00Z",
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
  "going_in_cap_rate": 0.0551,
  "purchase_price": 10000000
}
```

```json uw:section=x_uw_lite_source confidence=high source=manual ts=2026-08-25T00:00:00Z v=1
{
  "_meta": {
    "section": "x_uw_lite_source",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-25T00:00:00Z",
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
  "markdown": "---\nuw_lite_version: 1.0\ndeal_id: uw_lite_decimal_exact\ndeal_name: Saguaro Terrace\ncreated: 2026-08-25T00:00:00Z\ncreated_by: conformance\nasset_class: multifamily\n---\n\n# Acquisition\n\n- Purchase price: $10,000,000 <!-- uw:acquisition.purchase_price -->\n\n# Valuation\n\n- Going-in cap rate: 5.51% <!-- uw:valuation.going_in_cap_rate scenario=base -->\n\n# Financing\n\n- Interest rate: 6.19% <!-- uw:debt.interest_rate -->\n\n# Assumptions\n\n- Rent growth: -2.47% <!-- uw:assumptions.rent_growth -->\n- Year 1 vacancy: 3.07% <!-- uw:assumptions.vacancy.year_1 -->\n\nEvery percent in this fixture is a literal whose value under naive division\n(`Number(p) / 100`) lands one ULP away from the double its fraction spelling\ndenotes — `5.51 / 100` is `0.055099999999999996`, not `0.0551`. RFC 0025\nrequires normalization by decimal-point shift, so the canonical form must\ncarry the exact fraction. The other Lite fixtures all use cleanly-dividing\npercents and pass unchanged through either implementation; this one exists so\nthe corpus can tell them apart.\n",
  "profile": "deal-summary-v1",
  "representation": "uw-lite-markdown",
  "representation_version": "1.0"
}
```
