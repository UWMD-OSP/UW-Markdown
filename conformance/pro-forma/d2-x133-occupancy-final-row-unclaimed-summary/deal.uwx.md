---
uw_version: "3.0"
deal_id: SYN-551
deal_name: "Synthetic 551 control"
asset_class: office
currency_code: USD
deal_stage: screening
---

# Synthetic

```json uw:section=dcf source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"dcf","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"pro_forma":{"profile":"pro-forma","level":"L1","convention_registry":"uwmd.pro-forma.l1.1","rows":[{"address":{"section":"property","variant":null,"pointer":"/rentable_square_feet"},"kind":"input"}],"relationships":[{"identity":"final_occupancy_rate","procedure_version":"1","target":{"section":"lease_up_schedule","variant":"base","pointer":"/stabilized_summary/occupancy_rate"},"inputs":[{"role":"schedule","address":{"section":"lease_up_schedule","variant":"base","pointer":""}},{"role":"total_sf","address":{"section":"property","variant":null,"pointer":"/rentable_square_feet"}}],"unit":"%"}]}}
```

```json uw:section=lease_up_schedule variant=base source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"lease_up_schedule","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"model_type":"absorption_curve","period_granularity":"quarterly","schedule":[{"period":"2027-Q1","occupied_sf":1000,"rent_revenue":10,"concessions":0,"ti_lc_capex":0,"net_cash_flow":10},{"period":"2027-Q2","occupied_sf":1900,"rent_revenue":10,"concessions":0,"ti_lc_capex":0,"net_cash_flow":10}],"stabilized_summary":{"occupied_sf":1900,"occupancy_rate":0.95}}
```

```json uw:section=property source=manual ts=2026-10-25T00:00:00Z v=1 confidence=high
{"_meta":{"section":"property","provenance":{"source":"manual","actor":"synthetic-551","timestamp":"2026-10-25T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"rentable_square_feet":2000}
```
