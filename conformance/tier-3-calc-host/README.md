# Tier-3 Calc Host conformance

Tier-3 Calc Hosts evaluate `custom_calculations` blocks (and the
`calculations` declared by loaded modules) using the safe-expression
language defined in `UW_PROTOCOL_v1.md` Part VIII.

A Tier-3 host MUST:

- Parse the safe-expression grammar exactly as specified (no eval, no
  arbitrary code execution).
- Resolve variable references via `parser.deepGet` semantics against the
  parsed file.
- Implement the built-in functions: `sum`, `avg`, `npv`, `irr`, `pmt`,
  `if`, `coalesce`, `round`.
- Be deterministic: same inputs → same outputs, every run.
- Surface `CalcError` objects per the taxonomy in Part XI.

## Fixtures

```
fixtures/<scenario-id>/
├── deal.uw.md             Input deal file
├── calc.json              The calculation declaration to evaluate
└── expected-result.json   Expected CalcResult
```

## Provided scenarios

| Scenario | Tests |
|---|---|
| `revpar-basic` | RevPAR = adr × occupancy with literal inputs from `quick_metrics` |
| `dscr-from-section` | DSCR derived by deepGet path resolution across `noi_model` and `debt_structure` sections |

Run via:

```bash
node scripts/run-conformance.mjs --tier=3
```

Comparison strips the volatile `evaluated_at` timestamp from `expected-result.json`.
