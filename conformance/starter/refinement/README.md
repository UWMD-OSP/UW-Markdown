# Refinement starter checks

These starter-product fixtures check `extractDependencyGraph` against a stated
calculation graph. They belong to `starter-products` in the
[corpus index](../../corpus-index.json).

Each `<scenario>/` holds `deal.uwx.md` and `expected-graph.json`.
Run `npm run conformance -- --suite=starter-refinement` after building core.
For baseline updates, select the complete calculation family with
`--suite=calc --update`, which also includes refinement checks.
