# CLI reporting clarity — completed

Authorized by the external audit requirements on 2026-10-03. Reconciled against
canonical remote main `48fa108`: stage checks, computed flags, packages and
composition already existed. The initial local checkout was `2fbf925`; managed
worktree creation resolved the newer remote main. No external deal files were
imported.

## Contract

- Separate validation status, normative `stage_readiness` (explained as workflow
  section/field completeness), cross-check coverage and unchecked receipt readiness.
- Report issued receipts' computed/uncomputed statuses, completeness and hashes
  explicitly while preserving the complete result set and receipt semantics.
- Print typed issuance refusals and retain calc messages/pointers when supplied.
  No fallback pack, inferred inputs or asset-level equity allocations.
- Explain verification mismatches independently of missing-input completeness.
- Preserve JSON/stdout payloads, codes, exits, schemas, grammar, canonicalization,
  calculation rules and default conformance baselines.
- Document an incremental element/package RFC candidate over RFCs 0018/0021/0048.

## Task matrix

- [x] Implement reporting and retained calc diagnostics, deterministic regressions,
  guidance/roadmap/status/changelog; pass repository gates and commit.

## Completion

Implementation committed locally as `c41a07e` after all required gates passed,
including 2,699 workspace tests, 675 default conformance checks, 47 schemas,
build/lint/package/link checks and the docs-site build. Extra test type-check,
version and index checks passed. Nine focused CLI tests cover clean validation
with incomplete workflow, partial/complete issuance, missing-pack and calc
selection refusals, and verified/mismatched receipts.

See [the review report](../../docs/reviews/2026-10-03-cli-reporting-clarity.md)
for changed files, examples, evidence and the normative/future RFC boundary.
Published versions remain unchanged. No push, merge, publication or release.
