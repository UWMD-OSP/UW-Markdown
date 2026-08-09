---
uw_version: "1.1"
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
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "debt_structure",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "annual_debt_service": 1289000,
  "interest_rate": 0.0625,
  "loan_amount": 17250000
}
```

```json uw:section=noi_model confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "noi_model",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "net_operating_income": 1653125
}
```

```json uw:section=property confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "property",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "total_nra_sqft": 212400,
  "total_units": 148
}
```

```json uw:section=valuation confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "valuation",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "going_in_cap_rate": 0.0575,
  "purchase_price": 28750000
}
```

```json uw:section=x_uw_lite_source confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "actor": "conformance",
    "agent_id": null,
    "agent_version": null,
    "confidence": "high",
    "flags": [],
    "human_review_required": false,
    "input_hash": null,
    "notes": null,
    "section": "x_uw_lite_source",
    "source": "manual",
    "superseded": false,
    "timestamp": "2026-08-08T00:00:00Z",
    "version": 1
  },
  "markdown": "---\nuw_lite_version: 1.0\ndeal_id: uw_lite_ironwood\ndeal_name: Ironwood Logistics\ncreated: 2026-08-08T00:00:00Z\ncreated_by: conformance\nasset_class: industrial\n---\n\n## Financing terms\n\n* Loan proceeds: $17,250,000 <!-- uw:debt.loan_amount -->\n+ Coupon: 6.2500% <!-- uw:debt.interest_rate -->\n*   Debt service (annual): $1289000 <!-- uw:debt.annual_debt_service -->\n\nProse between fields is presentation only and must not reach the financial\ncanonical form.\n\n### Income and value\n\n+ NOI: $1653125 <!-- uw:noi.net_operating_income -->\n- Cap rate at acquisition: 5.750% <!-- uw:valuation.going_in_cap_rate scenario=base -->\n* Basis: $28750000 <!-- uw:acquisition.purchase_price -->\n\n#### Physical\n\n- Unit count: 148 <!-- uw:property.total_units -->\n- Rentable area: 212400 <!-- uw:property.total_nra_sqft -->\n",
  "profile": "deal-summary-v1",
  "representation": "uw-lite-markdown",
  "representation_version": "1.0"
}
```
