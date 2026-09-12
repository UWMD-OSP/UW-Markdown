# Completed proposal stage: property cash-flow assembly proposal

## Objective

Draft the next roadmap contract after published 2.8.0, grounded in RFC 0044,
the existing DCF footing helper and dated cash-flow engine. The deliverable is
[RFC 0045](../../docs/rfcs/0045-explicit-property-cash-flow-assembly.md), with
explicit coverage, date, basis, currency, reserve and double-count rules.

## Scope and decisions

This stage is proposal-only. No normative spec, public API, schema, calculation,
dependency or release version changes. The draft proposes unlevered/pre-tax,
single-currency cash flows and copies stated amounts. Existing math stays intact.
Clearly distinguish a mechanically complete declaration from verified economics.
Do not invent adopter facts to fill missing expense, acquisition or exit inputs.

## Definition of done

- Reconcile current release, RFC inventory and active work before drafting.
- Write the RFC, source-grounded review example and conformance acceptance matrix.
- Update RFC index, roadmap and living status to say draft, not implemented.
- Pass build, tests, conformance and the full repository verification gates,
  including docs build; commit and open a review PR.

## Next-stage prerequisite

Owner acceptance of the economic boundary plus a concrete adopter supplemental
ledger; then exact plan/result/issue schemas and normative triad approval before
implementation. The draft lists those decisions; generic approval of continuing
the roadmap does not supply missing financial facts.

## Completion evidence — 2026-09-12

- [x] Drafted RFC 0045 and reconciled the roadmap, RFC index and living status.
- [x] All gates passed before commit `4a081fe31c017a5be99ff5859f689abfa09c1893`.
- [x] Opened [PR #189](https://github.com/UWMD-OSP/UW-Markdown/pull/189) for owner review.

Build, 1,931 workspace tests, test typechecking, 441 default plus 76 declarative
conformance checks, 31 JSON schemas, lint, lockfile/package/version/index/release
checks and docs-site build passed. The generated RFC page exists and is indexed.
No dependencies or lockfile changed, so npm ci was not required. Docs retained
only the existing EBNF-highlighting and chunk-size warnings.

This completes the proposal-writing stage only. RFC 0045 is draft; acceptance,
the adopter ledger, wire contract and implementation remain outstanding. No
normative files, runtime behavior, financial calculations or versions changed.
