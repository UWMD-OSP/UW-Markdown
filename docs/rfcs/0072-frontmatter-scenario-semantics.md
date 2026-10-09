---
rfc: 0072
title: Give frontmatter `scenario` a defined meaning
status: accepted
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

Frontmatter `scenario` describes one business plan / execution strategy. It
uses eight standard plans or an owned reverse-DNS extension. Product identity,
program and acquisition circumstance are separate axes. Single-site BTR is
`asset_class: multifamily` and `asset_subtype: build_to_rent`, paired with its
actual plan (for example `stabilized_acquisition`).

This RFC and its implementation ship in one PR. Status is `accepted`; the
merge is acceptance. All new identity diagnostics are warnings in both format
generations: existing valid documents gain no errors. No calculation, default,
pack or underwriting behavior depends on either label.

## Owner direction (2026-10-04)

These owner decisions bind the RFC. The merge of this RFC and its implementation is acceptance.

| # | Decision |
|---|---|
| D1 | `scenario` represents the deal's **business plan / execution strategy**. It does not represent product form, a regulatory or capital program, or the acquisition circumstance. |
| D2 | `scenario` stays **single-valued**. Overlapping independent facts are not resolved by precedence; each goes on its correct semantic axis. |
| D3 | Standard `scenario` values form a **closed standard vocabulary**. Extensibility uses the project's existing extension/namespacing mechanisms, not arbitrary undocumented bare values. |
| D4 | `build_to_rent` is **not a scenario**. Single-site BTR is `asset_class: multifamily` plus an appropriate product/subtype representation. No new asset class or module solely for single-site BTR identity, absent new evidence. |
| D5 | Scenario and subtype identity are **descriptive and routable only**. They must not alter calculations, defaults, underwriting semantics, or validation beyond structural/vocabulary validity. Any such behavior needs separately governed semantics. |
| D6 | The vestigial Appendix B `scenario_defaults.json` and `scenario_default` wording is repaired **separately**, unless this RFC needs a narrow edit to avoid contradicting D5. |

## Motivation and existing evidence

Issue #255 (StackUW `UPSTREAM-022`) needs a defined single-site BTR identity.
The original twelve-value scenario list mixed plans with product/lease form
(`build_to_rent`, `nnn_single_tenant`), regulatory/capital program
(`lihtc_section8`) and acquisition circumstance (`distressed_reo`). It defined
none. Core admitted `string | null`; PR #257 made init write listed values,
but no validator or calculation consumed the field.

The pre-RFC corpus uses `stabilized_acquisition`, `value_add`, null and the
unlisted `entitled_land_acquisition` in Sundance. Twenty-eight corpus files
carry free subtype values spanning form, location, service and product; this
RFC neither rewrites nor closes them. The property renderer historically
prefers its local subtype; that display behavior does not resolve document
identity. This RFC specifies identity authority without rewriting either
carrier or changing rendering.

## Decisions

| Question | Decision | Why (precedent) |
|---|---|---|
| R1 — Plan vocabulary and hold strategy | Retain the eight execution plans: `stabilized_acquisition`, `ground_up_development`, `value_add`, `lease_up`, `house_flip`, `commercial_flip`, `property_conversion`, `land_banking`, with the definitions below. `deal_context.hold_strategy` remains the independent hold/exit axis; no automatic precedence or inference between axes. | D1–D2; the original list already contains these plans. Format §4.0 distinguishes execution narrative from hold/exit strategy; RFC 0060 keeps distinct concepts on separate axes. |
| R2 — Extensions | Accept reverse-DNS identifiers using Format §2.2a's three-or-more lowercase segment grammar. No module declaration, label field or bare `other` is added. | §2.2a fixes namespace ownership. Unlike an asset class, a descriptive plan needs no module-provided calculations or resolution. RFC 0052's `other` requires a label-bearing object; adding that structure to this scalar is unnecessary. |
| R3 — Unlisted and retired values | `DQ-07` warning for any non-null value outside the standard vocabulary and extension grammar, including malformed types and all four retired values, in both 1.x and 2.x. Absence/null stays valid. Preserve bytes; no escalation or automatic migration. `entitled_land_acquisition` remains unlisted and warns; an author may deliberately restate it as a namespaced plan. | Existing `DQ-NN` family covers data-quality guidance; RFC 0031 warns on legacy vocabulary and preserves raw bytes. Its later major-boundary escalation is deliberately not adopted: this RFC must preserve today's valid documents. |
| R4 — Subtype carrier | Keep both `asset_subtype` carriers open and optional. Define only `build_to_rent`, scoped to frontmatter `asset_class: multifamily`. Frontmatter governs identity; property is a fallback when frontmatter is absent/null. If either carrier states BTR and both non-null carriers differ, warn `DQ-08`; BTR outside multifamily warns `DQ-09`. No checks or migrations for other free subtype values. | D4; existing Format §2.2/§4.1 carriers suffice. RFC 0052's opt-in additions preserve absent-field behavior. A closed subtype taxonomy would exceed the evidence and disturb the 28 existing free-value corpus files. |
| R5 — BTR definition | A community of detached or attached homes purpose-built to be leased by the home, on one site and under one loan. Scattered-site single-family portfolios are outside this defined identity. The label asserts identity only; no loan-count or financial cross-check is added. | Issue #255 (StackUW UPSTREAM-022) supplies the product boundary; D4 retains multifamily and D5 forbids underwriting behavior driven by the label. |
| R6 — Retired values' homes | Retire `build_to_rent`, `nnn_single_tenant`, `lihtc_section8`, `distressed_reo` from the standard plan list. BTR uses the defined subtype. The other facts may remain in existing lease, compliance and acquisition narratives; do not invent new canonical carriers or lossless automatic mappings. | D1 separates lease/product, program and acquisition circumstance from execution. RFC 0031 documents retired vocabulary and refuses to guess a migration; a new carrier needs adopter evidence. |
| R7 — Default wording | Add narrow disclaimers to Appendix B and `scenario_default`: neither refers to frontmatter `scenario` or selects defaults from it. Leave the vestigial file reference and wider repair for a separate RFC/PR. | D5–D6; Protocol §V.7 already keys published defaults by asset class, not frontmatter business plan. |
| R8 — Version | Keep Format 2.0 and Protocol 2.22.0 labels. This clarifies existing optional scalar fields and adds warnings without changing syntax, admission, math or protocol procedures. Extend the existing remediation registry/schema documentation together; package/release version assignment remains release preparation. | Independent surface versioning in VERSIONS.md; prior additive section work retained the Format label, and RFCs 0075–0076 defer release version assignment. No new protocol procedure or major-boundary escalation is introduced. |

## Normative change

### Business plans (Format §2.2b)

`scenario` is optional and single-valued. Absent or null makes no assertion.
For new production, use one standard plan or a namespaced extension. The
standard vocabulary is closed:

| Value | Business plan / execution strategy |
|---|---|
| `stabilized_acquisition` | Acquire an already stabilized income property and operate it without a material repositioning plan. |
| `ground_up_development` | Create new improvements through ground-up construction before sale or stabilized operation. |
| `value_add` | Reposition an existing property through improvements or operating changes. |
| `lease_up` | Execute initial or renewed leasing to bring an existing property to stabilized occupancy. |
| `house_flip` | Improve an existing home for resale rather than continuing rental operation. |
| `commercial_flip` | Improve or reposition an existing commercial property for resale rather than continuing operation. |
| `property_conversion` | Convert existing improvements to a different property use. |
| `land_banking` | Hold land for a future development or disposition opportunity without a current construction plan. |

The author states the execution strategy; no precedence, class inference or
hold-strategy inference resolves overlapping descriptions. Product form,
program and acquisition circumstance go on their own axes; narrative can
explain a composite execution strategy. Analytical stress cases, custom
scenarios and section variants retain their separate meanings.

An extension uses `segment ('.' segment){2,}`, with
`segment := [a-z][a-z0-9_]*`, as in Format §2.2a. It needs no module declaration
because it conveys no executable semantics. Preserve the full identifier;
never interpret a suffix as a standard plan or infer defaults from it.

### Single-site BTR (Format §2.2c and §4.1)

Both subtype fields stay free strings. The sole value defined here is
`build_to_rent` on `multifamily`: a community of detached or attached homes
purpose-built to be leased by the home, on one site and under one loan.
Scattered-site single-family portfolios are outside this definition. Other
physical-form details remain in property fields or narrative; this identity
is not a new asset class, module, pack or subtype taxonomy.

Frontmatter is authoritative for descriptive subtype identity. The canonical
property block supplies a fallback only if frontmatter is absent or null.
When either carrier states BTR, two non-null carriers SHOULD agree; disagreement
warns without overwriting either. This authority rule does not force a display
renderer to discard section-local text. No other free-value agreement or class
scope check is introduced.

```yaml
asset_class: multifamily
asset_subtype: build_to_rent
scenario: stabilized_acquisition
```

### Validation (Format §5.4)

| Code | Severity | Condition |
|---|---|---|
| `DQ-07` | warning | Non-null scenario is not a standard plan or well-formed reverse-DNS extension, including retired values and non-string structures. |
| `DQ-08` | warning | Either subtype carrier states BTR and both non-null carriers disagree. |
| `DQ-09` | warning | Either subtype carrier states BTR outside frontmatter `asset_class: multifamily`. |

These are structural/vocabulary checks only. No stage requirements, defaults,
financial cross-checks, calculation selection or underwriting rules depend on
scenario/subtype identity. They never escalate with the file's format version.
Absent/null values and all other free subtype values add no diagnostics.

### Retired vocabulary and migration

The four non-plan values leave the standard scenario vocabulary. Readers retain
and warn on them; they never reject or rewrite historical documents. New init
output accepts the eight plans and namespaced extensions, and refuses retired,
unlisted or malformed plan arguments before writing a file. Existing library
callers can still serialize legacy strings for lossless round-trips.

There is no automatic conversion: `scenario: build_to_rent` does not identify
an execution strategy. An author who knows the facts can state the subtype and
actual plan independently. Sundance remains unchanged and gains only `DQ-07`;
restating its label requires an explicit author choice. NNN lease form, LIHTC/
Section 8 program and REO acquisition circumstances can be described in existing
lease/compliance/acquisition narratives pending evidence for a canonical field.

## Conformance impact

The `scenario` suite contains one valid fixture per standard plan, including a
stabilized multifamily BTR acquisition on separate axes; absent and null
scenario cases; unlisted, all four retired, namespaced, malformed namespace and
non-string values; subtype fallback, disagreement, class scope and existing
free-value cases. Expectations freeze code and warning severity and require
zero errors. They run in the default corpus and through the v2 CLI driver.

Unit regressions additionally exercise both format generations, preserve raw
source bytes, compare stage readiness/coverage and unrelated findings, and
check unchanged pack calculation and default-resolution results under varied
identity labels. CLI smoke tests pin namespaced plans, BTR scaffolding and
refusal before output for retired or malformed arguments.

## Reference implementation

`scenario.ts` exports the closed vocabulary and grammar predicate; `types.ts`
keeps the document boundary open. `validator.ts` emits only DQ-07–09.
`INIT_SCENARIOS` derives from the standard vocabulary; `uwmd init` also accepts
reverse-DNS extensions and exposes the existing `--asset-subtype` carrier.
Canonical remediation entries, schema documentation and protocol code guidance
land together. No frontmatter/property schema exists, and none is introduced
solely to close otherwise open metadata.

## Alternatives and follow-ups

- A precedence rule, multi-valued scenario, BTR scenario, and new BTR class or
  module are excluded by D1–D4.
- Label-bearing `other` is unnecessary for a namespaced scalar and would add a
  second field solely to name an extension.
- A closed subtype taxonomy, physical-form/product split, normalization of
  `garden`/`garden_style`, general agreement rules and migration of the 28
  existing free subtype values are deferred. They need separate evidence and
  an additive compatibility design.
- Full repair of Appendix B's vestigial `scenario_defaults.json` and the broader
  `scenario_default` terminology remains separate under D6.

## Prior art

Format §2.2a / RFC 0003 fixes namespace ownership; RFC 0052 supplies the
label-bearing `other` alternative; RFC 0031 demonstrates explicit vocabulary
retirement and preservation of raw legacy bytes; RFC 0060 keeps independent
semantic axes separate. None requires this descriptive identity to drive math.
