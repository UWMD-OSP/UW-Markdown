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
{"_meta":{"section":"dcf","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[{"address":{"section":"valuation","variant":null,"pointer":"/underwritten_value"},"kind":"input"},{"address":{"section":"valuation","variant":null,"pointer":"/purchase_price"},"kind":"input"}],"relationships":[{"identity":"ltv_through","procedure_version":"1","target":{"section":"capital_stack","variant":null,"pointer":"/sizing/4/value"},"inputs":[{"role":"stack","address":{"section":"capital_stack","variant":null,"pointer":""}},{"role":"value","address":{"section":"valuation","variant":null,"pointer":"/underwritten_value"}}],"unit":"%","selectors":{"through":2}}]}}
```

```json uw:section=capital_stack source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"capital_stack","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"point_in_time":"stabilization","tranches":[{"id":"senior","class":"senior_debt","position":1,"amount":6500000,"rate":0.0575,"amortization_months":360,"io_months":24,"term_months":120,"accrual":"cash"},{"id":"mezz","class":"mezzanine_debt","position":2,"amount":1200000,"rate":0.105,"amortization_months":0,"io_months":60,"term_months":60,"accrual":"cash"},{"id":"common","class":"common_equity","position":3,"amount":1500000}],"sizing":[{"id":"senior_dscr","fn":"coverage","over":"senior","value":1.58},{"id":"blend","fn":"blended_coverage","through":2,"value":1.24},{"id":"dy","fn":"debt_yield_through","through":2,"value":0.0935},{"id":"ltc","fn":"ltc_through","through":2,"value":0.713},{"id":"ltv","fn":"ltv_through","through":2,"value":0.6417},{"id":"wacc","fn":"weighted_cost","over":"*","value":0.0649}]}
```

```json uw:section=valuation source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"valuation","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"purchase_price":11000000}
```
