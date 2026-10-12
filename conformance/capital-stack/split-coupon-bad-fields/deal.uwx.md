---
uw_version: "3.0"
deal_id: uw_split_coupon_bad_fields
asset_class: multifamily
---

## Capital Stack {#capital_stack}

```json uw:section=capital_stack v=1
{
  "_meta": {
    "section": "capital_stack",
    "provenance": {
      "source": "manual",
      "resolution": "source_document",
      "actor": null,
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
  "tranches": [
    {
      "id": "debt",
      "class": "senior_debt",
      "position": 1,
      "amount": 1000000,
      "rate": 0.05,
      "accrual": "split",
      "cash_rate": 0.03
    }
  ]
}
```
