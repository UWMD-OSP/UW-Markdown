# Active Task Matrix

Derived from [`SPEC.md`](SPEC.md). One unchecked item is in flight at a time; an
item is checked off only after the deterministic gates pass and the change is
committed. Reconciled against the working tree on 2026-08-15 — items marked done
were verified present, not assumed.

## Stage 1: Protocol 1.3.0 bump & PR #38 finalization — **merged**

Landed on `main` via PR #38 (`6758251`), followed by the 1.2.0 release cut in
PR #43 (`4c3b101`). Only the Task 1.2 engine-identity item below is still open;
it moved to its own follow-up because the merge was already green without it.


- [x] **Task 1.1: Bump protocol version** — `d174014`
  - `PROTOCOL_VERSION = '1.3.0'` in `packages/uwmd-core/src/protocol.ts:29`.
  - Synced in `spec/schemas/module-manifest.schema.json` and `VERSIONS.md`.
- [x] **Task 1.2: Receipt computation metadata** — `d174014`, `41eeaef`
  - `protocol_version: PROTOCOL_VERSION` on the `computation` object in
    `packages/uwmd-core/src/receipts.ts`.
  - `verifyReceipt` (`RCP-07`) now compares the pair `(engine, engine_version)`.
    `engineMatches` had compared `engine_version` alone, so two different
    engines sharing a version string came back `failed` instead of
    `unverifiable`. Receipt spec §5.1/§5.3/§5.4 restated to match.
    On `fix/receipt-engine-identity`, awaiting PR.
- [x] **Task 1.3: Normative spec & errata documentation** — `d174014`, `1d40011`
  - IRR bracket `[-0.999, 10.0]` documented in `spec/UW_PROTOCOL_v1.md` §VIII.3.
  - `CHANGELOG.md` carries the `round(1.005, 2)` half-away-from-zero errata note.
- [x] **Task 1.4: Run deterministic gates & finalize PR #38** — `2368284`, `6758251`
  - `main` merged into the branch; conflicts resolved keeping both the 1.3.0 bump
    and the #39/#40/#41 hardening. Gates green: build ✓, tests ✓, conformance
    153/153 ✓, schemas 11/11 ✓, lint ✓, lockfile ✓. PR #38 merged.

---

## Stage 2: Security & dependencies (landed on `main` as PRs #39–#41)

- [x] **Task 2.1: AST sandbox path hardening** — `c4e5bb5` (PR #39)
  - `calc/evaluator.ts` walks own properties only; document-authored keys and
    paths cannot reach the prototype chain. Tests in `calc/calc.test.ts`.
- [x] **Task 2.2: Demote Anthropic SDK dependency** — `5dc8310` (PR #40)
  - `@anthropic-ai/sdk` is a `peerDependency` of `@uwmd/core`; the provider seam
    in `src/agents/provider.ts` keeps it out of `browser.ts`.

---

## Stage 3: CI, type-checking & test hygiene

- [x] **Task 3.1: Lockfile registry trap check** — `6c79dbc` (PR #41)
  - Landed as `npm run verify-lockfile` (`scripts/verify-lockfile.mjs`), not
    `check:lockfile`; it also cross-checks workspace pins. Wired into
    `.github/workflows/ci.yml` as its own pre-install job.
- [x] **Task 3.2: Test type-checking** — `10bbc2d` (on `chore/typecheck-tests`)
  - `packages/uwmd-core/tsconfig.test.json` (`noEmit`, extends the package
    tsconfig, includes the tests); `npm run typecheck:tests` at both levels;
    CI step on the Node 20 leg of `build-and-test`.
  - Its first run found **12 type errors across 5 files** — none failing at
    runtime, all places the compiler had nothing to say. Fixed in the same
    commit. Biome now parses `tsconfig*.json` as JSONC.
  - Extended to all five workspaces in `6bae5b8`. No further type errors, but
    the sweep found that **`@uwmd/excel` was publishing its own test suite** —
    its tsconfig had no `exclude`, so the build compiled tests into `dist/`,
    and its `files` field carries none of core's `!dist/**/*.test.*` guards.
    `verify-packages` had no entry for excel or report at all; it covers all
    five publishable workspaces now.
- [x] **Task 3.3: Exclude re-export barrels from coverage** — `ce13e55`
  - `src/index.ts` and `src/browser.ts` excluded in `vitest.config.ts`.
  - **The coverage gate was already red on `main`:** measured 77.88% against a
    79% floor, and the CI `coverage` job has no `continue-on-error`. RFC 0018
    had grown the two barrels to ~1,050 uncovered lines; nothing got less
    tested. With them excluded, measured 83.30% lines, 76.8% branches, 97.5%
    functions; floor re-ratcheted to 82/82/97/76.
  - Closes open decision 6 in `docs/wiki/13-status.md`.

---

## Stage 4: Governance & specification updates

- [x] **Task 4.1: Draft RFC 0024** — `72d1fdb` (on `rfc/0024-iterative-solvers`)
  - The draft already existed and is more complete than this task asked for:
    `docs/rfcs/0024-iterative-function-determinism.md` (295 lines), plus the
    §VIII.3 spec change, a CHANGELOG entry, the RFC index, and the docs-site
    prebuild copy list. Not the filename this matrix guessed at.
  - Verified 2026-08-15: merges cleanly onto current `main`, and the merged tree
    passes build, tests, conformance 153/153, schemas 11/11, and lint.
  - It also corrects a factual error in §VIII.3's convergence note as errata:
    the note claims the engine brackets first and refines with Newton, while
    `calc/builtins.ts` runs Newton first from a seed of `0.1` capped at 100
    iterations, with the bracket and its 200-iteration bisection as *fallback*.
    That is why `irr(-1, 20)` returns `18.999…` — 1900%, from an engine whose
    spec says it searches to 1000%.
  - **Remaining is governance, not authorship:** open the PR and accept it. An
    RFC is accepted by a human, not merged by a builder.
- [ ] **Task 4.2: Update security alias**
  - `SECURITY.md:5` currently reads `team@uwmd.org`; change to
    `security@uwmd.org`. Check `CONTRIBUTING.md`, `GOVERNANCE.md`,
    `MAINTAINERS.md`, and `docs/` for the same address.
  - **Confirm with the human partner that the alias is live** before publishing
    it — an unrouted security address silently drops vulnerability reports.
