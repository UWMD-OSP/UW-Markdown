---
rfc: 0019
title: Define mixed-use composition as a document shape, not a pack shape
status: draft
author: jaredmaxey
created: 2026-08-13
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0019: Define mixed-use composition as a document shape, not a pack shape

## Summary

`mixed_use` is the last member of the `AssetClass` union without a calc pack, and
it is the only one that does not describe a single kind of building. A mixed-use
property is an apartment tower over ground-floor retail, or an office podium with
a hotel above — two or more uses under one purchase price and one loan. This RFC
proposes that the composition live in the **document**, as a bounded set of named
component slots keyed by the component's own asset class, and that `mixed_use`
receive exactly **one** ordinary calc pack that reads those slots. The
one-pack-per-asset-class assumption survives unchanged. The pack computes
property-level metrics normally, computes component-level intensive metrics only
from an explicit user-supplied allocation, and deliberately omits metrics that
cannot be computed honestly across a blend.

## Motivation

Nine asset classes have shipped and the add-a-pack recipe in the internal
developer wiki (`docs/wiki/05-calc-packs.md`) has held nine times.
`mixed_use` is the tenth and it breaks the recipe's central assumption: that one
asset class corresponds to one homogeneous income model with one natural
denominator.

Concretely, against the existing multifamily pack
(`packages/uwmd-core/src/packs/multifamily.ts`):

- `price_per_unit` is `valuation.purchase_price / property.total_units`. In a
  building with 120 apartments over 18,000 sf of retail, `total_units` counts
  only the apartments while `purchase_price` buys the whole property. The
  quotient is not price per unit. It is a number that looks like one.
- `noi_model.net_operating_income` is a single figure, but the retail component
  has expense recoveries and the residential component does not. A single
  expense ratio describes neither.
- The defaults table for a mixed property cannot exist as one table: the right
  vacancy assumption for the residential component and for the retail component
  are different numbers drawn from different markets.

This is the same class of error the `land` pack already taught us to avoid.
`land` deliberately omits `cap_rate`, `dscr`, and `debt_yield` because its
`noi_model` is a carry model that nets negative, and capitalizing it produces a
"−1.6% cap rate" that reads as a yield when it is a carry burden. The failure
mode is not a crash. It is a confidently wrong number in an underwriting
document.

Doing nothing is also a cost: `mixed_use` is a valid `AssetClass` that every
tool accepts and no tool can compute, so a real deal typed as `mixed_use` gets
silently degraded handling rather than an honest refusal.

## Proposed change

### 1. Why composition cannot live in the pack

The obvious design — evaluate each component with its own existing pack and
aggregate the results — is **not expressible in the Tier-3 calc engine**, and
this constraint drives the rest of the proposal.

`packages/uwmd-core/src/calc/parser.ts` admits exactly two relevant expression
forms: `{ kind: 'path'; head: string; segments: string[] }` and
`{ kind: 'call'; name: string; args: Expr[] }`. There is no array indexing, no
iteration, no comprehension, and no scoping operator that could re-base a
formula onto a subtree. `sum()` in `calc/builtins.ts` is variadic over
**explicit arguments**; it is not an aggregation over a collection.

So "for each component, evaluate that component's pack against that component's
subtree, then sum" would require a new calc primitive. That primitive would have
to be bounded against the sandbox's `MAX_NODES` cap, would need a matching Excel
emission for a dynamic range (the Excel↔calc parity invariant is to 6 decimals
over *every* metric), and would make the calc engine's cost depend on document
content. That is a large, high-risk change to the most safety-critical component
in the library, in service of one asset class.

The composition therefore belongs in the document shape, where static paths can
address it.

### 2. Component slots

Add an optional `components` section. It is a **bounded map keyed by the
component's own asset class**, not a variable-length array, so that every field
path in a formula stays static:

```json uw:section=components source=manual ts=2026-08-13T00:00:00Z v=1 confidence=high
{
  "section_id": "components",
  "content": {
    "multifamily": {
      "component_class": "multifamily",
      "effective_gross_income": 2180000,
      "operating_expenses": 880000,
      "net_operating_income": 1300000,
      "total_units": 120,
      "nra_sqft": 96000,
      "allocation_pct": 0.78
    },
    "retail": {
      "component_class": "retail",
      "effective_gross_income": 520000,
      "operating_expenses": 148000,
      "net_operating_income": 372000,
      "nra_sqft": 18000,
      "allocation_pct": 0.22
    }
  }
}
```

Normative rules (RFC 2119):

- The `components` section MAY appear only when `asset_class` is `mixed_use`. A
  document with any other asset class carrying a `components` section MUST be
  rejected. This keeps the section from becoming a general-purpose escape hatch.
- Each key MUST equal its entry's `component_class`, and `component_class` MUST
  be one of `multifamily`, `retail`, `office`, `industrial`, `self_storage`, or
  `hospitality`. Duplicate uses roll up into one component: a property with two
  retail suites has one `retail` component, because underwriting a mixed-use
  property rolls up by *use type*, not by tenancy.
- At least **two** components MUST be present. A single-component document is
  not mixed use and MUST use that component's own asset class, where a real pack
  and a real defaults table already apply.
- `land` MUST NOT be a component. Its `noi_model` is a carry model that nets
  negative by design; admitting it into an NOI rollup would let a carry burden
  silently reduce a property's income.

### 3. Absent versus unmeasured

`sum()` coerces `null` to `0` (`acc += n ?? 0` in `calc/builtins.ts`). That is
correct for an absent component and **dangerous** for a present one, because
both would contribute zero to a rollup and only one of them is honest.

Therefore:

- An **absent** component contributes nothing to any rollup. This is the
  intended, safe use of the coercion.
- A **present** component that omits a field its rollup consumes MUST raise a
  typed validation error, not resolve to zero. A present component with a
  missing NOI is an incomplete document, not a property with no income from that
  use.
- `null` in a component means *does not apply to this component* — never
  *not yet measured*, and never *the extractor found nothing*. This is the same
  `null`-versus-`0` rule the `land` pack already pins a test on, and the same
  distinction RFC 0018 draws for unstated lease terms.

### 4. Allocation, and the metrics that depend on it

One purchase price and one loan cover the whole property. Component-level
intensive metrics — price per apartment, loan per retail square foot — require
splitting those single figures across components, and **there is no deterministic
way to derive that split**. Income share, area share, and appraised-value share
all disagree, and the difference is a judgment an underwriter makes, not a
calculation.

So allocation is an **input**, never a derivation:

- `allocation_pct` is user-supplied, carries normal block provenance, and MUST
  sum to `1.0` across present components within a tolerance of `0.0001`.
- When `allocation_pct` is absent, every component-level intensive metric MUST
  evaluate to `null`. It MUST NOT fall back to an area-share or income-share
  guess. An agent MUST NOT populate `allocation_pct` — it is exactly the kind of
  judgment the format reserves for a human, and inferring it would smuggle a
  financial assumption in under the AI-never-does-math invariant.

The pack's metrics are then:

| Metric | Basis | Notes |
|---|---|---|
| `cap_rate` | property | `noi_model.net_operating_income / valuation.purchase_price`. Legitimate: one NOI, one price. |
| `ltv`, `dscr`, `debt_yield`, `cash_on_cash` | property | Unchanged from the multifamily pack. One loan, one debt service. |
| `<class>_noi_share` | component | Component NOI ÷ property NOI. Needs no allocation. |
| `price_per_residential_unit` | component | `(purchase_price × multifamily.allocation_pct) / multifamily.total_units`. `null` without allocation. |
| `<class>_price_psf` | component | `(purchase_price × <class>.allocation_pct) / <class>.nra_sqft`. `null` without allocation. |

**Deliberately omitted**, in the spirit of `land`:

- Property-level `price_per_unit` and `loan_per_unit`. Units are a residential
  denominator; the property is not all residential. These are the metrics that
  motivated this RFC, and the right answer is to not emit them.
- Any **blended market cap rate**. A weighted average of component cap rates
  reads as a market cap rate and is not one — the components carry different
  risk, and the blend of two observable market rates is not itself observable.
  The pack emits the property's going-in cap rate, which is an arithmetic fact
  about this deal, and refuses to synthesize a market-implied blend.

A conformance test MUST assert that no `mixed_use` formula reads
`property.total_units`, mirroring the existing `student_housing` test that
asserts no metric reads `property.total_units` because that class sizes per bed.

### 5. Component-scoped defaults need no new mechanism

A single `mixed_use` defaults table cannot be right for a mix-dependent field:
the residential vacancy assumption and the retail vacancy assumption are
different numbers from different markets.

The cascade already solves this. `resolveValue()` in `cascade.ts` reads
`ctx.asset_class ?? frontmatter.asset_class`, and an existing test
(`cascade.test.ts`, "explicit ctx.asset_class overrides frontmatter") pins that
precedence. Component-scoped defaults are therefore a **specification of when to
use an existing mechanism**, not a new one:

- When resolving a field **inside** a component, a host MUST pass that
  component's `component_class` as `ctx.asset_class`, so the component resolves
  against the real `retail` or `multifamily` defaults table.
- `MIXED_USE_DEFAULTS` covers only **mix-independent** fields — financing terms
  such as `debt_structure.ltv_pct`, which attach to the property and the loan
  rather than to a use.
- The `resolved_from` stamp already emitted by the cascade
  (`` `${table.asset_class}@${table.version}` ``) makes the provenance visible:
  a reader can see that a component's vacancy came from `retail@1.0.0`, not from
  a mixed-use table that quietly averaged something.

This is real reuse of the nine shipped defaults tables, and it costs no engine
change.

### 6. What this does *not* propose

The `mixed_use` pack does **not** reuse the component packs' calc bodies. Given
§1, it cannot, and claiming otherwise would imply a capability that does not
exist. `ModuleManifest.depends_on` remains what it is today — a load-ordering
declaration — and this RFC does not repurpose it as a composition operator.

The composition this RFC defines is over **data**: component subtotals in the
document, defaults resolved at component scope. The formulas are the
`mixed_use` pack's own, written once against static slot paths.

## Compatibility analysis

- **Existing `.uw.md` files** — none become invalid. The `components` section is
  new and optional, and it is gated to `asset_class: mixed_use`, which today has
  no pack and so has no behavior to change. No existing file can contain it.
- **Tier-1 Reader** — unaffected; an unknown section renders as a block like any
  other.
- **Tier-2 Editor** — unaffected. Byte preservation outside an edited region is
  untouched. A host that cannot interpret components simply does not offer to
  edit them.
- **Tier-3 Calc Host** — additive. A host that does not implement this RFC
  continues to resolve no pack for `mixed_use` and behaves exactly as it does
  today. A host that does implement it gains one pack registered under one key.
- **Tier-4 Agent Host** — additive, with one new prohibition: an agent MUST NOT
  populate `allocation_pct` (§4).
- **Modules** — no manifest schema change. `depends_on` is not redefined (§6).
- **The `AssetClass` union is unchanged.** This RFC registers the last existing
  member; it does not add one. Custom asset-class identifiers from modules
  remain the separate topic of RFC 0003.

Nothing breaks, so no deprecation path is required.

The one behavior change to an existing surface is that
`getPackForAssetClass('mixed_use')` and `getAssetClassDefaults('mixed_use')`
begin returning non-null. Thanks to the T12 refactor, no test or fixture depends
on either returning null any more — the "no pack registered" negative tests
anchor on the synthetic `__unregistered_test_class__` identifier, which is not
an `AssetClass` member and never will be.

## Conformance impact

No existing fixture requires changing — a direct consequence of T12, which is
what made this RFC implementable without disturbing unrelated tests.

New fixtures:

- `conformance/tier3/mixed-use-two-component/` — an apartment-over-retail
  property whose component NOIs sum to the property NOI, with every pack metric
  frozen.
- `conformance/tier3/mixed-use-no-allocation/` — `allocation_pct` absent; every
  component-level intensive metric MUST be `null` and MUST NOT be an area-share
  guess.
- `conformance/tier3/mixed-use-allocation-not-unity/` — allocations summing to
  `0.95`; rejected.
- `conformance/tier3/mixed-use-present-but-unmeasured/` — a present component
  missing an NOI its rollup consumes; a typed error, **not** a zero
  contribution. This is the fixture that pins §3 and the one most likely to
  regress silently, because the wrong behavior is a plausible-looking number.
- `conformance/tier3/mixed-use-single-component/` — one component; rejected.
- `conformance/tier3/mixed-use-land-component/` — a `land` component; rejected.
- `conformance/tier3/mixed-use-components-on-other-class/` — a `components`
  section on an `office` document; rejected.
- A defaults-cascade case proving a component field resolves from its own class
  table with `resolved_from` naming that table, not a mixed-use one.

## Reference implementation

**Files affected**

- `packages/uwmd-core/src/packs/mixed-use.ts` (new) + `packs/index.ts`
  registration; `src/index.ts` and `src/browser.ts` exports.
- `packages/uwmd-core/src/defaults.ts` — `MIXED_USE_DEFAULTS` (mix-independent
  fields only) + `REGISTRY` entry, and a `describe` block in `defaults.test.ts`
  asserting `low <= central <= high`, the source stamp, citations and units, and
  the expected field set. The hospitality table shipped without one; this must
  not repeat that.
- `packages/uwmd-core/src/validator.ts` — the component rules in §2/§3/§4 as
  typed errors.
- `spec/UW_FORMAT_SPEC_v1.md` + `spec/schemas/` — the `components` section.
  **Normative; this is why the change needs an RFC at all.**
- `packages/uwmd-excel/src/mixed-use.ts` + `layouts.ts` — one operating-statement
  block per present component plus a consolidation block. Slots are static, so
  named ranges stay static and the existing emitter is sufficient.
- `examples/` — a worked mixed-use example whose statement foots.

**API surface** — additive: `MIXED_USE_PACK`, `MIXED_USE_DEFAULTS`,
`MIXED_USE_LAYOUT`, and a `ComponentBreakdown` type. No signature changes.

**Test plan**

- Excel↔calc parity to 6 decimals for every metric, per the standing invariant.
- A footing test: component NOIs sum to `noi_model.net_operating_income`.
- A test that no `mixed_use` formula reads `property.total_units` (§4).
- Absent-versus-unmeasured (§3) — the highest-value test here.
- Allocation absent ⇒ intensive metrics `null`, not a fallback guess.
- Component-scoped default resolution with the correct `resolved_from` stamp.
- **The excel suite test count must rise by 4.** If it does not, the class is
  being silently skipped by the parity loop — the check every previous pack has
  had to make.

## Alternatives considered

1. **Per-component pack evaluation with a new iteration primitive.** The most
   conceptually elegant option: each component evaluated by its own shipped
   pack, results aggregated. Rejected because it is not expressible today (§1)
   and the enabling primitive would touch the sandboxed calc engine, its
   `MAX_NODES` bound, and the Excel emitter's static-range assumption. Large
   blast radius on the most safety-critical code in the library, for one class.
2. **A variable-length `components` array.** More natural as data modelling, but
   formulas address `head.segments` statically — there is no way to write "the
   third component" or "every component". Fixed slots keyed by class are what
   the calc engine can actually address, and rolling up by use type is the
   underwriting convention anyway.
3. **Treat `mixed_use` as multifamily with a retail income line.** Cheapest, and
   it is what users do today by hand. Rejected: it discards the retail drivers
   (recoveries, TI, leasing commissions) and reproduces exactly the misleading
   `price_per_unit` this RFC exists to eliminate.
4. **Relax one-pack-per-class and register several packs for `mixed_use`.**
   Rejected: `getPackForAssetClass` returns one manifest and the Excel layout
   selector assumes one layout. Changing that arity would ripple through every
   consumer — editor, Excel, CLI, refinement — to serve a single class, and
   §2's slots make it unnecessary.
5. **Ship no `mixed_use` pack and refuse the class explicitly.** A legitimate
   outcome and the honest status quo. Rejected because the class is already in
   the union and already accepted by every parser, so refusal is only better
   than a wrong answer — not better than a correct one.
6. **Derive `allocation_pct` from area or income share.** Rejected: it produces
   a plausible number for a question that has no single right answer, and it
   would make the library assert a financial judgment rather than compute a
   deterministic result.

## Unresolved questions

- **Operating-business components.** `hospitality` is admitted as a component,
  but its pack carries model-level subtotals (`gross_operating_profit`) *outside*
  `noi_model.expenses` so its statement foots without double counting.
  `senior_housing` and `student_housing` do the same and are **excluded** here
  pending a decision on how an operating business's GOP layer participates in a
  real-estate NOI rollup. Admitting hospitality but not the other two is
  deliberate but not obviously stable.
- **Whether `MIXED_USE_DEFAULTS` should exist at all**, versus resolving every
  field at component scope and leaving `getAssetClassDefaults('mixed_use')`
  null. The proposal keeps a minimal table for financing terms; a reviewer may
  reasonably prefer none.
- **Component-level debt.** Some mixed-use deals carry separate financing on a
  commercial condo component. This RFC assumes one property-level loan and
  defers component-level debt structures.
- Whether the web editor should render one metric strip per component or a
  single consolidated strip is a presentation question deferred to T14.

## Prior art

Segment reporting under IFRS 8 and ASC 280 solves the same shape of problem —
one legal entity, several economically distinct units, disclosed separately and
reconciled to a consolidated total — and its reconciliation requirement is the
direct ancestor of the footing rule in §3. Appraisal practice's sum-of-the-parts
component valuation informs the allocation-as-input decision in §4: appraisers
allocate value across uses by stated judgment and disclose the basis, rather
than deriving it. OpenAPI's discriminated unions inform keying each slot by its
own `component_class`.
