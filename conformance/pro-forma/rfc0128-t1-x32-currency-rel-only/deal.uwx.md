---
uw_version: "3.0"
deal_id: SYN-551
deal_name: "Synthetic 551 control"
asset_class: multifamily
deal_stage: screening
---

# Synthetic

```json uw:section=dcf source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"dcf","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"t":265000.0,"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[],"relationships":[{"identity":"total_net","procedure_version":"1","target":{"section":"dcf","variant":null,"pointer":"/t"},"inputs":[{"role":"stream","address":{"section":"cash_flow_series","variant":"base","pointer":""}}],"unit":"$","currency":"USD"}],"conventions":{"cash_flow_timing":"dated","irr_frequency":"xirr"}}}
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"cash_flow_series","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"day_count":"actual/365f","series":[{"date":"2026-01-15","amount":-1000000.0},{"date":"2026-01-15","amount":-25000.0},{"date":"2026-07-15","amount":40000.0},{"date":"2027-01-15","amount":42500.0},{"date":"2027-01-15","amount":42500.0},{"date":"2027-09-30","amount":-15000.0},{"date":"2028-12-31","amount":1180000.0}]}
```
