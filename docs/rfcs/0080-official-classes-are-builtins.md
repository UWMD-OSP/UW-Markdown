---
rfc: 0080
title: Every official asset class is a builtin; data center and manufactured housing join the builtin set
status: implemented
implemented: 2026-10-11
author: UWMD maintainers
created: 2026-10-10
depends_on:
  - 0003
  - 0006
  - 0039
  - 0068
  - 0078
supersedes:
  - 0039 (its module-declared class design only)
  - 0068 (its module design only; its owner decisions carry over)
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0080: Every official asset class is a builtin; data center and manufactured housing join the builtin set

**Compatibility clauses superseded by [RFC 0081](0081-one-format-one-protocol.md).** §5 (the `org.uwmd.data_center` alias, `CLS-01`/`CLS-02`, module-gated severities), the module shells and the transition decision rows are removed, and the hotel facts consolidate into `rent_roll`. The builtin-class design stands.

**Accepted with its implementation.** The direction is the owner's
(Product principle 1, 2026-10-10); this RFC turns it into a contract. It lands
`accepted` together with its implementation in one PR, as RFCs 0064, 0065 and
0072 did. Merging that PR is the acceptance. **Implemented; released and
independently verified** in 3.0.0 with Format 2.1 and Stable Protocol 3.0.0
(see [Publication and verification](#publication-and-verification-2026-10-11)).

## Summary

The project ships two kinds of official asset class today:

- **Ten builtins** (multifamily … land), which have the full kit.
- **Module classes**, which do not. Data center (`org.uwmd.data_center`, RFC
  0039) is the only one shipped; manufactured housing (draft RFC 0068) was
  about to follow.

Under Protocol §X.2.4 a module class gets no builtin calc pack, no Excel
layout, no size-registry row and no defaults, and it carries a namespaced id.
The owner's intent is the opposite: every official class is equal to
multifamily from the day it is added.

This RFC:

- **Adds `data_center` and `manufactured_housing` to the builtin set** with
  full standard support and full starter support (RFC 0078 D5).
- **Folds the official hospitality module's content into the builtin
  `hospitality` class.**
- **Keeps every existing document valid.** `org.uwmd.data_center` documents
  read as the builtin with a deprecation warning.
- **Restricts module-declared classes to third parties.**

## Motivation

- **The owner never chose the two-tier design.** RFC 0003 closed the builtin
  set ("answers 'what does `data_center` mean?' by not allowing the
  question"). RFC 0039 then rejected a builtin data center as "the full
  builtin cost — for one vertical". The 2026-10-10 product-decision audit
  found no owner record selecting either.
- **Module classes are second-class in concrete ways.** Per the 2026-10-10
  inventory:
  - no pack, so no receipts (`RCP_PACK_UNRESOLVED`);
  - no size row, so CC-13 and CSV size columns do not apply and price per
    unit is empty;
  - no defaults, so `uwmd scope` fails;
  - no Excel layout;
  - no mixed-use component slot;
  - no stage overlays;
  - section schemas declared but not enforced.
- **Hotel fields sit outside the standard.** ADR, RevPAR and F&B live in a
  module (RFC 0006 Alternative 3), although hospitality is a builtin, so a
  hotel document's core metrics are second-class too.
- **The adopter need is concrete.** StackUW's park exports (MH-8) need a
  manufactured-housing class whose identity never changes, so that lake
  benchmark keys never split (issue #263).

## Owner direction (binding)

| # | Direction | Source |
|---|---|---|
| P1 | Every official asset class is a full builtin, equal to multifamily: in the `asset_class` list with its own calc pack, Excel layout, size registry and defaults. No official class is a module class, a namespaced id or a separate npm package. Modules exist only for third parties. | Owner, 2026-10-10 (Product principle 1) |
| D5 | "Equal" holds in both layers. Standard: class id, size metric, required sections, metric-dictionary definitions, verification rules. Starter: calc pack, Excel layout, defaults, example. | RFC 0078 |
| M1 | RFC 0068's first-scope owner decisions carry over unchanged: `weighted_pad_rent_monthly` as the pad-rent representation; `poh_home_rent_monthly` required when `park_owned_homes > 0` and absent otherwise; `age_restricted`, `poh_rent_share`, `expense_ratio` and the generic debt metrics deferred; nonnegative pad rent. | Owner, 2026-10-01 (RFC 0068 decision table) |
| M2 | No promotion problem: StackUW's manufactured-housing documents must never need to change class id. | Owner (StackUW answer on #263), 2026-10-10 |

## Proposed change

### 1. The builtin set grows by RFC, not never

- **Format §2.2 / §2.2a.** Twelve builtin values: the ten, plus
  `data_center` and `manufactured_housing`. The "closed" wording is replaced:
  the builtin set is the official classes, and a class joins it by RFC with
  full standard and starter support. Module-declared (namespaced) classes
  remain available to third parties for private or unofficial classes.
- **Protocol §X.2.4** is reworded accordingly. Third-party module classes
  still get no builtin pack, layout, size row or defaults. That is now a
  property of *unofficial* classes, never of official ones.

### 2. Data center (`data_center`)

- **Sections.** RFC 0039's module sections (`dc_capacity`, `dc_power`,
  `dc_revenue`) become standard Format sections with their current fields,
  required/optional status and validation (`CC-MOD-DC-01..07` renumbered
  into a standard family).
- **Size.** The primary size is commissioned critical IT load in kW.
  Precedent puts every builtin primary size on `property` (e.g. student
  `total_beds`). Add `property.critical_it_load_kw`, or justify reading the
  primary from `dc_capacity` and amend the registry rule; the implementation
  decides and records it.
- **Metrics.** The eleven module calculations, plus the standard metrics every
  income class has (cap rate, DSCR, LTV, LTC, debt yield, cash-on-cash per RFC
  0079, price and NOI per unit of size), enter the metric dictionary and a
  `data_center` pack.
- **Excel, defaults, example.** An Excel layout, a defaults table (see
  Unresolved questions), and the Mesa Gateway example restated as
  `asset_class: data_center`.
- **No fallback field.** A builtin needs no `fallback`. Readers that predate
  this RFC see an unknown builtin, covered under Compatibility.

### 3. Manufactured housing (`manufactured_housing`)

- **Content.** RFC 0068's first scope, under M1: the `mhc_sites` section,
  its six calculations and its seven rules become standard. Codex's parked
  branch `codex/rfc-0068-mhc` holds that work as a module; reuse its section
  schema, rules, tests and example.
- **Size.** The primary size is sites (`property.total_sites`, by the same
  precedent as data center).
- **Metrics.** The six RFC 0068 calculations plus the standard income-class
  metrics. RFC 0068 deferred the generic debt metrics only because a module
  could not reach them without cloning formulas. A builtin gets them from the
  dictionary like every other class, so M1's deferral of them is resolved,
  not overridden.
- **Excel, defaults, example.** Excel layout, defaults table, and the Desert
  Palms example.
- **Identity.** The id is `manufactured_housing` from the first release.
  Nothing ever shipped as `org.uwmd.manufactured_housing`, so M2 holds
  trivially.

### 4. Hospitality

The official hospitality module's sections (`hotel_metrics`, `hotel_brand`,
`hotel_food_beverage`), its five calculations and three rules fold into the
builtin `hospitality` class: standard sections, dictionary entries, the
`hospitality` pack. Where the module's `revpar` and the pack's `revpar` both
exist, the dictionary keeps one definition. If they differ, record both and
the choice in the Decisions table.

### 5. Existing documents keep working

- `asset_class: org.uwmd.data_center` reads as builtin `data_center`, with a
  new warning (deprecated class id; use `data_center`). Today
  `INVALID-ASSET-CLASS-002` would refuse it. This RFC exempts exactly the ids
  the project itself shipped (`org.uwmd.data_center`) and nothing else.
  Neither the document nor its digest is rewritten.
- A document whose `modules` list names `org.uwmd.datacenters` or
  `org.uwmd.hospitality` still validates. The named module is satisfied by
  core, which reports an informational note, not an error.
- Third-party ids ending in `.data_center` or `.manufactured_housing` become
  `INVALID-ASSET-CLASS-002`. This is a new refusal: before this RFC those
  names were not builtins, so such ids were ordinary module-declared classes.
  That includes the test-only `com.example.data_center` corpus: the shadowing
  rule is exactly what protects builtin names. Tests that used these names as a stand-in "unknown
  class" switch to a neutral id.

### 6. Packages

- `@uwmd/module-data-center` and `@uwmd/module-hospitality` stop being
  developed. Their content now lives in `@uwmd/core`.
- The release that ships this RFC publishes a final version of each that
  depends on the new core and declares no classes or sections of its own, so
  existing installs keep resolving. They leave the publish set afterwards.
  Deprecating the names on npm is an owner account step.
- No manufactured-housing package is created.

### 7. Versions

- **Format 2.1.** Additive: two new builtin values and new standard sections.
  A document using them declares `uw_version: "2.1"`. 2.1 readers read 2.0
  and 1.x unchanged.
- **Protocol.** The label moves at release preparation, as before. Release
  preparation pairs Format 2.1 with Protocol 3.0.0 and core/CLI 3.0.0; both
  module packages ship 0.2.0 as their final version. Released in 3.0.0;
  publication was independently verified before this RFC moved to
  `implemented`.

## Compatibility analysis

- **Existing documents.** All stay valid. `org.uwmd.data_center` documents
  gain one deprecation warning and otherwise behave as `data_center`, now with
  receipts, size and Excel support they lacked. Hospitality documents that
  used the module behave the same.
- **Older readers (Format 2.0).** A 2.1 document with `asset_class:
  data_center` or `manufactured_housing` is refused by a 2.0 validator
  (`INVALID-ASSET-CLASS-001`). That is the purpose of the `uw_version: "2.1"`
  declaration: a 2.0 reader recognizes a newer format instead of
  misreporting it.
- **Third-party modules.** These are unaffected, except that a module can no
  longer declare `data_center` or `manufactured_housing` as custom ids. The
  same rule already applied to every builtin name.
- **StackUW.** Park exports use `manufactured_housing` from the first release
  that includes this RFC. Its export refusal for manufactured housing can be
  lifted then.

## Conformance impact

- **Size intensives.** Rows for both classes in the size-intensive fixtures,
  and the runner strings "nine classes" / "nine sized" updated.
- **Tier-3 fixtures and lender check.** A tier-3 fixture per new class, and
  each new example in the lender-only metric fixture.
- **Deprecation behavior.** Runtime fixtures 06–11 (data center) become
  builtin-class fixtures. New fixtures cover the deprecated-id warning and
  the satisfied-by-core module note.
- **Shadowing.** Fixtures prove that `com.example.data_center` is still
  refused.
- **Pinned tests.** Tests that pin ten classes are updated to twelve:
  `types.test.ts`, the role counts in `packs.test.ts`, the Excel
  `SUPPORTED` list, the CLI smoke test and the catalog test.

## Reference implementation

The full touch-point inventory is in the 2026-10-10 builtin inventory: the
spec lists, schemas, `types.ts` `AssetClass` and its exhaustiveness record,
`SIZE_INTENSIVES`, packs, defaults registry, Excel layouts, the web-editor
catalog, `receipts.ts lookupPack`, Lite aliases, the mixed-use component
slot and the docs-site sample lists. Self-storage is the template, at about
1,300 new lines plus about 35 one-line edits per class.

Also in this change:

- `receipts.ts lookupPack` resolves all twelve classes. It currently knows
  five, so hospitality, senior, student, land and mixed-use receipts fail
  without injected packs. That is a pre-existing gap the inventory found; fix
  it here.
- A mixed-use component slot for `data_center` if precedent supports it; the
  implementation decides and records it.

## Alternatives considered

1. **Keep module classes and give them the missing machinery** (packs,
   layouts, size rows for modules). Rejected: this keeps two tiers and
   namespaced ids for official classes, and P1 forbids that.
2. **Equivalence aliases instead of builtins (RFC 0073).** Rejected as the
   mechanism. Aliases only matter when an official class ships under the
   wrong id first. Builtins from day one remove the need, and the narrow
   `org.uwmd.data_center` exemption above covers the one id that already
   shipped.
3. **Bundle module manifests inside core but keep them as modules.** Rejected:
   it is still second-class, just packaged differently.

## Decisions

| Question | Decision | Why (precedent) |
|---|---|---|
| Primary sizes | Commissioned critical IT load is `property.critical_it_load_kw`; sites are `property.total_sites`. Retain the detailed section quantities and require exact equality when both are stated (`CC-DC-08`, `CC-MH-08`). Do not infer or default physical size. | RFC 0027 and every existing builtin put primary denominators on `property`; a mirrored quantity is an identity, not a financial tolerance. |
| MHC per-site input addresses | Preserve the six calculation IDs and their operations; price/site and NOI/site read the canonical `property.total_sites`. `mhc_sites.total_sites` remains the operating-count source and is checked against it. Add `loan_per_site`. | The size-registry denominator and pack denominator must match (RFC 0027). The carried owner decision defines sites, not a different financial basis. |
| Mixed-use slots | Admit `data_center` with `critical_it_load_kw`, and `manufactured_housing` with `total_sites`; add NOI-share and explicitly allocated purchase-price intensives. New slots require Format 2.1 and retain the existing matching component_class, NOI-footing and explicit-allocation checks. Never combine their sizes into a property size. | RFC 0019 admits income uses whose stated NOI is additive; both new classes use the same EGI-minus-operating-expenses basis. |
| Standard income metrics | Copy cap rate, DSCR, LTV, LTC, debt yield and guarded cash-on-cash exactly from the accepted RFC 0079 dictionary. MHC generic-debt deferral is resolved by builtin support; other MHC deferrals remain. | RFC 0079 revised owner directions and RFC 0080 §3. |
| Hospitality RevPAR | Keep the builtin `noi_model.income.rooms_revenue / rent_roll.available_room_nights`. The module used `hotel_metrics.adr * hotel_metrics.occupancy`; it has different stated inputs and can differ when those inputs are inconsistent. Only the builtin formula is in the dictionary. | The established builtin definition uses stated rooms revenue and available nights; preserve existing builtin examples rather than silently changing their denominator or source. |
| Migrated dependencies | Inline a referenced module calculation with an explicit `round(..., its round_to)` wherever the module runtime previously passed its reported result to a later calculation. Preserve every original reporting precision. | RFC 0006/module runtime threads quantized prior results; Protocol §VIII.1 `round` reproduces that existing boundary without adding an evaluator or tolerance. |
| Lite bridge | New official-class summaries default to Format 2.1 and the existing nested metadata conversion; existing classes retain the Format 1.1 bridge. Explicit source versions are preserved. Admit the seven new standard section anchors without inferring missing financial facts. | RFC 0080 requires the new class ids at 2.1; RFC 0009 supplies the existing metadata reshape, while RFC 0017 existing outputs remain unchanged. |
| Required hotel section | `hotel_metrics` remains required when the document explicitly names the legacy hospitality module. Existing builtin hospitality records without that dependency continue using their standard rent-roll/NOI sections. Optional brand and F&B sections remain optional. | RFC 0080 requires existing documents to remain valid; the module's explicit section requirement is preserved without imposing it on previously valid builtin records. |
| Date and type checks | MHC `as_of_date` is presence-only, including the existing malformed-date negative controls that establish the boundary. Date validity stays a separate core follow-up. Calculation errors retain `MOD-CALC-ERROR`; rule evaluation type errors use `MOD-RULE-ERROR`; fixed field-shape defects additionally use `CLS-04`. Q3/Q4 and the other owner deferrals remain outside scope. | RFC 0068 first-scope decisions and RFC 0039 runtime precedent. |
| Compatibility identity | Resolve exactly `org.uwmd.data_center` as `data_center` with `CLS-01`; never rewrite the parsed source or digest. Official module dependencies emit `CLS-02` and require no external module load, including the restricted frontmatter reader's legacy `id: org.uwmd.*` list spelling for exactly these two shipped modules. Third-party suffix shadows newly become `INVALID-ASSET-CLASS-002`. | RFC 0080 narrow grandfathering, not a general equivalence or suffix-matching contract. |
| Standard codes | Register `CC-DC-01..08`, `CC-MH-01..08`, `CC-HOSP-01..03` and `CLS-01..05`; class rules execute in ordinary core validation. Missing required class sections use `CLS-03`. | Existing closed code-family and safe-expression verification patterns. |
| Defaults | Propose industrial starter ranges for data-center common financial assumptions, excluding per-square-foot TI; propose multifamily starter ranges for MHC, explicitly mapping the reserve basis from dwelling to site. Every low/central/high value is an owner-review proxy, not a claimed market estimate. No physical facts or POH rent are defaulted. Jared must review the tables at the top of the PR before merge. | RFC 0078 distinguishes starter assumptions from verification; RFC 0080 makes defaults the explicit owner gate. |
| Official module packages | Keep package identities, core pins and publish membership. Retain API constants and empty view exports; the 0.2.0 compatibility manifests declare no class, section, calculation or rule. Retirement and npm deprecation occur separately at release. | RFC 0080 §6 and independent package/manifest versioning. |
| RFC 0073 | Keep it draft for third-party identity renames. Official classes no longer depend on an identity-promotion contract. | RFC 0080 Alternatives and Product principle 1. |
| Native block/envelope shape | New examples and new-class Lite output use canonical section_id/_meta/content wrappers with nested metadata. Mixed-use validation reads the canonical payload, preserving its matching-class and NOI-footing negative controls. The format-neutral envelope accepts both existing v1 metadata and the v2 schema; reading it normalizes metadata for eligibility without rewriting raw content or digest. | RFC 0009's one-shape rule and the existing envelope's lossless, format-neutral contract; no new representation or financial convention. |
| Versions | Format 2.1 authors the additive builtin/section extension and reads all previously supported formats. Keep package versions/core pins and the Protocol label unchanged until release preparation. | RFC 0080 §7 and the RFC 0072/R8 release pattern. |
| Stage overlays | None. `data_center` and `manufactured_housing` take the §5.1 base lists verbatim, exactly as multifamily; `dc_capacity` / `mhc_sites` are class-required (`CLS-03`), never substitutes for `rent_roll`, and a missing rent roll is `DQ-06`. Examples carry a real `rent_roll`. | Format §5.1 declares its overlay set (land, mixed_use) exhaustive and calls section reuse "the design, not a gap"; P1 forbids a weaker bar for new classes. |
| Pre-existing hospitality calculations | `revpar` (in the builtin pack before this RFC) fails uncomputed with no finding, as every builtin pack calculation does. Migrated hotel calculations emit `MOD-CALC-ERROR` only for documents naming `org.uwmd.hospitality`, where the module runtime emitted it. | §5 "behave the same": a 099e47e-valid builtin hotel record gains no error; the module's own failure reporting is kept where it existed. |
| Compatibility severities | `CLS-04` is an error only on canonical-id Format 2.1+ documents and a warning on legacy-alias or pre-2.1 documents. Other error-severity class findings (rules, `MOD-RULE-ERROR`, `MOD-CALC-ERROR`) are warnings on pre-2.1 documents that do not name the legacy module. | §5: the module runtime never enforced the fixed field contracts (RFC 0080 Motivation: "section schemas declared but not enforced"); a warning keeps the defect visible without failing a previously valid document. |
| Uncomputable RevPAR with a comp set | `CC-HOSP-04` warning names the missing canonical inputs; `CC-HOSP-01` is not evaluated. No ADR × occupancy fallback. | The RevPAR decision above keeps one definition; inventing a fallback is a numeric owner decision (AGENTS.md: never guess at numerics). The CC-HOSP family is the existing registered home. |
| Scope identity and citations | `uwmd scope` reports the resolved builtin as `asset_class` / `defaults_table`, the stated alias unmodified as `declared_asset_class`, and each default's `citation` (additive; also on `ResolvedValue`). | §5 never rewrites the source; RFC 0078 starter defaults are proxies whose basis must stay visible. |
| Data-center expense ratio | No `noi_model.expense_ratio` default (owner decision 2026-10-10). The cascade falls through as for land; no other class's table is borrowed. | Owner: the industrial NNN proxy does not fit a power-grossed-up basis (Mesa runs 0.595). Land/mixed-use omissions are the precedent. |
| Grouping keys | Batch filters/summaries and lake indexed `asset_class` columns use the resolved builtin; index entries and envelopes keep the stated id. | M2 / issue #263: benchmark keys must never split; §5 forbids rewriting the source. |

## Owner review at merge

1. **Defaults for data center and manufactured housing.** Defaults are a
   starter product (RFC 0078 D4), but they are still underwriting
   assumptions (vacancy, expense ratios, reserves). The implementation PR
   proposes values with sources for owner review before merge. It does not
   invent them silently.
2. **RFC 0073.** It becomes unnecessary for official classes. Whether to
   withdraw it or keep it for third-party module renames is decided with
   this RFC's acceptance; the recommendation is to keep it as a draft for
   third parties.

## Prior art

- **The builtin classes themselves.** Self-storage (added after the first six)
  is the template for adding a class with full support.
- **XBRL taxonomies.** New industries extend the standard taxonomy through
  the standard's own process, rather than living as permanent private
  extensions.

## Publication and verification (2026-10-11)

Annotated `v3.0.0` targets the release-prepared merge
`44ab7347a8a3054fc377e19e85f89ad6f1539dea` (PR #305).
[Release run 38163964522](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38163964522)
succeeded and published core/CLI 3.0.0, signing 0.2.26, batch 0.8.21, Excel
0.9.14, report 0.8.26, lake 0.2.10 and both module packages 0.2.0, pairing
Stable Protocol 3.0.0 with Format 2.1. Independent registry, provenance,
published-file, delivered-CLI (332/332 portable cases, no skips) and consumer
checks passed, including all twelve builtin classes in the published core and
both 0.2.0 module shells declaring nothing and pinning core 3.0.0 exactly; see
[the publication record](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/releases/3.0.0-publication.md).
The §6 retirement is complete: the owner deprecated `@uwmd/module-hospitality`
and `@uwmd/module-data-center` on npm on 2026-10-11, and the registry shows
the retirement message on every version of each. Removing both packages from
the release workflow is left to a later release. Publication verification
precedes this separate `accepted` → `implemented` reconciliation. The
immutable release tag and every normative section above remain unchanged.
