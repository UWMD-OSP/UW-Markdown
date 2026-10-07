# CLI reporting clarity — implementation review

Implemented and verified 2026-10-03 on `codex/cli-reporting-clarity`, based on
canonical remote `main` at `48fa108`. Implementation commit: `c41a07e`. This work is
unreleased; published core/CLI remain 2.16.0, Protocol 2.20.0, Format 2.0.

The initial local checkout was `2fbf925`; managed worktree creation resolved the
newer remote-main merge `48fa108`, which includes RFC 0070's accepted design.
Those prior commits are baseline history, not changes made by this task. The
implementation and all gates ran in the managed worktree at that newer base.

## Changed files

- `packages/uwmd-core/src/cli.ts`: separate validation/workflow/coverage/readiness
  labels; explicit metric coverage and hashes at issuance; typed refusals and
  clearly labeled receipt verification.
- `packages/uwmd-core/src/receipts.ts`: retain existing calc failure messages
  and optional error pointers in the refusal text, beside the calc ID and code.
- `packages/uwmd-cli/test/reporting.test.ts`: nine deterministic subprocess
  regression tests, including a partial-issuance inline snapshot.
- `CHANGELOG.md`: unreleased reporting entry.
- `ROADMAP.md`: completed reporting work and incremental package design candidate.
- `docs/wiki/13-status.md`: implemented/unreleased reporting status and future scope.
- `docs/wiki/08-tools.md`: CLI behavior and public terminology boundary.
- `docs/UW_RECEIPTS.md`: validity/completeness/hash/receipt distinctions and examples.
- `docs/roadmap/element-package-validation.md`: future RFC/design brief.
- `tools/docs-site/scripts/prebuild.mjs`: copy and URL mapping for the brief.
- `specs/active/SPEC.md`, `specs/active/TASKS.md`: task contract and reconciliation;
  closed back to placeholders after the implementation commit.
- `specs/archive/cli-reporting-clarity.md`: completed contract/task record.
- This review file: completion evidence and before/after examples.

## Before and after

| Case | Before | After |
|---|---|---|
| Valid but incomplete workflow | `CLEAN` followed by `Stage Readiness: ✗ full_underwrite` | `Validation result: CLEAN`; `Stage Readiness (workflow completeness)`; `full_underwrite: incomplete`; receipt readiness/verification explicitly `not checked`. |
| Skipped checks | Evaluated/skipped reason counts only | Counts preserved, with an explanation that skipped checks were not evaluated and cleanliness does not establish their agreement. |
| Partial metric coverage | `Issued receipt ... (7/8 outputs computed)` | `Receipt issued`; `Metric completeness: partial`; `Computed: 7/8`; `Uncomputed: cash_on_cash`; complete result/status-set explanation and canonicalization/document/results hashes. |
| Missing pack | Generic thrown `ReceiptError` stack and code | `Receipt refused [RCP_PACK_UNRESOLVED]`, asset class/reason, no new receipt and no prior-receipt verification performed. |
| Calc selection refusal | `cash_on_cash (CALC-RESOLVE-002)` | Same metric/code plus `Cannot select debt_structure`, the resolver's reason and variant keys; error pointer also retained when supplied. |
| Receipt mismatch | `Verdict: FAILED` and existing issue detail | `Receipt verification verdict: FAILED`, existing `RCP-01` expected/actual hashes, and explanation separating completeness gaps from mismatch/recomputation failure. |

An unchanged receipt with `cash_on_cash` uncomputed verifies successfully. After
changing its document, verification fails independently of that completeness
gap. Tests pin both human and JSON behavior. All data comes from repo-owned
synthetic fixtures or temporary mutations of them. No external golden/source
deal files were copied into the repository or re-audited here.

## Verification

All final gates passed:

| Gate | Result |
|---|---|
| `npm run build` | All workspaces built. |
| `npm test` | 2,699 tests passed across nine workspaces, including 104 CLI tests. |
| `npm run conformance` | 675 passed, 0 failed; all default suites, no baseline updates. |
| `npm run validate-schemas` | 47 passed, 0 failed. |
| `npm run lint` | Passed. |
| `npm run verify-lockfile` | Three lockfiles/local links and nine workspace pins passed. |
| `npm run verify-packages` | All nine package contents passed. |
| `npm run typecheck:tests` | All workspaces passed. |
| `npm run verify-indexes` | Index checks and two discovery/version tests passed. |
| `npm run verify-versions` | Manifests, spec constants and labels passed. |
| `npm --prefix tools/docs-site run build` | Built successfully, including the new candidate page and links. |
| `git diff --check` | Passed. |

Fresh-worktree installs used existing root and docs-site lockfiles; neither
dependencies nor workspace links were edited. A lint-only string-formatting
correction was followed by a core rebuild, all 66 receipt tests and all nine
focused CLI tests. The docs gate initially identified dead links; copy and URL
mapping plus the public guidance link were corrected before its successful run.

## Normative boundary and follow-up

Stage Readiness / `stage_readiness` remains the public term, with an explanatory
label. JSON payloads, error codes, exit behavior, schemas, calc grammar/formulas,
receipt result semantics, canonicalization and conformance obligations are
unchanged. No `spec/`, `protocol.ts`, conformance or package-version edits.
Manufactured housing still refuses without a registered pack; no substitute
pack or asset-level equity allocation is invented.

The [future element/package brief](../roadmap/element-package-validation.md)
reconciles existing RFCs 0018/0021/0048 and scopes standalone rent rolls, T-12s,
debt schedules and property files; ZIP/folder manifests; deterministic assembly,
canonicalization/hashing; provenance; and document-versus-package receipt scope.
It recommends a future normative RFC and implements no new stitching behavior.
A separate terminology RFC may consider “workflow completeness” compatibility.

The change is committed locally; no push, merge, publication or release was done.
