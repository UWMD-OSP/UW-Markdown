---
rfc: 0066
title: Resolve calc identifiers over variant-map sections the way cross-checks do
status: draft
author: claude-code (agent proposal)
created: 2026-09-28
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0066: Resolve calc identifiers over variant-map sections the way cross-checks do

**Draft agent proposal.** StackUW's engine-exported document and UPSTREAM-016
are adopter requirements evidence, not UWMD owner authorship or acceptance.
The owner has not accepted this RFC or authorized implementation. Keep this
correctness issue high in the next queue after the current release/reserve work.

## Summary

Protocol §VIII.2 says a calc identifier maps to "`sections.<id>` (the canonical
block's `content`)" and says nothing about a section present as a variant map.
The reference evaluator fills the gap by falling through to the period-reference
resolver, which applies RFC 0040's generic order — and when that order finds no
answer, the evaluator swallows the refusal and the identifier becomes `null`,
so a pack metric over a two-tranche `debt_structure` reports `ok: true,
value: null` with no diagnostic. This RFC makes §VIII.2 say what the evaluator
should do: resolve a variant map by the caller's explicit variant, then a
declared role preference, then RFC 0040's generic order; and when nothing
resolves, refuse with a new `CALC-RESOLVE-002` instead of returning `null`.
Packs gain an optional `section_roles` declaration so a metric can say it means
the senior loan. Additive for single-block documents; a correction for
multi-block ones.

## Motivation

Measured on `main` at `3a51cdfee` (2026-09-28), every path below by file and
line.

- **The spec is silent.** `spec/UW_PROTOCOL_v1.md` §VIII.2 (lines 1271–1282)
  resolves a top-level identifier to `frontmatter.<id>`, then `sections.<id>`
  "(the canonical block's `content`)", then `prior_results.<id>`, and says a
  missing path is `null`. A variant map (format §2.8) has no canonical block.
  §VIII.2a "Section context" (lines 1339–1348) does specify a resolution — the
  caller's `CalcEvaluationContext.sectionVariants[section]` with no fallback,
  otherwise RFC 0040's generic primary/default/base/sole selection excluding
  components and invalid roles, otherwise `CALC-PERIOD-003` — but only for
  **period references** (`series@selector`), not for ordinary identifiers.
- **The evaluator falls through, then swallows.** `resolveIdentifier`
  (`packages/uwmd-core/src/calc/evaluator.ts:240–276`) calls `getSection`
  (line 252; `parser.ts:512–517` returns `null` for a multi-variant map), then
  `periodSection(ctx.parsed, name, ctx)` (line 255) inside a `try` whose
  `catch` sets the section to `null` (lines 254–258), then `prior_results`,
  then `null`. `periodSection` (`period-path.ts:14–29`) honors an explicit
  `sectionVariants` entry and otherwise calls `resolveRoleBlock`
  (`block-roles.ts:18–60`, the RFC 0040 resolver shared with the validator),
  throwing `CALC-PERIOD-003` when the map is unresolvable. The throw is what
  the `catch` discards.
- **Measured results** for `debt_structure.loan_amount / 2` over a
  `student_housing` document (the same probe is the proposed conformance
  fixture set):
  - two blocks with `_role: primary` (6,000,000) and `_role: junior` — resolves
    the primary: `3,000,000`;
  - `variant=default` (6,000,000) with `_role: senior` and `variant=mezzanine`
    with `_role: junior` — resolves `default`: `3,000,000`;
  - `_role: senior` and `_role: junior`, no primary, no `default`/`base` (the
    shape of `conformance/tier-1-reader/fixtures/10-declared-roles.uwx.md:106–141`)
    — **`ok: true`, `value: null`, `display: "n/a"`**;
  - the same document with `sectionVariants: { debt_structure: 'producer-mezz' }`
    supplied programmatically — resolves the junior block: `500,000`. The CLI
    cannot supply that context: `--calc-context` rejects a `sectionVariants`
    key for any section that is not a registered period series
    (`calculation-context.ts:37–42`).
- **Only role-bearing blocks survive as a map.** The parser builds a variant map
  for `MULTI_VARIANT_SECTIONS` (`parser.ts:219–226`: `operating_statement`,
  `stress_tests`, `due_diligence`, `lease_up_schedule`, `cash_flow_series`,
  `distribution_waterfall`) and for any section whose active blocks carry
  `_role` (RFC 0040's Markdown opt-in; `parser.ts:372–378`, `:449–477`). A
  second `debt_structure` block **without** `_role` is routed by §2.7 update
  semantics: measured, `variant=senior` stayed current, `variant=mezzanine`
  landed in `parsed.superseded.debt_structure`, and `debt_structure.loan_amount`
  evaluated to the senior figure with no diagnostic. That routing is RFC 0040's
  decision and is out of scope here; it is recorded so producers know that two
  concurrent debt blocks must carry roles to be two blocks at all.
- **The consequence.** On a role-bearing two-tranche `debt_structure` with no
  `primary`, the student pack's `ltv`, `ltc`, `dscr`, `debt_yield`,
  `loan_per_bed` and `cash_on_cash` all report `ok: true, value: null`. StackUW
  measured this on an engine-exported document on 2026-09-28: of the pack's
  fourteen metrics, three evaluated (its app-side note UPSTREAM-016). A null
  that means "the evaluator declined to choose a block" is indistinguishable
  from a null that means "the field is not stated", which is the same failure
  RFC 0037 corrected for cross-checks with coverage and `CC-16`.
- **There is no `absent`.** `CalcResult` (`protocol.ts:1065–1084`) carries
  `ok`, `value`, `unit`, `round_to`, `display` and `error`; it has no skip
  reason. `variant_unresolvable` is a `CrossCheckSkipReason` in validation
  coverage (format §5.3, lines 3230–3239), not a calc concept. The calc analog
  of a skip is a `CalcError` (§VIII.6, lines 1614–1634), where
  `CALC-RESOLVE-001` ("Identifier could not be resolved") already exists but
  is thrown only for an unknown function name (`evaluator.ts:169`).

## Proposed change

### Protocol §VIII.2 (normative)

Insert after the bullet "then `sections.<id>` (the canonical block's
`content`)" at `spec/UW_PROTOCOL_v1.md:1278`:

> When `sections.<id>` is a **variant map** (format §2.8, or any section a
> UW JSON envelope carries as more than one block), the evaluator MUST select
> one block by this order, excluding blocks whose `_role` is `component` or
> invalid before every step (RFC 0040):
>
> 1. The caller's `CalcEvaluationContext.sectionVariants[<id>]`, when
>    supplied: exactly that variant, with no fallback. A requested variant
>    that is not present is `CALC-RESOLVE-002`.
> 2. The caller's `CalcEvaluationContext.sectionRoles[<id>]`, when supplied:
>    the unique eligible block carrying that `_role`. Two blocks carrying it
>    is `CALC-RESOLVE-002`, without fallback.
> 3. RFC 0040's generic order: the unique `primary`, then the `default`
>    variant, then `base`, then the sole eligible variant. A `primary`
>    collision is `CALC-RESOLVE-002`, without fallback.
> 4. Otherwise `CALC-RESOLVE-002`. The result is `ok: false`; the identifier
>    MUST NOT resolve to `null`, and the message MUST name the section and the
>    variants found.
>
> A missing section remains `null` (a missing path is not an ambiguity). The
> evaluator MUST NOT choose by fence order, sum blocks, or infer from amounts,
> producer key names or labels. A standalone block is unchanged by this rule.

Add to the §VIII.6 taxonomy table:

| Code | Meaning |
|---|---|
| `CALC-RESOLVE-002` | An identifier names a section present as a variant map and no variant resolves under §VIII.2, or an explicitly requested variant or role is absent or ambiguous. |

Amend §VIII.2a "Section context" (line 1341) to read "as §VIII.2 specifies for
every section-rooted identifier"; its `CALC-PERIOD-003` for a failed
**period-reference** selection is unchanged.

### Module manifest (Protocol §X, normative, additive)

`ModuleManifest` (`packages/uwmd-core/src/protocol.ts:1103–1140`) gains an
optional `section_roles?: Readonly<Record<string, BlockRole>>` — the role a
host MUST supply as `sectionRoles` when it evaluates this manifest's
`calculations`. `spec/schemas/module-manifest.schema.json` (top level is
`additionalProperties: false`, line 19) gains the matching property in
lockstep. A calculation that reads a section named in `section_roles` SHOULD
say so in its `label` or description. The nine canonical packs whose metrics
read `debt_structure.loan_amount` and `debt_structure.annual_debt_service`
(`ltv`, `ltc`, `dscr`, `debt_yield`, `loan_per_*`, `cash_on_cash`) declare
`section_roles: { debt_structure: 'senior' }`, which is the preference
`CROSS_CHECK_ROLE_PREFERENCE` already registers for CC-02/03/05/09
(`protocol.ts:2072–2078`) — the loan a lender's LTV and DSCR describe.

### `@uwmd/core` (additive)

- `CalcEvaluationContext` (`protocol.ts:1040–1063`) gains
  `sectionRoles?: Readonly<Record<string, BlockRole>>`; the doc comment on
  `sectionVariants` drops "for period references only".
- `resolveIdentifier` resolves a variant map through the shared
  `resolveRoleBlock` (`block-roles.ts`) with the context's variant and role
  preferences, and lets its refusal surface as `CALC-RESOLVE-002` instead of
  catching it. `periodSection` keeps throwing `CALC-PERIOD-003` for period
  references.
- `CalcErrorCode` (`calc/errors.ts:6–`) gains `'CALC-RESOLVE-002'`.
- `parseCalculationContext` (`calculation-context.ts:22–`) accepts
  `sectionVariants` for any section and accepts `sectionRoles` (values from
  `BLOCK_ROLES`), so the CLI's `--calc-context` can express both.
- `evaluateCalc`'s signature is unchanged. Hosts that evaluate a manifest's
  calculations pass `manifest.section_roles` as `ctx.sectionRoles`; the
  reference CLI and `uwmd-excel` do so where they already hold the manifest.

## Compatibility analysis

- **Existing `.uw.md` files** — none change and none become invalid.
- **Tier-1 Reader / Tier-2 Editor** — unaffected.
- **Tier-3 Calc Host** — a single-block section resolves exactly as today. A
  variant map that resolves under RFC 0040's generic order today (the first two
  measured cases) keeps the same value. A variant map that is unresolvable
  today moves from `ok: true, value: null` to `ok: false` with
  `CALC-RESOLVE-002`: that is the intended correction, and it changes behavior
  only on a path §VIII.2 never specified. A host that displayed "n/a" for
  those metrics now displays a refusal naming the variants. Receipts (RFC 0016)
  over such a document re-issue with the refusal. The only corpus documents
  carrying `_role` are `conformance/tier-1-reader/fixtures/10–12-*.uwx.md` and
  `conformance/lease-up-projection/component/deal.uwx.md` (a component-role
  case); none has a tier-3 or receipt case, so no frozen baseline moves. The
  `conformance/hedge/*/deal.uwx.md` documents state `debt_structure` under a
  `variant=` key with no `_role`, so they parse as a single block (§2.7
  routing) and are unaffected.
- **Tier-4 Agent Host** — none.
- **Modules** — `section_roles` is optional; a manifest without it validates
  and resolves as today. The manifest schema change is additive.
- **Excel** — `emitExcelFormula` is path-based and unchanged. `toWorkbook`'s
  `sectionContent` (`packages/uwmd-excel/src/toWorkbook.ts:72–75`) currently
  reads one block through `getSection`, so named inputs from a variant map can
  diverge from the corrected calc result. Before acceptance, pin the same
  selection or refusal behavior for workbook input extraction and the
  evaluator, including explicit variant, role preference and generic fallback.
  Implementation must carry Excel ↔ calc-engine parity to six decimals in the
  same release scope; deferring workbook behavior while changing pack results
  would break the repository's parity invariant.

No deprecation path is needed.

## Conformance impact

Existing fixtures:

- `conformance/cash-flow/calc-missing-variant/` is an RFC 0034 **declaration**
  case: `decl.json` requests `variant: "upside"` on a `cash_flow_series` that
  has only `base`, and `expected.json` expects `ok: false`,
  `error_code: CALC-CF-SERIES`. It is not an identifier-resolution case, does
  not encode `absent`, and is unchanged.
- `conformance/tier-3-calc-host/fixtures/period-0*` exercise §VIII.2a on
  multi-variant series and are unchanged.

New tier-3 fixtures, one `calc.json` each in the existing
`deal.uwx.md` / `calc.json` / `expected-result.json` layout, plus an optional
`calc-context.json` that both runners pass as `--calc-context` when present
(the CLI already accepts the flag, `cli.ts:1109–1125`; the TypeScript runner
`scripts/run-conformance.mjs:569–616` and the RFC 0004 case generator learn to
read it). All use two `debt_structure` blocks in the shape of
`10-declared-roles.uwx.md:106–141` and the formula
`debt_structure.loan_amount / valuation.purchase_price`:

| Scenario | Blocks | Context | Expected |
|---|---|---|---|
| `variant-01-primary-resolves` | `_role: primary` 6,000,000; `_role: junior` 1,000,000 | none | `ok: true`, the primary's ratio |
| `variant-02-default-resolves` | `variant=default` `_role: senior`; `variant=mezzanine` `_role: junior` | none | `ok: true`, the default's ratio |
| `variant-03-unresolvable` | `_role: senior`; `_role: junior` | none | `ok: false`, `error.code: CALC-RESOLVE-002` (today `ok: true, value: null`) |
| `variant-04-role-preference` | as 03 | `{ "sectionRoles": { "debt_structure": "senior" } }` | `ok: true`, the senior's ratio |
| `variant-05-explicit-variant` | as 03 | `{ "sectionVariants": { "debt_structure": "producer-mezz" } }` | `ok: true`, the junior's ratio (today the CLI rejects this context) |
| `variant-06-missing-section` | no `debt_structure` | none | `ok: true`, `value: null` (unchanged rule, pinned) |

## Reference implementation

- **Files affected:** `spec/UW_PROTOCOL_v1.md` (§VIII.2, §VIII.2a, §VIII.6);
  `spec/schemas/module-manifest.schema.json`; `packages/uwmd-core/src/protocol.ts`
  (`CalcEvaluationContext.sectionRoles`, `ModuleManifest.section_roles`);
  `packages/uwmd-core/src/calc/errors.ts`; `packages/uwmd-core/src/calc/evaluator.ts`
  (`resolveIdentifier`); `packages/uwmd-core/src/calculation-context.ts`;
  `packages/uwmd-core/src/packs/*.ts` (`section_roles` on the packs that read
  `debt_structure`); `packages/uwmd-core/src/cli.ts` (pass a pack's
  `section_roles` when evaluating a pack); `packages/uwmd-excel/src/toWorkbook.ts`
  (the same role-aware input selection and refusal); `scripts/run-conformance.mjs` and
  `scripts/gen-conformance-cases.mjs` (optional `calc-context.json`);
  `conformance/runner/runner.py` needs no change (it passes `args` through);
  the six fixtures above; `docs/wiki/05-calc-packs.md` (the `section_roles`
  field and what `null` versus `CALC-RESOLVE-002` means).
- **API surface:** `CalcEvaluationContext.sectionRoles?`,
  `ModuleManifest.section_roles?`, `CalcErrorCode` gains
  `'CALC-RESOLVE-002'`. No new functions; `resolveRoleBlock` stays the single
  resolver so the validator, the period path and the evaluator cannot drift.
- **Test plan:** `calc/calc.test.ts` cases mirroring the six fixtures;
  `calculation-context.test.ts` for the widened `sectionVariants` and new
  `sectionRoles`; `packs.test.ts` asserting every pack that reads
  `debt_structure` declares `section_roles.debt_structure = 'senior'`;
  workbook parity/refusal cases for resolvable and unresolvable role maps;
  `npm run validate-schemas` over the manifest schema; `npm run conformance`
  and `python conformance/runner/runner.py --tier 3` green with the new cases;
  `npm run verify-codes` unaffected (the `CALC-*` family is registered).

The reference implementation lands with this RFC or in a linked follow-up PR.

## Alternatives considered

- **Require producers to emit a single `debt_structure` block.** Contradicts
  RFC 0026's typed capital stack and RFC 0040, which registers a `senior`
  preference on `debt_structure` precisely because two debt blocks are
  expected. It also misstates a mezzanine tranche as not existing.
- **Let a formula name the variant key** (`debt_structure.senior.loan_amount`).
  Couples packs to producers' key names, which RFC 0040 replaced with roles;
  and a key segment is indistinguishable from a field name in the grammar.
- **Keep the silent `null`.** A metric that reads nothing and a metric whose
  section the evaluator declined to choose would remain the same result; RFC
  0037 rejected exactly this for cross-checks.
- **Sum the tranches.** RFC 0040: never sum multiple seniors or guess from
  amounts. Total debt is a different metric a pack can declare explicitly over
  `capital_stack` (RFC 0026).
- **Reuse `CALC-PERIOD-003`.** It would file a non-period failure under the
  period family; adopters filter by prefix (§III.6a). A `RESOLVE` code says
  what happened.
- **Unwrap the map to its first block** (fence order). That is what §2.7
  routing does for role-free blocks and is the failure RFC 0040's opt-in was
  written to prevent; making it the calc rule would reintroduce it for the
  role-bearing case.

## Unresolved questions

- Whether `CALC-PERIOD-003`'s selection failure should be folded into
  `CALC-RESOLVE-002` so one code covers "could not choose a block" everywhere.
  This RFC leaves the period code alone to keep RFC 0041 fixtures frozen.
- Whether `section_roles` should also be declarable per calculation
  (`ModuleCalcDecl`) for a pack that wants total debt in one metric and senior
  debt in another. This RFC starts at the manifest level, where the
  cross-check table already lives.
- Whether the parser's RFC 0040 Markdown opt-in should widen so a keyed second
  `debt_structure` block without `_role` is retained rather than superseded.
  Out of scope: that is a format routing decision, and this RFC only makes
  the evaluator honest about the maps that do exist.

## Prior art

- RFC 0037 (cross-check resolution over variant maps, and coverage) and RFC
  0040 (variant roles) — the order this RFC adopts and the shared resolver it
  reuses.
- RFC 0041 §VIII.2a "Section context" — the same rule, already normative for
  period references; this RFC generalizes it to every section-rooted
  identifier.
- RFC 0034's `CALC-CF-SERIES` — a missing explicitly requested variant is a
  refusal, not a `null`, for cash-flow declarations.
