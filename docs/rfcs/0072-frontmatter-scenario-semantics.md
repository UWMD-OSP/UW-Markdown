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

The owner set the direction on 2026-10-04 ([Owner direction](#owner-direction-2026-10-04)):
`scenario` names the business plan, stays single-valued, takes a closed
standard vocabulary with an existing extension mechanism, and is descriptive
only; `build_to_rent` is not a scenario. The exact field design, vocabulary,
severities and migration remain RFC work ([Open RFC questions](#open-rfc-questions)).

The RFC stays `draft`. No normative text, schema, code, fixture or version
change is authorized by this RFC's presence, and no `scenario` semantics have
shipped.

## Owner direction (2026-10-04)

These decisions bind the RFC. They set direction; they are not acceptance.

| # | Decision |
|---|---|
| D1 | `scenario` represents the deal's **business plan / execution strategy**. It does not represent product form, a regulatory or capital program, or the acquisition circumstance. |
| D2 | `scenario` stays **single-valued**. Overlapping independent facts are not resolved by precedence; each goes on its correct semantic axis. |
| D3 | Standard `scenario` values form a **closed standard vocabulary**. Extensibility uses the project's existing extension/namespacing mechanisms, not arbitrary undocumented bare values. |
| D4 | `build_to_rent` is **not a scenario**. Single-site BTR is `asset_class: multifamily` plus an appropriate product/subtype representation. No new asset class or module solely for single-site BTR identity, absent new evidence. |
| D5 | Scenario and subtype identity are **descriptive and routable only**. They must not alter calculations, defaults, underwriting semantics, or validation beyond structural/vocabulary validity. Any such behavior needs separately governed semantics. |
| D6 | The vestigial Appendix B `scenario_defaults.json` and `scenario_default` wording is repaired **separately**, unless this RFC needs a narrow edit to avoid contradicting D5. |

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
  meaning does not become the default. Under D4 the eventual answer is not a
  `scenario` value.

### The twelve values are not one axis

| Axis | Values | Under D1 |
|---|---|---|
| Business plan / execution | `stabilized_acquisition`, `value_add`, `lease_up`, `ground_up_development`, `property_conversion`, `house_flip`, `commercial_flip`, `land_banking` | Candidates for the closed vocabulary (R1). |
| Product or lease form | `build_to_rent`, `nnn_single_tenant` | Leave `scenario` (D1, D4). |
| Regulatory or capital program | `lihtc_section8` | Leaves `scenario` (D1). |
| Acquisition circumstance | `distressed_reo` | Leaves `scenario` (D1). |

The axis assignment of each value is this RFC's reading, to be confirmed with
the definitions (R1). `entitled_land_acquisition` reads as a plan value but is
unlisted (R3).

### "Scenario" already has other meanings

| Surface | Meaning |
|---|---|
| Frontmatter `scenario` (§2.2) | Undefined; the subject of this RFC. |
| `scenario_default` source tag (§2.6) | "A value derived from a named scenario in this file or institution config." |
| Appendix B, "Scenario Default Keys" | Assumptions "populated from `scenario_defaults.json`". No such file exists in the repository; Protocol §V.7 defaults are keyed by **asset class**. |
| `stress_tests`, `custom_scenarios` (§4.20), section variants (`base`/`upside`/`downside`) | Analytical what-if cases inside one deal. |
| Lite `scenario=` attribute (`UW_LITE_SPEC_v1.md`) | Field identity qualifier; only `base` is accepted today. |

Defining frontmatter `scenario` as a business plan does not define any of the
others. Appendix B's wording can be read as frontmatter `scenario` selecting
defaults, which D5 forbids; see R7.

## Existing surfaces checked

| Surface | What it carries | Bearing |
|---|---|---|
| `asset_class` (§2.2, §2.2a) | Closed builtin list plus reverse-DNS namespaced, module-declared classes (RFC 0003). | Single-site BTR stays `multifamily` (D4). §2.2a is one existing extension mechanism for D3. |
| `asset_subtype` (§2.2 and §4.1) | Free string, "e.g. garden_style, strip_center, warehouse". | The candidate product/subtype home under D4; see [the subtype finding](#the-product-or-subtype-carrier-is-not-ready-as-is). |
| `loan_type` (§2.2) | `permanent | bridge | construction | value_add | refinance`. | Financing, not plan; `value_add` overlaps by name only. |
| `deal_context.hold_strategy` (§4.0) | Closed: `exit_at_stabilization | long_term_hold | develop_and_sell | refinance_and_hold | 1031_exchange | portfolio_addition | flip | other`. | Hold/exit strategy, a neighboring axis inside a section. Its relation to `scenario` needs stating (R1). |
| `deal_context.value_creation_strategy` (§4.0) | Free string. | Narrative; not routable. |
| Closed vocabulary with a label-bearing `other` (RFC 0052, reused by RFC 0056) | A closed list plus `other` carrying a required label. | The second existing extension mechanism for D3. |
| Document profiles and deal packages (RFC 0018), modules (RFC 0003) | Composition; asset-class declarations. | Not needed for single-site BTR (D4). |
| ROADMAP "Nearest asset-class extensions" | Demand-gated scattered-site SFR/BTR decision. | Out of scope; #255 asks only for single-site BTR. |

### The product or subtype carrier is not ready as is

D4 points BTR at "an appropriate product/subtype representation". The current
contract for `asset_subtype` does not yet support a defined value:

1. **What it names is unstated.** §2.2's comment examples are physical forms
   (`garden_style`, `strip_center`, `warehouse`). BTR is a product or tenure
   form: the same community can also be physically `garden_style` or
   detached homes. With one single-valued field, BTR would compete with the
   physical form, which recreates D2's overlap one level down.
2. **The corpus already mixes axes in it.** Values in use include physical
   form (`garden_style`, `garden`, `midrise`), location (`suburban`),
   entitlement state (`entitled_residential`), product (`purpose_built_off_campus`),
   service level (`select_service`, `boutique`) and composition
   (`apartments_over_retail_with_hotel`). `garden` and `garden_style` appear to
   name the same form under two spellings.
3. **Two carriers, no agreement rule.** `asset_subtype` exists in frontmatter
   (§2.2) and in the `property` section (§4.1). Nothing says which governs or
   that they must agree. The renderer prefers the section value
   (`renderer.ts`); five examples state it only in frontmatter.
4. **No schema and no class scope.** No JSON Schema covers either carrier, and
   subtype values are implicitly class-relative (`strip_center` is retail).

So formalizing a product/subtype vocabulary needs more than adding a value to
the free string. At minimum the RFC must state what the carrier names, how the
two carriers relate, whether values are class-scoped, and what happens to
existing free values. Whether that is done by defining `asset_subtype` or by a
separate product-form carrier is R4; this RFC does not assume either.

## Proposed change

**Partially directed, not yet specified.** Under D1–D6 the change will:

1. define frontmatter `scenario` as the deal's business plan / execution
   strategy, single-valued, with a closed standard vocabulary and a one-line
   definition per value (R1);
2. name the existing mechanism through which non-standard plan values are
   expressed (R2);
3. state the structural/vocabulary validation, with code and severity, for an
   unlisted or retired value (R3); no other validation (D5);
4. remove `build_to_rent`, `nnn_single_tenant`, `lihtc_section8` and
   `distressed_reo` from the standard `scenario` vocabulary, with a migration
   note (R3, R6);
5. give single-site BTR a defined product/subtype representation on
   `multifamily` (R4, R5), with the carrier contract that requires;
6. update `INIT_SCENARIOS` and `uwmd init` to the new vocabulary;
7. select the Format version label (R8).

Invariants: no calculation, default, pack or underwriting semantics depend on
`scenario` or the subtype (D5); existing documents keep parsing; rates and
financial math are untouched.

## Compatibility analysis

- **`stabilized_acquisition`** (19 files) and **`value_add`** (1 file) are
  plan values and should survive any vocabulary.
- **`entitled_land_acquisition`** (Sundance example) is unlisted; under D3 it
  becomes either a standard plan value, an extension-form value, or an
  invalid/flagged value (R3).
- **Retired values** (`build_to_rent`, `nnn_single_tenant`, `lihtc_section8`,
  `distressed_reo`) appear in no corpus file, and StackUW is holding BTR
  emission, so retiring them now costs little. Third-party documents may still
  carry them; R3 sets how they are reported.
- **`asset_subtype`** carries free values in 28 corpus files. Any
  closed or class-scoped vocabulary there is a migration (R4).
- **Readers.** Under D5, Tier-1–4 behavior changes only by the vocabulary
  check; no calculation or default changes.

## Conformance impact

Sketch only; files land with an implementation:

- one valid fixture per standard plan value class, including a stabilized
  multifamily BTR acquisition that states its plan and its product form on
  separate axes;
- an absent-field fixture proving a document without `scenario` validates as
  it does today;
- fixtures for an unlisted bare value, a retired value and an extension-form
  value, at the severities R3 selects;
- if R4 defines a subtype contract, fixtures for the carrier-agreement rule.

## Reference implementation

Likely files: `spec/UW_FORMAT_SPEC_v1.md` §2.2, §4.1, §5 (validation code),
§6.7 and possibly Appendix B (R7); `packages/uwmd-core/src/types.ts`;
`init.ts` (`INIT_SCENARIOS` and its spec-line test); `validator.ts` for the
vocabulary check only; the Sundance example if R3 changes its status;
`docs/wiki/10-conventions-invariants.md`. The test plan follows from R1–R8.

## Alternatives considered

The owner direction settles the main fork. For the record:

- **Mixed field with a precedence rule.** Rejected by D2.
- **Multi-valued `scenario`.** Rejected by D2.
- **`build_to_rent` as a `scenario` value.** Rejected by D4.
- **A new asset class or module for single-site BTR.** Rejected by D4 absent
  new evidence.
- **Status quo plus an `x_` section.** Rejected by the reporter as defining
  protocol meaning outside the protocol, and invisible to other readers.

Still open, under R4: define what `asset_subtype` names and give it a
vocabulary, or add a separate product-form carrier and leave `asset_subtype`
physical.

## Open RFC questions

These are RFC work under the owner direction, to be justified from the current
contract before any normative text is written.

- **R1 — Plan vocabulary.** Which plan values are standard, their one-line
  definitions, and how `scenario` relates to `deal_context.hold_strategy`.
- **R2 — Extension mechanism.** §2.2a reverse-DNS namespaced identifiers, or
  RFC 0052's label-bearing `other`. If namespaced, whether a value must be
  declared by a module as custom asset classes are.
- **R3 — Unlisted and retired values.** Validation code, severity, and the
  deprecation path; the fate of `entitled_land_acquisition`.
- **R4 — Product/subtype carrier.** Define `asset_subtype` (what it names,
  class scope, closed or open, frontmatter/§4.1 agreement, migration of current
  free values), or add a separate product-form carrier.
- **R5 — The BTR definition.** #255 proposes: a community of detached or
  attached homes built to be leased by the home, on one site and under one
  loan; scattered-site SFR out of scope.
- **R6 — Homes for retired values.** Whether `nnn_single_tenant`,
  `lihtc_section8` and `distressed_reo` need a carrier now, or retire with no
  replacement until an adopter asks.
- **R7 — Appendix B contradiction.** Whether a narrow edit is needed so
  Appendix B and the `scenario_default` tag cannot be read as `scenario`
  selecting defaults (D5, D6).
- **R8 — Version.** The Format version label and whether a Protocol change is
  needed (D5 suggests not, if the vocabulary check lives in Format §5).

## Prior art

Institutional real-estate indices classify funds by investment style (core,
value-add, opportunistic) separately from property type, which supports
treating plan and product form as different axes. RFC 0060 is the in-repo
precedent for refusing to merge distinct concepts into one enum, and RFC 0003
(§2.2a) and RFC 0052 are the in-repo precedents for extending a closed
vocabulary.
