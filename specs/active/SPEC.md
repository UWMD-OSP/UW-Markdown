# Specification: Preferred-equity split coupon (RFC 0050)

Status: **draft implementation scope** · Opened 2026-09-13 · RFC 0050

The next protocol milestone adds a bounded `accrual: "split"` representation
for preferred equity: `cash_rate` enters cash coverage, `accrued_rate` does not,
and `rate` remains their total. Existing `cash` and `accrued` tranches retain
their current behavior.

Debt PIK toggles, accrued compounding frequency, and distribution waterfalls
remain outside this implementation scope until separately pinned.

The complete contract is [RFC 0050](../../docs/rfcs/0050-preferred-equity-split-coupon.md).
