# Post-2.7.0 roadmap and determinism sprint

Status: authorized 2026-09-12; reconciled main/tag v2.7.0 at `560c2aa`.
Release 2.7.0 is published and verified; no competing open PR was found.

## Scope

1. Replace the historical roadmap/status narrative with a concise current
   snapshot, an ordered backlog and explicit implementation/publication states.
   Preserve the old documents as labeled history with working relative links.
   Mark RFCs 0040/0041 implemented and link their 2.7.0 release.
2. Verify PCG64 against an independent compiled NumPy implementation using the
   exact upstream default stream and srandom sequence. Pin source provenance,
   boundary-seed vectors and long-sequence digests; add normal-test regression
   coverage and a maintainer reproduction script. No PRNG output change.
3. Assess Excel/refinement period consumers and write the bounded follow-up
   brief with code entry points, compatibility requirements and decisions that
   need their own accepted RFC before the existing refusal contract changes.

No numerical formulas, tolerances, protocol/schema/API contracts, external npm
dependencies, workspace links or package versions change in this sprint. If the
independent oracle disagrees, retain the existing outputs and report the exact
disagreement before proposing a normative correction.

## Done

Pass build, workspace tests, test typechecking, default and declarative
conformance, schemas, lint, package/lockfile/version/index/release checks and docs
build. The independent verifier reproduces the committed vectors. Commit and
submit the sprint PR, verify CI and archive the sprint record. A new feature
release or publication is outside this sprint.
