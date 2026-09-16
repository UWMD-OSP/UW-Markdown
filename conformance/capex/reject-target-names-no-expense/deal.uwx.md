---
uw_version: "1.1"
deal_id: CAPX-CONF
asset_class: multifamily
---

```json uw:section=sources_uses variant=base source=manual ts=2026-09-16T00:00:00Z v=1
{
  "uses": {
    "renovation": {
      "budget": 4000000,
      "contingency": 500000,
      "contingency_used": 120000,
      "drawn_to_date": 1850000,
      "as_of_date": "2026-09-01",
      "expense_targeted": [
        {
          "label": "LED and controls retrofit",
          "amount": 600000,
          "targets": "parking_revenue",
          "annual_savings": 95000,
          "savings_begin": "Y2",
          "in_noi_model": false
        }
      ]
    }
  }
}
```

```json uw:section=noi_model variant=base source=manual ts=2026-09-16T00:00:00Z v=1
{
  "expenses": {
    "utilities": {
      "value": 310000,
      "source": "actual"
    },
    "insurance": {
      "value": 88000,
      "source": "actual"
    }
  }
}
```
