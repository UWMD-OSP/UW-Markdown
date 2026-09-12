# RFC 0040 — role-aware cross-check selection

Status: implementation preparation; owner decision pending on the wire location.
Baseline: `59e8912`, core 2.6.2 / Protocol 2.6.0. Opened 2026-09-11.

## Authorized objective

The owner requested proceeding with: land the documentation reconciliation,
make RFC 0040 ready for acceptance and implement it, then follow with RFC 0041.
PR #177 completes the first step. One implementation stage is active: RFC 0040.
The [readiness review](../../docs/reviews/2026-09-11-rfc-0040-0041-readiness.md)
records verified code findings and the queued RFC 0041 work.

## Pending contract decision

The recommended wire representation is block-level `_role`, rather than
`_meta.role`. Existing v2 normalization discards `_meta.role`, so assigning it
meaning would otherwise leave a validation-relevant field outside the block hash.
The owner has been asked to choose `_role` or a separately versioned integrity
contract for `_meta.role`. This contract authorizes preparation and review now;
it does not authorize assuming an unanswered choice or marking the RFC accepted.

## Proposed implementation scope after that decision

1. Revise RFC 0040 with one scalar role, explicit collision semantics, component
   exclusion at every fallback, per-section resolution evidence, and the signed
   representation approved by the owner. Preserve existing role-free results.
2. Change the normative format text, protocol text/constants, relevant block
   schemas, and exported types together. Target the next protocol minor from
   the actual main baseline; do not equate it with the package release version.
3. Implement role selection without changing any comparison or tolerance. Audit
   direct CC-03 and CC-12 reads as well as the common resolver. Keep CC-15's
   existing base-schedule exception. Never aggregate multiple senior tranches.
4. Preserve role annotations through parse/envelope/serialization and trusted
   edit/supersede paths. Explicitly prevent model content from assigning roles.
   Prove that a signed role change invalidates verification, while role-free
   hashes and the existing conformance corpus remain unchanged.
5. Record selection evidence per rule and per section, only where roles are
   present, so old coverage records remain byte-identical. Add the structural
   validation rule and register its remediation and code family.
6. Export browser-safe public symbols from both entries. No dependencies,
   financial formulas, release tags, or publication changes in this feature.

## Required cases

- Unique senior restores debt-related cross-checks over producer-named variants.
- Detail beats summary for rent-roll selection; primary serves generic reads.
- Explicit key preference precedes role preference; a consulted duplicate role
  refuses resolution without falling through to a default.
- Component blocks cannot win via preferred/default/base/sole/single-block paths.
- Invalid role values are errors in every variant, including unselected blocks.
- Role-free resolution, diagnostics, coverage, hashes, and fixtures are unchanged.
- Multi-section checks report each role-bearing selection separately.
- Parsed role survives supported conversion/edit paths; trusted role edits are
  possible; model-supplied role changes are stripped or refused explicitly.
- Signing detects role tampering. No new-field omission from canonical hashing.

## Gates and completion

Build, workspace tests, test typechecking, default conformance, v2 conformance
cases where affected, schema validation, lint, lockfile/package/version/index
checks, and docs build. All affected normative surfaces land in the same commit.
Acceptance and implementation status must reflect the owner's decision and the
actual result. Reconcile RFC 0041 against main only after this stage completes.
