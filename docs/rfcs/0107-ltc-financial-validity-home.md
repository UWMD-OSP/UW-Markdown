---
rfc: 0107
title: Give the LTC band a Format-defined home and an FV code
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0107: Give the LTC band a Format-defined home and an FV code

> **Accepted by the owner, 2026-10-21, with D2 changed** (owner: "Owner rulings, 2026-10-21. RFC 0107 (#460) accepted with D2 = yes, add quick_metrics.ltc as a second home; D3 = check every stated LTC, not construction only. RFC 0108 (#461) accepted with D2 = yes, align completeness.severity; D3 = yes, replace the four stage names with the seven deal_stage values. RFC 0109 (#462) accepted with D1 = a separate deal_flags list; D3 = institutions list codes one by one in validation_overrides.financial_validity_errors. All other decisions as drafted.").
> D2 adds `quick_metrics.ltc` as a second home; D3 keeps every stated value.
> Origin: owner ruling of 2026-10-21 (3), after
> RFC 0105 left the LTC row of Format §5.2 with thresholds but no home and no
> code. It changes which documents draw a financial-validity finding, so it is
> normative.

## Summary

Format §5.2 lists a loan-to-cost band (warning above 80%, error above 90%) that
nothing checks. It has no field to read and no `FV-NN` code. This RFC reads it
from the field the Format already defines, `sources_uses.equity_metrics.loan_to_cost`,
and gives it the next financial-validity code, `FV-15`. A second home,
`quick_metrics.ltc`, is added to the frontmatter beside `quick_metrics.ltv` (D2).
Both homes are checked under RFC 0105's rules: a finite stated value, one finding
per home at the most severe band.

## Motivation

- **A stated band that is never applied.** RFC 0105 made every other §5.2 row
  name its code and its homes. The LTC row is the only one left with neither, so
  a 95% LTC draws nothing in either implementation.
- **The field already exists.** Format §4.8 defines
  `sources_uses.equity_metrics.loan_to_cost` (default `null`). The metric
  dictionary already computes `ltc` as `debt_structure.loan_amount ÷
  sources_uses.uses.total` for ten classes. No new field is needed.
- **The reference already carries the thresholds.** `FinancialThresholds.ltc`
  (`warning_above: 0.80`, `error_above: 0.90`) is in the reference defaults and
  is read by nothing; Python's threshold table has no LTC row yet.

## Proposed change

1. **Format §5.2.** The LTC row gains code `FV-15` and two homes,
   `quick_metrics.ltc` and `sources_uses.equity_metrics.loan_to_cost`. The
   "(construction)" label is dropped: every stated value is checked, whatever
   the loan purpose (D3). The sentence saying the LTC band is not checked is
   removed.
2. **Reading rule.** Unchanged from RFC 0105: a finite number at the home is
   compared with the band; absent, `null` or non-numeric draws nothing; one issue
   per home at the most severe band. The `sources_uses` home is read from the
   block the §5.3 selection order picks.
3. **Protocol §III.6a / remediation registry.** Register `FV-15`, severity per
   band, title "Loan-to-cost above threshold", spec reference Format §5.2.
4. **Frontmatter home (D2).** Format §2 `quick_metrics` gains `ltc`, a
   fraction, optional, beside `ltv`. A producer that states it SHOULD state the
   same value as `sources_uses.equity_metrics.loan_to_cost`; this RFC does not
   verify the two against each other (D5).

## Compatibility analysis

No compatibility path (prelaunch; no 5.0 before launch). A document stating
`loan_to_cost` above 0.80 starts drawing `FV-15`. No corpus document changes:
every value the corpus states is 0.6774, below the band, and no corpus
document states `quick_metrics.ltc`. Under RFC 0109 (accepted the same day),
`FV-15` is a deal flag like the other FV codes, not a validity error.

## Conformance impact

Extend `documents/malformed/67-financial-validity-homes` (or add a sibling case)
with `quick_metrics.ltc` and `loan_to_cost` in the warning band and in the error
band, plus a boundary case at exactly 0.80 that draws nothing. A document stating
both homes over the band draws one finding per home. Python agreement test as for
case 67.

## Reference implementation

- **Files:** `packages/uwmd-verify/src/validator.ts` (one row in
  `financialValidityBands`, two homes), `types.ts` (`QuickMetrics.ltc`),
  `protocol.ts` (the `FV-15` remediation entry),
  `implementations/python/uwmd_validation_cross.py` (one `_THRESHOLD_SPECS` row),
  `spec/UW_FORMAT_SPEC.md` §2 and §5.2, tests and the case above.
- **API surface:** none new; `DEFAULT_THRESHOLDS.ltc` starts being read.

## Alternatives considered

- **Compute LTC from `loan_amount ÷ uses.total` and check that.** That is
  financial math in validation; the dictionary already computes `ltc`, and §5.2
  reads stated values only (RFC 0105). Rejected.
- **No frontmatter home.** Proposed in the draft as D2; the owner ruled for
  `quick_metrics.ltc`, which matches DSCR and LTV.
- **Check LTC only for construction loans** (`loan_purpose` or `loan_type`
  `construction`). Closer to the row's label, but a producer that states LTC on
  an acquisition or bridge loan is stating it on purpose, and the band is
  plausible there too. Rejected by the owner's D3 ruling.
- **Drop the LTC row.** It would remove a threshold institutions already carry.

## Unresolved questions

- Whether `sources_uses` should become a dictionary output section so that a
  stated `loan_to_cost` is also *verified* against `ltc` (RFC 0099). That is a
  separate change and not proposed here.
- Whether the institution configuration gains an `ltc_*` override; RFC 0097's
  closed carrier has only the three DSCR/LTV/debt-yield keys today.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | Home | `sources_uses.equity_metrics.loan_to_cost` | Already Format-defined (§4.8); no new field |
| D2 | Frontmatter home | **Ruled: add `quick_metrics.ltc` as a second home** | Parity with DSCR and LTV (draft proposed none) |
| D3 | Applicability | **Ruled: every stated value, whatever the loan purpose** | A stated LTC is deliberate; not construction only |
| D4 | Code | `FV-15`, one code for both bands | The next free number; LTV's `FV-09` is the same one-code pattern |
| D5 | Verification against `ltc` | Out of scope, for both homes | Separate RFC 0099-style change |
| D6 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0105 of this project: every §5.2 band read at each Format-defined home.
- Construction-lending practice states loan-to-cost against total project cost,
  which is what `uses.total` carries in §4.8.
