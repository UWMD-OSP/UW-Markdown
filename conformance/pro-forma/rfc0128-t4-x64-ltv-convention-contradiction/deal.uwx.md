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
{"_meta":{"section":"dcf","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[{"address":{"section":"valuation","variant":null,"pointer":"/purchase_price"},"kind":"input"}],"relationships":[{"identity":"ltv","procedure_version":"1","target":{"section":"debt_structure","variant":null,"pointer":"/sizing_metrics/ltv"},"inputs":[{"role":"loan","address":{"section":"debt_structure","variant":null,"pointer":""}},{"role":"denominator","address":{"section":"valuation","variant":null,"pointer":"/purchase_price"}}],"unit":"%","conventions":{"ltv_basis":"underwritten-value"}}]}}
```

```json uw:section=debt_structure source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"debt_structure","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"loan_amount":6000000,"ltv_basis":"purchase-price","sizing_metrics":{"ltv":0.75}}
```

```json uw:section=valuation source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"valuation","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"purchase_price":8000000}
```
