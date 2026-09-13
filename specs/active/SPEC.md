# Cash-flow verification CLI

Status: active. Reconciled against main at 1e776b8; release 2.9.0 is complete.

## Scope

Make the existing dated-cash-flow metric verifier usable from the CLI for
private deal reconciliation. No financial formulas, normative schemas, protocol
types, precision tolerances, dependencies or package versions change.

## Contract

- `uwmd verify-cash-flows <file> [--variant <name>] [--json]` is read-only.
- Parse structured UWX strictly. Select the active cash_flow_series using the
  existing periodSection role/default/base/sole rules, or an exact variant.
  Unresolvable selection refuses; do not select superseded history.
- Guard the selected JSON payload before invoking verifyCashFlowSeries.
  Malformed rows and nonnumeric claims refuse instead of silently passing.
  Preserve the existing default day count and verifier outcomes.
- Report section, selected variant, checked metric names and original verification.
  No stated metrics produces a distinct no_stated_metrics status and exit 3.
  Verified nonempty claims exit 0; failed/input errors exit 1; unverifiable exit 3.
- Unknown/duplicate options, write options, overrides and extra paths refuse.
  JSON mode is machine-readable, including read/parse/input errors.
- Verification is of stated metrics only: no economic completeness, currency,
  financing basis, ownership or realized-performance assertions are inferred.
- Public examples/tests contain only synthetic data. Real archived workbooks,
  addresses and their cash ledgers remain outside Git.

## Definition of done

Meaningful unit and subprocess tests cover selection, bad inputs, empty claims,
all verdicts, text/JSON output and source immutability. Documentation describes
source-only availability and economic limits. All repository gates pass; changes
are committed and offered for review. New financial extensions remain separate.
