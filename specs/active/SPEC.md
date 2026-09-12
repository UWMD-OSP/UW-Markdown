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
