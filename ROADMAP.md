# Roadmap

Current as of **2026-09-12**, following [release 2.8.0](https://github.com/UWMD-OSP/UW-Markdown/releases/tag/v2.8.0).
UW Markdown has completed its foundational standard and reference-engine work.
The forward work is narrower modeling workflows, tool integration and adopter-led
extensions. This roadmap is directional; a candidate is not a release commitment.

## Current release

Core/CLI **2.8.0**, signing **0.2.12** and batch **0.8.7** are published on npm.
Format is **2.0** and Protocol is **2.11.0**; the version streams are independent.
The [version matrix](VERSIONS.md) records exact compatibility and unpublished
packages. Release automation uses npm trusted publishing (OIDC), not NPM_TOKEN.

## Status legend

- **Released** — implemented and included in a published package release.
- **Implemented** — code and verification exist; a standalone package may remain unpublished.
- **Sprint verification** — evidence or tooling added by the current maintenance sprint.
- **Next candidate** — scoped for consideration; requires acceptance before implementation.
- **Demand-gated / deferred** — no committed implementation or release date.

## Completed capabilities

| Area | State | Scope |
|---|---|---|
| Format, reader, editor and calc host | Released | UW Lite / UWX, Format 2.0 authoring with legacy readers, byte-preserving edits, deterministic evaluation, validation and stage readiness. |
| Integrity and authorization | Released | Provenance, verification receipts, signed blocks/modules, capability tokens and conformance profiles. |
| Interchange and composition | Released | JSON/XML/CSV codecs, HTTP/MCP profiles, document packages/composites, mixed-use aggregation, market data and portfolio relationship data. |
| Financial structures | Released | Asset-class packs, typed capital stacks, calendar cash flows and xirr/xnpv, lease-up schedules, distribution waterfalls and LP IRR hurdles. |
| Signed block roles — RFC 0040 | Released in 2.7.0 | Role-aware cross-check selection, component exclusion, trusted edits and coverage evidence; introduced Protocol 2.7.0. |
| Explicit period addressing — RFC 0041 | Released in 2.7.0 | Named holding years and absolute month/quarter/date selectors on five standard series; Protocol 2.8.0. |
| Period consumers — RFCs 0042/0043 | Core APIs released in 2.8.0 | Fixed stated refinement inputs, explicit variants/overrides and contextual workbook binding APIs. Native Excel verified; standalone Excel package remains unpublished. |
| Explicit lease-up projection — RFC 0044 | Released in 2.8.0 | Complete explicit cash-date mapping of verified stated amounts, semantic source digest and binding evidence; read-only API and CLI. |
| Supporting tools and modules | Implemented | Web editor/viewer, docs site, VS Code extension, Excel/report packages and hospitality/data-center reference modules. Publication varies; see the matrix. |

See the [RFC index](docs/rfcs/README.md) and [changelog](CHANGELOG.md) for the
individual contracts and releases. A module implementation landing in the repo
does not mean its standalone npm package is published.

## Maintenance sprint after 2.7.0

| Work | State | Evidence / completion |
|---|---|---|
| Current roadmap and status reconciliation | Merged in PR #181 | Historical launch plans archived; implemented/published/proposed states separated; RFC 0040/0041 marked implemented. |
| Independent PCG64 verification | Sprint verification complete | 11 seeds, 11,264 raw draws and 176 doubles match NumPy 1.26.4's compiled PCG64 under the upstream default stream and srandom sequence. Existing outputs are unchanged. [Evidence and reproduction](docs/reviews/2026-09-12-pcg64-reference.md). |
| Period consumers and lease-up projection | Released in 2.8.0 | RFCs 0042–0044, validated CLI context and the explicit projection workflow. [Publication and installation evidence](docs/reviews/2026-09-12-release-2.8.0.md). |

## Forward backlog

The bounded period-consumer and lease-up projection stages are complete. The
next modeling work needs explicit economic inputs and a concrete adopter case;
no additional financial assumptions are supplied by the released adapter.

| Priority | Work | State | Definition of done / prerequisite |
|---|---|---|---|
| 1 | Full DCF assembly | Contract needed | Pin valuation anchor, expense/reserve/capital coverage, acquisition/disposition, financing basis, currency identity and double-count prevention. RFC 0044 supplies only a partial rent/concession/TI-LC stream. |
| 2 | Speculative leasing module | Proposal | Pin renewal probability, vacancy, market-rent resets, TI/LC cash timing and amortization against a concrete adopter example. Add deterministic fixtures before implementing rollover math. |
| 3 | Additional period consumers | Deferred extensions | Reverse import, structural workbook edits, period defaults and custom function/cash-flow metric export need separate contracts and parity evidence. |
| 4 | Waterfall extensions | Deferred | Clawback/crystallization, combined-hurdle “any” mode and GP-side hurdles each need exact economic rules and conformance cases. |
| 5 | Currency-code disambiguation | Deferred | Define currency identity independently from display locale before combining cross-currency values. |

### Mixed-use and speculative leasing

[RFC 0019](docs/rfcs/0019-mixed-use-composition.md) implements multi-component
container aggregation. [RFC 0008](docs/rfcs/0008-lease-up-modeling.md) implements
stated lease-up schedules. [RFC 0041](docs/rfcs/0041-period-indexed-addressing.md)
selects periods in existing series. None alone implements speculative lease
rollover or establishes Argus parity. Array iteration is not the remaining
product specification; lease economics and cash timing are.

### Demand-gated work

- **Semantic corpus retrieval (RFC 0013):** remains draft until an adopter needs
  find-similar-deals or risk-pattern recall. Portfolio analytics already use the
  corpus fact table and SQL; an embedding pipeline is not required for that.
- **Investor profiles and portfolio/relationship agent layers:** the data
  surfaces exist, but reference consumers need concrete adoption requirements.
- **Standalone Excel/report/module publication:** implemented packages remain
  unpublished until a consumer and supported distribution scope are chosen.
- **DOCX output:** scoped out by the owner; reconsider on an actual adopter ask.
- **Native bps units:** deferred until a pack demonstrates the required unit
  and precision contract. This is not an unresolved Excel ROUND-parity defect.
- **Relative periods, module-defined period series and stochastic VOI:** require
  separate contracts; they are not implied by the released first implementations.

## History and maintenance

The [historical roadmap](docs/roadmap/history-through-2.7.0.md) preserves the v1
launch, interchange train and v2 exploration narrative. Those milestones are
closed history, not remaining npm setup or launch tasks.

For each future item, record its user need, acceptance state, implementation
scope, proof of completion and publication state. Update the RFC frontmatter
and index together after a release; keep detailed implementation notes in the
developer wiki and dated reviews. New normative behavior requires an RFC under
[governance](GOVERNANCE.md); editorial status corrections do not change contracts.
