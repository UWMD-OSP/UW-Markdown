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
no numeric cash-on-cash outputs; controls exercise the shared definition in all nine income classes.

`expected.json` records every selected address, stated value, quantized computed
value, source decimals, comparison decimals and state. RFC 0079 compares the
unrounded result at source precision, capped at dictionary `round_to`;
insufficient/unknown source precision, missing/null inputs, invalid operands,
nonfinite results and resolution refusals
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

There are **128 verified, 0 failed, 15 unverifiable** numeric statements.
Of the 35 prior precision disagreements, 34 now verify. Riverside LTC `0.6`
fails the proposed 1%-leverage minimum (two fractional decimals), so it remains
unverifiable. Fourteen formerly matching statements also carry too few source
decimals: cap-rate copies in Cactus, Riverside and Sonoran; LTV copies in
Mill Ave, Parkview and parkview-after-L6, Saguaro and Sundance. No tokens were
padded to clear these findings. Missing-input/type/refusal cases remain controls.

| Example (relative to examples/) | Verified | Failed | Unverifiable |
|---|---|---|---|
| `Agave-Court-Apts-Scottsdale-AZ.uwx.md` | 9 | 0 | 0 |
| `Cactus-Crossing-Retail-Mesa-AZ.uwx.md` | 12 | 0 | 2 |
| `Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md` | 14 | 0 | 0 |
| `Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | 12 | 0 | 2 |
| `Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | 15 | 0 | 0 |
| `Parkview-Apts-Glendale-AZ.uw.md` | 2 | 0 | 0 |
| `Parkview-Apts-Glendale-AZ.uwx.md` | 8 | 0 | 1 |
| `Riverside-Office-Phoenix-AZ.uwx.md` | 11 | 0 | 3 |
| `Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md` | 5 | 0 | 0 |
| `Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | 13 | 0 | 2 |
| `Sonoran-Self-Storage-Peoria-AZ.uwx.md` | 11 | 0 | 2 |
| `Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | 5 | 0 | 2 |
| `market-data/Phoenix-Multifamily-2026-Q2.uwx.md` | 0 | 0 | 0 |
| `parkview-after-L6.uwx.md` | 8 | 0 | 1 |
| `standalone/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/inline-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/package/records/externalized-deal.uwx.md` | 1 | 0 | 0 |

The only value corrections authorized by the examples' own inputs are:

| Example | Address | Before | After | Evidence |
|---|---|---|---|---|
| Agave Court | `quick_metrics.ltv` | `0.4938` | `0.5000` | Stated loan 24,000,000 / stated purchase price 48,000,000. |
| Agave Court | `debt_structure.ltv` | `0.4938` | `0.5000` | Same inputs; appraised value 49,000,000 is not the dictionary denominator. |
| Sonoran Self-Storage | `quick_metrics.dscr` | `1.3153` | `1.3161` | Stated NOI 672,000 / stated annual debt service 510,606, quantized at 4 dp. |
| Sonoran Self-Storage | `debt_structure.dscr` | `1.3153` | `1.3161` | Same inputs and quantization. |

No cash-on-cash numeric claims are selected in these examples. The eight
changed-class worked examples all lack `sources_uses.equity_metrics.equity_total`
and Y1 levered flow, so their newly defined returns are uncomputed; no equity
is inferred from sponsor contributions. The [RFC's audit](../../docs/rfcs/0079-metric-precision.md#example-evidence)
lists the prior values and new nulls. Multifamily and land behavior is unchanged.

## Controls

The independent controls verify the import graph excludes packs, defaults,
cascade and the core barrel. They cover statement tampering; missing/null/type-invalid
inputs; zero division; dictionary formula selection; cent-level quantization of
a noisy binary64 amount over $100k and a one-cent negative; negative half cents;
common cash-on-cash across all nine income classes; lazy stated-year-1 selection (including
zero); senior debt selection and unresolved equity debt service; stated mixed-use
allocation; fractional raw sizes with missing, string and nonfinite controls;
immutability; source-token trailing zeroes, exponents, escaped/nested keys,
content envelopes and YAML comments; minimum precision, output ceilings and
no double rounding. Dictionary/pack/size completeness is separately enforced by
`packages/uwmd-core/src/packs/metric-dictionary.test.ts`.
