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
{"_meta":{"section":"dcf","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[],"relationships":[],"ledger":{"universe":[{"event":{"section":"cash_flow_series","variant":"base","pointer":"/series/0"},"role":"acq_price","required":true}],"bindings":[{"event":{"section":"cash_flow_series","variant":"base","pointer":"/series/0"},"role":"acq_price"},{"event":{"section":"cash_flow_series","variant":"base","pointer":"/series/6"},"role":"exit"}],"exclusions":[]}}}
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"cash_flow_series","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"day_count":"actual/365f","series":[{"date":"2026-01-15","amount":-1000000.0},{"date":"2026-01-15","amount":-25000.0},{"date":"2026-07-15","amount":40000.0},{"date":"2027-01-15","amount":42500.0},{"date":"2027-01-15","amount":42500.0},{"date":"2027-09-30","amount":-15000.0},{"date":"2028-12-31","amount":1180000.0}]}
```
