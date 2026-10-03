# RFC 0070 implementation specification

Selected feature: accepted RFC 0070. Owner implementation authorization received
2026-10-03. Canonical base: 48fa1086671c0c229562457b98efd0a378969f78.
Frozen contract: 29c42c79e855fca4f97d82ec71596857370ca4b6.
Branch: codex/implement-rfc-0070 in ../uwmd-codex.

## Contract and scope

Implement docs/rfcs/0070-replacement-cap-funding-and-payment-binding.md exactly:
closed replacement-funding union; exact variant/index/payment structure;
legacy escrow compatibility and missing-section ESC-04 correction; separate
async digest verifier with the accepted states; consumer integration; all
conformance controls and portable CLI coverage. The digest commits exact JCS
of currency_code (authored or null), row_index, section, complete ordered series,
and variant. Capture immutable inputs before awaiting hashing.

The public synchronous ValidationResult and validateUWFile signature remain
unchanged. HDG-09 is solely an async mismatch finding. Complete consumers expose
a separate replacement_funding_verification result and require verified for
outright success. No hashing-pending validation error exists.

Normative format/schema/protocol and executable declarations land in the same
implementation commit. One atomic task avoids any intermediate shipped state
admitting outright funding with consumers that silently skip verification.
Existing roles/property-level selection and financial math remain unchanged.

## Explicit authorization boundaries

No dependency change, release preparation, version consumption, tag/publication,
StackUW adoption, unrelated RFC implementation or RFC status promotion.
Keep Format 2.0 / Protocol 2.20.0 / core-CLI 2.16.0 labels until the owner's
separate actual version/release decision. Document pending unreleased behavior
separately from released guarantees. RFC 0070 remains accepted.

## Definition of done

Accepted structural truth table, exact async API/results and canonical digest
implemented and tested; legacy fixtures preserve bytes; direct missing-section
regressions; CLI/MCP/browser qualified results; matrix of conformance cases,
portable-driver coverage; two known-answer hashes with Node/Web Crypto parity;
immutable snapshot and reviewed/malicious-rebind controls. Build, unit tests,
test typechecks, all default/portable/profile conformance, schema, lint, codes,
indexes, lockfile/packages/versions and docs build green. Commit implementation
atomically, complete/archive this matrix, then open PR for review. Do not merge
the implementation PR or prepare a release under this authorization.
