---
rfc: 0119
title: Compare NOI by absolute difference when it is zero or negative (CC-05, CC-06)
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0119: Compare NOI by absolute difference when it is zero or negative (CC-05, CC-06)

## Resolution

The UWMD maintainers accepted D1's **$500 absolute** comparison and D2's
**model NOI <= 0, including zero** applicability on 2026-10-22. These decisions
resolve the CC-05/CC-06 comparison gap reported in #491.

## Summary

Two cross-checks compare restated NOI with `noi_model.net_operating_income` by
percentage difference:
- **CC-05** compares `debt_structure.underwritten_noi` (the NOI used for DSCR),
  with a 1% warning threshold.
- **CC-06** compares DCF Year 1 NOI, with a 2% warning threshold.

A percentage of a zero or negative NOI is undefined or inverted, so both checks
skip when the model NOI is ≤ 0. They also report the skip as `field_absent`,
although the field is present.

The effect: land, lease-up and pre-stabilization records, whose NOI is often
negative, have no NOI consistency check at all. In bug bash pass 2, a land
record's NOI tampered from −272,000 to −299,200 passed both validate and
verify. This RFC compares by absolute difference whenever the model NOI is
zero or negative.

## Change

1. **CC-05 and CC-06, model NOI ≤ 0.** When `noi_model.net_operating_income` is
   stated and ≤ 0, the check is evaluated, not skipped. It compares the absolute
   difference between the two stated NOI figures with a fixed tolerance:
   **$500 (accepted, D1)**. A larger difference is the check's existing
   `warning`. The message states both figures and the dollar difference instead
   of a percentage.
2. **Model NOI > 0.** No change: the 1% (CC-05) and 2% (CC-06) percentage rules
   stand.
3. **Coverage.** `field_absent` is reported only when a field is absent. The
   ≤ 0 branch is `evaluated`.
4. **Format §5.3** CC-05 and CC-06 rows state both branches and the tolerance.
   The Python validator matches.

## The accepted tolerance (D1)

**Accepted: $500, in the record's currency units, absolute.** The precedents:

| Check | Compares | Tolerance |
|---|---|---|
| CC-09 | Stress-test base-case annual debt service vs `debt_structure` | $500 absolute |
| CC-10 | Sources & Uses purchase price vs valuation | $100 absolute |
| CC-12 | Mixed-use component NOI sum vs property NOI | $1 (rounding) |

NOI, like annual debt service, is an annual operating amount that producers
round to whole dollars or hundreds. CC-09's $500 is the existing tolerance for
an annual operating figure restated in another section, so this RFC reuses
it. The other options:

- **$1 (CC-12)**, if restatements are expected to be exact copies.
- **$100 (CC-10)**, the tighter price rule.

A loss of $272,000 restated as $299,200 is caught under any of the three.

## Validation impact

Records with NOI ≤ 0 whose
restatements differ by more than the tolerance gain a CC-05 or CC-06 warning.
The findings retain existing warning severity and CLI exit behavior. No record with positive NOI
changes outcome.

## Conformance impact

New cases:
- land NOI −272,000, restated −272,000: clean;
- restated −272,400 (within $500): clean;
- restated −272,501: CC-05 warning;
- the same three for CC-06;
- NOI exactly 0 restated 0: clean; restated 600: warning.

Coverage cases show `evaluated` for NOI ≤ 0.

## Reference implementation

Format §5.3; `validator.ts` (CC-05, CC-06 branches, coverage); the Python
validator; the cases.

## Alternatives considered

- **Keep skipping NOI ≤ 0.** This is the defect. Rejected.
- **Percentage of the absolute NOI** (|a − b| / |a|). It is defined for negative
  NOI, but still undefined at zero, and its meaning near zero is unstable.
  Rejected.
- **An absolute rule at every NOI.** This changes the established
  positive-NOI percentage rules. Not proposed.

## Decisions

| # | Question | Proposal | Alternative |
|---|---|---|---|
| **D1** | **Tolerance for NOI ≤ 0** | **$500 absolute (CC-09's annual-amount precedent)** | $100 (CC-10) or $1 (CC-12) |
| D2 | Where the branch starts | Model NOI ≤ 0, zero included | NOI < 0 only, leaving zero skipped |
| D3 | Severity | The existing warning | — |
| D4 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Format §5.3 CC-05, CC-06, CC-09, CC-10, CC-12; RFC 0037 (coverage reasons);
  #491 and bug bash pass 2c.
