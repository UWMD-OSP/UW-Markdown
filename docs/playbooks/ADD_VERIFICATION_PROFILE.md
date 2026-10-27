# Adding a verification profile

Use a verification profile when stated relationships need a bounded deterministic
procedure beyond the current base Verifier. It checks a producer's declared
model; it does not generate underwriting or pick an economic convention for it.
RFC0092 and its accepted clarifications are the current worked example.

## 1. The RFC and exact contract

An accepted RFC states:

- The profile id/version, explicit claim/admission shape, subject and supported
  source representations. Unknown or contradictory claim fields have defined
  refusal behavior; do not silently fall back to a different convention.
- Every address/selector, unit, currency, time basis, precision and source-token
  rule. An absent input stays absent. New financial choices need acceptance
  before implementation or expected values.
- The asserted relationships, exact prerequisites and dependency ordering,
  cycle/self-copy handling and distinction between inputs and computed claims.
- Native and ledger bindings, declared universes/roles, unknown membership,
  report-only evidence and coverage counts. A count is not an assertion that an
  unchecked relationship is true.
- The report/schema, stable diagnostic meanings and each public binding's exit
  contract. Reuse only an applicable accepted contract; do not invent fallback
  exit numbers or treat internal failure as financial disagreement.

## 2. Implement and prove the claim

- [ ] Synchronize spec, protocol/types, schema, implementation and conformance
  under the accepted RFC. Use the existing verification package boundary.
- [ ] Export the library surface explicitly. List library, CLI, MCP and HTTP
  bindings independently; no binding inherits support by association.
- [ ] Preserve source/model/cache/receipt bytes required by the operation's
  read-only contract, including refusal and internal-error paths.
- [ ] Test empty claims, missing inputs, contradictions, malformed addresses,
  cycles, precision, nonfinite/domain refusals, native/ledger admission and
  status/order/schema output. Include synthetic tamper and negative controls.
- [ ] Establish optional [conformance profile](ADD_CONFORMANCE_PROFILE.md)
  ownership and driver mappings. Keep all base obligations intact.
- [ ] Run actual built and clean-installed CLI/library paths for bindings being
  claimed, with exact source/artifact/runtime identities and raw streams. Declare
  fault injection and incomplete machine-write boundaries plainly.
- [ ] Require selected profile coverage in Main CI before advertising it. Update
  the manifest/docs only after proof and any independent/owner gate required by
  that profile; source evidence is not proof for older registry code.

## 3. Review and completion

Record the exact accepted procedure and any choices in the PR. Build/test/types,
full and selected conformance, schemas, lint, docs and repository guards must
pass on the pushed head/current main. The implementation must report unavailable
or refused work clearly. A new profile never implies support for every financial
convention, source document, platform or transport.
