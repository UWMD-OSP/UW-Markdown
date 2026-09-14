---
rfc: 0050
title: Preferred equity with a split coupon (current-pay and accrued on one tranche)
status: draft
author: jaredmaxey
created: 2026-09-13
depends_on:
  - 0026
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0050: Preferred equity with a split coupon

## Summary and boundary

Institutional preferred equity can carry a current-pay coupon and an accrued
(PIK) coupon on the same principal and seniority position. This RFC adds an
optional `accrual: "split"` mode with `cash_rate` and `accrued_rate` fields.

This implementation deliberately supports `split` only on
`preferred_equity`. A PIK toggle on an amortizing debt tranche needs explicit
period, compounding, and principal-schedule semantics and remains deferred.

For a split preferred tranche:

- `rate` is required and MUST equal `cash_rate + accrued_rate`;
- `cash_rate` and `accrued_rate` are required numeric fractions;
- `cash_rate` contributes `amount × cash_rate` to cash coverage;
- `accrued_rate` contributes zero to cash coverage and does not alter the
  point-in-time capital-stack balance used by attachment metrics;
- `weighted_cost` uses the full `rate`, because it represents the cost of the
  capital regardless of payment timing.

Existing `cash` and `accrued` tranches are unchanged. Documents that do not
use `split` remain byte-compatible and recompute identically.

## Motivation

The current capital-stack contract has one `rate` and one `accrual` mode. A
single preferred-equity row therefore cannot state, for example, an 8%
current coupon plus a 4% accrued return on the same $4,000,000 position:

- treating 12% as cash-pay overstates coverage burden;
- treating 12% as accrued hides the current distribution; and
- two rows double-count principal or misstate seniority.

The split representation keeps one principal, one position, and one headline
rate while making the coverage treatment explicit.

## Normative format change

In `UW_FORMAT_SPEC_v1.md` §4.24:

- extend `accrual` from `cash | accrued` to `cash | accrued | split`;
- add `cash_rate` and `accrued_rate`, both required only when `accrual` is
  `split` and forbidden otherwise;
- require `class: "preferred_equity"` when `accrual` is `split`;
- require `rate = cash_rate + accrued_rate` for `split`.

The schema expresses the conditional field and class requirements. The
validator emits `CS-02b` for a split tranche with missing/extra fields, a
non-preferred class, or a total-rate mismatch.

The `blended_coverage` sizing verb continues to mean NOI divided by cash-pay
service at or above the selected position. For split preferred equity, the
cash-pay service is `amount × cash_rate`; the accrued portion is zero.
`debt_yield_through` remains debt-only, and `weighted_cost` continues to use
the full `rate` on every rate-bearing tranche.

## Reference implementation

The change is additive and limited to:

- `spec/UW_FORMAT_SPEC_v1.md` and `spec/UW_PROTOCOL_v1.md`;
- `spec/schemas/section-capital-stack.schema.json`;
- `@uwmd/core` tranche types, verifier, validator remediation, and tests;
- one positive split-coupon conformance case plus negative controls for missing
  fields, a wrong total, non-preferred use, and overstated cash coverage.

No new calculation-pack formula, waterfall behavior, module manifest, or
public function is introduced.

## Compatibility and acceptance

Existing capital-stack documents must validate and verify with unchanged
results. The positive fixture uses a preferred-equity tranche with
`cash_rate: 0.08`, `accrued_rate: 0.04`, and `rate: 0.12`. It states both
`blended_coverage` using only the cash rate and `weighted_cost` using the full
rate. Negative fixtures must emit `CS-02b` or
`CS-SIZING-DISAGREES` as specified, and the schema, validator, and executable
verifier must agree on the accepted shape.

## Deferred follow-ups

Debt split/PIK toggles, accrued compounding frequency, multi-period accrued
balance roll-forward, and waterfall interaction require separate contracts.
