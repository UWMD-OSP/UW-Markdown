---
title: "Calc conventions"
---

# Calc calling conventions

UW Markdown calculations are a small deterministic expression language. A
formula is evaluated by the Tier-3 engine; an agent may describe assumptions
and extract facts, but never supplies financial math.

## Write paths from the parsed record

Paths begin with a section id and are resolved against its JSON content.

```text
noi_model.net_operating_income / debt_structure.annual_debt_service
```

Arrays use zero-based bracket indexes:

```text
dcf.annual_cash_flows[0].net_operating_income
```

Use a path only when the owning section really stores that value. Missing input
propagates as `null`; do not substitute a made-up zero.

## Units and number conventions

Rates are fractions, never display percentages:

```text
0.0551                 # 5.51%
1000000 * 0.0551       # $55,100
```

Use plain numbers for currency, counts, square feet, and periods. Units belong
on the calculation declaration (`$`, `%`, `x`, `count`, `$/sf`), not inside the
formula string.

## Operators and builtins

Arithmetic operators are `+`, `-`, `*`, `/`, and `%`; comparisons and a ternary
conditional are also supported. Available builtins are:

| Category | Functions |
|---|---|
| Aggregation | `sum`, `avg`, `min`, `max` |
| Logic and rounding | `coalesce`, `if`, `round` |
| Math | `abs`, `floor`, `ceil`, `sqrt`, `pow`, `log`, `exp` |
| Finance | `pmt`, `fv`, `pv`, `nper`, `npv`, `irr` |

`sum` treats null inputs as zero. `avg`, `min`, and `max` ignore null inputs and
return null if every input is null. `coalesce` returns its first non-null
argument. Other arithmetic propagates null, which keeps incomplete-data state
visible instead of manufacturing a result.

## Excel-emittable pack formulas

Every pack formula must be expressible in Excel from workbook named ranges.
Arithmetic, comparisons, conditionals, and the following builtins emit cleanly:

```text
sum min max if round abs floor ceil sqrt pow log exp pmt npv irr fv pv nper
```

The emitter deliberately rejects `coalesce` and `avg` with `EXCEL-EMIT-FN`.
Their null semantics do not have a portable Excel equivalent. A missing named
range produces `EXCEL-EMIT-PATH` instead. Treat either result as a pack-design
error: add the required input mapping or rewrite the formula with equivalent
Excel-safe logic.

## Verify a formula from the command line

```bash
npm run cli -- calc examples/Parkview-Apts-Glendale-AZ.uwx.md "npv(0.1, -100, 60, 60)"
```

The result is deterministic and has no network or model dependency. For error
meanings and recovery, see the [FAQ](/guide/faq).
