# RFC 0064 / PR #219 technical audit — 2026-09-29

Audit base: canonical `main` `356c2a1` (PR #221 merged). PR #219 was rebased
onto that base. RFC 0064 is **draft**; Protocol 2.19.0 and Format §4.28 on the
PR are proposals, not the accepted contract on `main`. Published core/CLI
remain 2.13.0 with Protocol 2.17.0; `main` has the untagged 2.14.0 candidate
and accepted, unreleased Protocol 2.18.0. No tag, publication or merge occurred.

## Findings

| Classification | Finding and evidence |
|---|---|
| Verified | `rollForwardEndingBalance` alone computes opening + contributions − draws − releases. Both `RSV-05` and `verifyReserveAccounts` call it. All reserve comparisons use `quantizeAtDecimals`, which delegates to PR #221's shared decimal-shift quantizer; positive and negative half-cent, scientific notation, continuity at the same quantum and canonical zero have focused regressions. |
| Verified | The section and types are optional; absence has a validator and conformance case. `RSV-01`–`RSV-07` exist in `validator.ts`, with focused tests and `verify-codes`; the schema, Format §4.28, Protocol §VIII.9.7, protocol/version mirrors, registries, core/browser exports and receipt baselines agree as a proposed 2.19.0 branch. |
| Verified | `reserve-statement-does-not-cure` keeps RFC 0045's `reserve_spending_excluded` refusal at the same pointer. The reserve module has no property-assembly import and no calc pack or collection primitive. Draws only reduce custodial balance; no gross expenditure is altered. `lender_reserve` receives `RSV-02`. Browser entry imports both public functions and the web editor builds. |
| Verified | An unevaluable statement now returns explicit `null` numeric fields and an `unverifiable` verdict; the public type and JSON result agree, with no `NaN` or inferred zero. A focused regression serializes this path. |
| Verified | RFC 0056 escrows remain funding declarations, RFC 0057 renovation remains a budget/draw fact, and RFCs 0062/0063 and their date behavior are not changed by the reserve code. Source block provenance and Tier-2 edit mechanics are untouched. |
| Partially verified | The Golden Deal review establishes two source roles with reserve activity, but public synthetic cases cannot prove every private movement classification or that the statement source is complete. The verifier checks authored arithmetic and continuity, not account custody against a bank or lender record. |
| Unverified | No owner record accepting direct standard-section creation for this evidence was found. A green PR and its earlier `accepted` label were not acceptance; the branch now says `draft`. Live npm trusted-publisher settings and future release contents are outside local gates. |
| Contradicted | The prior branch text said Protocol 2.19.0 was on canonical `main` and RFC 0064 was accepted. Live `main` is at 2.18.0 and the RFC is draft. Those branch claims were corrected. |
| Needs owner decision | Standard `reserve_accounts` now versus an `x_*` statement plus selected companion verifier. The separate [owner review](2026-09-29-rfc-0064-owner-review.md) states C.7's rule, direct-RFC precedent, interoperability cost and evidence limit. No normative merge should occur before that choice. |

Currency-quantum comparison, author-stated closed movement kinds,
`verifyReserveAccounts`, `uwmd validate`, and lender-reserve refusal are
coherent implementation choices for this custodial verifier. They do not
resolve the later draw/expenditure binding or owner-cash treatment.

## Current-base gates

The root lockfile dependencies were installed with `npm ci --ignore-scripts
--offline`; the separate docs and web editor lockfile dependencies were
installed with their `npm --prefix … ci --ignore-scripts --offline` commands.
No dependency or lockfile changed. Results on the rebased branch:

| Gate | Result |
|---|---|
| `npm run build` | Passed. |
| `npm test` | 2,596 passed in 140 files, nine workspaces. |
| `npm run typecheck:tests` | Passed in nine workspaces. |
| `npm run conformance` | 666 pass, 0 fail. |
| `npm run conformance:profiles` | Three passed: 12/64 pass/skipped, 73/3, 76/0. |
| `npm run conformance -- --tier=receipts` | 14 pass, 0 fail. |
| `npm run validate-schemas` | 47 pass, 0 fail. |
| `npm run lint` | 1,186 files checked. |
| `npm run verify-indexes` | Two tests; 48 schema index entries, 63 linked RFCs, 64 frontmatters. |
| `npm run verify-codes` | 228 emitted codes; 23 families, 45 Format bullets, 66 codes across 57 implemented RFCs. The draft RSV family is also pinned by its focused tests and Format bullets. |
| `npm run verify-versions` | 11 manifests, two spec constants, two protocol labels. |
| `npm run verify-packages`, `verify-lockfile`, `verify-release` | Nine packages; three lockfiles and nine workspace links; 20 released changelog sections against 26 tags. |
| `npm --prefix tools/docs-site run build` | 117 files copied; VitePress rendered. |
| `npm run release:check` | Four publishing packages locally OIDC eligible. |
| Browser checks | Built `@uwmd/core/browser` imports both reserve functions; web editor `tsc --noEmit && vite build` passed. |

The web editor build retains Vite's existing `node:crypto` externalization
warning from the core integrity module. It did not fail the build; this audit
does not claim a runtime browser crypto test beyond the import and bundle.
