# 13 — Build status (living document)

Reconciled **2026-09-12** after release **v2.8.0** at `f0d8642`.
Core/CLI **2.8.0**, signing **0.2.12** and batch **0.8.7** are published and
verified through a clean npm installation. Format **2.0** and Protocol
**2.11.0** version independently. See [release evidence](../reviews/2026-09-12-release-2.8.0.md),
[VERSIONS.md](../../VERSIONS.md) and [ROADMAP.md](../../ROADMAP.md).

## Built and released

- Reader/editor/calc/agent-host foundations; Format 2.0 metadata, provenance,
  scoped edits, deterministic asset packs, class-aware readiness and validation.
- Calendar cash flows, xirr/xnpv, typed capital stacks, lease-up schedules,
  mixed-use component aggregation and LP-IRR waterfalls.
- Signed blocks/modules, capability tokens, receipts and conformance profiles;
  JSON/XML/CSV interchange, optional HTTP/MCP profiles, document composition,
  market data, portfolio relationships and batch corpus fact tables.
- RFCs 0040/0041 in 2.7.0: signed block roles and explicit period identities.
- RFCs 0042–0044 in 2.8.0: fixed stated period refinement inputs, contextual
  workbook binding APIs, validated CLI calculation context, and explicit
  lease-up cash-flow projection with semantic source evidence.

## Implemented supporting tools

Web editor/viewer, docs site and VS Code extension are implemented. Standalone
Excel **0.9.0**, report **0.8.12**, and hospitality/data-center modules **0.1.0**
remain unpublished. Core's RFC 0043 binding API is published; the full Excel
exporter remains available from source. Native Excel 16.0 build 20326 passed
14 scenarios / 48 cell checks. Reverse import of additional inputs refuses.

## Verification

Release preparation passed clean npm ci, build, **1,931 workspace tests**,
test typechecking, **441 default + 76 declarative conformance checks**,
**31 JSON schemas**, lint, lockfile/package/version/index/release checks and
documentation build. Separate tarball and registry installations verified
core/browser projection, zero-valued context overrides, CLI success/refusal,
signing exports and batch indexing. Source documents remained unchanged.

PCG64 independently matches NumPy 1.26.4's compiled implementation over
11 seeds, 11,264 raw draws and 176 doubles. See the [record](../reviews/2026-09-12-pcg64-reference.md).
No financial formula, precision boundary or calculation digest changed in the
release repin. The three receipt edits changed engine-version labels only.

## Remaining work

- Full DCF assembly needs a contract for economic coverage, valuation anchor,
  financing/currency basis and double counting. RFC 0044 includes rent receipts,
  concessions and TI/LC only; it does not produce complete investment returns.
- Speculative leasing needs explicit renewal/vacancy, rent reset and TI/LC timing
  rules with an adopter example. Array iteration alone does not supply them.
- Reverse import, structural workbook edits, period defaults and cash-flow
  metric Excel export remain separate extensions.
- Waterfall extensions, currency identity and stochastic VOI need bounded
  contracts. Retrieval and standalone optional-package publication remain
  demand-gated. DOCX remains scoped out by the owner.

Historical implementation/preparation details are [archived](13-status-history-2.8.0-preparation.md).
They do not describe current release status.
