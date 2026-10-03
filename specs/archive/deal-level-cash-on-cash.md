# Deal-level multifamily cash-on-cash correction

Status: completed on 2026-10-03 after owner-approved narrow resumption.
Implementation commit: `b9a973c4f1bb07cb2908469bdf70cc7c648cfdbd`.
No release, publication, merge or normative RFC-level change is included.

Owner authorization: 2026-10-03. Format §4.19 defines cash-on-cash as year-N
levered cash flow divided by total invested equity. The multifamily pack's
sponsor denominator is an implementation defect, not a sponsor-specific
normative definition.

Correct only the multifamily pack and its consumers: select stated year-1 DCF
levered cash flow (by year identity), or the existing NOI minus debt-service
fallback when absent; divide by sources_uses.equity_metrics.equity_total.
Never infer total equity from sponsor or LP contributions. Missing total equity
remains uncomputed; zero follows the existing division-by-zero contract.
Retain role-free debt selection on the fallback. Update the pack patch version,
Excel bindings, synthetic regression coverage, receipt baselines, and wiki.
No new metrics, public types, schemas, protocol, dependencies, or financial
precision rules. Other asset-class packs are outside this correction.

Done: all requested regressions plus the repository's deterministic gates pass;
the change is committed in an isolated worktree.

# Task matrix

- [x] Correct multifamily cash-on-cash and Excel bindings; verify GD05-style
  synthetic regressions, missing allocation and missing/zero aggregate equity,
  year identity and fallback debt refusal; update wiki and receipt baselines;
  run all deterministic gates and commit.

## Verification

All commands ran from the isolated `codex/deal-cash-on-cash` worktree and
finished with exit code 0. No dependency or lockfile change required another
`npm ci` on the warm worktree.

| Command | Final result |
|---|---|
| `npm run build` | Pass |
| `npm test` | Pass; 2,801 tests across 9 workspaces |
| `npm run conformance` | Pass; 734 passed, 0 failed |
| `npm run validate-schemas` | Pass; 47 passed, 0 failed |
| `npm run lint` | Pass; 1,323 files, no findings |
| `npm run verify-lockfile` | Pass; 3 lockfiles, 9 workspace pins |
| `npm run verify-packages` | Pass; 9 packages |
| `npm run typecheck:tests` | Pass |
| `npm --prefix tools/docs-site run build` | Pass |

Focused checks also passed:

- `npm --prefix packages/uwmd-core test -- --run src/refinement.test.ts src/packs/multifamily.test.ts src/packs/packs.test.ts src/calc/dependencies.test.ts`: 87 passed.
- `npm --prefix packages/uwmd-excel test -- --run src/toWorkbook.test.ts src/fromWorkbook.test.ts`: 90 passed.

The Excel oracle repair independently selects the stated year-1 row for the
corrected cash-on-cash input; aggregate equity is read directly from its new
canonical path. The related import oracle now uses the same year identity.
The core oracle pins refinement's existing conservative conditional-AST
diagnostic for this metric. No production implementation changed on resumption.
The mixed-use test block was restored byte-for-byte, and the isolated newly
introduced Windows-1252 punctuation was repaired without changing pre-existing
UTF-8 bytes or line endings.

One concurrent full run passed all assertions but failed on Vitest's
`onTaskUpdate` worker timeout. Running the identical `npm test` command alone
passed with no unhandled errors; no timeout or test settings changed.
The docs build retains nonfatal chunk-size and EBNF-highlighting warnings.
