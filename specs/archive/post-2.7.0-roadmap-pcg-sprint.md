# Post-2.7.0 roadmap and determinism sprint

Status: completed in `93c4877`, 2026-09-12; [PR #181](https://github.com/UWMD-OSP/UW-Markdown/pull/181). Baseline: main/tag v2.7.0 at `560c2aa`.
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

## Completion evidence

- [x] Reconcile the roadmap/status pages and archive their historical notes.
- [x] Mark RFC 0040/0041 implemented and wire public roadmap/evidence/brief routes.
- [x] Verify PCG64 independently: 11 seeds, 11,264 raw draws, 176 doubles;
  add a reproducible oracle and 12 normal-suite regression tests.
- [x] Document downstream Excel/refinement entry points, decisions and acceptance
  cases in docs/roadmap/period-consumers.md.
- [x] Pass every local gate, commit as `93c4877`, submit PR #181 and archive.

Verification: 1,794 workspace tests, 426 default conformance checks, 76 declarative
cases, 25 schemas, build, test typechecking, lint, lockfile/package/version/index/
release checks, docs build and generated-page inspection. Python reproduction
passes against the independent NumPy oracle. Existing conformance files, schema/
protocol contracts, dependency locks and financial outputs are unchanged.
Final-commit CI is tracked on PR #181 and must pass before merge.

The sprint did not implement contextual period consumers: RFC 0041 explicitly
refuses Excel emission, the workbook builder has no period-table binding or
general custom-calculation export, and refinement's cascade has no period-default
contract. The follow-up brief makes those decisions concrete without changing
published behavior or inventing defaults. No package release is needed here.
