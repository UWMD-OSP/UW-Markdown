---
uw_version: "3.0"
deal_id: uw_lite_ironwood
deal_name: "Ironwood Logistics"
created: "2026-08-08T00:00:00Z"
last_modified: "2026-08-08T00:00:00Z"
asset_class: industrial
created_by: conformance
---

```json uw:section=debt_structure confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "annual_debt_service": 1289000,
  "interest_rate": 0.0625,
  "loan_amount": 17250000
}
```
```json uw:section=noi_model confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "net_operating_income": 1653125
}
```
```json uw:section=property confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "total_nra_sqft": 212400,
  "total_units": 148
}
```
```json uw:section=valuation confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "going_in_cap_rate": 0.0575,
  "purchase_price": 28750000
}
```
```json uw:section=x_uw_lite_source confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "x_uw_lite_source",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "markdown": "---\nuw_lite_version: 1.0\ndeal_id: uw_lite_ironwood\ndeal_name: Ironwood Logistics\ncreated: 2026-08-08T00:00:00Z\ncreated_by: conformance\nasset_class: industrial\n---\n\n# Property\n\n- Total units: 148 <!-- uw:property.total_units -->\n- Total NRA: 212,400 <!-- uw:property.total_nra_sqft -->\n\n# Acquisition\n\n- Purchase price: $28,750,000 <!-- uw:acquisition.purchase_price -->\n\n# Valuation\n\n- Going-in cap rate: 5.75% <!-- uw:valuation.going_in_cap_rate scenario=base -->\n\n# Net operating income\n\n- Net operating income: $1,653,125 <!-- uw:noi.net_operating_income -->\n\n# Debt\n\n- Loan amount: $17,250,000 <!-- uw:debt.loan_amount -->\n- Interest rate: 6.25% <!-- uw:debt.interest_rate -->\n- Annual debt service: $1,289,000 <!-- uw:debt.annual_debt_service -->\n\nEvery field above is a user-supplied input. A verification receipt can establish\nintegrity and deterministic consistency, but not the truth of these inputs.\n",
  "profile": "deal-summary-v1",
  "representation": "uw-lite-markdown",
  "representation_version": "1.0"
}
```
