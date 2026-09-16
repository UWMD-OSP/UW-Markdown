---
uw_version: "1.1"
deal_id: uw_split_coupon_bad_fields
asset_class: multifamily
---

## Capital Stack {#capital_stack}

```json uw:section=capital_stack v=1
{
  "_meta": {
    "section": "capital_stack",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "source_document",
    "agent_id": null,
    "agent_version": null,
    "actor": null,
    "ts": "2026-09-13T00:00:00Z"
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
