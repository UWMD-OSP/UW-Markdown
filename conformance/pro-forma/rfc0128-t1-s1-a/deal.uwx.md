---
uw_version: "3.0"
deal_id: SYN-551
deal_name: "Synthetic 551 control"
asset_class: multifamily
currency_code: USD
deal_stage: screening
---

# Synthetic

```json uw:section=dcf source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"dcf","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[{"address":{"section":"cash_flow_series","variant":"base","pointer":"/stated_metrics/xnpv/rate"},"family":"npv","kind":"assumption"}],"relationships":[{"identity":"total_net","procedure_version":"1","target":{"section":"cash_flow_series","variant":"base","pointer":"/stated_metrics/total_net"},"inputs":[{"role":"stream","address":{"section":"cash_flow_series","variant":"base","pointer":""}}],"unit":"$","currency":"USD"},{"identity":"moic","procedure_version":"1","target":{"section":"cash_flow_series","variant":"base","pointer":"/stated_metrics/moic"},"inputs":[{"role":"stream","address":{"section":"cash_flow_series","variant":"base","pointer":""}}],"unit":"x"},{"identity":"xirr","procedure_version":"1","target":{"section":"cash_flow_series","variant":"base","pointer":"/stated_metrics/xirr"},"inputs":[{"role":"stream","address":{"section":"cash_flow_series","variant":"base","pointer":""}}],"unit":"%"},{"identity":"xnpv","procedure_version":"1","target":{"section":"cash_flow_series","variant":"base","pointer":"/stated_metrics/xnpv/value"},"inputs":[{"role":"stream","address":{"section":"cash_flow_series","variant":"base","pointer":""}},{"role":"rate","address":{"section":"cash_flow_series","variant":"base","pointer":"/stated_metrics/xnpv/rate"}}],"unit":"$","currency":"USD"}],"conventions":{"cash_flow_timing":"dated","irr_frequency":"xirr"}}}
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"cash_flow_series","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"label":"synthetic S1-A","day_count":"actual/365f","series":[{"date":"2026-01-15","amount":-1000000.0},{"date":"2026-01-15","amount":-25000.0},{"date":"2026-07-15","amount":40000.0},{"date":"2027-01-15","amount":42500.0},{"date":"2027-01-15","amount":42500.0},{"date":"2027-09-30","amount":-15000.0},{"date":"2028-12-31","amount":1180000.0}],"stated_metrics":{"total_net":265000.0,"moic":1.2548,"xirr":0.087098,"xnpv":{"rate":0.08,"value":18543.65}}}
```
