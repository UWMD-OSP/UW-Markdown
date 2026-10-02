---
rfc: 0066
title: Resolve calc identifiers over variant-map sections the way cross-checks do
status: implemented
author: claude-code (agent proposal)
created: 2026-09-28
accepted: 2026-10-02
implemented: 2026-10-02
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0066: Resolve calc identifiers over variant-map sections the way cross-checks do

**Implemented; released in 2.15.0.** On 2026-10-02 Jared made three owner
decisions:

- **D1.** Protocol §VIII.2a's section-context rule becomes normative for every
  section-rooted identifier, with refusal as a new `CALC-RESOLVE-002`.
- **D2.** The built-in lender-side debt metrics declare a per-calculation
  `senior` preference. `cash_on_cash` declares none and refuses on a
  multi-tranche map.
- **D3.** Implementation is authorized on a separate branch. The release
  target is core/CLI **2.15.0** with Protocol **2.19.0**.

Every other rule in the accepted contract follows from D1 and D2 under existing
precedent. Those rules are listed under
[Consequences of D1 and D2](#independent-verification-and-owner-decision-set-2026-10-02);
none is a separate owner decision.

**Released in core/CLI 2.15.0 with Protocol 2.19.0.** PR #234 merged the
implementation once the [merge conditions](#merge-readiness) held. The
`v2.15.0` tag on release commit `aaa9ec3` published it on 2026-10-02.

A coding agent wrote this RFC. StackUW's engine-exported documents and its
app-side note UPSTREAM-016 are adopter requirements evidence, not UWMD owner
authorship. Where the original proposal below differs from the accepted
decision set, the decision set and Protocol §VIII.2 govern. See
[Decision status](#decision-status).

## Summary

Protocol §VIII.2 says a calc identifier maps to "`sections.<id>` (the
canonical block's `content`)" and says nothing about a section present as a
variant map. The reference evaluator fills the gap by falling through to the
period-reference section resolver, which applies an explicit `sectionVariants`
entry or RFC 0040's generic order. When neither selects a block, the evaluator
swallows the refusal and the identifier becomes `null`. A pack metric over a
role-bearing two-tranche `debt_structure` with no `primary` therefore reports
`ok: true, value: null` with no diagnostic, exactly as if the loan were not
stated.

This draft proposes that §VIII.2 distinguish three cases:

- **Missing section.** Unchanged: a missing path is `null`.
- **Present, resolvable variant map.** Select one block deterministically: the
  caller's explicit variant, then a declared role preference, then RFC 0040's
  generic order, through the existing resolver.
- **Present, unresolvable variant map.** Refuse, proposed as
  `CALC-RESOLVE-002`, instead of returning `null`.

It also proposes a way for a pack to declare a role preference, so a metric
can say it means the senior loan. Whether that declaration belongs on the
manifest or on each calculation is unresolved. Any implementation must change
Excel workbook input extraction in the same change, so the workbook and the
evaluator never select different blocks.

## Independent verification and owner decision set (2026-10-02)

A second agent session re-checked this diagnosis on `main` at `6ad146a`, the
2.14.0 candidate. Everything was checked against built code, not prose. The
draft status is unchanged.

**Every code claim below reproduces.** Over `10-declared-roles.uwx.md` and its
variants, three readers disagree:

- **Evaluator.** It returns `ok: true, value: null` for an unresolvable map, for
  a `primary` collision and for an absent explicit variant. It resolves the
  `primary`, `default` and explicit cases.
- **Cascade.** `resolveValue` returns the **first fence's** value in every case,
  including the `primary` collision. Fence order wins at two places: in
  `findBySource`, which scans every variant for an in-file tag, and in
  `getBlock`.
- **Excel.** For a resolvable `primary` + `junior` map with a 10,000,000
  purchase price, `evaluateCalc` reports the multifamily `ltv` as `0.6`, but the
  workbook's Loan Amount input is blank. The sheet's
  `ROUND((loan_amount/purchase_price),6)` therefore yields 0. Exact parity is
  broken even when calc resolves. This predates 2.14.0; standalone Excel is
  unpublished.

**Adopter scale (de-identified).** StackUW's 11 canonical engine exports were
measured under core 2.7.0 and the 2.14.0 candidate:

- Every one states `debt_structure` as a `senior` + `junior` role map, and one
  states two `senior` blocks.
- The validator already selects the senior block by role for CC-02/03/05/09,
  and refuses the two-senior deal with CC-16.
- Every built-in pack returns `null` for `ltv`, `ltc`, `dscr`, `debt_yield`,
  `loan_per_*` and `cash_on_cash` on all 11.
- The adopter's own conformance adapter flattens ordinary identifiers to the
  last fence. That makes four selection rules in the ecosystem today.

**What existing normative precedent already settles.** These need owner
acceptance only because they are normative text, not because they are open
choices:

1. **The order.** Protocol §VIII.2a "Section context" (RFC 0041) already
   specifies the selection for a present, section-rooted read:
   - the explicit `sectionVariants` entry, with no fallback, where a component
     is allowed and an invalid role is not;
   - then RFC 0040's generic primary/default/base/sole order over eligible
     blocks;
   - otherwise refuse;
   - a missing section stays `null`.

   Applying that same rule to ordinary identifiers adds no new semantics.
   `periodSection` already implements it, and the evaluator already calls it.
   It only discards the refusal.
2. **Ambiguity is not absence.** RFC 0037 (CC-16 and `variant_unresolvable`)
   and RFC 0040 ("refuse resolution immediately", "never sum … or guess from
   amounts or producer names") already require refusal.
3. **Excel's refusal semantics.** Protocol §VIII.2c (RFC 0043) already says
   custom-calculation ordinary inputs "use calc resolution". It also says
   unresolvable selections raise, and that invalid identity sets yield
   `#VALUE!`, "never coerced zero".
4. **The cascade's refusal shape.** `AmbiguousInheritanceError` (RFC 0021 §5)
   is the cascade's existing precedent for refusing instead of choosing.
5. **One resolver.** `resolveRoleBlock` stays the only selection
   implementation.

**Genuine owner decisions (the smallest set):**

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Make §VIII.2a's section-context rule normative for every section-rooted identifier, with refusal as a new `CALC-RESOLVE-002` | **Yes, new code** | `CALC-PERIOD-003` would file a non-period failure under the period family. A new code also keeps every RFC 0041 fixture frozen. |
| D2 | When `debt_structure` is a role-bearing map, the built-in **lender-side** metrics mean the **`senior`** block. These are `ltv`, `ltc`, `dscr`, `debt_yield` and `loan_per_*`, 46 declarations across ten packs. Each declares it **per calculation** as `section_roles: { debt_structure: "senior" }`. **`cash_on_cash` declares no role**, so on a multi-tranche map it refuses. | **Yes, per calculation; exclude `cash_on_cash`** | The lender-side metrics mirror the validator's registered `senior` preference for CC-02/03/05/09 without inheriting it implicitly, which RFC 0041 forbids. The evaluator reads the role from the declaration, so no host can forget to pass it. `cash_on_cash` is `(NOI − debt_structure.annual_debt_service) / equity`. Equity cash flow must deduct **all** debt service, so a senior-only figure would overstate the return whenever mezzanine debt exists. It stays refused until a total-debt-service input is contracted, over `capital_stack` (RFC 0026), never by summing blocks. Without D2, D1 alone turns every adopter debt metric from a silent `null` into a `CALC-RESOLVE-002` refusal: honest, but still uncomputed. |

**Consequences of D1 and D2.** These rules are derived from existing precedent
(cited where it applies). The owner did not decide them separately; the owner
may still revisit any of them:

- **Precedence.** This follows from D1's order. An explicit `sectionVariants`
  beats a declared role, which beats the generic order. If no eligible block
  carries the declared role, the generic order applies, as `resolveRoleBlock`
  already does for cross-checks (RFC 0040). If two blocks carry it, the read
  refuses (RFC 0040).
- **No caller `sectionRoles`.** D2 places the preference on the declaration.
  A caller already has `sectionVariants` for ad hoc formulas.
- **Period references are unchanged.** D1 extends §VIII.2a to ordinary
  identifiers; it does not amend §VIII.2a.
- **`--calc-context`.** It accepts `sectionVariants` for any section id,
  because under D1 that context applies to every section-rooted read.
- **Excel standard sheets.** These follow from the parity invariant and
  §VIII.2c (ordinary inputs "use calc resolution"; an invalid identity yields
  `#VALUE!`, "never coerced zero"). They resolve each section's named inputs through
  the same resolver, using the role the pack's calculations declare for that
  section. A refused input is written as an explicit `#VALUE!` cell (§VIII.2c's
  invalid-identity value), never blank. Dependent metrics therefore show an
  error exactly where calc reports `ok: false`, and every other metric keeps
  exact parity.
- **Excel custom sheets.** These raise the refusal, as unresolvable period
  selections already do (§VIII.2c).
- **Disagreeing calculations.** If two calculations in one pack declare
  different roles for the same section, the workbook and the refinement ranker
  refuse rather than choose. Each holds one value per path, and RFC 0040
  forbids guessing.
- **Cascade.** `resolveValue` resolves in-file steps 1–2 against the selected
  block only, and throws for an unresolvable map, following the cascade's own
  refusal precedent (`AmbiguousInheritanceError`, RFC 0021 §5). Refinement
  selects under its targets' declared roles and reports each excluded target,
  mirroring §VIII.2b's `period_inputs`.
- **Payload.** Every consumer reads the selected block's payload the way
  §VIII.2 defines it, through `blockPayload`. That comes from the separate
  payload-unwrapping fix this branch is rebased on; it is not part of RFC 0066's
  contract.
- **Receipts.** Over an unresolvable map, issuance changes from
  `computed: false` to `RCP_COMPUTATION_FAILED`. That is the existing receipt
  rule (RFC 0016) applied to D1's refusal.

## Motivation

Re-measured on `main` at `a961110` (2026-10-01). References name files and
symbols rather than line numbers.

- **The spec is silent.** Protocol §VIII.2 "Variable resolution" resolves a
  top-level identifier to `frontmatter.<id>`, then `sections.<id>` "(the
  canonical block's `content`)", then `prior_results.<id>`, and says a missing
  path is `null`. A variant map (format §2.8) has no canonical block. The
  "Section context" paragraph of Protocol §VIII.2a (RFC 0041) does specify a
  selection, but only for **period references** (`series@selector`), not for
  ordinary identifiers:
  - the caller's `CalcEvaluationContext.sectionVariants[section]`, with no
    fallback; an explicitly selected component is allowed, an invalid role is
    not;
  - otherwise RFC 0040's generic primary/default/base/sole selection, excluding
    components and invalid roles, with no check-specific role preference;
  - otherwise `CALC-PERIOD-003`.
- **The evaluator falls through, then swallows.** `resolveIdentifier`
  (`packages/uwmd-core/src/calc/evaluator.ts`) calls `getSection`
  (`parser.ts`), which returns `null` for any variant map. It then calls
  `periodSection(ctx.parsed, name, ctx)` (`period-path.ts`) inside a `try`
  whose `catch` sets the section to `null`, then tries `prior_results`, then
  returns `null`. `periodSection` honors an explicit `sectionVariants` entry
  and otherwise calls `resolveRoleBlock` (`block-roles.ts`), the RFC 0040
  resolver the validator also uses. It throws `CALC-PERIOD-003` when the map is
  unresolvable or a requested variant is missing, and the `catch` discards the
  throw.
- **Measured results.** The probe is `debt_structure.loan_amount / 2` over the
  two `debt_structure` blocks of
  `conformance/tier-1-reader/fixtures/10-declared-roles.uwx.md`
  (`variant=producer-senior`, `_role: senior`, 6,000,000;
  `variant=producer-mezz`, `_role: junior`, 1,000,000), varied as listed:
  - first block re-roled `primary`: resolves it, `3,000,000`;
  - keys changed to `default` (senior) and `mezzanine` (junior): resolves
    `default`, `3,000,000`;
  - as stated (senior and junior; no `primary`, `default` or `base`):
    **`ok: true`, `value: null`, `display: "n/a"`**;
  - both blocks re-roled `primary`, a collision RFC 0040 refuses:
    **`ok: true`, `value: null`**;
  - `sectionVariants: { debt_structure: 'producer-mezz' }` supplied
    programmatically: resolves the junior block, `500,000`;
  - `sectionVariants: { debt_structure: 'nope' }`, a variant that is not
    present: **`ok: true`, `value: null`**;
  - the same explicit selection of a block re-roled `component`: resolves it,
    `500,000`, as §VIII.2a allows.

  The CLI cannot supply either context. `parseCalculationContext`
  (`calculation-context.ts`), which backs `--calc-context`, accepts only
  `sectionVariants` and `overrides`. It rejects a `sectionVariants` key for any
  section that does not head a registered `PERIOD_SERIES` entry, and
  `debt_structure` heads none.
- **Only keyed, role-bearing blocks survive as a map.** The parser builds a
  variant map for `MULTI_VARIANT_SECTIONS` (`operating_statement`,
  `stress_tests`, `due_diligence`, `lease_up_schedule`, `cash_flow_series`,
  `distribution_waterfall`). Under RFC 0040's Markdown opt-in it also builds one
  for a section in which some active block carries `_role` and some active block
  carries a `variant=` key. Other repeated blocks follow §2.7 update semantics.
  Measured:
  - two keyed `debt_structure` blocks without `_role` (`senior`, `mezzanine`)
    leave `senior` current and put `mezzanine` in
    `parsed.superseded.debt_structure`;
  - two `_role` blocks without `variant=` keys leave one current and supersede
    the other.

  In both cases `debt_structure.loan_amount` evaluates to the current block
  with no diagnostic. That routing is RFC 0040's decision and is out of scope
  here. It is recorded so producers know that two concurrent debt blocks must
  carry both roles and keys to be two blocks at all.
- **The consequence.** On the role-bearing two-tranche shape above, the
  metrics that read `debt_structure` in all ten built-in packs in
  `PACK_REGISTRY` (`packs/index.ts`) report `ok: true, value: null`. Those
  metrics are `ltv`, `ltc`, `dscr`, `debt_yield`, `loan_per_*` and
  `cash_on_cash`, as each pack declares them. StackUW reported the same on an
  engine-exported document on 2026-09-28: three of the student-housing pack's
  fourteen metrics evaluated (its note UPSTREAM-016). That figure is adopter
  evidence and was not reproduced here. A null that means "the evaluator
  declined to choose a block" is indistinguishable from one that means "the
  field is not stated". RFC 0037 corrected the same failure for cross-checks
  with coverage and `CC-16`.
- **Consumers inherit the ambiguity.** `computeReceiptResults` (`receipts.ts`)
  treats an `ok: true, value: null` result as an uncomputed output and issues
  the receipt with `computed: false`. A receipt over such a document therefore
  records an ambiguity as absent input.
- **Other readers use other rules.** `getBlock` in `cascade.ts` backs
  `resolveValue`, which the refinement ranker (`uwmd refine`) uses for ordinary
  field reads. For a variant map it returns the first variant in map order,
  which is fence order. Measured: over the stated senior and junior blocks,
  `resolveValue('debt_structure.loan_amount', …)` returns 6,000,000. With the two
  fences swapped it returns 1,000,000. `uwmd-excel` reads through `getSection`
  and gets no block at all (see [Excel parity](#excel-parity-hard-requirement)).
  The evaluator, the cascade and the workbook therefore apply three different
  selection rules to the same map today.
- **There is no `absent` in calc results.** `CalcResult` (`protocol.ts`)
  carries `calc_id`, `ok`, `value`, `unit`, `round_to`, `display` and `error`;
  it has no skip reason. `variant_unresolvable` is a `CrossCheckSkipReason` in
  validation coverage (format §5.3), not a calc concept. The calc analog of a
  skip is a `CalcError` (Protocol §VIII.6). There, `CALC-RESOLVE-001`
  ("Identifier could not be resolved") already exists, but the evaluator raises
  it only for an unknown function name.

## Proposed change

This is the original proposal, kept for the record. The accepted contract is the
2026-10-02 decision set and Protocol §VIII.2. Where they differ, they govern:

- `cash_on_cash` takes no role.
- There is no caller `sectionRoles`.
- `sectionVariants` also applies to a standalone block.

### Protocol §VIII.2 (normative, proposed)

Insert after the §VIII.2 bullet "then `sections.<id>` (the canonical block's
`content`)":

> When `sections.<id>` is a **variant map** (format §2.8, or any section a
> UW JSON envelope carries as more than one block), the evaluator MUST select
> one block by this order:
>
> 1. The caller's `CalcEvaluationContext.sectionVariants[<id>]`, when
>    supplied: exactly that variant, with no fallback. As in §VIII.2a, an
>    explicitly selected component is allowed and an invalid role is not. A
>    requested variant that is absent, or that carries an invalid role, is
>    `CALC-RESOLVE-002`.
> 2. A declared role preference for `<id>`, when one applies: the unique
>    eligible block carrying that `_role`. Two eligible blocks carrying it is
>    `CALC-RESOLVE-002`, without fallback. No eligible block carrying it
>    continues to step 3.
> 3. RFC 0040's generic order: the unique `primary`, then the `default`
>    variant, then `base`, then the sole eligible variant. A `primary`
>    collision is `CALC-RESOLVE-002`, without fallback.
> 4. Otherwise `CALC-RESOLVE-002`.
>
> Blocks whose `_role` is `component` or invalid are excluded before steps 2–4
> (RFC 0040). A `CALC-RESOLVE-002` result is `ok: false`. The identifier MUST
> NOT resolve to `null`, and the message MUST name the section and the variants
> found. A missing section remains `null`: a missing path is not an ambiguity.
> The evaluator MUST NOT choose by fence order, sum blocks, or infer from
> amounts, producer key names or labels. A standalone block is unchanged by
> this rule.

Steps 2–4 are the order `resolveRoleBlock` already applies after a
cross-check's registered role preference. Step 1 is §VIII.2a's explicit
selection. Step 2's fall-through when no block carries the declared role
matches what `resolveRoleBlock` does today; whether a declared preference
should instead refuse is an open question.

Add to the §VIII.6 taxonomy table:

| Code | Meaning |
|---|---|
| `CALC-RESOLVE-002` | An identifier names a section present as a variant map and no block resolves under §VIII.2: a requested variant is absent or carries an invalid role, a declared role or `primary` is claimed by more than one eligible block, or no generic rule selects a block. |

The code's name and meaning are proposals. `CALC-PERIOD-003` keeps its current
scope: a failed **period-reference** selection under §VIII.2a. §VIII.2a would
gain a cross-reference to §VIII.2 for ordinary identifiers. Its period-reference
rules, including "no check-specific role preference", are unchanged by this
draft.

### Declaring a role preference (layer unresolved)

A pack metric such as LTV or DSCR describes one loan. On a two-tranche
`debt_structure` with no `primary`, the generic order refuses, so a pack needs a
way to say which role it means.

RFC 0041 says the calc side must never inherit a validator check's senior or
detail preference, so the pack has to state the role itself.
`CROSS_CHECK_ROLE_PREFERENCE` (`protocol.ts`) registers `senior` on
`debt_structure` for CC-02, CC-03, CC-05 and CC-09. That is precedent for the
choice, not a table the evaluator would read.

Two layers are possible:

| | A. Manifest level | B. Per calculation |
|---|---|---|
| Shape | `ModuleManifest.section_roles?: Readonly<Record<string, BlockRole>>` | `ModuleCalcDecl.section_roles?: Readonly<Record<string, BlockRole>>` |
| Route to the evaluator | Each host that evaluates the manifest's calculations copies it into a context field (`CalcEvaluationContext.sectionRoles`). | `evaluateCalc(decl, ctx)` already receives the declaration and can read it directly. |
| Different roles in one pack | Not possible. One role per section applies to every calculation in the manifest, including calculations added later. | Each calculation states its own role. |
| Repetition | One entry per pack. | Repeated on each debt-reading metric (six in most packs today). |
| Schema | The top level of `spec/schemas/module-manifest.schema.json` (`additionalProperties: false`) gains a property. | The `calculations` item schema (`additionalProperties: false`) gains a property. |

Repository evidence:

- **Precedent is keyed per rule.** `CROSS_CHECK_ROLE_PREFERENCE` is keyed by
  check code. It is not keyed per validator or per pack.
- **Many hosts evaluate pack calculations.** Each builds its own
  `CalcEvaluationContext` for `evaluateCalc`:
  - `computeReceiptResults` (`receipts.ts`);
  - `module-runtime.ts`;
  - the web editor's `CalcDashboard` and `CalcDetail`;
  - `uwmd-excel` (`toWorkbook.ts` and `layout.ts`).

  The refinement ranker (`refinement.ts`, reached through `uwmd refine`) reads
  pack inputs through `cascade.ts` instead, so under either layer it would need
  to be routed through the same resolver.

  Under option A, each host must remember to pass the manifest's preference,
  and one that does not would select differently from the rest. Under option B,
  every host that calls `evaluateCalc` with the declaration gets the same
  selection. That is the property the Excel parity requirement below depends
  on.
- **Total debt is not the deciding case.** Neither layer makes a future
  combined or total-debt figure impossible, because summing `debt_structure`
  blocks is ruled out either way (RFC 0040). Total debt belongs over
  `capital_stack` (RFC 0026), which no built-in pack reads today.
- **Manifest level forbids mixed roles.** A manifest-level
  `debt_structure: senior` would forbid a junior- or mezzanine-specific metric,
  such as a mezzanine debt yield, in the same pack. It would also apply to
  calculations whose author never considered it.

On this evidence the draft recommends option B, the narrower and more
composable layer. That is a recommendation only. No owner decision selects
either layer, and the choice must be made before acceptance.

Under either layer:

- a caller-supplied `CalcEvaluationContext.sectionRoles` would let a host or
  `--calc-context` express a preference for an ad hoc formula;
- the ten built-in packs would state `debt_structure: 'senior'` for the
  lender-side metrics that read `debt_structure.loan_amount` or
  `debt_structure.annual_debt_service`. Per the 2026-10-02 decision set,
  `cash_on_cash` is excluded: equity cash flow deducts all debt service;
- a calculation that reads a section under a role preference SHOULD say so in
  its `label` or description.

### `@uwmd/core` (additive, proposed)

- **`resolveIdentifier`** would stop catching the selection failure. It would
  reuse the existing pieces rather than add a resolver: `periodSection`'s
  explicit-variant branch for step 1, and `resolveRoleBlock` for steps 2–4.
  `resolveRoleBlock` today takes a role preference only through a cross-check
  code looked up in `CROSS_CHECK_ROLE_PREFERENCE`. It would gain a way to
  accept a caller-supplied role, so the validator, the period path and the
  evaluator keep one selection implementation. The failure would surface as
  `CALC-RESOLVE-002`; `periodSection` keeps throwing `CALC-PERIOD-003` for
  period references.
- **`CalcErrorCode`** (`calc/errors.ts`) would gain `'CALC-RESOLVE-002'`.
- **`CalcEvaluationContext.sectionVariants`**: its doc comment ("Exact section
  variants for period references only") would drop "period references only".
- **`CalcEvaluationContext.sectionRoles`** would be added: as the transport
  under option A, or for ad hoc formulas under option B.
- **`parseCalculationContext`** would accept `sectionVariants` for any section
  and, if adopted, `sectionRoles` with values from `BLOCK_ROLES`.
- **`evaluateCalc`**'s signature is unchanged.

This PR changes none of these.

### Excel parity (hard requirement)

`uwmd-excel` reads named inputs through `sectionContent`, which calls
`getSection`, in `toWorkbook.ts`; the mixed-use path uses the same helper. A
variant-map section therefore contributes no input at all. The workbook's
derived metrics are live formulas over those named inputs
(`buildDerivedMetrics`, `layout.ts`).

The two already diverge on `main`. For the measured `primary` + `junior` map
with a stated purchase price of 10,000,000:

- `evaluateCalc` reports the multifamily `ltv` as `0.6`, because it resolves the
  `primary` block through the period-path fallback;
- the workbook's `loan_amount` named input is blank, so the sheet's
  `ROUND((loan_amount/purchase_price),6)` evaluates over an empty cell, which
  Excel reads as zero.

This draft does not fix that. It records it as a parity defect that any
implementation must close.

**Requirement on any implementation.** Workbook named-input extraction and
calc-engine resolution MUST select the same block, or refuse together, for
every section the calc engine resolves: explicit variant, role preference,
generic fallback and refusal. Both sides change in the same change. A refused
section MUST NOT become a blank input that Excel evaluates as zero. Exact
Excel ↔ calc-engine parity at the shared `round_to` (Protocol §VIII.5) is not
relaxed, deferred or approximated. How the workbook represents a refusal
(refusing the export, or an explicit error cell) must be pinned before
acceptance.

## Compatibility analysis

- **Existing `.uw.md` files** — none change and none become invalid.
- **Tier-1 Reader / Tier-2 Editor** — unaffected.
- **Tier-3 Calc Host** — A single-block section resolves exactly as today.
  - A variant map that resolves under RFC 0040's generic order today (the first
    two measured cases) keeps the same value.
  - An unresolvable map, a `primary` collision, or a missing explicitly
    requested variant moves from `ok: true, value: null` to `ok: false` with
    `CALC-RESOLVE-002`. That is the intended correction, and it changes
    behavior only on a path §VIII.2 never specified. A host that displayed
    "n/a" for those metrics would display a refusal naming the variants.
- **Receipts (RFC 0016)** — `computeReceiptResults` refuses to issue
  (`RCP_COMPUTATION_FAILED`) when any pack calculation is `ok: false`. Over an
  unresolvable map, issuance would change from a receipt with `computed: false`
  debt metrics to a refusal, unless a role preference resolves the map. That is
  a behavior change for receipt issuers and is part of what acceptance would
  approve.
- **Conformance corpus** — no frozen baseline moves.
  - The only corpus documents carrying `_role` are
    `conformance/tier-1-reader/fixtures/10–12-*.uwx.md` and
    `conformance/lease-up-projection/component/deal.uwx.md` (a component-role
    case). None has a tier-3 or receipt case.
  - The `conformance/hedge/*/deal.uwx.md` documents state `debt_structure`
    under `variant=base` with no `_role`. They parse as a single block (§2.7
    routing) and are unaffected.
- **Tier-4 Agent Host** — none.
- **Modules** — the role-preference declaration is optional under either
  layer, and the schema change is additive. A manifest without it validates and
  resolves as today, except where a calculation reads an unresolvable map.
- **Excel** — see [Excel parity](#excel-parity-hard-requirement).

No deprecation path is needed.

## Conformance impact

Existing fixtures, unchanged:

- `conformance/cash-flow/calc-missing-variant/` is an RFC 0034
  **declaration** case. `decl.json` requests `variant: "upside"` on a
  `cash_flow_series` that has only `base`, and `expected.json` expects
  `ok: false`, `error_code: CALC-CF-SERIES`. It is not an
  identifier-resolution case and does not encode `absent`.
- `conformance/tier-3-calc-host/fixtures/period-0*` exercise §VIII.2a on
  multi-variant series.

Proposed new tier-3 fixtures use the existing `deal.uwx.md` / `calc.json` /
`expected-result.json` layout, plus an optional `calc-context.json` that both
runners would pass as `--calc-context` when present.

- The CLI already accepts the flag (`loadCalculationContext` in `cli.ts`).
- The TypeScript runner (`runTier3` in `scripts/run-conformance.mjs`) and the
  RFC 0004 case generator (`scripts/gen-conformance-cases.mjs`) do not read such
  a file today and would learn to.

All cases use two `debt_structure` blocks shaped like those in
`10-declared-roles.uwx.md` and the formula
`debt_structure.loan_amount / valuation.purchase_price`:

| Scenario | Blocks | Context | Expected |
|---|---|---|---|
| `variant-01-primary-resolves` | `_role: primary` 6,000,000; `_role: junior` 1,000,000 | none | `ok: true`, the primary's ratio |
| `variant-02-default-resolves` | `variant=default` `_role: senior`; `variant=mezzanine` `_role: junior` | none | `ok: true`, the default's ratio |
| `variant-03-unresolvable` | `_role: senior`; `_role: junior` | none | `ok: false`, `error.code: CALC-RESOLVE-002` (today `ok: true, value: null`) |
| `variant-04-role-preference` | as 03 | a `senior` preference for `debt_structure`, in `calc-context.json` or `calc.json` depending on the layer chosen | `ok: true`, the senior's ratio |
| `variant-05-explicit-variant` | as 03 | `{ "sectionVariants": { "debt_structure": "producer-mezz" } }` | `ok: true`, the junior's ratio (today the CLI rejects this context) |
| `variant-06-missing-section` | no `debt_structure` | none | `ok: true`, `value: null` (unchanged rule, pinned) |
| `variant-07-explicit-missing` | as 03 | `{ "sectionVariants": { "debt_structure": "absent-key" } }` | `ok: false`, `CALC-RESOLVE-002` (today `ok: true, value: null`) |
| `variant-08-primary-collision` | two `_role: primary` blocks | none | `ok: false`, `CALC-RESOLVE-002` (today `ok: true, value: null`) |

Workbook cases in `uwmd-excel` would pin the same selection and refusal for a
resolvable and an unresolvable role-bearing map.

## Reference implementation (if accepted)

This draft authorizes no implementation. If it is accepted, the
implementation would land with that acceptance or in a linked follow-up PR.

**Files likely affected:**

- `spec/UW_PROTOCOL_v1.md` (§VIII.2, §VIII.2a cross-reference, §VIII.6);
- `spec/schemas/module-manifest.schema.json` (manifest top level or the
  `calculations` item, per the layer chosen);
- `packages/uwmd-core/src/protocol.ts`;
- `calc/errors.ts`;
- `calc/evaluator.ts` (`resolveIdentifier`);
- `block-roles.ts` (a caller-supplied role for `resolveRoleBlock`);
- `calculation-context.ts`;
- `packs/*.ts`;
- under option A, every host that evaluates manifest calculations (listed
  above);
- `cascade.ts` (`getBlock`), if the scope question below is answered yes;
- `packages/uwmd-excel/src/toWorkbook.ts`, including the mixed-use path, for
  the same selection and refusal in the same change;
- `scripts/run-conformance.mjs` and `scripts/gen-conformance-cases.mjs`;
- the fixtures above;
- `docs/wiki/05-calc-packs.md`, for the declaration and for what `null`
  versus `CALC-RESOLVE-002` means.

`conformance/runner/runner.py` needs no change, because it passes a case's
`args` through.

**API surface.** `CalcErrorCode` gains `'CALC-RESOLVE-002'`. The role-preference
field is added on the layer chosen, with an optional
`CalcEvaluationContext.sectionRoles`. No new public function is added, and
`resolveRoleBlock` remains the single resolver.

**Test plan:**

- `calc/calc.test.ts` cases mirroring the fixtures;
- `calculation-context.test.ts` for the widened `sectionVariants` and the new
  `sectionRoles`;
- `packs.test.ts` asserting that every metric reading `debt_structure` states
  `senior`;
- workbook parity and refusal cases;
- `npm run validate-schemas`;
- `npm run conformance` and `python3 conformance/runner/runner.py --tier 3`;
- `npm run verify-codes` (the `CALC` family is already registered in
  `scripts/verify-codes.mjs`).

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
- **Write a separate calc-side selector.** A second implementation of the
  RFC 0040 order would drift from the validator's and the period path's.
  `resolveRoleBlock` stays the one resolver.
- **Unwrap the map to its first block** (fence order). That is what §2.7
  routing does for role-free blocks and is the failure RFC 0040's opt-in was
  written to prevent; making it the calc rule would reintroduce it for the
  role-bearing case.

## Resolved questions

Each question below was resolved on 2026-10-02. The original wording is kept.
Each resolution says whether it is an owner decision (D1, D2) or a consequence
of one under precedent.

- **The layer for a declared role preference.** Manifest level (A) or per
  calculation (B). The evidence above leans toward B; the owner has not
  decided. *Resolved by owner decision D2: per calculation.*
- **Precedence between two preferences.** If both a calculation's declared
  role and a caller-supplied `sectionRoles` exist, which one wins.
  *Resolved as a consequence of D1 and D2: there is no caller `sectionRoles`,
  and an explicit `sectionVariants` entry beats a declared role.*
- **A declared role that matches no eligible block.** Whether it falls through
  to the generic order, as `resolveRoleBlock` does for cross-checks today, or
  refuses. *Resolved as a consequence of D1: it falls through, as
  `resolveRoleBlock` does for cross-checks, and a role claimed twice refuses
  (RFC 0040).*
- **Period references.** Whether a declared role preference should also apply
  to them. §VIII.2a currently resolves period references without any
  check-specific preference. *Resolved as a consequence of D1, which extends
  §VIII.2a rather than amending it: no, period references are unchanged.*
- **One code or two.** Whether `CALC-PERIOD-003`'s selection failure should be
  folded into `CALC-RESOLVE-002`, so one code covers "could not choose a
  block" everywhere. This draft leaves the period code alone to keep RFC 0041
  fixtures frozen. *Resolved by owner decision D1: two codes.*
- **How the workbook represents a refused input:** refusing the export, or an
  explicit error cell. *Resolved as a consequence of D1 under §VIII.2c and the
  parity invariant: an explicit `#VALUE!` cell for a refused input or metric.
  The export refuses only when one named input would have to stand for two
  blocks, and custom-calculation inputs raise.*
- **Cascade reads.** Whether this RFC's implementation also routes
  `cascade.ts`'s `getBlock`, and so the refinement ranker, through the same
  resolver. This draft recommends it, because a third selection rule is the
  drift the shared resolver exists to prevent. The cascade is not the calc
  evaluator, though, so the scope is the owner's call. *Resolved as a
  consequence of D1, whose question named the evaluator, cascade, Excel and
  refine: the cascade's in-file steps and refinement select through the shared
  resolver, and refinement reports an excluded target in
  `diagnostics.section_inputs`.*
- **Parser routing.** Whether the parser's RFC 0040 Markdown opt-in should
  widen so a keyed second `debt_structure` block without `_role` is retained
  rather than superseded. This is out of scope: it is a format routing
  decision, and this draft only makes the evaluator honest about the maps that
  do exist. *Still out of scope; parser routing is unchanged.*

## Decision status

RFC 0066 is `implemented`, released in core/CLI 2.15.0 with Protocol 2.19.0.

| Item | Source | State |
|---|---|---|
| A missing path resolves to `null` | Protocol §VIII.2 | Existing normative rule. Unchanged. |
| Period-reference selection: explicit `sectionVariants`, RFC 0040 generic order, `CALC-PERIOD-003` | Protocol §VIII.2a (RFC 0041), RFC 0040 | Existing normative rule. Unchanged. |
| Exact Excel ↔ calc-engine parity | Repository invariant; Protocol §VIII.5 | Existing. Binding on any implementation. |
| The same selection order for ordinary identifiers | D1, 2026-10-02 | Accepted. Protocol §VIII.2, 2.19.0. |
| `CALC-RESOLVE-002`, its name and meaning | D1, 2026-10-02 | Accepted. Protocol §VIII.6. |
| Per-calculation `section_roles`; built-in lender-side metrics `senior`; `cash_on_cash` none | D2, 2026-10-02 | Accepted. Protocol §X; module-manifest schema. |
| Cascade, refinement and Excel selection; `diagnostics.section_inputs`; `#VALUE!` | Consequence of D1 under §VIII.2c, RFC 0021 §5 and the parity invariant | Specified in Protocol §V.7, §VIII.2b and §VIII.2c, and the section-refinement-issue schema. |
| `--calc-context` accepts `sectionVariants` for any section | Consequence of D1 | Specified. |
| Implementation; release target core/CLI 2.15.0 with Protocol 2.19.0 | D3, 2026-10-02 | Implemented; released in core/CLI 2.15.0 on 2026-10-02. |

## Merge readiness

D3 set the release target. The owner then asked that the implementation not
merge until three conditions held. All three now do:

1. **`v2.14.0` is published.** The tag published core/CLI 2.14.0 on
   2026-10-02, with Protocol 2.18.0.
2. **The branch sits on released `main`.** The payload-unwrapping fix merges
   first, as its own change; this branch is rebased behind it.
3. **The 2.15.0 package generation is prepared and gated**, following the
   2.14.0 candidate's pattern:
   - core/CLI 2.15.0, and core's optional signing peer at 0.2.19;
   - exact-pin bumps for every dependent: signing 0.2.19, batch 0.8.14,
     Excel 0.9.7, report 0.8.19, lake 0.2.3, and the two modules at 0.1.7;
   - the root lockfile and `CORE_VERSION`;
   - receipt issuance baselines and the frozen result-disagreement fixture at
     engine 2.15.0;
   - the `VERSIONS.md` rows, a `[2.15.0]` candidate CHANGELOG section and the
     candidate record (`docs/releases/2.15.0-candidate.md`).

   The release gates were rerun under the pinned toolchain (Node 22.14.0,
   npm 11.5.1). The candidate record lists the results.

PR #234 merged the implementation at `4227744`. After the RFC 0062
portable-runner cases (PR #235) and the release record (PR #236), the owner
pushed the `v2.15.0` tag on release commit `aaa9ec3`, which published
core/CLI 2.15.0 on 2026-10-02.

## Prior art

- RFC 0037 (cross-check resolution over variant maps, and coverage) and RFC
  0040 (variant roles) — the order this RFC adopts and the shared resolver it
  reuses.
- RFC 0041 §VIII.2a "Section context" — the same rule, already normative for
  period references; this RFC generalizes it to every section-rooted
  identifier.
- RFC 0034's `CALC-CF-SERIES` — a missing explicitly requested variant is a
  refusal, not a `null`, for cash-flow declarations.
