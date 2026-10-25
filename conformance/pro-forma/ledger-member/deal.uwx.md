---
uw_version: "3.0"
deal_id: SYNTHETIC-PRO-FORMA
deal_name: "Synthetic profile controls"
asset_class: multifamily
currency_code: USD
deal_stage: screening
---

```json uw:section=dcf source=manual
{"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[],"relationships":[],"ledger":{"universe":[{"event":{"section":"cash_flow_series","variant":null,"pointer":"/series/0"},"role":"acquisition","required":true}],"bindings":[{"event":{"section":"cash_flow_series","variant":null,"pointer":"/series/0"},"role":"acquisition"}],"exclusions":[]}}}
```

```json uw:section=cash_flow_series source=manual
{"day_count":"actual/365f","series":[{"date":"2025-01-01","amount":-100},{"date":"2026-01-01","amount":120}]}
```
