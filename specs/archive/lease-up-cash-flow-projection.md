# RFC 0044 explicit projection — completion record

Owner approved implementation on 2026-09-12. Implementation commit: `14671cf`.
Source Protocol 2.11.0; published core/CLI stay 2.7.0 / Protocol 2.8.0.

Completed: browser-safe async API, exact explicit variants and complete date
maps, shared existing structural/verifier rules, exact copied values, semantic
source digest and canonical bindings. Typed CALC-LU-PROJECTION preserves nested
selection/structural/verifier evidence. Candidate-only CLI and production-API
worked example are documented. Protocol/types/schemas landed in one commit.

Verification on 2026-09-12:

- Build and 1,931 workspace tests pass, including 50 new API cases and four CLI checks.
- Test typechecking passes across workspaces.
- Default conformance: 441 pass, including 15 new self-contained projection cases.
- Declarative conformance: 76/76 pass.
- All 31 JSON schemas compile; API tests validate actual outputs and refusal evidence.
- Lint, lockfile, package contents, version matrix, indexes and release checks pass.
- Documentation production build passes; only existing highlighting/chunk-size warnings.
- Git diff whitespace check passes. No dependency/lockfile changes; npm ci unnecessary.

No economic formula, precision boundary, source document, signing behavior or
published package version changed. Full-property/equity DCF requires a separate
contract for valuation anchor, economic coverage and double counting; speculative
leasing and cash-flow metric Excel export remain separate work.
