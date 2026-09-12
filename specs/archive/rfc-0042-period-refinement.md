# RFC 0042 — stated period inputs in refinement

Status: implementation for owner review. Baseline: PR #181 merged at `a703535`,
2026-09-12. The owner requested continuation of the period-consumer work.
The proposed contract is [RFC 0042](../../docs/rfcs/0042-period-refinement.md);
merging its PR accepts the contract. It is not a published feature yet.

## Scope and authorized surfaces

Implement only the refinement stage of the period-consumer brief. Existing
finite numeric period inputs are fixed while ordinary cascade gaps are ranked.
Resolve through RFC 0041 with explicit variant/override context. Never send a
period dependency to the cascade. Missing, nonnumeric or invalid period inputs
exclude only affected outputs and produce structured diagnostics even when no
ordinary gap exists. Preserve scalar-only results and existing perturbation math.

This stage authorizes Protocol 2.9.0, a PeriodRefinementIssue type in protocol.ts,
its JSON schema, and matching normative text in the same commit. It authorizes
RankGapsOptions.periodContext and optional diagnostics.period_inputs. Export the
new diagnostic type from both package entries. Format, package versions, financial
formulas, precision tolerances, dependencies and workspace links do not change.
Only receipt protocol labels change; no expected calculation values may change.

Excel remains EXCEL-EMIT-PATH. Workbook bindings, period defaults, stochastic VOI,
stage-blocking ranking and financial-model extensions remain out of scope.

## Done

Focused tests cover all five series, year/calendar identity and row permutation,
duplicates/malformed/absent/nonnumeric values, generic and explicit variants,
overrides including null, literal keys, no cascade access and partial results.
Schema validation covers emitted issue shapes. Run build, full tests, test type
checks, conformance, schemas, lint, lock/package/version/index/release guards and
docs build. Submit a reviewable PR and verify final-commit CI; do not publish.

## Implementation completion — 2026-09-12

Committed in `e8a8b0bb9fe1c9de8694581619186e492b25cd41` after all local gates.
Review branch: `codex/rfc-0042-period-refinement`. Owner acceptance/merge and
package publication remain separate; RFC status is active for review.

- [x] Implement fixed period inputs, exact context and per-output diagnostics.
- [x] Synchronize Protocol 2.9.0, public type, schema, exports and receipt labels.
- [x] Add 33 acceptance tests and update the roadmap/wiki/consumer brief.
- [x] Pass build, 1,827 workspace tests, test typechecking, 426 default and 76
  declarative conformance checks, 26 schemas, lint, all five repository guards
  (lockfile, packages, versions, indexes, release) and docs build.
- [x] Smoke-test built Node and browser entries against a parsed conformance
  fixture: ordinary gap ranking and explicit null period override.

Only receipt protocol labels change among conformance baselines. Financial
outputs/digests, package versions, dependency locks and evaluator math are
unchanged. The final documentation build passed after adding the usage example.
Final-commit GitHub CI is a separate pre-merge condition checked on the PR.

Follow-up consumer audit: the CLI text view now prints period exclusions as well
as the JSON diagnostics, with a command-level regression test.

Next: contextual workbook bindings and actual Excel recalculation verification,
following docs/roadmap/period-consumers.md. No workbook contract or new financial
model was implicitly accepted by this implementation sprint.
