---
uw_version: "1.1"
deal_id: TEST-EXIT-PROCEEDS
deal_name: "Exit Proceeds Fixture"
created: "2026-10-07T00:00:00Z"
last_modified: "2026-10-07T00:00:00Z"
property_address: "77 Stack St"
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
# Exit proceeds with junior capital (RFC 0077)

The capital stack carries senior debt, mezzanine debt, preferred equity and
common equity. At the sale, `loan_balance_at_exit` repays both debts
(5,000,000 + 1,000,000), so `net_proceeds_to_equity` is the whole equity
stack's 3,800,000. The stated preferred redemption, 1,500,000, includes the
accrued return on a 1,200,000 tranche; it is stated, never derived. Common
equity's residual is 2,300,000.

```json uw:section=property source=manual ts=2026-10-07T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-07T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "address": "77 Stack St, Phoenix AZ",
  "total_units": 96
}
```
```json uw:section=capital_stack source=manual ts=2026-10-07T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-07T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "tranches": [
    { "id": "senior", "class": "senior_debt", "position": 1, "amount": 5000000, "rate": 0.06, "amortization_months": 360, "io_months": 0, "term_months": 120, "accrual": "cash" },
    { "id": "mezz", "class": "mezzanine_debt", "position": 2, "amount": 1000000, "rate": 0.11, "amortization_months": 0, "io_months": 120, "term_months": 120, "accrual": "cash" },
    { "id": "pref", "class": "preferred_equity", "position": 3, "amount": 1200000, "rate": 0.1, "accrual": "accrued" },
    { "id": "common", "class": "common_equity", "position": 4, "amount": 1300000 }
  ],
  "sizing": []
}
```
```json uw:section=dcf source=manual ts=2026-10-07T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-07T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "hold_period_years": 5,
  "assumptions": {
    "disposition_costs_pct": 0.02
  },
  "exit_analysis": {
    "exit_year": 5,
    "exit_value_gross": 10000000,
    "disposition_costs": 200000,
    "exit_value_net": 9800000,
    "loan_balance_at_exit": 6000000,
    "net_proceeds_to_equity": 3800000,
    "preferred_equity_redemption_at_exit": 1500000,
    "net_proceeds_to_common_equity": 2300000
  }
}
```
