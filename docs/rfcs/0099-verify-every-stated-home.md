---
rfc: 0099
title: Verify each dictionary metric wherever the document states it
status: accepted
author: UWMD maintainers
created: 2026-10-20
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0099: Verify each dictionary metric wherever the document states it

> **Accepted by the owner, 2026-10-20, as drafted** (owner: "RFC 0099 (#417) is
> accepted as drafted; implement it"). The Decisions table D1–D6 stands as
> written. It changes what a Verifier owes, so it opened alone as a draft, and
> the synchronized implementation follows in its own PR. Origin:
> issue [#416](https://github.com/UWMD-OSP/UW-Markdown/issues/416), ruled
> 2026-10-19 ("verify every home").

## Summary

A Verifier today reproduces a dictionary metric only where the document states
it under the metric's own id: frontmatter `quick_metrics.<id>`, or `<id>` at the
root of one of twelve output sections. Most documents state the same figures
under other names in the sections people read: `valuation.going_in_cap_rate`,
`valuation.price_per_sf`, `debt_structure.sizing_metrics.dscr_underwritten`, and
so on. None of those are checked. A 10% error in any of them passes
`uwmd verify`. This RFC makes the metric dictionary carry a closed,
normative **statement-binding registry**: for each metric id, the further section
paths that state it. Every Verifier then checks every bound statement it finds,
with the existing formula, precision (RFC 0079) and three-state outcome. The
registry starts from the alias table the conformance suite already uses. With it,
every section-home figure in the 13 class examples verifies unchanged, and the
#416 tampers all fail.

## Motivation

The launch-criterion-4 bug bash (#416, pass 2c) multiplied each stated derived
figure in the 13 class examples by 1.10, one at a time. 19 of 57 tampers passed
`validate` and `verify` (exit 0). Changing the same cap rate in `quick_metrics`
fails, as it should: `[FAILED] quick_metrics.cap_rate: stated 0.05962,
recomputed 0.05417`. The section copy passes:

| Stated field | Classes where a +10% tamper passes |
|---|---|
| `valuation.going_in_cap_rate` | 10 of 12 classes (every class whose example states it) |
| `valuation.price_per_sf` | retail, industrial, data center, office |
| `debt_structure.sizing_metrics.ltv` / `.dscr_underwritten` / `.debt_yield` | multifamily |

The reason is in `verifyStatedMetrics` (`packages/uwmd-verify/src/metric-verification.ts`).
It already supports per-metric `aliases`, but the default bindings carry none ("No
aliases by default; the conformance aliases bind existing example fields only").
The alias table lives in `conformance/metrics/statement-bindings.json`, so the
corpus can see these statements and the shipped Verifier cannot. Protocol §II.2.2
asks a Verifier to reproduce "the standard's metric definitions … A stated value
that disagrees after quantization is a verification failure". It does not say
where a document states a metric, so the reference chose the narrowest reading.

A signed, "verified" record can therefore carry a wrong cap rate, price per SF or
sizing DSCR in the section a reader actually looks at (the valuation and debt
sections, the Excel workbook, the credit memo), as long as `quick_metrics` is right.

## Proposed change

### 1. A normative statement-binding registry in the metric dictionary

`spec/metrics/builtin.json` gains a top-level `statement_bindings` object, and
`metric-dictionary.schema.json` admits it (closed, required):

```json
"statement_bindings": {
  "output_sections": ["valuation", "debt_structure", "noi_model", "rent_roll", "property",
    "components", "dc_capacity", "dc_power", "dc_revenue", "mhc_sites", "hotel_metrics",
    "hotel_food_beverage"],
  "aliases": {
    "cap_rate": ["valuation.going_in_cap_rate"],
    "price_per_unit": ["valuation.purchase_price_per_unit"],
    "price_per_sqft": ["valuation.price_per_sf", "valuation.purchase_price_per_sqft"],
    "noi_per_sqft": ["noi_model.noi_per_sf"],
    "occupancy": ["property.occupancy_pct", "rent_roll.occupancy_pct"],
    "revpor": ["noi_model.revpor_monthly"],
    "dscr": ["debt_structure.sizing_metrics.dscr_underwritten"],
    "ltv": ["debt_structure.sizing_metrics.ltv"],
    "debt_yield": ["debt_structure.sizing_metrics.debt_yield"],
    "hospitality_gross_operating_profit": ["components.hospitality.gross_operating_profit"],
    "senior_housing_total_labor_expense": ["components.senior_housing.total_labor_expense"]
  }
}
```

This is exactly today's conformance table, moved. `conformance/metrics/statement-bindings.json`
is deleted, and the conformance suite reads the dictionary, so there is one source.
`output_sections` is unchanged from `DEFAULT_STATED_METRIC_BINDINGS`.

Rules (Protocol §II.2.2 and the metric README, normative):

- **A statement** of metric *m* is a finite JSON number at any of: frontmatter
  `quick_metrics.m`; `S.m` for each `S` in `output_sections`; each path in
  `aliases[m]`. It applies to every class whose dictionary carries an entry with
  id *m*. Each current block variant is a separate statement (today's rule).
- **The registry is closed.** A field the registry does not bind is not a
  statement, whatever its name. No reader infers a binding from a field name. A
  new statement home is a dictionary change, not an implementation choice.
- **A Verifier MUST check every statement it finds**, at every bound address, with
  the existing formula, input paths, `round_to` and RFC 0079 comparison
  precision. Each address is counted separately, so agreeing and disagreeing
  copies both stay visible. `verified` / `failed` / `unverifiable` keep their
  meanings. A `failed` statement anywhere fails verification, exactly as a failed
  `quick_metrics` statement does today.
- A statement whose value is not a finite number is not a statement. The field
  keeps any existing admission rule, and no new code is added.

### 2. Format text

Each aliased field gets one sentence where the section defines it, for example
§4.6 `valuation.going_in_cap_rate`: "A statement of the dictionary metric
`cap_rate` (Protocol §II.2.2, RFC 0099); a Verifier checks it." That makes it
visible to a producer that the field is checked.

### 3. API

`DEFAULT_STATED_METRIC_BINDINGS` becomes the dictionary's `statement_bindings`.
`VerifyStatedMetricsOptions.bindings` stays for tests and module dictionaries. No
public symbol is added or removed.

## Compatibility analysis

- **Documents.** A record whose section-home figure disagrees with its own inputs
  now fails `verify`. That is the defect being fixed. Every section-home
  statement in the 13 class examples verifies under the registry (measured at
  `main` `902695e0`: all `verified`, none `failed` or `unverifiable`), and the
  corpus already exercises the table. No compatibility path is added (the
  prelaunch rule).
- **Implementers.** A Verifier must read the registry. The independent Python
  implementation (#354) adopts it in the same synchronized implementation.
- **Versions.** None allocated (RFC 0091 D6); prelaunch work stays 4.x.

## Conformance impact

- Move `conformance/metrics/statement-bindings.json` into the dictionary; the
  metric suite and its pin test read `statement_bindings`.
- New cases under `conformance/metrics/statement-homes/`, synthetic: for each
  alias, one document whose section-home figure agrees (verified) and one that
  disagrees by 10% (failed). Plus one where `quick_metrics` agrees and the
  section copy disagrees: verification fails and both addresses are reported.
- An unbound look-alike (`valuation.cap_rate_trailing`) is not a statement: no
  outcome is reported for it.

## Reference implementation

- `metric-verification.ts`: default bindings read from the dictionary;
  `BUILTIN_METRIC_DICTIONARY` exposes `statement_bindings`.
- `gen-metric-dictionary.mjs` / the dictionary pin test: carry the new member.
- `uwmd verify`: unchanged code path; more statements are found.
- Python (`implementations/python`): read the same registry.
- Tests: one per alias, agree and disagree; a test that the deleted conformance
  file and the dictionary cannot drift (a single source makes this structural).

## Alternatives considered

- **One home** (retire the section copies or `quick_metrics`, refusing the
  duplicate). The other consistent shape #416 offered. The owner chose "verify
  every home". One home would also break every producer that writes the familiar
  section fields.
- **Infer bindings from field names** (`*cap_rate*` → `cap_rate`). Rejected:
  `going_in_cap_rate` and `exit_cap_rate` are different metrics. A closed
  registry is the house pattern for vocabularies.
- **Bind in the Format prose only.** The dictionary is where formulas, units and
  precision already live and are versioned together. A binding is meaningless
  without the formula it is checked against.

## Unresolved questions

- **Other de facto statements.** The registry starts from the fields the corpus
  and examples already use. An audit of Part IV for other stated derived figures
  (for example class-specific per-unit fields) would extend it. Each addition is
  a dictionary change under this RFC's rules.
- **Inputs restated elsewhere** (land's `noi_model.net_operating_income`,
  `debt_structure.annual_debt_service`) are inputs, not dictionary metrics. The
  `CC-*` reconciliations cover them, not this registry. The land example misses
  them because no NOI-based check applies to negative NOI. That is a separate
  question.

## Decisions (accepted 2026-10-20)

| # | Question | Proposal | Why (precedent) |
|---|---|---|---|
| D1 | Where bindings live | `statement_bindings` in the metric dictionary | Formulas, units and precision are already there (RFC 0078) |
| D2 | Open or closed | Closed registry; no name inference | House pattern: closed vocabularies |
| D3 | Initial content | Today's conformance alias table, unchanged | Measured: all 13 examples verify; no new semantics |
| D4 | Failure reporting | Existing stated-metric `failed`, per address; no new code | Same outcome as a `quick_metrics` disagreement |
| D5 | Class scope | An alias applies wherever the class's dictionary has that id | Existing per-class dictionary entries |
| D6 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- OpenAPI `$ref` / JSON Schema `$defs`: one definition, referenced at every place
  it applies, rather than parallel copies that drift.
- RFC 0078 and RFC 0079 of this project: the dictionary is the single executable
  definition of each metric and its comparison precision. This RFC adds where a
  document states it.
