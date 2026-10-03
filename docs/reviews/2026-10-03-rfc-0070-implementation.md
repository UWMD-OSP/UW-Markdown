
# RFC 0070 implementation review evidence — 2026-10-03

Canonical repository: UWMD-OSP/UW-Markdown.
Implementation base: `48fa1086671c0c229562457b98efd0a378969f78`.
Frozen accepted semantics: `29c42c79e855fca4f97d82ec71596857370ca4b6`.
Atomic implementation commit: `678c31a68495d8b22ef92f5f3d12e5521ab7cd17`.
Branch: `codex/implement-rfc-0070`. The review PR's head identifies the final
implementation and planning-record commits. This document records local evidence;
the PR's checks are the authoritative CI state.

## Behavior

The optional nullable closed replacement-funding union separates funding from
the unchanged post-expiration lifecycle statement. Legacy absent/null funding
and explicit escrow require RFC 0056's lawful named replacement escrow.
Outright requires an exact current explicit §4.26 variant and zero-based safe row
index, and forbids replacement escrow even at zero. No fallback/search/rebind is
performed. Payment <= 0 and strictly after initial effective_date is required;
before/on/after expiration are all permitted. Invalid initial anchors retain
existing hedge findings. This describes a modeled future payment, not an
executed trade.

Synchronous validateUWFile remains synchronous with its existing ValidationResult
shape. HDG-07 checks union/assumption; HDG-08 checks source/reference/rows/digest
syntax; HDG-10 checks sign/date. No hash-pending finding or HDG-11 exists.
Only actual async recomputed mismatch emits HDG-09, in the separate result.

The public Node/browser helper commits exact RFC 8785 JSON/UTF-8/SHA-256 of
currency_code (exact authored valid value or null), row_index, the fixed section
cash_flow_series, full ordered series, and exact variant. Absent/null document
currency is equivalent; optional row absence/null is distinct. No metadata,
whole-document digest or containing funding object creates a circular scope.
Snapshots are captured before the first await. No dependency or financial-math
change is introduced.

CLI validate text/JSON and verify with validation enabled, plus MCP validation,
invoke the verifier and separately expose structural status and binding state.
Complete outright success requires structural success and verified. Refusal
exits 1 in CLI and sets MCP isError. Integrity/policy-only CLI verification
reports not_checked/not_invoked; the synchronous web panel explicitly qualifies
its result and makes no complete binding claim.

## Compatibility and regression proof

- All 17 pre-existing RFC 0056 hedge fixture/expected pairs have no diff against
  the canonical base. Their existing conformance results still pass.
- Unit tests read all 17 fixtures, validate/verify, and compare parsed snapshots,
  raw text and on-disk text unchanged. Lawful legacy escrow returns
  not_checked/not_applicable. Explicit null funding is also tested.
- New missing-sources-uses and missing-uses fixtures each require exactly ESC-04;
  complete verification is unverifiable/invalid_structure. This corrects the
  early-return implementation defect under already-released RFC 0056.
- New fixtures cover explicit escrow, outright, zero cost, same-day rows,
  expiration-independent timing, closure/reference failures, contradictory modes
  and staleness under row/index/variant/currency edits.
- A reviewed rebind targets an unrelated -99 outflow with a fresh valid digest.
  UWMD verifies consistency; the independent producer source-payment assertion
  (2028-01-01, -360000) fails. No economic authenticity claim follows from hashing.

## Async result evidence

| Control | Separate result |
|---|---|
| Lawful outright/zero/same-day/timing cases | verified; equal stated/computed digests |
| Stale amount, insertion, deletion, order, label, variant, index, currency | failed / stale_binding; exactly HDG-09 |
| Illegal funding/rows/sign/anchor/currency | unverifiable / invalid_structure; relevant structural_issues |
| Missing/superseded cash source or ambiguous required selection | unverifiable / unresolvable_source |
| Controlled unavailable hash provider | unverifiable / crypto_unavailable; no HDG-09 or structural pending error |
| Lawful legacy/explicit escrow | not_checked / not_applicable |
| Verifier not requested (web; integrity-only CLI) | not_checked / not_invoked; qualified claim |

Runtime crypto/unchecked controls are unit/consumer tests because they describe
invocation/provider state rather than authored financial facts. Structural
results remain clean for eligible stale/unchecked/unavailable bindings; they do
not silently claim verification. Caller mutations during hashing cannot change
the helper/verifier's captured snapshot.

## Known-answer parity

For cap-cash, row_index 1 and the accepted two-row synthetic series:

| Currency | Node and real Web Crypto SHA-256 result |
|---|---|
| USD | `sha256:3add19b25a3adb3d8bfa3f02977ecd14a53ead000abc4ad1ae99cd3d39fdf1fa` |
| absent/null | `sha256:33072bf8b331730e37176a3fb1b1f80cb3fc1c398bed4746fcffc3d5b74ea63a` |

Both pass; browser exports are exercised. Additional controls cover object-key
order, numeric JSON spellings, row null-versus-absence, Format 2.0 nested metadata,
and metadata/unrelated-edit stability.

## Local deterministic gates

Windows / Node 24.14.1 / Python 3.12; Node 20/22 and Windows Node 20 are covered
by repository PR CI. No dependency/lockfile/workspace-link change required npm ci.

| Gate | Result |
|---|---|
| npm run build | PASS, all workspaces |
| npm test | PASS, 2,782 tests / 143 files; core 2,355 / 119 |
| npm run typecheck:tests | PASS, all workspaces |
| npm run conformance | PASS, 732 checks; 74 hedge cases including 57 new |
| gen-conformance-cases --check | PASS, 158 current cases |
| portable driver --no-skip | PASS, 158/158 |
| conformance:profiles | PASS, 3 profiles; 14+144 skipped, 155+3 skipped, 158+0 skipped |
| validate-schemas | PASS, 47 schema compilations |
| verify-codes | PASS, 231 emitted codes; documented promises/families agree |
| verify-indexes | PASS, schema/RFC/site indexes |
| verify-lockfile | PASS, 3 lockfiles / 9 workspaces |
| verify-packages | PASS, all publishable contents |
| verify-versions | PASS, all existing labels/pins unchanged |
| verify-release | PASS, existing release-record consistency only |
| npm run lint | PASS |
| docs-site build | PASS |
| web-editor build/test | PASS, 72 tests / 9 files |
| git diff --check | PASS |

The existing browser receipt known-answer test now disables the Node crypto
branch by stubbing process.versions.node rather than deleting the process global
that Vitest needs. It still uses real Web Crypto, and restores its stub. The new
component test explicitly selects jsdom. The Ajv test follows the repository's
typed ESM addFormats.default convention.

## Authorization boundaries and deviations

No accepted semantic deviation. The web editor uses the expressly permitted
sync-only qualified result. CLI verify --validate is additionally reconciled
because it already claims validation. Dynamic provider/invocation controls are
tested separately from static authored fixtures.

RFC 0070 remains accepted. Format 2.0 / Protocol 2.20.0 / core-CLI 2.16.0,
manifests, lockfiles, VERSIONS.md, CHANGELOG.md and release records are unchanged.
The immutable v2.16.0 tag still resolves to
`a1ca815e2aee5da374caf7627ba3702849ecd257`.
No merge, release preparation, version selection, tag/publication or StackUW
adoption is performed. No cap pricing, payoff/curve/MTM, swap/collar expansion,
escrow roll-forward, inferred funding or changed cash flows is introduced.

After implementation review, the owner separately decides merge and the actual
release pairing. StackUW remains blocked until a released pairing is vendored
and downstream source-mapping, calendar-anchor, provenance and admission proofs
pass under its own authorization.

## Changed-file inventory

Paths are repository-relative. The archive and this record are included.

### Normative

- `spec/UW_FORMAT_SPEC_v1.md`
- `spec/UW_PROTOCOL_v1.md`
- `spec/schemas/debt-rate-hedge.schema.json`

### Core

- `packages/uwmd-core/src/browser.ts`
- `packages/uwmd-core/src/index.ts`
- `packages/uwmd-core/src/protocol.ts`
- `packages/uwmd-core/src/replacement-funding-structure.test.ts`
- `packages/uwmd-core/src/replacement-funding-structure.ts`
- `packages/uwmd-core/src/replacement-funding.test.ts`
- `packages/uwmd-core/src/replacement-funding.ts`
- `packages/uwmd-core/src/validator.hedge.test.ts`
- `packages/uwmd-core/src/validator.ts`

### Consumers

- `packages/uwmd-core/src/bindings.ts`
- `packages/uwmd-core/src/cli.test.ts`
- `packages/uwmd-core/src/cli.ts`
- `tools/web-editor/README.md`
- `tools/web-editor/src/components/ValidationPanel.test.tsx`
- `tools/web-editor/src/components/ValidationPanel.tsx`
- `tools/web-editor/src/receipts.test.ts`

### Conformance

- `conformance/README.md`
- `conformance/hedge/0070-after-expiration/deal.uwx.md`
- `conformance/hedge/0070-after-expiration/expected.json`
- `conformance/hedge/0070-ambiguous-debt/deal.uwx.md`
- `conformance/hedge/0070-ambiguous-debt/expected.json`
- `conformance/hedge/0070-ambiguous-sources/deal.uwx.md`
- `conformance/hedge/0070-ambiguous-sources/expected.json`
- `conformance/hedge/0070-bad-amount/deal.uwx.md`
- `conformance/hedge/0070-bad-amount/expected.json`
- `conformance/hedge/0070-bad-currency/deal.uwx.md`
- `conformance/hedge/0070-bad-currency/expected.json`
- `conformance/hedge/0070-bad-date/deal.uwx.md`
- `conformance/hedge/0070-bad-date/expected.json`
- `conformance/hedge/0070-bad-index--1/deal.uwx.md`
- `conformance/hedge/0070-bad-index--1/expected.json`
- `conformance/hedge/0070-bad-index-0_5/deal.uwx.md`
- `conformance/hedge/0070-bad-index-0_5/expected.json`
- `conformance/hedge/0070-bad-index-9007199254740992/deal.uwx.md`
- `conformance/hedge/0070-bad-index-9007199254740992/expected.json`
- `conformance/hedge/0070-bad-kind/deal.uwx.md`
- `conformance/hedge/0070-bad-kind/expected.json`
- `conformance/hedge/0070-bad-order/deal.uwx.md`
- `conformance/hedge/0070-bad-order/expected.json`
- `conformance/hedge/0070-bad-row-label/deal.uwx.md`
- `conformance/hedge/0070-bad-row-label/expected.json`
- `conformance/hedge/0070-bad-row-member/deal.uwx.md`
- `conformance/hedge/0070-bad-row-member/expected.json`
- `conformance/hedge/0070-before-expiration/deal.uwx.md`
- `conformance/hedge/0070-before-expiration/expected.json`
- `conformance/hedge/0070-currency-absent/deal.uwx.md`
- `conformance/hedge/0070-currency-absent/expected.json`
- `conformance/hedge/0070-currency-null/deal.uwx.md`
- `conformance/hedge/0070-currency-null/expected.json`
- `conformance/hedge/0070-digest-member-missing/deal.uwx.md`
- `conformance/hedge/0070-digest-member-missing/expected.json`
- `conformance/hedge/0070-digest-syntax/deal.uwx.md`
- `conformance/hedge/0070-digest-syntax/expected.json`
- `conformance/hedge/0070-empty-series/deal.uwx.md`
- `conformance/hedge/0070-empty-series/expected.json`
- `conformance/hedge/0070-escrow-contradiction-0/deal.uwx.md`
- `conformance/hedge/0070-escrow-contradiction-0/expected.json`
- `conformance/hedge/0070-escrow-contradiction-100/deal.uwx.md`
- `conformance/hedge/0070-escrow-contradiction-100/expected.json`
- `conformance/hedge/0070-escrow-missing/deal.uwx.md`
- `conformance/hedge/0070-escrow-missing/expected.json`
- `conformance/hedge/0070-escrow-reference/deal.uwx.md`
- `conformance/hedge/0070-escrow-reference/expected.json`
- `conformance/hedge/0070-explicit-escrow/deal.uwx.md`
- `conformance/hedge/0070-explicit-escrow/expected.json`
- `conformance/hedge/0070-explicit-zero/deal.uwx.md`
- `conformance/hedge/0070-explicit-zero/expected.json`
- `conformance/hedge/0070-invalid-effective/deal.uwx.md`
- `conformance/hedge/0070-invalid-effective/expected.json`
- `conformance/hedge/0070-legacy-escrow/deal.uwx.md`
- `conformance/hedge/0070-legacy-escrow/expected.json`
- `conformance/hedge/0070-missing-reference/deal.uwx.md`
- `conformance/hedge/0070-missing-reference/expected.json`
- `conformance/hedge/0070-missing-row/deal.uwx.md`
- `conformance/hedge/0070-missing-row/expected.json`
- `conformance/hedge/0070-missing-source/deal.uwx.md`
- `conformance/hedge/0070-missing-source/expected.json`
- `conformance/hedge/0070-missing-sources-uses/deal.uwx.md`
- `conformance/hedge/0070-missing-sources-uses/expected.json`
- `conformance/hedge/0070-missing-uses/deal.uwx.md`
- `conformance/hedge/0070-missing-uses/expected.json`
- `conformance/hedge/0070-nonreplacement-loan_matures_first-escrow/deal.uwx.md`
- `conformance/hedge/0070-nonreplacement-loan_matures_first-escrow/expected.json`
- `conformance/hedge/0070-nonreplacement-loan_matures_first-outright/deal.uwx.md`
- `conformance/hedge/0070-nonreplacement-loan_matures_first-outright/expected.json`
- `conformance/hedge/0070-nonreplacement-unhedged-escrow/deal.uwx.md`
- `conformance/hedge/0070-nonreplacement-unhedged-escrow/expected.json`
- `conformance/hedge/0070-nonreplacement-unhedged-outright/deal.uwx.md`
- `conformance/hedge/0070-nonreplacement-unhedged-outright/expected.json`
- `conformance/hedge/0070-on-expiration/deal.uwx.md`
- `conformance/hedge/0070-on-expiration/expected.json`
- `conformance/hedge/0070-outright-payment/deal.uwx.md`
- `conformance/hedge/0070-outright-payment/expected.json`
- `conformance/hedge/0070-payment-before-effective/deal.uwx.md`
- `conformance/hedge/0070-payment-before-effective/expected.json`
- `conformance/hedge/0070-payment-on-effective/deal.uwx.md`
- `conformance/hedge/0070-payment-on-effective/expected.json`
- `conformance/hedge/0070-positive-payment/deal.uwx.md`
- `conformance/hedge/0070-positive-payment/expected.json`
- `conformance/hedge/0070-reviewed-rebind/deal.uwx.md`
- `conformance/hedge/0070-reviewed-rebind/expected.json`
- `conformance/hedge/0070-same-day-distinct/deal.uwx.md`
- `conformance/hedge/0070-same-day-distinct/expected.json`
- `conformance/hedge/0070-stale-amount/deal.uwx.md`
- `conformance/hedge/0070-stale-amount/expected.json`
- `conformance/hedge/0070-stale-currency-removed/deal.uwx.md`
- `conformance/hedge/0070-stale-currency-removed/expected.json`
- `conformance/hedge/0070-stale-currency/deal.uwx.md`
- `conformance/hedge/0070-stale-currency/expected.json`
- `conformance/hedge/0070-stale-deletion/deal.uwx.md`
- `conformance/hedge/0070-stale-deletion/expected.json`
- `conformance/hedge/0070-stale-index/deal.uwx.md`
- `conformance/hedge/0070-stale-index/expected.json`
- `conformance/hedge/0070-stale-insertion/deal.uwx.md`
- `conformance/hedge/0070-stale-insertion/expected.json`
- `conformance/hedge/0070-stale-label/deal.uwx.md`
- `conformance/hedge/0070-stale-label/expected.json`
- `conformance/hedge/0070-stale-reorder/deal.uwx.md`
- `conformance/hedge/0070-stale-reorder/expected.json`
- `conformance/hedge/0070-stale-variant/deal.uwx.md`
- `conformance/hedge/0070-stale-variant/expected.json`
- `conformance/hedge/0070-superseded-source/deal.uwx.md`
- `conformance/hedge/0070-superseded-source/expected.json`
- `conformance/hedge/0070-unknown-member/deal.uwx.md`
- `conformance/hedge/0070-unknown-member/expected.json`
- `conformance/hedge/0070-unknown-mode/deal.uwx.md`
- `conformance/hedge/0070-unknown-mode/expected.json`
- `conformance/hedge/0070-unrelated-edit/deal.uwx.md`
- `conformance/hedge/0070-unrelated-edit/expected.json`
- `conformance/hedge/0070-variant-fallback-forbidden/deal.uwx.md`
- `conformance/hedge/0070-variant-fallback-forbidden/expected.json`
- `conformance/runner/README.md`
- `conformance/runner/cases/replacement-funding__0070-after-expiration.case.json`
- `conformance/runner/cases/replacement-funding__0070-ambiguous-debt.case.json`
- `conformance/runner/cases/replacement-funding__0070-ambiguous-sources.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-amount.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-currency.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-date.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-index--1.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-index-0_5.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-index-9007199254740992.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-kind.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-order.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-row-label.case.json`
- `conformance/runner/cases/replacement-funding__0070-bad-row-member.case.json`
- `conformance/runner/cases/replacement-funding__0070-before-expiration.case.json`
- `conformance/runner/cases/replacement-funding__0070-currency-absent.case.json`
- `conformance/runner/cases/replacement-funding__0070-currency-null.case.json`
- `conformance/runner/cases/replacement-funding__0070-digest-member-missing.case.json`
- `conformance/runner/cases/replacement-funding__0070-digest-syntax.case.json`
- `conformance/runner/cases/replacement-funding__0070-empty-series.case.json`
- `conformance/runner/cases/replacement-funding__0070-escrow-contradiction-0.case.json`
- `conformance/runner/cases/replacement-funding__0070-escrow-contradiction-100.case.json`
- `conformance/runner/cases/replacement-funding__0070-escrow-missing.case.json`
- `conformance/runner/cases/replacement-funding__0070-escrow-reference.case.json`
- `conformance/runner/cases/replacement-funding__0070-explicit-escrow.case.json`
- `conformance/runner/cases/replacement-funding__0070-explicit-zero.case.json`
- `conformance/runner/cases/replacement-funding__0070-invalid-effective.case.json`
- `conformance/runner/cases/replacement-funding__0070-legacy-escrow.case.json`
- `conformance/runner/cases/replacement-funding__0070-missing-reference.case.json`
- `conformance/runner/cases/replacement-funding__0070-missing-row.case.json`
- `conformance/runner/cases/replacement-funding__0070-missing-source.case.json`
- `conformance/runner/cases/replacement-funding__0070-missing-sources-uses.case.json`
- `conformance/runner/cases/replacement-funding__0070-missing-uses.case.json`
- `conformance/runner/cases/replacement-funding__0070-nonreplacement-loan_matures_first-escrow.case.json`
- `conformance/runner/cases/replacement-funding__0070-nonreplacement-loan_matures_first-outright.case.json`
- `conformance/runner/cases/replacement-funding__0070-nonreplacement-unhedged-escrow.case.json`
- `conformance/runner/cases/replacement-funding__0070-nonreplacement-unhedged-outright.case.json`
- `conformance/runner/cases/replacement-funding__0070-on-expiration.case.json`
- `conformance/runner/cases/replacement-funding__0070-outright-payment.case.json`
- `conformance/runner/cases/replacement-funding__0070-payment-before-effective.case.json`
- `conformance/runner/cases/replacement-funding__0070-payment-on-effective.case.json`
- `conformance/runner/cases/replacement-funding__0070-positive-payment.case.json`
- `conformance/runner/cases/replacement-funding__0070-reviewed-rebind.case.json`
- `conformance/runner/cases/replacement-funding__0070-same-day-distinct.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-amount.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-currency-removed.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-currency.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-deletion.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-index.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-insertion.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-label.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-reorder.case.json`
- `conformance/runner/cases/replacement-funding__0070-stale-variant.case.json`
- `conformance/runner/cases/replacement-funding__0070-superseded-source.case.json`
- `conformance/runner/cases/replacement-funding__0070-unknown-member.case.json`
- `conformance/runner/cases/replacement-funding__0070-unknown-mode.case.json`
- `conformance/runner/cases/replacement-funding__0070-unrelated-edit.case.json`
- `conformance/runner/cases/replacement-funding__0070-variant-fallback-forbidden.case.json`
- `conformance/runner/runner.py`
- `scripts/gen-conformance-cases.mjs`
- `scripts/run-conformance.mjs`

### Documentation and planning

- `docs/reviews/2026-10-03-rfc-0070-implementation.md`
- `docs/rfcs/0070-replacement-cap-funding-and-payment-binding.md`
- `docs/wiki/03-core-library.md`
- `docs/wiki/07-data-model-reference.md`
- `docs/wiki/08-tools.md`
- `docs/wiki/09-conformance-testing.md`
- `docs/wiki/13-status.md`
- `specs/active/SPEC.md`
- `specs/active/TASKS.md`
- `specs/archive/rfc-0070-replacement-funding.md`
