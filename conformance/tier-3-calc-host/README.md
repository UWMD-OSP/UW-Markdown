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
├── deal.uwx.md             Input deal file
├── calc.json              The calculation declaration to evaluate
└── expected-result.json   Expected CalcResult
```

## Provided scenarios

| Scenario | Tests |
|---|---|
| `fixtures/revpar-basic` | RevPAR = adr × occupancy with literal inputs from `quick_metrics` |
| `fixtures/dscr-from-section` | DSCR derived by deepGet path resolution across `noi_model` and `debt_structure` sections |

### Refinement scenarios

> **Capability: `refinement`. No tier requires these.** Protocol II.3 lists
> four requirements for a Tier-3 Calc Host and a dependency graph is not among
> them; II.6 is explicit that a fixture group's directory is not a normative
> signal. A calc host that does not project a dependency graph is a conforming
> calc host, and the RFC 0004 driver generates no cases here.


A separate `refinement/` subdirectory exercises the dependency-graph
extraction used by the v1.1 refinement engine
(`extractDependencyGraph` from `@uwmd/core/calc/dependencies`):

```
refinement/<scenario-id>/
├── deal.uwx.md             Input deal file
└── expected-graph.json    Expected projection of the dependency graph
                            (sorted maps and sets for stable comparison)
```

| Scenario | Tests |
|---|---|
| `refinement/dependency-graph-multifamily` | Multifamily pack only (no `custom_calculations`); asserts the calc → input edge set matches the recorded shape |

Run via:

```bash
node scripts/run-conformance.mjs --tier=3
```

Comparison strips the volatile `evaluated_at` timestamp from
`expected-result.json`. The refinement scenario uses byte-exact
comparison against `expected-graph.json` after sorting maps and sets.
