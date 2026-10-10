# Metric dictionary conformance — a lender with only the standard

`verifier.mjs` imports the UWX/Lite readers, section resolver, safe-expression
evaluator and shared §VIII.5 quantizer directly. It reads only the normative
[metric dictionary](../../spec/metrics/README.md) for calculation definitions.
It imports no packs, defaults, cascade or public core barrel; there are no prior
results, overrides, inferred financial inputs or underwriting workflow.

It discovers every `.uw.md` / `.uwx.md` below `examples/` whose stated class has
dictionary calculations (17 documents, including Lite, market-data and the
standalone package record). The custom data-center module example and standalone
non-deal records have no builtin dictionary class and are excluded explicitly.
Current active section blocks and frontmatter `quick_metrics` are checked;
superseded blocks, prose, scenarios, forecasts and market observations are not
current metric claims. A numeric statement is counted separately at each address,
so agreeing/disagreeing copies in frontmatter and sections remain visible.

`statement-bindings.json` enumerates fixture-only aliases such as
`valuation.going_in_cap_rate`, `valuation.price_per_sf` and
`debt_structure.sizing_metrics.dscr_underwritten`. Canonical metric ids at the
listed current output section roots are also found automatically. These are
bindings to existing example fields, not a new normative alias contract. Lite
anchors map only their explicitly stated input sections, using the published
bridge's section mapping without any bridge defaults. Primary-size statements
are also checked as unrounded raw finite selectors. The current examples state
no numeric cash-on-cash outputs; controls exercise all three existing variants.

`expected.json` records every selected address, stated value, quantized computed
value and state. Comparisons quantize both sides exactly at dictionary precision;
missing/null inputs, invalid operands, nonfinite results and resolution refusals
are **unverifiable**. Definitions or inputs not stated are not invented or counted
as numeric claims. The market-data example therefore has zero claims; standalone
deal examples each state one primary size.

Run after building core:

```sh
node --test conformance/metrics/verifier.test.mjs
npm run conformance -- --tier=metrics
```

The named `metrics` suite also runs by default in `npm run conformance`. Its pass
means the complete evidence matches the recorded findings and all negative
controls pass; it does **not** mean every example metric verifies. New, removed
or changed claims fail the gate until reviewed. `--update` does not silently
replace this baseline.

## Current example findings

There are **104 verified, 39 failed, 0 unverifiable** numeric statements.
All selected current numeric claims have inputs; absent-input cases are pinned
by negative controls. No example has been edited to clear a finding.

| Example (relative to examples/) | Verified | Failed | Unverifiable |
|---|---|---|---|
| `Agave-Court-Apts-Scottsdale-AZ.uwx.md` | 1 | 8 | 0 |
| `Cactus-Crossing-Retail-Mesa-AZ.uwx.md` | 9 | 5 | 0 |
| `Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md` | 10 | 4 | 0 |
| `Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | 14 | 0 | 0 |
| `Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | 15 | 0 | 0 |
| `Parkview-Apts-Glendale-AZ.uw.md` | 1 | 1 | 0 |
| `Parkview-Apts-Glendale-AZ.uwx.md` | 4 | 5 | 0 |
| `Riverside-Office-Phoenix-AZ.uwx.md` | 7 | 7 | 0 |
| `Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md` | 3 | 2 | 0 |
| `Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | 15 | 0 | 0 |
| `Sonoran-Self-Storage-Peoria-AZ.uwx.md` | 11 | 2 | 0 |
| `Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | 7 | 0 | 0 |
| `market-data/Phoenix-Multifamily-2026-Q2.uwx.md` | 0 | 0 | 0 |
| `parkview-after-L6.uwx.md` | 4 | 5 | 0 |
| `standalone/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/inline-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/package/records/externalized-deal.uwx.md` | 1 | 0 | 0 |

Most disagreements are statements rounded more coarsely than §VIII.5 permits.
Examples also contain larger differences: Agave states LTV 0.4938 while the
existing pack/dictionary purchase-price denominator gives 0.5 (its stated
appraised value differs); Sonoran states DSCR 1.3153 while the existing
inputs give 1.3161. Riverside states LTC 0.6 versus 0.601852. The fixture reports
these facts and preserves the existing formulas and inputs. Each finding's
exact address and values are in `expected.json`.

## Controls

The independent controls cover statement tampering; missing/null/type-invalid
inputs; zero division; dictionary formula selection; cent-level quantization of
a noisy binary64 amount over $100k and a one-cent negative; negative half cents;
class-scoped cash-on-cash definitions; lazy stated-year-1 selection (including
zero); senior debt selection and unresolved equity debt service; stated mixed-use
allocation; fractional raw sizes with missing, string and nonfinite controls;
and immutability. Dictionary/pack/size completeness is separately enforced by
`packages/uwmd-core/src/packs/metric-dictionary.test.ts`.
