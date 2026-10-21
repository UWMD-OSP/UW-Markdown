---
rfc: 0107
title: Give the LTC band a Format-defined home and an FV code
status: draft
author: claude-code
created: 2026-10-21
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0107: Give the LTC band a Format-defined home and an FV code

> **Draft for owner acceptance.** Origin: owner ruling of 2026-10-21 (3), after
> RFC 0105 left the LTC row of Format §5.2 with thresholds but no home and no
> code. It changes which documents draw a financial-validity finding, so it is
> normative.

## Summary

Format §5.2 lists a loan-to-cost band (warning above 80%, error above 90%) that
nothing checks. It has no field to read and no `FV-NN` code. This RFC reads it
from the field the Format already defines, `sources_uses.equity_metrics.loan_to_cost`,
and gives it the next financial-validity code, `FV-15`. It is checked under
RFC 0105's rules: a finite stated value, one issue at the most severe band.

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

1. **Format §5.2.** The LTC row gains code `FV-15` and home
   `sources_uses.equity_metrics.loan_to_cost`. The "(construction)" label stays
   as a description; see D3. The sentence saying the LTC band is not checked is
   removed.
2. **Reading rule.** Unchanged from RFC 0105: a finite number at the home is
   compared with the band; absent, `null` or non-numeric draws nothing; one issue
   at the most severe band. The home is read from the `sources_uses` block the
   §5.3 selection order picks.
3. **Protocol §III.6a / remediation registry.** Register `FV-15`, severity per
   band, title "Loan-to-cost above threshold", spec reference Format §5.2.
4. **No frontmatter home.** `quick_metrics` has no LTC member and this RFC adds
   none (D2).

## Compatibility analysis

No compatibility path (prelaunch; no 5.0 before launch). A document stating
`loan_to_cost` above 0.80 starts drawing `FV-15`. No corpus document changes:
every value the corpus states is 0.6774, below the band. Under RFC 0109, if
accepted, `FV-15` is a deal flag like the other FV codes, not a validity error.

## Conformance impact

Extend `documents/malformed/67-financial-validity-homes` (or add a sibling case)
with `loan_to_cost` in the warning band and in the error band, plus a boundary
case at exactly 0.80 that draws nothing. Python agreement test as for case 67.

## Reference implementation

- **Files:** `packages/uwmd-verify/src/validator.ts` (one row in
  `financialValidityBands`), `protocol.ts` (the `FV-15` remediation entry),
  `implementations/python/uwmd_validation_cross.py` (one `_THRESHOLD_SPECS` row),
  `spec/UW_FORMAT_SPEC.md` §5.2, tests and the case above.
- **API surface:** none new; `DEFAULT_THRESHOLDS.ltc` starts being read.

## Alternatives considered

- **Compute LTC from `loan_amount ÷ uses.total` and check that.** That is
  financial math in validation; the dictionary already computes `ltc`, and §5.2
  reads stated values only (RFC 0105). Rejected.
- **Add `quick_metrics.ltc`.** A second home would match DSCR and LTV, but it
  adds a frontmatter member for one band. Left as D2.
- **Check LTC only for construction loans** (`loan_purpose` or `loan_type`
  `construction`). Closer to the row's label, but a producer that states LTC on
  an acquisition or bridge loan is stating it on purpose, and the band is
  plausible there too. Left as D3.
- **Drop the LTC row.** It would remove a threshold institutions already carry.

## Unresolved questions

- Whether `sources_uses` should become a dictionary output section so that a
  stated `loan_to_cost` is also *verified* against `ltc` (RFC 0099). That is a
  separate change and not proposed here.
- Whether the institution configuration gains an `ltc_*` override; RFC 0097's
  closed carrier has only the three DSCR/LTV/debt-yield keys today.

## Decisions proposed for owner review

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | Home | `sources_uses.equity_metrics.loan_to_cost` | Already Format-defined (§4.8); no new field |
| D2 | Frontmatter home | None; no `quick_metrics.ltc` | One band does not justify a new frontmatter member; alternative: add it for parity with LTV |
| D3 | Applicability | Every stated value, whatever the loan purpose | A stated LTC is deliberate; alternative: only when `loan_purpose` or `loan_type` is `construction` |
| D4 | Code | `FV-15`, one code for both bands | The next free number; LTV's `FV-09` is the same one-code pattern |
| D5 | Verification against `ltc` | Out of scope | Separate RFC 0099-style change |
| D6 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0105 of this project: every §5.2 band read at each Format-defined home.
- Construction-lending practice states loan-to-cost against total project cost,
  which is what `uses.total` carries in §4.8.
