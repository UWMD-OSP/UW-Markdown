# Roadmap

Current as of **2026-09-12**, following [release 2.7.0](https://github.com/UWMD-OSP/UW-Markdown/releases/tag/v2.7.0).
UW Markdown has completed its foundational standard and reference-engine work.
The forward work is narrower modeling workflows, tool integration and adopter-led
extensions. This roadmap is directional; a candidate is not a release commitment.

## Current release

Core/CLI **2.7.0**, signing **0.2.11** and batch **0.8.6** are published on npm.
Format is **2.0** and Protocol is **2.8.0**; the version streams are independent.
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
| Supporting tools and modules | Implemented | Web editor/viewer, docs site, VS Code extension, Excel/report packages and hospitality/data-center reference modules. Publication varies; see the matrix. |

See the [RFC index](docs/rfcs/README.md) and [changelog](CHANGELOG.md) for the
individual contracts and releases. A module implementation landing in the repo
does not mean its standalone npm package is published.

## Maintenance sprint after 2.7.0

| Work | State | Evidence / completion |
|---|---|---|
| Current roadmap and status reconciliation | Merged in PR #181 | Historical launch plans archived; implemented/published/proposed states separated; RFC 0040/0041 marked implemented. |
| Independent PCG64 verification | Sprint verification complete | 11 seeds, 11,264 raw draws and 176 doubles match NumPy 1.26.4's compiled PCG64 under the upstream default stream and srandom sequence. Existing outputs are unchanged. [Evidence and reproduction](docs/reviews/2026-09-12-pcg64-reference.md). |
| Period-consumer follow-up scope | Refinement implementation ready for review | [RFC 0042](docs/rfcs/0042-period-refinement.md) adds fixed stated period inputs and diagnostics. [Workbook bindings](docs/roadmap/period-consumers.md) remain a planning brief. |

## Forward backlog

The bounded RFC 0042 refinement stage is implemented for review, with package
publication pending. The remaining order guides the next planning decision;
no new financial model or package release is committed.

| Priority | Work | State | Definition of done / prerequisite |
|---|---|---|---|
| 1 | Contextual period support in downstream tools | Refinement in review; Excel next | Review [RFC 0042](docs/rfcs/0042-period-refinement.md), then specify [workbook bindings](docs/roadmap/period-consumers.md) and real Excel recalculation checks. Period defaults remain separate. |
| 2 | Lease-up / DCF integration | Next candidate | Define how stated lease-up schedules feed dated cash flows and Excel, including cash timing and defaults. Reuse existing calendar contracts; do not infer dates or periods. |
| 3 | Speculative leasing module | Proposal | Pin renewal probability, vacancy, market-rent resets, TI/LC cash timing and amortization against a concrete adopter example. Add deterministic fixtures before implementing rollover math. |
| 4 | Waterfall extensions | Deferred | RFC 0035/0036 left clawback/crystallization, combined-hurdle “any” mode and GP-side hurdles for separate contracts. Each needs exact economic rules and conformance cases. |
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
