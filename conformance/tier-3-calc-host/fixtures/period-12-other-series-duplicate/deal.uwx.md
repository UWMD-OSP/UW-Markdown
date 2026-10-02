---
uw_version: "1.1"
deal_id: TEST-PERIOD-SAME-DAY
deal_name: "Same-Day Cash Flow Fixture"
created: "2026-10-02T00:00:00Z"
last_modified: "2026-10-02T00:00:00Z"
property_address: "16 Variant Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Same-day dated rows (RFC 0062)

Two rows share 2027-06-30 in both dated series. Cash-flow rows stay distinct
and only the repeated date is ambiguous; the waterfall schedule keeps the
whole-series duplicate refusal.

```json uw:section=cash_flow_series variant=base source=manual v=1
{
  "_meta": {
    "section": "cash_flow_series",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "series": [
    {
      "date": "2027-06-30",
      "amount": -100,
      "kind": "acquisition",
      "label": "Purchase"
    },
    {
      "date": "2027-06-30",
      "amount": -20,
      "kind": "capex",
      "label": "Work"
    },
    {
      "date": "2028-06-30",
      "amount": 150,
      "kind": "disposition",
      "label": "Sale"
    }
  ]
}
```

```json uw:section=distribution_waterfall variant=base source=manual v=1
{
  "_meta": {
    "section": "distribution_waterfall",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "stated_schedule": [
    {
      "date": "2027-06-30",
      "lp_distribution": 10
    },
    {
      "date": "2027-06-30",
      "lp_distribution": 15
    },
    {
      "date": "2028-06-30",
      "lp_distribution": 40
    }
  ]
}
```
