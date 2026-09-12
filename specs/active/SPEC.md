# Active contract: RFC 0045 core and CLI implementation

The owner requested continued development and selected a clearly labeled
synthetic test ledger on 2026-09-12; real-deal validation follows separately.
Implement RFC 0045's stated unlevered/pre-tax, single-currency assembly contract,
including its exact section 8 plan/result/error types. No inferred financial
inputs, formulas, tolerances, currency conversion or new dependencies.

Authorized normative changes: Protocol 2.12.0, new VIII.9.6 text; the RFC 0045
types in protocol.ts; CALC-CF-ASSEMBLY; and three plan/result/issue schemas,
all in one commit. Format remains 2.0. Package release is a separate task.
Core/browser exports and read-only `assemble-property` CLI consume that contract.

Use a Format 2.0 synthetic ledger with complete category coverage, real purchase
anchor, external reserve transfers and stated gross exit. Test refusal of missing
coverage, overlapping rows, invalid dates/signs/basis, failed and unverifiable
sources, snapshot mutation and same-date ordering. Preserve existing math and
source bytes; verify returns through existing metric procedures only.

Definition of done: implementation, independent conformance cases, schema/runtime
agreement, CLI success/refusal, workflow docs and living status; all repository
gates and CI green before merge. Keep synthetic evidence distinct from adopter
validation and published APIs.
