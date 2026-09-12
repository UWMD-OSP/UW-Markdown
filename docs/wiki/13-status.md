# 13 — Build status (living document)

Reconciled **2026-09-12** against main/tag **v2.7.0** at `560c2aa` and its
successful release workflow. Core/CLI **2.7.0**, signing **0.2.11** and batch
**0.8.6** are published and were smoke-tested from a clean npm install.
Format **2.0** and Protocol **2.8.0** version independently.

Use [VERSIONS.md](../../VERSIONS.md) for current versions and
[ROADMAP.md](../../ROADMAP.md) for priorities. The detailed notes accumulated
through 2.7.0 are [archived](13-status-history-2026-09-12.md); they are historical,
not an active task list. No new feature release is committed by this sprint.

## Built and released

- Reader/editor/calc/agent-host foundations; strict representation handling,
  Format 2.0 metadata, provenance, scoped edits and class-aware readiness.
- Deterministic calculation packs for the built-in asset classes, mixed-use
  component aggregation, typed capital stacks, calendar cash flows, xirr/xnpv,
  lease-up schedules and LP-IRR waterfall tiers.
- Receipt/integrity/signing chain, capability tokens and conformance profiles.
- JSON/XML/CSV interchange, optional HTTP/MCP profiles, composable documents,
  market data, portfolio relationships and batch corpus fact tables.
- RFC 0040 signed block roles and role-aware cross-check coverage; RFC 0041
  explicit year/calendar/date addressing for the five standard period series.
  Both are included in package 2.7.0; both RFCs are now marked implemented.

The web editor, viewer, documentation site and VS Code extension are implemented.
Excel/report packages and hospitality/data-center reference modules are also
implemented but remain unpublished as standalone packages. Their publication
state is distinct from the core features they consume.

## Verified maintenance work

PCG64 now has independent evidence: NumPy 1.26.4's compiled PCG64 matches
**11 seeds, 11,264 raw draws and 176 doubles**, using the upstream default stream
and srandom sequence. The seed-42 vector and stochastic outputs are unchanged.
See the [verification record](../reviews/2026-09-12-pcg64-reference.md).
Normal Vitest tests consume a pinned oracle; the optional Python reproduction
script does not add a runtime or npm dependency.

Sprint verification: **1,794 workspace tests**, **426 default conformance checks**,
**76 declarative cases**, 25 JSON schemas, build, test typechecking, lint,
package/lockfile/version/index/release checks and docs build pass. The sprint
adds 12 independent-reference tests to the release baseline; no existing
conformance baseline or calculation digest changes.

## Remaining limitations and follow-ups

| Area | Current limitation | Next condition |
|---|---|---|
| Period addressing | Excel emission refuses selector nodes; refinement records dependencies but does not perturb selector expressions. | Accept the [period-consumer brief](../roadmap/period-consumers.md) as a scoped RFC before changing that contract. |
| Refinement | Marginal perturbation is approximate; stochastic VOI and stage-blocking ranking are not implemented. | Define the ranking/default contract before expanding output claims. |
| Lease-up | Excel emission and DCF coupling remain follow-ups. | Specify schedule-to-cash-flow timing and fixtures. |
| Speculative leasing | No renewal/vacancy/market-reset/TI/LC rollover engine. | Adopter example and accepted modeling contract. |
| Waterfalls | Clawback/crystallization, “any” combined hurdles and GP-side hurdles remain deferred. | Separate normative contract and cases. |
| Currency and bps | Currency-code disambiguation and a dedicated bps unit remain deferred. | Demonstrated use case with explicit unit/precision semantics. |
| Adoption extensions | Semantic retrieval, investor profiles, portfolio/relationship agents, DOCX and additional package publication are demand-gated. | A concrete consumer requirement. |

## Operations

The repository is public and npm publishing is operational. The release workflow
uses OIDC trusted publishers for core, CLI, signing and batch; a new NPM_TOKEN is
not a launch prerequisite. SECURITY.md uses security@uwmd.org. Current mailbox
delivery and outside-adopter demand were not re-tested in this sprint.

The owner-accepted ExcelJS exposure and optional package-publication decisions
are historical governance choices, not an instruction to update dependencies or
publish those packages automatically. Revisit their scope when usage changes.

## Keeping this current

Keep this page short: current capabilities, real limitations and verified state.
Put chronology in CHANGELOG.md or a dated review. On release, update RFC statuses,
the version matrix and publication evidence; preserve old notes in the archive
without presenting their completed tasks as new work.
