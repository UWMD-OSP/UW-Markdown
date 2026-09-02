# conformance/portfolio-relationships

Fixtures for the `.uwportfolio.json` sidecar (RFC 0015, Protocol §XV): the
`PORT-NN` structural refusals of `validatePortfolioProfile` (registry-aware
via `lookupEdgeType`), unknown-type/field preservation, edge queries, and the
RFC 0018 projection bridge (`projectPackageLinksToEntityEdges` →
`entityEdgesToPortfolioEdges`). Owed under the `portfolio-relationships`
capability.

Scenario kind is dispatched by the files a directory carries (see
`scripts/run-conformance.mjs`):

- `profile.json` + `expected.json` — the profile runs through
  `validatePortfolioProfile`; `expected.json` pins `ok`, any
  `expected_codes`, and optionally `uninterpreted` types,
  `preserved_paths` (extension fields that must survive),
  `edge_count`, and `edges_touching` (a `getPortfolioRelationships` pin).
- `package-manifest.json` + `expected.json` — the manifest's links project
  through `projectPackageLinksToEntityEdges`, wrap via
  `entityEdgesToPortfolioEdges`, and the resulting profile must validate;
  `projected_edge_ids` / `projected_types` pin what crossed the layer
  boundary.

| Scenario | Pins |
|---|---|
| `01-valid-multi-deal` | A borrower, loan, two properties, and source-document evidence; 4 edges, 3 touching the borrower. |
| `02-missing-provenance` | An edge with an empty provenance array → PORT-009. |
| `03-duplicate-id` | A duplicated entity id (one namespace across entities and edges) → PORT-006. |
| `04-dangling-edge` | An endpoint that does not resolve locally → PORT-008. |
| `05-unknown-preservation` | Extension entity/edge types and fields validate clean, are reported via `uninterpretedPortfolioTypes`, and survive (`preserved_paths`). |
| `06-wrong-layer` | A *known* member-layer type (`abstracts`) used as an entity edge → PORT-010 — the RFC 0018 §5 two-layer rule, pinned from the sidecar side. |
| `07-package-projection` | `supports`/`related_to` project up with synthesized provenance; `abstracts` (member-only) must NOT; the wrapped edges validate as a profile. |
