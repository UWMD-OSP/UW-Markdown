---
rfc: 0040
title: Variant roles — resolve cross-checks by a declared role, not a key name
status: draft
author: jaredmaxey
created: 2026-09-09
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0040: Variant roles — resolve cross-checks by a declared role, not a key name

> RFC 0037 made cross-check resolution over a variant map deterministic:
> a check reads the variant it prefers, else `default`, else `base`, else
> the sole variant, else nothing — reported once as `CC-16`. That was the
> right rule and the first production implementation's coverage report
> shows its limit: every one of its documents keys `rent_roll`,
> `operating_statement` and `debt_structure` by the module that produced
> each block (`debt-senior/cmbs`, `debt-mezz/base`, `tax/base`, …), so
> CC-01, CC-03, CC-05 and CC-09 skip on every class. The keys are honest —
> they name the producer, which RFC 0031 asked for — and none of them is
> "the" block. This RFC lets a producer *say* which block a check should
> read, without renaming it. Protocol 2.6.0 → 2.7.0; the format version
> does not move (an optional `_meta` field).

## Summary

Add an optional `_meta.role` to a block inside a variant map, drawn from a
closed set (`primary`, `senior`, `junior`, `summary`, `detail`,
`component`). Cross-check resolution (§5.3) gains one step between the
check's own preference and `default`: a check first looks for the variant
carrying the role it registers (`CC-03` / `CC-05` / `CC-09` register
`senior` on `debt_structure`; `CC-01` registers `detail` on `rent_roll`),
then for the variant carrying `primary`, then proceeds as today. Two
variants claiming the same role make the section unresolvable (`CC-16`,
with the collision named). Nothing changes for a map that carries no
roles; nothing changes for a section stated once.

## Motivation

- **A key names a producer; a role names a fact.** The variant map's keys
  were opened to producer ids on purpose (RFC 0031's source vocabulary and
  the composition work that followed): a reader can see *which module*
  wrote the senior tranche block. Asking the same key to also mean "this
  is the block CC-03 reconciles" overloads it, and the only way to comply
  today is to rename the block `default` — losing the producer — or to
  emit the block twice under two keys — violating the one-statement rule
  every cross-check exists to enforce.
- **`debt_structure` has no honest `default`.** A stack with a funded
  mezzanine is two facts, senior and junior, in one section. `default`
  would be a convention ("the senior goes under `default`"); `senior` is a
  statement. The same holds for a rent roll stated as a unit-mix detail
  and a derived summary: the detail is what CC-01 should read, and
  `detail` says so where `default` would only imply it.
- **The measurement.** With `@uwmd/core` 2.5.0 the reference
  implementation's nine canonical classes report 3 of 15 cross-checks
  evaluated; 4 of the 12 skips are `variant_unresolvable`, all on these
  three sections. That is the coverage channel doing exactly what RFC
  0037 built it for — and the number should move because the document
  declared something, not because a key was renamed.

## Proposed change

### A. Format: `_meta.role` (§2.8 variant maps; the block `_meta` schema)

Add to the `_meta` object (normative schema `spec/schemas/block-meta.schema.json`
or wherever `_meta` is defined — implementation locates it) one optional
field:

> `role` — OPTIONAL, string, one of `primary`, `senior`, `junior`,
> `summary`, `detail`, `component`. Meaningful only on a block that is a
> member of a variant map; on a section stated once it is permitted and
> ignored. A role states which fact the block is, for readers that must
> pick one block from a map: `primary` — the block a generic reader takes
> as the section; `senior` / `junior` — the senior and subordinate
> tranches of a `debt_structure` map; `detail` / `summary` — the
> line-level statement and a derived roll-up of the same section (a rent
> roll's unit mix and its summary; an operating statement's line items
> and its totals); `component` — a block scoped to one component of a
> mixed-use property (RFC 0019), never the property-level statement.
> Within one variant map, no two blocks MAY carry the same role;
> `primary` and `detail` MAY coexist on one block (a detail statement
> that is also the primary), and a block MAY carry at most one role.

### B. Protocol §5.3 / the resolution order (normative)

Replace the four-step order in "Resolution over variant maps (RFC 0037)"
with:

> (1) the check's registered variant preference, if any; (2) the variant
> whose `_meta.role` equals the check's registered **role preference**,
> if any (`CROSS_CHECK_ROLE_PREFERENCE`); (3) the variant whose
> `_meta.role` is `primary`; (4) `default`; (5) `base`; (6) the sole
> variant. If any role the resolver consults is carried by more than one
> variant of the map, the section is unresolvable and `CC-16`'s detail
> names the collision (`two variants claim role senior: a, b`). A
> `component`-role block is never resolved by a property-level check.

Registered role preferences (the `CROSS_CHECK_ROLE_PREFERENCE` table in
`@uwmd/core`, beside the existing variant-preference table):

| Check | Section | Role |
|---|---|---|
| `CC-02`, `CC-03`, `CC-05`, `CC-09` | `debt_structure` | `senior` |
| `CC-01` | `rent_roll` | `detail` |
| `CC-01`, `CC-05`, `CC-06`, `CC-12` | `operating_statement` / `noi_model` | `primary` (explicit, same as step 3) |

Every other check has no role preference and relies on step 3.

`CC-16`'s message gains the roles found, when any: `… present as 3
variants (debt-mezz/base [junior], debt-senior/agency [senior],
debt-senior/construction) and …`.

### C. Validator

- `resolveCrossCheckSection` gains the two role steps and the collision
  check. `CROSS_CHECK_ROLE_PREFERENCE` is exported and frozen.
- A new structural rule, `META-ROLE-001` (error): `_meta.role` outside
  the closed set. A role on a section stated once is not an issue.
- `CC-16` reports the collision case with `reason: variant_unresolvable`
  and a detail that names the role and the colliding keys.
- Coverage: a section resolved by role is `evaluated` like any other;
  the resolution `variant` recorded on the ledger carries the key, and a
  new optional `via: 'preference' | 'role' | 'primary' | 'default' | 'base' | 'sole'`
  says which step resolved it — reporting only, so a producer can see
  that its role declaration is what made the check run.

### D. What this RFC does not change

- Keys. A producer keeps naming blocks by producer id.
- Any check's arithmetic, tolerance, or severity.
- Documents without roles: identical resolution, identical coverage,
  identical `CC-16`.
- The Tier-4 rule: an agent MUST NOT invent a role any more than a
  figure; roles come from the producer that knows which block is which.

## Compatibility analysis

- **Existing files** — no file carries `_meta.role`; all resolve as
  today. A file that carried an unknown `_meta` key was already tolerated
  by the schema's additional-properties posture (verify at
  implementation; if `_meta` is closed, this is an additive field on a
  closed object and the schema moves with it).
- **Tier-1 readers** — ignore the field. **Tier-2 editors** — preserve
  `_meta` on round-trip as they already must. **Tier-3** — untouched.
  **Tier-4** — the prohibition above.
- **Modules** — none; a module-declared section may use roles the same
  way.
- **Protocol skew** — a 2.6.0 validator reading a 2.7.0 file with roles
  ignores them and reports `CC-16` as before: a visible, correct
  under-report, not a wrong verdict. §XII.4 posture, no shim.
- **Receipts** — a receipt's canonicalization includes `_meta`; adding a
  role to a block changes its bytes and therefore its digest, which is
  correct (the document says something new). No receipt baseline
  changes until a fixture adopts a role.

## Conformance impact

New in `conformance/cross-checks/` (or beside the RFC 0037 fixtures —
implementation locates the 0037 tier-1 fixtures 08/09 and sits next to
them):

| Scenario | Pins |
|---|---|
| `verify-role-senior-resolves-cc03` | `debt_structure` as `{ 'debt-senior/cmbs': {role: senior}, 'debt-mezz/base': {role: junior} }` → CC-03/05/09 `evaluated`, no CC-16. |
| `verify-role-primary-generic` | `operating_statement` with three producer-keyed blocks, one `primary` → CC-01 `evaluated`. |
| `verify-role-detail-over-summary` | `rent_roll` as detail + summary, both stated, `detail` role → CC-01 reads the detail; the summary is ignored. |
| `reject-role-collision` | two `senior` blocks → CC-16 naming the collision, CC-03 `variant_unresolvable`. |
| `reject-role-unknown` | `_meta.role: "main"` → `META-ROLE-001`. |
| `verify-role-ignored-when-single` | a section stated once with a role → no issue, resolved as today. |
| `verify-no-roles-unchanged` | the RFC 0037 fixture 08 byte-identical → identical coverage and CC-16 (the regression pin). |

Roughly 7 fixtures; `gen-conformance-cases` for the runner.

## Reference implementation

- **Files:** `validator.ts` (`resolveCrossCheckSection`, the ledger's
  `via`, `META-ROLE-001`, CC-16 detail), `protocol.ts`
  (`CROSS_CHECK_ROLE_PREFERENCE`, `BLOCK_ROLES`, remediation rows,
  `PROTOCOL_VERSION` 2.7.0), `types.ts` (`BlockRole`, the coverage
  `via`), the `_meta` schema, format §2.8 + §5.3, protocol §VIII / §XVI
  version lines, fixtures, CHANGELOG, status wiki, ROADMAP, RFC index.
- **API surface:** `BLOCK_ROLES`, `BlockRole`, `CROSS_CHECK_ROLE_PREFERENCE`;
  `CrossCheckCoverage` gains optional `via`. Additive.
- **Test plan:** unit tests on the resolver for each step and the
  collision; the seven fixtures; the RFC 0037 tests unchanged and green.
- **Effort:** small. Most of the work is the spec sentence and the table.

## Alternatives considered

1. **Rename the primary block to `default` app-side (no spec change).**
   Rejected: loses the producer id in the key, and `default` on
   `debt_structure` is a convention masquerading as a statement.
2. **Emit the primary block twice, under its id and under `default`.**
   Rejected: two statements of one fact is what the cross-checks exist
   to refuse.
3. **Positional rule: the first variant in map order is primary.**
   Rejected: object key order is not a statement, and JSON producers
   reorder keys.
4. **A per-section `_primary: "<key>"` pointer at the map level.**
   Cleaner for `primary` alone, but it cannot say `senior` versus
   `junior`, and a pointer beside the map is a second place a key name
   must be kept in sync. The role on the block itself travels with the
   block.
5. **Widen the variant-preference tables with producer-id patterns
   (`debt-senior/*`).** Rejected: the protocol would then know one
   implementation's module vocabulary.

## Unresolved questions

- **Should `senior`/`junior` be closed to `debt_structure`?** This RFC
  admits any role on any section and leaves meaning to the check that
  consumes it; a later erratum could restrict roles per section if
  misuse appears.
- **Multiple seniors.** A stack with two pari-passu senior facilities has
  no single `senior`; this RFC calls that unresolvable, which is the
  honest report. Whether `CC-03` should learn to sum pari-passu tranches
  is RFC 0026 / capital-stack territory, not this one.
- **Component roles and CC-12.** `component` is reserved here so that a
  property-level check never reads a component block by accident; the
  mixed-use checks (RFC 0019) may want to *use* it. Left for their
  maintainers.

## Prior art

RFC 0037 (the order this extends and the coverage channel that showed
the gap); RFC 0031 (why keys name producers); RFC 0026 / 0033
(`capital_stack` tranche vocabulary — `senior` / `junior` are borrowed
from it). Outside: HTML's `rel` attribute — a closed vocabulary of
relationships carried on the element, not encoded in its name.
