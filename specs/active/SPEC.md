# Active contract: property cash-flow assembly proposal

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
