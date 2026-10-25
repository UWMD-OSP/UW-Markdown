---
uw_version: "3.0"
deal_id: SYNTHETIC-PRO-FORMA
deal_name: "Synthetic profile controls"
asset_class: multifamily
currency_code: USD
deal_stage: screening
---

```json uw:section=dcf source=manual
{"result":1.2,"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[{"address":{"section":"dcf","variant":null,"pointer":"/result"},"kind":"input"}],"relationships":[{"identity":"moic","procedure_version":"1","target":{"section":"dcf","variant":null,"pointer":"/result"},"inputs":[{"role":"stream","address":{"section":"cash_flow_series","variant":null,"pointer":""}}],"unit":"x","conventions":{"cash_flow_timing":"dated"}}]}}
```

```json uw:section=cash_flow_series source=manual
{"day_count":"actual/365f","series":[{"date":"2025-01-01","amount":-100},{"date":"2026-01-01","amount":120}]}
```
