---
rfc: 0074
title: What a dependent module's declaration override means
status: accepted
accepted: 2026-10-05
author: claude-code (agent proposal)
created: 2026-10-05
depends_on:
  - 0006
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0074: What a dependent module's declaration override means

**Accepted and implemented, not released.** A coding agent wrote this RFC.
The owner settled O1–O3 on 2026-10-05 and directed its implementation the
same day. The implementation PR carries the acceptance, and merging it
records it. The RFC stays `accepted` until a release ships it.

## Summary

Protocol §VII.3 says that when two loaded modules declare the same section
ID, calculation ID or view-model `section_id`, unrelated modules conflict and
"if one module declares the other in `depends_on`, the dependent module's
declarations override." It says nothing more. It does not say:

- which modules count as related;
- what happens to the overridden declaration;
- where a replacement calculation runs;
- what happens to calculations that read the overridden value;
- how module scope interacts with an override.

This RFC proposes those rules. The core is one invariant: **an override must
never make a declaration unavailable to anything that would otherwise use
it**. The protocol enforces this with static load-time refusals, not by
scheduling calculations across modules.

The owner settled its three open questions on 2026-10-05
([Owner decisions](#owner-decisions-2026-10-05)). Protocol §VII.3 and §X now
carry the normative text, and [Implementation record](#implementation-record)
describes the implementation.

## Motivation

### How this was found

The [renamed-identifier review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-04-renamed-identifiers.md)
for #263 found that the reference registry did not enforce §VII.3 at all.
PR [#267](https://github.com/UWMD-OSP/UW-Markdown/pull/267) repairs the part
that is unambiguous: two **unrelated** modules declaring one id are refused
(`PROTO-MOD-080`–`082`), where "unrelated" means no `depends_on` path joins
them in either direction.

While implementing the dependent case in #267, four review rounds each found
that a plausible reading of "override" silently turned a value into `null`:

1. **Override in the dependency's position.** A dependent that declares `y`,
   then overrides `x` with a formula reading `y`, ran its `x` before its own
   `y`.
2. **Override in the dependent's own position.** The overridden module's later
   calculation reading `x` then ran before the replacement and read nothing.
3. **Another dependent reading `x`.** With A → C (reads `x`) → B (overrides
   `x`), C ran before B's replacement.
4. **Scope mismatch.** B overrides A's `x` but applies only to `hospitality`.
   On an `office` document, A's `x` was suppressed and B's never ran.

None of these is decided by the current text. They are semantics, so #267 was
split at the normative boundary, and this RFC carries them. The implementation
explored in #267 (commit `31ccff4`) is design evidence, not authority.

### Current behavior (pre-RFC, and after #267)

A pair joined by `depends_on`, directly or through a chain, loads. Nothing is
overridden in practice:

- **Calculations.** `evaluateModuleCalculations` runs *both* declarations in
  registry order. Each result is threaded into one `prior_results` map by
  calculation id, so a later read sees whichever ran last: the dependent's,
  because a dependency always loads first (`PROTO-MOD-027`). Both outcomes
  are reported.
- **Sections.** Each applicable module's required-section check runs, so
  both declarations are enforced.
- **View models.** Both stay in the registry. The library has no view-model
  consumer, so nothing chooses between them.

So today "override" means at most "the last write wins for later readers."
That is load-order threading, not a declared rule.

## Proposed change

### Layer

| Surface | Change |
|---|---|
| Format | None. Documents are unaffected. |
| Protocol | §VII.3 gains the override rules below. §XI/III.6a gain no family; two `PROTO-MOD` codes are added. |
| Schemas | None. Manifests gain no field. |
| Reference library | Registry ownership metadata (internal), the load-time checks, runtime suppression of overridden declarations, and `getModuleCalculationsForAssetClass`. |
| Conformance | `conformance/modules/registry/` override scenarios ([Conformance](#conformance-impact)). |

### P1. Who may override whom

- **P1.1 Direct dependency.** A module may redeclare an id that a loaded
  module declares only if it names, in its own `depends_on`, the module whose
  declaration is currently in effect for that id. Otherwise the pair is a
  §VII.3 conflict (`PROTO-MOD-080`–`082`).
- **P1.2 Chains.** In A ← B ← C, B overrides A by naming A, and C overrides B
  by naming B. C naming only A while B's declaration is in effect is a
  conflict, because it would silently undo B.
- **P1.3 Siblings.** Two modules that both depend on A, but not on each
  other, are unrelated. Both redeclaring one of A's ids is a conflict. #267
  already refuses this as unrelated.
- **P1.4 Transitive-only pairs.** In A ← B ← C where only A and C declare `x`,
  C does not name A. A transitive path alone does not authorize an override,
  so this is a conflict (`PROTO-MOD-080`–`082` by namespace). Owner
  decision O1.

### P2. What an override does

- **P2.1** An overridden declaration does not take effect, in any namespace.
- **P2.2 Calculations.** The replacement runs once, where the overriding
  module declares it. Every module keeps its own author-declared order (§X:
  declaration order, each calculation seeing the ones before it). Modules
  still run in registry order. There is no cross-module topological
  scheduler: §VII.2's dependency load order is the only cross-module
  ordering, and the rules below make that sufficient.
- **P2.3 Sections.** The effective declaration's `required` flag is checked,
  once, as part of the module that owns it.
- **P2.4 View models.** The effective declaration is the module's view model
  for that `section_id`. The protocol defines no view-model consumer. A host
  that renders module view models MUST use the effective one.

### P3. Invariant and refusals

> A dependent override MUST NOT make a declaration unavailable to anything
> that, under the module dependency and applicability rules, would otherwise
> use it. A host MUST refuse a set of modules containing such an override.
> The decision is static, made from the manifests and independent of the
> order the modules are listed in.

Two static rules implement it. #267 revision 4 implemented and tested both.

**P3.1 Prior-result consumers (proposed `PROTO-MOD-083`).** A calculation
that reads an overridden calculation id as a prior result is served only when
it runs after the replacement. The only cross-module ordering guarantee is a
dependency, so each reader must be one of:

- the overriding module's own calculation declared **after** the id; or
- a calculation of a module that depends on the overriding module, directly
  or transitively.

The one exemption is a calculation that the **first** declaring module
declares before the id: it never had a value to read. Applied to each kind of
reader:

| Reader of `x` | Verdict |
|---|---|
| Overridden module, after its `x` | refuse |
| Overridden module, before its `x` (first declarer) | allowed, since it never read a value |
| Another dependent of the overridden module | refuse, as it is not ordered after the replacement |
| A module that depends on the overriding module | allowed |
| A module with no dependency on the overriding module | refuse |
| The overriding module, before its own `x` | refuse, as it was reading the overridden value |
| The overriding module's replacement `x` itself reading `x` | refuse, as it is declared at, not after, the id |
| The overriding module, after its own `x` | allowed |
| Chain A ← B ← C, where C overrides B's `x` | B's later readers and B's other dependents refuse; C's dependents are allowed |

**What counts as a read** is decided by the expression parser, not text
search. Only an identifier or a path head reaches `prior_results` (§VIII.2).
These never do:

- a string literal;
- a later path segment;
- a bracket key;
- a period-path head, which resolves through sections;
- a function name.

A head that frontmatter or a section might shadow in some document still
counts, because the check cannot depend on a document. Validation rules are
not readers, since they run after every calculation.

**P3.2 Scope (proposed `PROTO-MOD-084`).** The overriding module MUST apply
to every asset class to which the module whose declaration it overrides
applies. Scope is the module runtime's:

- `asset_classes` (builtins enhanced) together with
  `declares_asset_classes` (custom classes declared);
- a module naming neither applies to every class;
- a document with no class is reached only by modules naming neither.

These are manifest fields, so coverage is provable statically:

| Overridden module | Overriding module | Verdict |
|---|---|---|
| `office` | `office` | allowed |
| `office` | `office`, `retail` | allowed |
| `office` | unscoped | allowed |
| unscoped | unscoped | allowed |
| `office`, `retail` | `office` | refuse |
| `office` | `hospitality` | refuse |
| unscoped | `office` | refuse |
| custom `com.example.data_center` | unscoped | allowed |
| custom `com.example.data_center` | `office`, or another custom class | refuse |

A covering module can cover a custom class only by being unscoped or by
declaring that class, and two modules declaring one class is
`MOD-ASSET-CLASS-CONFLICT-001`. Where the host runs that check
(`assetClassDeclarationConflicts` in the reference library, which
`createModuleRegistry` does not call), only an unscoped module can therefore
override a custom-class module. P3.2 applies to sections,
calculations and view models alike.

**P3.3 Determinism.** Each rule is checked from whichever side loads second:
the override checks loaded readers, and a later reader checks existing
overrides. The verdict is therefore a property of the module set. Where
several listings describe the same valid dependency graph, they get the same
verdict and, if accepted, the same effective declarations.

### P4. Library

- Ownership is internal: a `WeakMap` beside the registry records the owning
  module per id and namespace. `ModuleRegistry` and the public exports are
  unchanged, and a hand-built registry has no overrides.
- `getModuleCalculationsForAssetClass` returns one declaration per id, the
  effective one. If the owner is not among the modules it lists, the owner's
  declaration stands where the overridden one was. Otherwise the id would
  vanish from that class's list.

### P5. Diagnostics

- **Proposed `PROTO-MOD-083`:** an override would leave a prior-result
  consumer without a value.
- **Proposed `PROTO-MOD-084`:** the overriding module does not apply wherever
  the overridden module does.

The allocation is reconciled against `main` after #267. That PR takes
`080`–`082`. Draft RFC 0073's candidates are `085`–`086`.

### P6. Protocol floor for modules that override (owner decision O3)

A module manifest that redeclares a section ID, calculation ID or view-model
`section_id` declared by a module it names in `depends_on` uses this RFC's
override semantics. It **MUST** declare a `requires_protocol` range that
excludes every Protocol version before the first release that implements this
RFC.

- **Why.** A pre-RFC host runs both declarations instead of one effective
  declaration, and it may accept a module set this RFC refuses. Calculation
  outcomes and validation behavior can therefore differ materially. The
  collision with a named dependency is itself sufficient evidence that the
  override feature is in use.
- **The floor.** The exact floor is assigned at release preparation, when that
  release's version is selected. As with RFC 0071, a comparator that only
  excludes the current label does not meet the requirement.
- **Enforcement.** This follows RFC 0071's precedent for
  `is_calendar_date`. §VII.2 step 3 is the enforcement: an older host
  refuses the manifest's range with `PROTO-MOD-030`, so it never loads an
  override it would run as two declarations. A manifest that violates P6 is
  non-conforming. A host is not required to detect the violation, and the
  requirement adds no loader check or code.

## Compatibility analysis

- **Unrelated conflicts.** #267 repairs these against the existing MUST. They
  are unchanged by this RFC.
- **Dependent overrides.** These are new semantics:
  - **Behavior change.** Today both declarations run and the last write wins
    for later readers. Under this RFC exactly one runs, and some module sets
    are refused (`083`, `084`, or `080`–`082` under P1.1/P1.4). A set that
    loads today can be refused after.
  - **Value change.** In an accepted set, a dependency's calculation declared
    *before* the overridden id still reads nothing for it, as today. Every
    other reader either reads the replacement, as today, or causes a refusal.
    No accepted set changes a served value, except that the overridden
    declaration's own outcome disappears, and a replacement that fails to
    evaluate on a document no longer leaves the overridden value in place:
    readers see absence, as they would for any failed calculation.
- **Modules that collide with nothing.** Unaffected.
- **First-party modules.** Hospitality and data-center share no ids with each
  other, so they are unaffected.
- **Pre-RFC hosts.**
  - They run both declarations, so they report two outcomes for one id.
  - They load sets this RFC refuses.
  - P6 keeps a conforming overriding module off those hosts entirely. Its
    `requires_protocol` range excludes them, so they refuse it under
    §VII.2 step 3.
- **Existing overriding modules.** A module that already redeclares a
  dependency's id becomes non-conforming until it declares the P6 floor.
  No first-party or corpus module does this.
- **Documents.** Unaffected.

## Conformance impact

This section carries forward the scenarios #267 developed. They are
`conformance/modules/registry/` cases, each a set of synthetic manifests plus
an `expected.json`.

The evidence: #267 revisions 3–4, commit `31ccff4`, scenarios 02, 04 and
06–11. Its runner also asserted the effective owner, the calculation
evaluation order and values on a shared deal, and exact refusal-code sets.

| Proposed scenario | Expected |
|---|---|
| Section override; B makes A's required section optional | loads; B's declaration in effect; no `MOD-SECTION-MISSING` |
| Calculation override; B declares `b_first`, then `x = b_first * 10`, then `b_after = x + 1` | loads; evaluation order A's calcs, then `b_first`, `x`, `b_after`; `x` = 20, `b_after` = 21; one outcome for `x` |
| View-model override | loads; B's view model in effect |
| Overridden module's own later reader | `083` |
| Another dependent reads `x` (orders A,C,B and A,B,C) | `083` in both |
| Reader depends on the overriding module | loads; reads the replacement |
| Chain: C overrides B while B's dependent reads `x` | `083` |
| Overriding module reads `x` before its own `x` | `083` |
| Reader listed before the dependency | `083` (see O2) |
| Same, broader and unscoped override scope | loads |
| Narrower, disjoint, and scoped-over-unscoped scope | `084` |
| Section and view-model scope mismatch | `084` for each |
| Transitive-only pair (P1.4): A and C declare `x`, C names only B | `081` |
| Text `x` in a string, later segment, bracket key or period-path head | not a read; loads |

## Reference implementation

#267 at `31ccff4` holds a complete implementation of P1–P5, with:

- 127 narrow tests and 11 registry scenarios;
- negative controls showing that each refusal fails against the revision
  before it.

| Part | Where in `31ccff4` | Reusable? |
|---|---|---|
| Owner tracking and P1.2 chain checks | `claimDeclarations` | Yes; its direct-`depends_on` check already matches O1 |
| Internal ownership | `OWNERS` `WeakMap`, `declarationOwnersOf`, `ownsDeclaration` | Yes |
| P3.1 | `unservedReader`, the reading-side loop, `priorResultReads` | Yes; already the conservative rule O2 keeps |
| P3.2 | `moduleScope`, `coversScope` | Yes |
| Runtime suppression (P2.2, P2.3) | `module-runtime.ts` | Yes |
| P4 | `getModuleCalculationsForAssetClass` | Yes |
| Tests and conformance | unit tests, scenarios, runner assertions | Yes, with the runner's owner assertions |

`dependsTransitively` already ships in the reduced #267.

## Alternatives considered

1. **Last write wins (today's behavior, made official).** It keeps both
   declarations running, so "override" means only that the dependent's
   value threads last. That leaves the overridden module's later readers
   reading the old value and everyone after reading the new one, two values
   for one id in one evaluation. Rejected.
2. **Run the replacement in the overridden declaration's position.** This
   breaks the dependent's own declaration order (failure 1 in
   [How this was found](#how-this-was-found)). Rejected.
3. **Cross-module scheduling by data dependency**, so every reader sees the
   replacement. This is the most permissive option, but it adds a scheduler,
   widens runtime semantics, and makes evaluation order a function of formula
   contents across modules. It conflicts with §X's author-declared order.
   Rejected for now. Refusals added under P3 can later be relaxed into
   acceptances without breaking anyone.
4. **Silent `null` for unserved readers.** This turns a previously available
   value into absence with no failure. Rejected by the owner during the #267
   review.
5. **Per-document owners.** An override would apply only on documents where
   the overriding module applies, and the overridden declaration would run
   elsewhere. Effective declarations would then depend on the document, the
   registry would have no single answer, and readers could see different
   declarations per document. Rejected in favor of P3.2's static refusal.

## Unresolved questions

No semantic question remains open. The owner decisions are recorded below, and the exact Protocol floor (P6) is assigned at release preparation. P6 adds no code, and its `requires_protocol` ranges are set by module authors.

### Owner decisions (2026-10-05)

Jared decided these on 2026-10-05.

- **O1. Direct dependency only.** An override is permitted only when the
  overriding module names, in its own `depends_on`, the module whose
  declaration is currently in effect for that id. A transitive path alone
  does not authorize an override.
  - In A ← B ← C, B overrides A by naming A, and C overrides B by naming B.
  - If only A and C declare `x`, C naming only B does not authorize C to
    override A's `x`. That is a conflict (P1.4).
  - This keeps override intent explicit and matches §VII.3's "declares the
    other in `depends_on`."
- **O2. The conservative reader rule stays.** A prior-result reader is
  valid only when the dependency graph guarantees that it runs after the
  effective replacement. A module set is never accepted merely because one
  listing order happens to produce the desired value. P3.1 therefore keeps
  refusing:
  - readers loaded after the override that do not depend on the overriding
    module;
  - readers with no dependency relationship that guarantees ordering;
  - equivalent order-dependent cases.

  The verdict remains a property of the valid module and dependency set.
- **O3. The Protocol floor is REQUIRED.** This changes the recommendation
  from SHOULD to MUST. See P6. The exact floor is assigned at release
  preparation.

### Settled from repository evidence

- Every module keeps its own declaration order (§X). No scheduler is added
  (§VII.2 is the only cross-module order).
- Ownership stays internal. No demonstrated consumer needs it on
  `ModuleRegistry`.
- Scope is the runtime's existing applicability rule, which is static.
- Two view models for one `section_id` inside a single manifest are outside
  §VII.3. They stay unrefused and are not decided here.

## Implementation record

- **Code.** It restores #267's `31ccff4` in `modules.ts`,
  `module-runtime.ts`, their tests and the conformance runner. `main` was
  byte-identical to the reduction `7dc78b8` on those paths. Checked against
  this text: `claimDeclarations` already required a direct `depends_on` on
  the current owner (O1), and the reader rule was already the conservative
  one (O2). Beyond the restore, only comments that cited PR #267 changed,
  and one P6 test was added.
- **P6.** A module-runtime test shows an older host refusing an overriding
  module through `PROTO-MOD-030`, as RFC 0071's floor does. Release
  preparation assigns the floor and raises the overriding registry fixtures'
  `requires_protocol` to it. Until then they use `>=1.0.0`.
- **Conformance.** `conformance/modules/registry/` keeps #267's 01–04 and
  makes 05 assert the effective owners. It adds 06–24, one or more per row
  of [Conformance impact](#conformance-impact), plus the P1.2 sibling,
  first-declarer exemption and self-read cases. Against the pre-RFC
  implementation every scenario from 05 on fails, except 22: it pins a
  sibling refusal that #267 already made.
- **Defects found in `31ccff4` and fixed.** An independent review of this
  branch found two:
  - **Self-read.** `unservedReader` skipped the overriding module's own
    declaration of the id, so a replacement `x = x * 10` loaded and
    evaluated to `null`. Before the RFC that value was 10. It now refuses
    with `083`, as P3.1 and the table above require (scenario 20).
  - **Duplicate listing.** In a chain whose owner is not among the listed
    modules, `getModuleCalculationsForAssetClass` listed the effective
    declaration once per listed declarer. It now lists it once (P4).

  The review also showed that scenario 18 could not pin both namespaces,
  because refusals compare code sets. It is split into 18 (sections) and
  19 (view models).
- **Not changed.** Format, schemas, public exports, `ModuleRegistry` and
  version labels.

## Prior art

- **CSS cascade layers.** A later layer overrides an earlier one by
  declaration, not by load accident. The analogy stops there: CSS resolves
  per element, and P3.2 rejects per-document resolution.
- **Maven dependency mediation.** "Nearest wins" picks silently by graph
  position. This RFC refuses instead of picking whenever the graph does not
  make the choice explicit (P1.1, P1.3).
