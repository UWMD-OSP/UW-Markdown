---
uw_version: "3.0"
deal_id: CAPX-CONF
asset_class: multifamily
---

```json uw:section=sources_uses variant=base source=manual ts=2026-09-16T00:00:00Z v=1
{
  "uses": {
    "renovation": {
      "budget": 4000000,
      "contingency": 500000,
      "contingency_remaining": 380000
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
