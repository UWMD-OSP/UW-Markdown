# Select calculation inputs without editing the deal

`--calc-context <file>` supplies explicit period variants and input overrides to
`uwmd calc`, `uwmd refine`, and selected calculations in `uwmd-excel`.
The source document is unchanged. These commands are implemented in the source
checkout and await publication; the published core/CLI 2.7.0 release does not
include this flag. Build the checkout with `npm run build` before using the
commands below, from the repository root.

## Context file

Save this as `context.json`:

```json
{
  "sectionVariants": { "dcf": "base" },
  "overrides": { "dcf.annual_cash_flows@Y3.noi": 300 }
}
```

The value 300 is a synthetic example, not an underwriting assumption. Replace
the path and value with the input you intend to test. Both top-level options
are optional; `{}` uses the normal document context.

- `sectionVariants` maps a registered period section to its exact variant name.
  The supported sections are `dcf`, `noi_model`, `lease_up_schedule`,
  `cash_flow_series`, and `distribution_waterfall`. Selection applies to period
  references only. It does not switch ordinary scalar paths or standard pack
  sheets. A referenced variant that cannot be selected has no fallback.
- `overrides` maps exact input paths to finite numbers, strings, booleans, or
  `null`. Keys are preserved without rewriting. A numeric `0` is a real zero;
  `null` is missing. A period override is checked before source lookup, after
  the selector/registry contract is validated.

Use canonical period paths such as `dcf.annual_cash_flows@Y3.noi`. For a literal
dotted leaf, use `dcf.annual_cash_flows@Y3['tax.rate']`; it differs from
`dcf.annual_cash_flows@Y3.tax.rate`. A key that does not match an input is not
applied. Context files reject unknown root options, invalid maps, non-finite
numbers, object/array overrides, and unregistered period section names.

## Calculate

```sh
npm run cli -- calc deal.uwx.md "dcf.annual_cash_flows@Y3.noi" --calc-context context.json --json
```

You can also pass a calculation-declaration JSON file in place of the formula.
Calculation supports ordinary scalar overrides as well as period overrides.
For example, adding `"property.total_units": 0` overrides that exact path when
the formula uses it. Output keeps the existing `CalcResult` shape and rounding
boundary. A nonnumeric override may produce a typed calculation error when
used in numeric arithmetic.

## Refine

For a custom calculation already declared in the deal with ID
`year_three_noi_per_unit`:

```sh
npm run cli -- refine deal.uwx.md --targets year_three_noi_per_unit --calc-context context.json --json
```

Refinement fixes the selected stated period values while ranking ordinary scalar
gaps through its existing cascade. It accepts only canonical period override
keys; an ordinary scalar override is rejected instead of being silently ignored.
Remove any ordinary scalar overrides from a context file before reusing it here.

Check `diagnostics.period_inputs` for excluded outputs. A missing, invalid or
nonnumeric period input excludes the affected output; unaffected outputs may
still be ranked. The command's successful exit means the ranking ran, not that
every requested output had complete data. Text output also lists these issues.
Refinement intervals retain the existing binary64 perturbation arithmetic;
comparison with reported calculation endpoints uses the existing calc boundary.

## Export selected calculations to Excel

```sh
node packages/uwmd-excel/bin/uwmd-excel.mjs deal.uwx.md --calculations year_three_noi_per_unit --calc-context context.json -o deal.xlsx
```

`--calculations` names existing custom-calculation IDs, separated by commas.
Excel requires this option when context is supplied. Context applies to those
additional calculations and their input sheets; the normal asset-class pack
sheets keep their existing behavior. The first exporter supports numeric paths,
period references, literals, unary minus and arithmetic `+`, `-`, `*`, `/`.

Missing inputs become `#N/A`, invalid/nonnumeric inputs become `#VALUE!`, and
numeric zero is preserved. Period lookup supports editing values and sorting
whole rows. Change the period set in the source and re-export. Additional input
edits are export-only; reverse import explicitly refuses extended workbooks.
See [RFC 0043](rfcs/0043-contextual-excel-period-bindings.md).

## Library use

`parseCalculationContext` is exported by both `@uwmd/core` and
`@uwmd/core/browser`. It validates decoded JSON without reading files or doing
calculations:

```ts
import { parseCalculationContext, evaluateCalc } from '@uwmd/core';

const context = parseCalculationContext(JSON.parse(contextText));
const result = evaluateCalc(declaration, {
  parsed, prior_results: {}, locale: 'en-US', ...context,
});
```

Pass the same validated object as `toWorkbook`'s `calculationContext`. For
`rankGaps`, pass it as `periodContext` and supply only period overrides; ordinary
overrides are outside that API's period context. Validation errors use
`CALC-TYPE-001`; invalid JSON or unreadable files cause the CLI to exit nonzero.
Invalid context does not create an Excel output file.
