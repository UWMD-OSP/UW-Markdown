# Verifier and Module calculation fixtures

Every scenario but one is a Verifier check (Protocol §II.2): exact dictionary
reproductions (same id, formula and unit as
[`spec/metrics/builtin.json`](../../spec/metrics/builtin.json), or the
dictionary formula under another id, as `dscr-from-section`), the IRR
procedure (`irr-*`, item 3), and the §VIII.1–VIII.3 notation item 6 requires
wherever a Verifier evaluates an expression: grammar and built-ins (`date-*`),
period addressing (`period-*`) and variable resolution, including the
`section_roles` preferences dictionary entries carry (`variant-*`). They keep
`requires_capabilities: ["calc-evaluate"]`, so a Verifier that evaluates no
expressions skips them rather than failing. `revpar-basic`, a custom
ADR × occupancy declaration rather than the dictionary RevPAR, is the Module
check. Refinement is a starter-product check. Directories describe content; [corpus-index.json](../corpus-index.json) determines
each case’s single owner.

An implementation that evaluates expressions (a Verifier using the notation,
or a Module-profile evaluator for `custom_calculations` and module
`calculations`) uses the safe-expression language defined in
`UW_PROTOCOL.md` Part VIII, and MUST:

- Parse the safe-expression grammar exactly as specified (no eval, no
  arbitrary code execution).
- Resolve variable references via `parser.deepGet` semantics against the
  parsed file.
- Implement the whole Protocol §VIII.3 built-in function set:
  - aggregation: `sum`, `avg`, `min`, `max`;
  - logic and rounding: `coalesce`, `if`, `round`;
  - math: `abs`, `floor`, `ceil`, `sqrt`, `pow`, `log`, `exp`;
  - finance: `pmt`, `fv`, `pv`, `nper`, `npv`, `irr`;
  - validity: `is_calendar_date` (RFC 0071).
- Be deterministic: same inputs → same outputs, every run.
- Surface `CalcError` objects per the taxonomy in Part XI.

## Fixtures

```
fixtures/<scenario-id>/
├── deal.uwx.md             Input deal file
├── calc.json              The calculation declaration to evaluate
└── expected-result.json   Expected CalcResult
```

## Provided scenarios

| Scenario | Tests |
|---|---|
| `fixtures/revpar-basic` | Module: a custom adr × occupancy declaration with literal inputs from `quick_metrics` (not the dictionary RevPAR) |
| `fixtures/dscr-from-section` | Verifier: the dictionary `dscr` formula, under the id `implied_dscr`, resolved across `noi_model` and `debt_structure` |

### Variant-map scenarios (RFC 0066)

`fixtures/variant-01` … `variant-11` select one `debt_structure` block of a
role-bearing variant map, or refuse `CALC-RESOLVE-002`. A scenario may carry an
optional `calc-context.json`, which both runners pass as `--calc-context`.

When that context names a variant, the named block sits between two other
fences. A reader that takes the first or the last fence must fail the case, not
pass by fence order. `section-resolution.test.ts` in `@uwmd/core` enforces
this for every context scenario.

The four successful no-context scenarios (`variant-01`, `-02`, `-04`, `-10`)
also put their selected block in the middle. Their distinct primary, default,
declared-role and unclaimed-role fallback rules still select the original
block, with no extra primary or matching role. The same guard rejects both
fence orders and pins those selection reasons. Both runners read the same
fixtures and unchanged expected results; no generated case or count changes.

### Dated same-day scenarios (RFC 0062)

The four fixtures share one synthetic document. Its `cash_flow_series.series`
and `distribution_waterfall.stated_schedule` each have two rows on 2027-06-30
and one on 2028-06-30.

| Scenario | Tests |
|---|---|
| `fixtures/period-09-same-day-unique` | A cash-flow date that appears once resolves (150) although another date repeats |
| `fixtures/period-10-same-day-repeated` | The repeated cash-flow date refuses `CALC-PERIOD-002`; rows are never summed or chosen |
| `fixtures/period-11-same-day-absent` | An absent cash-flow date is null, not a refusal |
| `fixtures/period-12-other-series-duplicate` | Other registered series keep whole-series refusal: a unique waterfall date still refuses `CALC-PERIOD-002` |

### Calendar-date predicate scenarios (RFC 0071)

`fixtures/date-01` … `date-48` pin `is_calendar_date` to the accepted case
matrix. All 48 share one synthetic deal and write each expected result from
the matrix, not from a captured run.

- **Literal scenarios (`date-01`–`date-36`)** call the predicate on a
  single-quoted literal, so the deal does not affect them:
  - `date-01`–`06` are valid dates (`true`). They include the leap rules
    divisible by 4 and by 400, `0000-02-29` and `9999-12-31`.
  - `date-07`–`36` are invalid (`false`):
    - impossible dates, including `1900-02-29` and `2026-02-30`;
    - month `00` and `13`, and day `00`;
    - fields of the wrong width;
    - signed and expanded years;
    - leading, trailing and internal whitespace, a tab and a newline;
    - date-times, and zone and offset suffixes;
    - slash, compact, week and ordinal forms;
    - full-width digits and a U+2010 hyphen;
    - the empty string.
- **Document scenarios (`date-37`–`45`)** read values from the deal:
  - frontmatter extension keys (§XII.1): a quoted and an unquoted YAML date,
    both `true`, then `null`, a number and a boolean, each `false`;
  - a `date_probe` section: an absent path, a one-element array, an object and
    an impossible date, each `false`.
- **Error scenarios (`date-46`–`48`):**
  - zero arguments and two arguments refuse with `CALC-TYPE-001`;
  - `is_calendar_date(1 / 0)` refuses with the argument's own
    `CALC-DIV-ZERO`, not `false`.

### Refinement scenarios

> **Capability: `refinement`. A starter-product check.** Protocol §II.2 does
> not require a dependency graph, and §II.6 is explicit that a fixture group's
> directory is not a normative signal. A Verifier that does not project a
> dependency graph is conforming, and the RFC 0004 driver generates no cases
> here.


The separate [`starter/refinement/`](../starter/refinement/README.md) directory exercises the dependency-graph
extraction used by the v1.1 refinement engine
(`extractDependencyGraph` from `@uwmd/core/calc/dependencies`):

```
starter/refinement/<scenario-id>/
├── deal.uwx.md             Input deal file
└── expected-graph.json    Expected projection of the dependency graph
                            (sorted maps and sets for stable comparison)
```

| Scenario | Tests |
|---|---|
| `starter/refinement/dependency-graph-multifamily` | Multifamily pack only (no `custom_calculations`); asserts the calc → input edge set matches the recorded shape |

Run via:

```bash
node scripts/run-conformance.mjs --suite=calc
```

Comparison strips the volatile `evaluated_at` timestamp from
`expected-result.json`. The refinement scenario uses byte-exact
comparison against `expected-graph.json` after sorting maps and sets.
