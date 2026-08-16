# Specification: Protocol 1.3.0 Finalization & Core Engine Hardening

Status: **active** · Opened 2026-08-15 · Stage 1 merged (PR #38, release PR #43)

## 1. Context & scope

This specification finalizes the landing of **RFC 0023** (numeric determinism and
the quantization boundary) and executes the immediate follow-up hardening across
sandbox security, dependency decoupling, and CI validation.

Much of the work described here landed on feature branches before this spec was
written down. The task matrix in [`TASKS.md`](TASKS.md) records what is already
true and what remains; treat the matrix, not this section, as the state of play.

## 2. Technical contracts & decisions

1. **Protocol version bump (1.3.0).** The normative `MUST` additions in §VIII.5
   are monotonic requirement strengthening under `VERSIONS.md` rule 2, so the
   protocol takes a minor bump: `PROTOCOL_VERSION = '1.3.0'`.
2. **Receipt verification (`RCP-07`).** `RECEIPT_RESULT_TOLERANCE` stays at
   `1e-6` as defense in depth against third-party non-conforming engines.
   `receipt.computation` carries `protocol_version`. Engine *version* drift only
   explains a disagreement when the engine *name* also matches — the
   `unverifiable` verdict requires `receipt.computation.engine === verifier engine`.
3. **Financial function bracket.** The IRR search bracket `[-0.999, 10.0]`
   (-99.9% to 1000%) is documented normatively in §VIII.3.
4. **AST traversal security.** Segment navigation in `calc/evaluator.ts` rejects
   `__proto__`, `constructor`, and `prototype`, and walks own properties only.
5. **Dependency decoupling.** `@anthropic-ai/sdk` is a peer dependency of
   `@uwmd/core`, not a hard dependency, and never reaches the browser entry.
6. **Lockfile integrity.** CI fails if any `@uwmd/*` reference in a lockfile
   resolves to a registry tarball rather than the working tree.
7. **Test type-checking.** `*.test.ts` is excluded from `tsconfig.json`, so
   compile-time assertions written in tests are inert. A separate
   `tsconfig.test.json` type-checks them, wired into CI.
8. **Coverage honesty.** Re-export barrels (`src/index.ts`, `src/browser.ts`)
   carry no logic; counting them inflates the coverage figure the floor
   ratchets against, so they are excluded from the coverage report.

## 3. Non-goals

- No change to the `.uw.md` **format** version — this is a protocol-only bump.
- No change to `RECEIPT_RESULT_TOLERANCE`.
- No new external npm dependencies.
- RFC 0024 is *drafted* here, not accepted; acceptance is a governance act.

## 4. Definition of done

- [x] `PROTOCOL_VERSION` is `'1.3.0'` across `protocol.ts`,
      `module-manifest.schema.json`, and `VERSIONS.md`.
- [x] `quantize.ts` performs all numeric quantization at the boundary with exact
      Excel parity.
- [x] Forbidden prototype segments throw explicit AST evaluation errors.
- [x] All 11 JSON schemas validate and conformance passes (153 assertions, target ≥147).
- [x] `npm run verify-lockfile` reports zero registry leaks.
- [x] `npm run typecheck:tests` passes and gates CI.
- [x] Coverage excludes the re-export barrels, and the floor is green again.
- [x] RFC 0024 exists in `docs/rfcs/` with its numerics pinned (acceptance is a
      separate governance step).
- [ ] Security contact is `security@uwmd.org` — blocked on confirming the alias
      is live and routed.

## 5. Verification gate

```bash
npm run build && npm test && npm run conformance && npm run validate-schemas
```

Plus `npm run lint`, `npm run verify-lockfile`, and `npm run verify-packages`
before the branch is proposed for merge. See the orchestration protocol in
[`AGENTS.md`](../../AGENTS.md) for the full gate and the escalation triggers.
