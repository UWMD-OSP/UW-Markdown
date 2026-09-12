# Lease-up / dated cash-flow design and executable example

Status: authorized continuation, stacked on PR #184. The next roadmap item is
cash-flow coupling; its economic/timing choices are not accepted yet.

Deliver draft RFC 0044 with a precise bounded projection contract, an executable
worked example using only existing core APIs, and a smoke test that keeps the
example runnable in CI. Pin dates, source variant, day count and discount rate
explicitly in synthetic example data. Copy source amounts from an existing
conformance fixture; deterministic core code computes all derived values.

The sample stream represents rent plus concessions plus TI/LC only. Do not label
it NOI, unlevered/levered free cash flow, or an investment return. No acquisition,
opex, debt, exit, renewal, vacancy or amortization assumptions may be inferred.
No production projection API, normative spec/schema/protocol/version changes,
new dependencies, release or merge are included. Owner reviews the proposal
before production implementation. Update roadmap/status and publish a separate
reviewable PR after all gates pass.

## Completion evidence

- [x] Draft RFC 0044 with bounded proposed API, validation rules, compatibility,
  conformance matrix and full-DCF decision boundary.
- [x] Authored dates and copied source amounts in an executable example, with
  deterministic core-generated output and a CI smoke test guarding the guide.
- [x] Public guide and mirroring, RFC index, roadmap and living status updated.
- [x] Build, 1,877 workspace tests, test typechecking, 426 default plus 76
  declarative conformance cases, 28 schemas, lint, package/lockfile/version/index/
  release guards and docs build passed before committing the stage.

This completes the design/example stage only. The production projection adapter
and full DCF model are not implemented. RFC 0044 remains draft for owner review;
there is no new normative, dependency, package-version or publication change.
