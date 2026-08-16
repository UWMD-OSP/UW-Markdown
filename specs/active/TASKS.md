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
- [ ] **Task 1.2: Receipt computation metadata**
  - [x] `protocol_version: PROTOCOL_VERSION` on the `computation` object in
        `packages/uwmd-core/src/receipts.ts`.
  - [ ] `verifyReceipt` (`RCP-07`) compares `receipt.computation.engine` against
        the verifier's engine name before treating version drift as an
        explanation. Today `engineMatches` compares `engine_version` alone, so
        two different engines that share a version string are reported as
        `failed` instead of `unverifiable`.
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
- [ ] **Task 3.2: Test type-checking**
  - `packages/uwmd-core/tsconfig.json` excludes `src/**/*.test.ts` and vitest's
    esbuild transform does not type-check, so compile-time assertions in tests
    are inert today.
  - Add `packages/uwmd-core/tsconfig.test.json` covering `src/**/*.test.ts`
    (`noEmit`, extending the package tsconfig).
  - Add `npm run typecheck:tests` and a CI step that runs it.
- [ ] **Task 3.3: Exclude re-export barrels from coverage**
  - Add `src/index.ts` and `src/browser.ts` to `coverage.exclude` in
    `packages/uwmd-core/vitest.config.ts`.
  - Re-measure and adjust the coverage floor in the same commit, documenting the
    new figures in the comment block per the ratchet policy already written there.

---

## Stage 4: Governance & specification updates

- [ ] **Task 4.1: Draft RFC 0024**
  - `docs/rfcs/0024-irr-convergence-determinism.md` pinning the Newton-Raphson
    seed (0.1), convergence tolerance (1e-7), and iteration cap (200).
  - A draft exists on the `rfc/0024-iterative-solvers` branch (`72d1fdb`,
    "open RFC 0024 — pin the iterative solvers"). Reconcile with that branch
    rather than writing a second draft; confirm the pinned constants match
    `calc/functions.ts` before publishing.
- [ ] **Task 4.2: Update security alias**
  - `SECURITY.md:5` currently reads `team@uwmd.org`; change to
    `security@uwmd.org`. Check `CONTRIBUTING.md`, `GOVERNANCE.md`,
    `MAINTAINERS.md`, and `docs/` for the same address.
  - **Confirm with the human partner that the alias is live** before publishing
    it — an unrouted security address silently drops vulnerability reports.
