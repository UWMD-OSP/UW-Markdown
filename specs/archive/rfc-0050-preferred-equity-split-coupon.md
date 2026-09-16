# Completed implementation scope: RFC 0050

RFC 0050's preferred-equity split-coupon representation was implemented in commit `b48cd68`.

The completed slice includes the `accrual: "split"` mode on preferred-equity
tranches with `cash_rate` entering cash coverage, `accrued_rate` omitted from
coverage, and full `rate` driving weighted cost. Validation rules (`CS-02b`),
schema updates, unit tests, and conformance fixtures (`split-coupon`,
`split-coupon-bad-total`, `split-coupon-bad-fields`) are all committed. The
normative draft is at
[`docs/rfcs/0050-preferred-equity-split-coupon.md`](../../docs/rfcs/0050-preferred-equity-split-coupon.md).
