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
