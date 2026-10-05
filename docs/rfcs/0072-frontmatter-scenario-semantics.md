---
rfc: 0072
title: Give frontmatter `scenario` a defined meaning
status: draft
author: claude-code (agent proposal)
created: 2026-10-04
affects:
  - format-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0072: Give frontmatter `scenario` a defined meaning

## Summary

Frontmatter `scenario` lists twelve values (Format §2.2), but the format
defines none of them, and no validator, pack, default table or cross-check
reads the field. Issue #255 (StackUW `UPSTREAM-022`) asks for `scenario` to
mean the deal's business plan and for `build_to_rent` to be defined.

This draft **defines nothing yet**. It records the evidence, maps the
existing surfaces, and isolates the owner decisions (D1–D6 under
[Unresolved questions](#unresolved-questions)) that must be made before any
normative text is written. No normative text, schema, code, fixture or version
change is authorized by this RFC's presence.

## Motivation

### Evidence

- **The list.** `spec/UW_FORMAT_SPEC_v1.md` line 160:
  `stabilized_acquisition | ground_up_development | value_add | lease_up |
  nnn_single_tenant | lihtc_section8 | house_flip | commercial_flip |
  property_conversion | build_to_rent | distressed_reo | land_banking`.
  There is no definition, no rule for choosing among values, and no statement
  of whether the list is closed. Format v2 does not change the field.
- **No consumer.** `UWFrontmatter.scenario` is `string | null`
  (`packages/uwmd-core/src/types.ts`). No validator, pack, default table or
  cross-check reads it. No JSON Schema covers frontmatter.
- **Tooling.** Since PR #257, `uwmd init --scenario` (§6.7) writes only a
  listed value and refuses anything else. That is CLI hygiene; it assigns no
  meaning.
- **Corpus.** In examples, conformance fixtures and package fixtures, the
  values in use are `stabilized_acquisition` (19 files), `value_add`
  (`examples/Riverside-Office-Phoenix-AZ.uwx.md`), `null`, and one
  value that is **not listed**: `entitled_land_acquisition`
  (`examples/Sundance-Ranch-Land-Buckeye-AZ.uwx.md`). That example validates
  today, so in practice the list is not enforced as closed.
- **Adopter need.** StackUW is adding a build-to-rent product: the stabilized
  acquisition of a community of detached or attached homes leased by the home,
  underwritten as multifamily. It is holding emission of
  `scenario: build_to_rent` until the value is defined, so that one producer's
  meaning does not become the default.

### The twelve values are not one axis

As an analysis, not a decision: the listed values describe at least four
different things about a deal.

| Axis | Values |
|---|---|
| Business plan / execution | `stabilized_acquisition`, `value_add`, `lease_up`, `ground_up_development`, `property_conversion`, `house_flip`, `commercial_flip`, `land_banking` |
| Product or lease form | `build_to_rent`, `nnn_single_tenant` |
| Regulatory or capital program | `lihtc_section8` |
| Acquisition circumstance | `distressed_reo` |

A deal can sit on several axes at once. A stabilized acquisition of a
build-to-rent community is both `stabilized_acquisition` and `build_to_rent`;
a value-add LIHTC deal is both `value_add` and `lihtc_section8`. One field
with one value cannot state both. #255's "which value wins" question is
therefore structural, not just a tie-break.

### "Scenario" already has other meanings

| Surface | Meaning |
|---|---|
| Frontmatter `scenario` (§2.2) | Undefined; the subject of this RFC. |
| `scenario_default` source tag (§2.6) | "A value derived from a named scenario in this file or institution config." |
| Appendix B, "Scenario Default Keys" | Assumptions "populated from `scenario_defaults.json`". No such file exists in the repository; Protocol §V.7 defaults are keyed by **asset class**. |
| `stress_tests`, `custom_scenarios` (§4.20), section variants (`base`/`upside`/`downside`) | Analytical what-if cases inside one deal. |
| Lite `scenario=` attribute (`UW_LITE_SPEC_v1.md`) | Field identity qualifier; only `base` is accepted today. |

Defining frontmatter `scenario` as a business plan must not be read as
defining any of the others, and vice versa.

## Existing surfaces checked

| Surface | What it carries | Fit for "build-to-rent" or "business plan" |
|---|---|---|
| `asset_class` (§2.2) | Property type; closed standard list plus namespaced module classes (RFC 0003). | BTR is underwritten as multifamily, so a new class or module class would split one underwriting model in two. |
| `asset_subtype` (§2.2) | Free string, "e.g. garden_style". | Described as physical subtype. BTR describes product form, so it is a candidate home, but the field has no vocabulary and no defined values. |
| `loan_type` (§2.2) | `permanent | bridge | construction | value_add | refinance`. | Financing, not plan, though `value_add` and `construction` overlap with plan values. |
| `deal_context.hold_strategy` (§4.0) | Closed: `exit_at_stabilization | long_term_hold | develop_and_sell | refinance_and_hold | 1031_exchange | portfolio_addition | flip | other`. | An existing structured business-plan representation, but for **hold/exit** strategy and inside a section rather than frontmatter. |
| `deal_context.value_creation_strategy` (§4.0) | Free string. | Narrative; not machine-routable. |
| Document profiles and deal packages (RFC 0018) | Composition of documents. | Describe document shape, not the deal's plan. |
| Modules (RFC 0003) | Asset-class declarations, packs, rules. | Would make BTR a different class; see `asset_class`. |
| `rent_roll.unit_mix_summary` | Home mix. | Says nothing about the plan. |
| ROADMAP "Nearest asset-class extensions" | Demand-gated parcel-array vs. RFC 0021 composition decision for SFR/BTR **scattered-site** deals. | Out of scope for #255, which asks only for single-site BTR. |

**Narrowest layer.** Defining what a frontmatter value asserts is a **Format**
change. It needs a Protocol change only if a validator, cross-check, default
selection or calc behavior is made to depend on the value (D5). No module,
profile or asset-class change is needed for single-site BTR.

## Proposed change

**Not yet proposed.** Once D1–D6 are decided, this section will specify:

1. normative Format §2.2 text stating what `scenario` asserts, and a one-line
   definition for each retained value;
2. the rule for a deal that fits more than one value, or the field structure
   that removes the need for one (D2);
3. whether the value list is closed, and what a reader does with an unlisted
   value (D3);
4. where product-form, program and circumstance values live if they leave
   `scenario` (D1, D4), with a migration note for any moved value;
5. validator behavior, if any, with code and severity (D5);
6. the Format version label (D6);
7. the matching `INIT_SCENARIOS` list for `uwmd init`.

Any answer must keep these invariants: rates and financial math are
untouched; existing documents keep parsing; and a value's definition must not
change what a pack computes unless a separate RFC says so.

## Compatibility analysis

Depends on D1–D5. Known exposures:

- **`entitled_land_acquisition`** in the Sundance land example would become
  invalid or flagged if D3 closes the list.
- **Moved values.** If `build_to_rent` or others move to another field (D1,
  D4), no known producer emits them yet (StackUW is holding), so the
  migration cost is low now and rises once anyone emits them.
- **`stabilized_acquisition`** is the only value with real corpus use; any
  definition must keep the 19 fixtures valid.
- **Readers.** A definition alone changes no Tier-1–4 behavior. Behavior
  changes only if D5 adds validation.

## Conformance impact

Sketch only; files land with an implementation:

- one fixture per newly defined value that a validator acts on;
- an absent-field fixture proving a document without `scenario` validates
  byte-identically to today;
- if D3 closes the list, a fixture for an unlisted value at the chosen
  severity;
- if D2 adds a second field, a fixture for a deal that sets both
  (for example stabilized acquisition plus build-to-rent).

## Reference implementation

Likely files: `spec/UW_FORMAT_SPEC_v1.md` §2.2 (and §6.7 if `init` changes);
`packages/uwmd-core/src/types.ts`; `packages/uwmd-core/src/init.ts`
(`INIT_SCENARIOS` and its spec-line test); `validator.ts` and
`docs/wiki/10-conventions-invariants.md` only if D5 adds validation; any moved
example. The test plan follows from the decisions.

## Alternatives considered

None is selected. Each is a coherent answer to D1–D2:

- **A. `scenario` is the business plan only.** Keep the execution values;
  move `build_to_rent` and `nnn_single_tenant` toward `asset_subtype` (with a
  defined vocabulary), and decide separately where `lihtc_section8` and
  `distressed_reo` live. One value per axis, no tie-break needed. Cost: a
  vocabulary for `asset_subtype`, which is free today, and a migration note.
- **B. Keep one mixed field with a precedence rule.** Define all twelve and
  rank them (for example product form over plan). Smallest spec change. Cost:
  the losing fact is lost; a stabilized BTR acquisition cannot say it is
  stabilized.
- **C. Split into named axes.** `scenario` (plan) plus new frontmatter fields
  for product form and program. Most expressive. Cost: new fields, more
  surface than #255 asks for.
- **D. Define `build_to_rent` only.** Answer #255 narrowly and leave the other
  eleven undefined. Cost: the selection problem is unanswered, and the next
  value request reopens it.
- **E. Status quo plus extension.** StackUW keeps the identity in an `x_`
  section or the assumptions registry. Rejected by the reporter as defining
  protocol meaning outside the protocol, and invisible to other readers.

## Unresolved questions

These are **owner decisions**. The RFC must not encode an answer to any of
them until it is made.

- **D1 — What does `scenario` name?** The business plan only; a mix of axes;
  or something else. This decides how it relates to `asset_subtype`
  (physical/product form) and to `deal_context.hold_strategy` (hold/exit).
- **D2 — Several fitting values.** A precedence rule, a multi-value field, or
  separate fields per axis (alternatives A–C).
- **D3 — Closed or open list.** And what a reader does with an unlisted value
  such as `entitled_land_acquisition`.
- **D4 — Where `build_to_rent` lives.** A `scenario` value, an
  `asset_subtype` value, or a new field; and its definition (#255 proposes:
  detached or attached homes built to be leased by the home, on one site and
  under one loan, scattered-site SFR out of scope).
- **D5 — Behavior.** Purely descriptive, or acted on by validators,
  cross-checks or default selection. Anything beyond descriptive also touches
  the Protocol.
- **D6 — Vestigial senses.** Whether this RFC also repairs Appendix B's
  nonexistent `scenario_defaults.json` and the `scenario_default` source-tag
  wording, or leaves them to a separate editorial fix.

## Prior art

Institutional real-estate indices classify funds by investment style (core,
value-add, opportunistic) separately from property type, which supports
treating plan and product form as different axes. RFC 0060 is the in-repo
precedent for refusing to merge distinct concepts into one enum.
