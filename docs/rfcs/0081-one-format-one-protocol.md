---
rfc: 0081
title: 'One format, one protocol: remove backward compatibility (pre-release cleanup)'
status: draft
author: claude-code (agent proposal, from owner direction 2026-10-11)
created: 2026-10-11
depends_on:
  - 0009
  - 0078
  - 0080
supersedes:
  - 0009 (v1/v2 coexistence, the read shim and the per-file boundary only)
  - 0017 (legacy detection and the Lite-to-1.1 bridge only)
  - 0022 (receipt_version 1.0 acceptance only)
  - 0025 (the explicit-override path for structured .uw.md only)
  - 0031 (legacy source tags and the read-time interpretation only)
  - 0072 (retired-scenario wording and the per-generation clauses only)
  - 0078 (legacy tier readings, the 3.x deprecation window and D12 only)
  - 0080 (its section 5 compatibility clauses and transition decisions only)
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0081: One format, one protocol: remove backward compatibility (pre-release cleanup)

**Draft for owner review.** This RFC records the owner's direction of
2026-10-11 (Product principle 5 and decisions D1–D14) and proposes how to
codify it. It is a breaking change to the Format (3.0), the Protocol (4.0.0)
and `@uwmd/core` (4.0.0), so it lands as a draft first. Three questions the
direction does not settle are listed under
[Owner gates](#owner-gates-before-acceptance). Nothing here is authorized for
implementation until the owner merges it.

## Summary

The project is live but pre-release: the owner is its only user. It still
carries the compatibility machinery of a mature standard:

- four readable format versions (1.0, 1.1, 2.0, 2.1);
- six honored protocol contracts (1.14.0 through 3.0.0);
- two `_meta` shapes, with a reshape layer in both directions;
- two migration tools;
- a deprecated class alias and two deprecated module packages;
- four deprecated conformance tier names;
- six "legacy scalar" fields beside their structured replacements;
- version-conditional severities.

This RFC removes all of it:

- **One format.** Format 3.0 is today's 2.1 shape (nested `_meta`, the
  twelve builtins) minus every alternate spelling. It is described by one spec
  file, and it is the only format any reader accepts.
- **One protocol.** Protocol 4.0.0 is the only protocol contract.
- **No transition plan.** No grandfathering, deprecation period, alias, shim,
  migration tool or old-version reader. The repo's own corpus is re-authored
  once, with financial values unchanged, and then the migrators are deleted.

## Motivation

- **Owner direction.** Product principle 5 (2026-10-11): *"we dont need back
  compatability yet, there are no users other than me and this is
  essentially pre-release despite being live. we can and should clean things
  up better and do not need legacy support for old modules basically."*
- **Compatibility is most of the surface.** A reader today implements
  two `_meta` shapes, two digest canonicalizations, per-file severities for
  `SRC-01`/`SRC-02`, `META-V2-IN-V1`/`META-V1-IN-V2`, the
  `org.uwmd.data_center` alias, module-gated hospitality rules and
  version-gated `CLS-04`. None of it changes what a document *means*. All of
  it is code an independent implementer must write to claim conformance
  (RFC 0078's boundary test: a lender verifying with only the standard).
- **The format has two specs.** `UW_FORMAT_SPEC_v1.md` (4,113 lines) is the
  base. `UW_FORMAT_SPEC_v2.md` (387 lines) is a delta that amends it "for 2.0
  files only". A reader has to merge them in their head to learn what a 2.1
  document is.
- **The compatibility windows were designed for adopters who do not exist.**
  RFC 0009's own timeline already planned this step: "v3.0: flat shape
  removed from the spec … v3 readers MAY drop the shim". Every other window
  (RFC 0078's "during 3.x", RFC 0080 §5) protects documents that only the
  owner has, and the owner's consumers update.
- **Overdue removals.** `FV` `legacy_code` was promised to travel "for one
  release; v1.2 drops `legacy_code` entirely" (`validator.ts:68-70`). It is
  still emitted at core 3.0.0.

## Owner direction (binding)

| # | Direction (owner, 2026-10-11) | Inventory facts (verified on `main` at `5b94c9f`) |
|---|---|---|
| P5 | Clean breaks beat compatibility layers. No grandfathering, deprecation periods, aliases, shims, migration tools or old-version readers. A breaking normative change gets an RFC and a version bump, but no transition plan. | Product principle 5. |
| D1 | Ship as **Format 3.0, Protocol 4.0.0, `@uwmd/core` 4.0.0**. Format 3.0 = the 2.1 shape minus every alternate spelling, and is the only supported format. Readers refuse every other `uw_version` with one clear error. `SUPPORTED_FORMAT_VERSIONS = ['3.0']`, `SUPPORTED_PROTOCOL_VERSIONS = ['4.0.0']`. Protocol 3.0's "during 3.x" promises are superseded by the major. | `protocol.ts:54` reads `['1.0','1.1','2.0','2.1']`; no corpus file declares 1.0. `protocol.ts:65` honors `1.14.0, 2.0.0, 2.1.0, 2.2.0, 2.25.0, 3.0.0`. No reader refuses an unknown `uw_version` today; Protocol §XII.3 only says to refuse *editing* a newer major. |
| D2 | **One format spec.** Merge `UW_FORMAT_SPEC_v1.md` (base) and `UW_FORMAT_SPEC_v2.md` (delta) into `spec/UW_FORMAT_SPEC.md`, describing only Format 3.0. Delete both old files. Rename the protocol to `spec/UW_PROTOCOL.md`. Remove the 34 "Moved to … starter products guide" stubs; the starter guide is their home. | All 34 stubs are in `UW_PROTOCOL_v1.md` (§III.1–III.6, §IV, §V.1/V.5–V.8, §VIII.2b/2c, §IX, §XIV). |
| D3 | **Delete on-disk v1 flat `_meta`.** This covers parser shape detection, `META-V2-IN-V1`/`META-V1-IN-V2`, the version-conditional severity of `SRC-01`/`SRC-02`, the v1 block-hash branch, the `?? '1.1'` defaults, the v1 `uwmd-block.schema.json` shape and the `section_id` alias. Target: the in-memory `UWMeta` matches the on-disk nested shape, so no reshape layer survives (Phase 4 decides the mechanics). | `meta-shape.ts` (both reshapes); `parser.ts:361-388`; `validator.ts:3146-3230`; `integrity.ts:83-95, 267, 397`; `envelope.ts:95, 317`; `renderer.ts:373, 435, 731` and `report.ts:290`; `editor.ts`/`runner.ts` shape selection. There are about 67 flat-field reads of `block.meta.*` in 17 non-test source files. |
| D4 | **Delete migration tooling** after one last use to re-author the corpus: `migrate-to-v2.ts`, `migrate-source-tags.ts`, the CLI `migrate` commands, their exports, the conformance `migrate` suite, and RFC 0031 legacy `_meta.source` tags. `uwmd init` writes only Format 3.0 (drop `--format`). | `cli.ts:478-580, 1461-1478, 2071-2072`; `init.ts:13-16, 108-114`; `index.ts:45` and `browser.ts:55` export `migrateSourceTags`/`mapLegacySource`. `migrate-to-v2.ts` writes 2.0, not 3.0. It refuses signed blocks unless given a key (`--resign`) and refuses legacy-tag blocks until `--source-tags` has run. |
| D5 | **Re-author every fixture and example** to Format 3.0. Signed fixtures are re-signed, receipt fixtures re-issued, content hashes recomputed. **Financial values never change**, only envelope and metadata shape. That is a hard acceptance criterion: the lender fixture and every calc baseline value stay identical. | Conformance `.md`: 435 at 1.1, 227 at 2.0, 54 at 2.1. Examples: 20 at 1.1, 2 at 2.1 (Mesa Gateway, Desert Palms). Also about 26 package/tool/docs fixtures and about 85 inline test strings. Seven corpus files carry signatures; the test key is `conformance/signing/keys/signer-private.jwk.json`. The lender fixture reads 187 verified / 0 failed / 0 unverifiable. |
| D6 | **Remove the RFC 0080 transition surface:** the `org.uwmd.data_center` alias, `CLS-01`, `CLS-02`, the frontmatter `id: org.uwmd.*` grandfathering, `declared_asset_class`, the batch and lake alias branches (keep `toBuiltinAssetClass` as the plain builtin lookup), and `LEGACY_MODULE`/`PRE_RFC_BUILTIN_CALCS` severity switching (`CLS-04` is always an error; class rules and calcs behave identically for every document). Hospitality has no module-gated behavior. Re-author alias fixtures with builtin ids. Delete both module packages, the `conformance/modules/runtime` shell scenarios and every release/verify/lockfile reference; releases from 4.0.0 publish seven packages. | `types.ts:593-597`; `asset-class.ts:243-249`; `validator.ts:3071-3078`; `builtin-class-validation.ts:12-104`; `cli.ts:1186-1189`; `uwmd-batch/src/index.ts:308`; `uwmd-lake/src/plan.ts:529-535`. 15 corpus files use `org.uwmd.data_center`. `conformance/modules/runtime/01-11`. Module packages appear in `release.yml`, `release-packages.mjs`, `release-state`, `verify-versions`, `verify-lockfile`, `run-conformance` and the lockfile. Both packages were deprecated on npm on 2026-10-11. |
| D7 | **Old protocol and module ranges.** A module manifest must declare ranges satisfied by 4.0.0 and 3.0. All 12 builtin packs move to `requires_protocol: '^4.0.0'`, `requires_format: '^3.0'` and a new pack major version (receipts pin pack versions, so receipt fixtures are re-issued). Module conformance manifests and signed module fixtures are regenerated. | 10 packs declare `^1.0.0`/`^1.1.0`. `data_center` and `manufactured_housing` declare `>=2.25.0`/`>=2.1.0`. All 12 declare `requires_tier: tier-3-calc-host`. `modules.ts:1012-1049` satisfies ranges against any supported version. |
| D8 | **Conformance tier names.** Delete `LEGACY_TIER_READINGS`, `readConformanceTier` aliasing, `ViewerTier`, numeric `--tier` shorts, legacy `--tier=<suite>`, deprecation notices, the `legacy_id`/`portable_legacy_ids`/`migration_base`/`before` bookkeeping and the deprecated manifest enum values. Rename the `tier-*` directories, suite ids and portable case ids to content names. Docs-site pages follow, with no redirects. | `protocol.ts:91-142`; `scripts/conformance-targets.mjs:18-45, 99-104`; `conformance/runner/runner.py:64, 402` and `tier-readings.json`; `corpus-index.json`; `implementation-manifest.schema.json` deprecated `tier` branch. Tier names appear in 319 tracked files outside RFC and release history. |
| D9 | **Module tier vocabulary.** Replace `ModuleManifest.requires_tier` (tier-1..4) and the host tier with the Protocol 3.0 vocabulary: `requires_conformance: 'reader' \| 'verifier'` plus an optional `requires_profiles`. | `module-manifest.schema.json` requires `requires_tier`; `modules.ts:30, 138, 596-619, 1018-1024` (`PROTO-MOD-006`, `PROTO-MOD-029`). |
| D10 | **Legacy scalars with structured replacements are removed**: `rate_cap_pct` (HDG-04), `uses.interest_reserve`/`uses.operating_reserves` (ESC-03), `uses.renovation_*` (CAPX-05), `cam_cap_pct` (REC-10), `sale_triggers_reassessment` (TAX-04). One way to express each fact. The agreement codes are retired. | Each replacement exists. Four of them are **not** supersets of the scalar they replace; see [Gate G1](#g1-legacy-scalars-whose-replacement-needs-more-facts). |
| D11 | **Other deprecated items:** FV `legacy_code`; structured content under `.uw.md` (refuse; no migration); `superseded_blocks` (remove if it only serves compatibility); `getRequiredSections`; the renderer's pre-§4.5 NOI keys; retired-scenario special wording (remove if it is compatibility); receipt_version 1.0 and Lite canonicalization 1.0; `RECEIPT_RESULT_TOLERANCE`. | `validator.ts:66-93`; `source-representation.ts:66-186`; `cli.ts:171-221`; `protocol.ts:772`; `renderer.ts:398-413`; `scenario.ts:20`, `validator.ts:211-222`; `receipts.ts:68, 92`; `UW_RECEIPT_v1.md` §10.4 ("MUST accept both `1.0` and `1.1`"); `UW_LITE_SPEC_v1.md` §6. |
| D12 | **The Lite bridge emits Format 3.0 for all twelve classes**, and the Lite spec is updated. | `lite-bridge.ts:11, 16, 320-342, 509-520`: ten classes compile to flat 1.1, two to nested 2.1. Explicit Lite `uw_version` values pass through. |
| D13 | **Keep (not compatibility):** `RCP-06/07/10` (version or engine mismatch is unverifiable), `INT-08` deprecated algorithms, the generic `canonicalize`/`sha256Hex` digest, historical release evidence in `docs/releases`, `releasePackagesForGeneration` history (edited to drop module packages going forward), Excel's no-MCP-sheet path, and the web viewer (fixed to read the nested shape). | `tools/web-viewer/index.html:161-165` reads only flat `_meta.section`/`_meta.superseded`. |
| D14 | **Supersession.** This RFC supersedes the compatibility clauses of RFC 0080 §5, RFC 0078's legacy tier reading and deprecation, RFC 0031 legacy source tags, RFC 0022/0009 coexistence and RFC 0017's Lite-to-1.1 bridge. Each superseded clause is listed, and the status line of each RFC notes partial supersession. | See [Superseded clauses](#superseded-clauses). |

## Proposed change

### 1. Versions

- **Format 3.0.** `uw_version: "3.0"` is REQUIRED in frontmatter. A reader MUST
  refuse a document whose `uw_version` is absent or anything other than `"3.0"`
  with **`UNSUPPORTED_FORMAT_VERSION`** (`parse` stage, error), naming the
  declared value and the one supported value. There is no partial read, no
  display-only mode and no "newer minor" tolerance.
- **Protocol 4.0.0.** The 4.0.0 contract is Protocol 3.0.0 with every
  compatibility clause below removed, `requires_tier` replaced (§6), and the
  tier-alias machinery gone (§8). §XII.3 is rewritten: the format-version
  refusal above replaces "refuse to edit a newer major". §XII.4 keeps the
  protocol-range rule.
- **`@uwmd/core` 4.0.0** with CLI 4.0.0. Other package versions move by
  semver-per-surface at release preparation.
- `FORMAT_VERSION = '3.0'`, `SUPPORTED_FORMAT_VERSIONS = ['3.0']`,
  `PROTOCOL_VERSION = '4.0.0'`, `SUPPORTED_PROTOCOL_VERSIONS = ['4.0.0']`.
  Module `requires_format`/`requires_protocol` ranges are checked against those
  single values.

### 2. One format spec, one protocol file

`spec/UW_FORMAT_SPEC.md` describes Format 3.0 only. Version history lives in
the RFCs and the CHANGELOG, not in the normative text. Disposition:

| Source | Disposition in `UW_FORMAT_SPEC.md` |
|---|---|
| v1 front matter, Part I, Part II (except §2.5) | Kept; the version banner reads 3.0. |
| v1 §2.5 flat `_meta` table and the "only valid form for 1.x" paragraph | **Replaced** by v2 §2 (the nested `_meta`) and v2 §3 (`_overrides`). |
| v1 §2.6 source identifiers | Kept, without the read-time interpretation, the migration notes or the legacy-tag tables. The actor grammar is always enforced. The resolution vocabulary is the v2 §4.1 closed set. |
| v1 Part III provenance model | Kept, with one canonicalization rule (v2 §5 normalize-then-hash). The v1 digest rule and the migration and signature-loss text are deleted. |
| v1 Part IV section registry | Kept, minus the six legacy scalars (D10, subject to Gate G1), with `uses`, `debt_structure` and the tenant/tax examples updated. The RFC 0080 "Official class sections" appendix moves into Part IV beside the other sections. |
| v1 Part V validation | Kept, with every per-generation clause removed (no "in both format generations", no "warning in 1.x"). |
| v1 Part VI toolchain | Kept, with the v2 §7 amendments applied: no `migrate`, `init` writes 3.0, the Lite bridge emits 3.0. §6.1 parse output drops `superseded_blocks`. |
| v1 Part VII, Appendices A–D | Kept. |
| v2 §1 versioning and the one-shape rule | **Replaced** by §1 above. One shape means there is nothing to mix. |
| v2 §4 vocabulary changes | Folded into §2.6 as plain rules, without "at 2.0" framing. |
| v2 §5 migration text, §6 deprecations, §8 conformance, Appendix A shape mapping | **Deleted.** Conformance is described in the merged §8 against the renamed corpus. |
| v2 "Signed block roles", v2 §8 official builtin classes | Moved to their topical homes (§2.8 roles; §2.2/Part IV classes). |

The protocol is renamed `spec/UW_PROTOCOL.md`, which supersedes RFC 0078 D12's
"rename in a later editorial pass". Its 34 "Moved to … starter products guide"
stubs are deleted, and the §0/§I front matter's section map points to
`docs/starter/` once. Appendix E's worked example re-authors the
`org.uwmd.hospitality` manifest as a neutral third-party example
(`com.example.*`), because there is no official module any more.

Every in-repo link follows the rename. Historical RFCs and release records are
not edited: the docs-site prebuild link map continues to resolve
`UW_FORMAT_SPEC_v1.md`, `UW_FORMAT_SPEC_v2.md` and `UW_PROTOCOL_v1.md` links to
the new pages. This keeps the site build from failing on dead links (the
RFC 0025 / PR #57 failure mode); it is a build-time link map, not a redirect.

### 3. One `_meta` shape

- `_meta` MUST be the nested object (`section`, `provenance`, `quality`,
  `lifecycle`, optional `integrity`). Readers never reshape.
- A block whose `_meta` lacks the nested `provenance` and `lifecycle` objects
  is refused with **`META-01`** (error): "`_meta` is not the Format 3.0 nested
  shape". `META-V2-IN-V1` and `META-V1-IN-V2` are retired. The provenance-
  completeness family (`META_MISSING`, `META_FIELD_MISSING_<FIELD>`,
  `META_LOW_CONFIDENCE_NO_REVIEW_FLAG`) is unchanged.
- `_meta.section` is the only spelling. The `section_id` alias inside `_meta`
  is gone.
- `SRC-01` and `SRC-02` are always errors. No read-time interpretation moves a
  resolution tag out of `provenance.source`.
- `SRC-03` changes from "`resolution` is `manual`" to "`provenance.resolution`
  is outside the closed resolution vocabulary" (error). The block schema
  already refuses non-members, so this makes the validator agree with it.
- One block digest rule: the v2 normalize-then-hash canonicalization. The
  generic `canonicalize`/`sha256Hex` remains for receipts and other non-block
  digests (D13).
- One block schema: `uwmd-block-v2.schema.json` is renamed
  `uwmd-block.schema.json`, replacing the v1 schema, and the reference to
  `META-*` mixing is dropped from its description. The in-memory `UWMeta`
  becomes the nested shape (the D3 target), and `UWBlock.meta_shape` is
  removed.

### 4. No migration tooling

The migrators are used exactly once, in Phase 3, then deleted with their
exports, CLI commands, tests and the `migrate` conformance suite. `uwmd init`
writes Format 3.0 nested blocks and takes no `--format`. Structured fences in a
file named `.uw.md` are refused with **`SOURCE_CONTENT_MISMATCH`** (the existing
code for content that contradicts its representation).
`SOURCE_LEGACY_STRUCTURED`, the explicit-UWX override that accepted the old name
with a warning, and `migrateLegacyUWMarkdown` are removed.

### 5. Builtin classes without transition rules

- `toBuiltinAssetClass(raw)` returns a value only for the twelve builtin ids.
  `org.uwmd.data_center` is an ordinary namespaced id: it is refused by
  `INVALID-ASSET-CLASS-002`, like every namespaced id ending in a builtin name.
- `CLS-01`, `CLS-02` and `CLS-05` are retired. `CLS-05` ("new ids require
  Format 2.1") cannot fire when only 3.0 exists.
- `declaredModuleDependencies` reads only the object-list spelling; the string
  `id: org.uwmd.*` recognition is removed. A `modules` entry naming
  `org.uwmd.hospitality` or `org.uwmd.datacenters` is an ordinary module
  dependency that no installed module satisfies.
- `uwmd scope` drops `declared_asset_class`. Batch and lake group by the stated
  id, which is now always a builtin or a third-party id.
- **Every class follows the same rules.** `CLS-03` and `CLS-04` are errors for
  every document. A class-content calculation that fails reports
  `MOD-CALC-ERROR` (error), and class rules keep their declared severity,
  regardless of `uw_version`, `modules` list or prior packaging.
  `PRE_RFC_BUILTIN_CALCS` is deleted, so hospitality's `revpar` behaves like
  its four sibling class calculations.
- **Hospitality, explicitly.** `hotel_metrics` is **required** for every
  `hospitality` document (as `dc_capacity` and `mhc_sites` are for theirs).
  `hotel_brand` and `hotel_food_beverage` are optional. `rent_roll`,
  `noi_model` and the other §5.1 base sections are unchanged. Saguaro Select
  gains a `hotel_metrics` block restating its `rent_roll` keys, available room
  nights, occupancy and ADR (same values, no new facts), and the
  builtin-classes hospitality fixtures are updated to match. See
  [Gate G3](#g3-hotel_metrics-restates-rent_roll).
- `packages/uwmd-module-data-center` and `packages/uwmd-module-hospitality` are
  deleted, together with `conformance/modules/runtime/01-11` (the
  `builtin-classes` suite already covers the content) and every reference in
  release, verify and lockfile tooling. From 4.0.0 the release publishes seven
  packages: core, CLI, signing, batch, Excel, report and lake.
  `releasePackagesForGeneration` keeps the module packages for generations
  before 4.0.0, so release history stays reproducible.

### 6. Module manifests: `requires_conformance` and `requires_profiles`

`requires_tier` is removed from `ModuleManifest`, the module-manifest schema,
`protocol.ts` and Protocol §X.

- `requires_conformance` — REQUIRED, `"reader"` or `"verifier"`: the minimum
  Protocol conformance tier (§II.1/§II.2) a host must claim to load the
  module. `reader` < `verifier`.
- `requires_profiles` — OPTIONAL array of unique members of the closed
  `CONFORMANCE_PROFILES` list (`module`, `integrity`, `representations`,
  `portfolio`, `sensitivity`, `stochastic`). The host must claim every listed
  profile. Absent means none.
- A module that declares calculations SHOULD declare
  `requires_conformance: "verifier"` and `requires_profiles: ["module"]`
  (§II.3: evaluating module-declared formulas is the Module profile). This
  replaces today's equally non-enforced "requires at least tier-3-calc-host";
  no new refusal is added.
- Loading: an invalid value or an unknown profile is `PROTO-MOD-006`. A host
  whose claimed tier is below `requires_conformance`, or that lacks a listed
  profile, is `PROTO-MOD-029`. `LoadModuleOptions.hostTier` becomes
  `hostConformance` (default `"verifier"`) and `hostProfiles` (default: the
  profiles the reference implementation's `ImplementationManifest` claims).
- The twelve builtin packs declare `requires_conformance: "verifier"` and no
  profiles: dictionary metrics are Verifier content (RFC 0078 Phase 3).
  Re-authored module fixtures map `tier-1-reader`/`tier-2-editor` to `reader`,
  and `tier-3-calc-host`/`tier-4-agent-host` to `verifier`, adding `module` to
  `requires_profiles` only when the manifest declares calculations. Every
  fixture's accept/refuse outcome is unchanged.

### 7. One way to state each fact

Removed from the schema, the Format text, `report.ts` and the validator: the
six scalars in D10. Retired codes: `HDG-04`, `ESC-03`, `CAPX-05`, `REC-10`,
`TAX-04`. Gate G1 decides how a fact whose replacement needs more facts is
expressed, and whether `HDG-05` (the same pattern, not in D10) goes too.

Also removed:

- **`FV` `legacy_code`.** `ValidationMessage.legacy_code`, `fvCode()` and the
  `FV_*` mapping go; validators emit `FV-NN` only.
- **`superseded_blocks`** in `uwmd parse` JSON. It is purely compatibility
  (`cli.ts:171-172`: "kept for compatibility; new callers should read
  `superseded`") and duplicates `superseded` in an older unprojected shape.
- **`getRequiredSections`** (the legacy helper; stage requirements are read
  from the current table).
- **The renderer's pre-§4.5 NOI keys** (`noiLegacyValue`), which by its own
  comment are read "only when the §4.5 path states nothing" and stated by no
  §4.5 document.
- **Retired-scenario wording.** RFC 0072's four retired values are
  compatibility: they were valid once and are no longer plans. `RETIRED_SCENARIOS`
  and its special message go. A retired value now gets the ordinary `DQ-07`
  warning, the same as any other unlisted value. The open-scenario `DQ-07`
  rule itself is a current feature and stays.
- **Receipts.** `receipt_version` stays **`1.1`**, and `1.1` is the only accepted
  value (`SUPPORTED_RECEIPT_VERSIONS = ['1.1']`). Lite canonicalization is
  `1.1` only. `UW_RECEIPT_v1.md` is rewritten to describe 1.1 directly, not as
  1.0 plus a §10 amendment. `RECEIPT_RESULT_TOLERANCE` is deleted. The
  `RCP-10` version-mismatch rule stays (D13).
- **The web viewer** reads `_meta.lifecycle.superseded` and `_meta.section`.

### 8. Conformance names

- Tier aliases are removed in every form listed in D8. `--tier` accepts
  `reader` or `verifier`. Fixture families are selected with `--suite`, and
  any other `--tier` value is a usage error.
- `ImplementationManifest.tier` is `"reader" | "verifier"` only.
- Directory and suite mapping, by what each corpus contains:

| Today | 4.0.0 | Suite id(s) | Why |
|---|---|---|---|
| `tier-1-reader/` (`fixtures`, `expected`, `malformed`) | `documents/` | `documents` | The base documents are parsed (Reader), validated (Verifier) and rendered (starter) — 20/31/34 cases plus 1 integrity case. Calling the directory `reader/` would mislabel 66 of its 86 cases. |
| `tier-1-reader/v2-fixtures/` (suite `meta-v2`) | removed | — | Its shim, one-shape and digest shape-insensitivity cases test what this RFC deletes. The flat-`_meta` refusal becomes a `documents/malformed` `META-01` case; the defaulted-`algorithm` exclusion moves to `signing/`. |
| `tier-2-editor/` | `starter/editor/` | `starter-editor` | 6 starter-products cases. |
| `tier-3-calc-host/` | `calc/` | `calc` | 96 Verifier cases plus `revpar-basic` (Module). |
| `tier-3-calc-host/refinement/` | `starter/refinement/` | `starter-refinement` | Starter. |
| `tier-4-agent-host/` (`fixtures`, `profile`, `replay`) | `starter/agent/` | `starter-agent`, `starter-agent-profile`, `starter-agent-replay` | Starter. |
| `migrate/`, `modules/runtime/` | removed | — | D4, D6. |

- Portable case ids keep the `<owner>__<suite>__<scenario>__<op>` pattern with
  the new suite ids (for example `reader__documents__01-minimal-screening__parse`
  and `module__calc__revpar-basic`). `legacy_id`, `portable_legacy_ids`,
  `migration_base` and `before` are removed from `corpus-index.json` and its
  schema. The generator checks coverage against the index rows directly.
- Docs-site conformance pages follow the new names. No redirects.

## Decisions

Calls this RFC makes where D1–D14 leave a detail open:

| Question | Decision | Why (precedent) |
|---|---|---|
| Error for an unsupported or absent `uw_version` | `UNSUPPORTED_FORMAT_VERSION`, parse stage, error. | `UNSUPPORTED_YAML_FEATURE` (parse-stage refusal of an unsupported input) and `ENVELOPE_UNSUPPORTED_VERSION`; D1 "one clear error". |
| Flat `_meta` in a 3.0 file | `META-01` error; retire both `META-V*` codes. | Codes are not renamed in place or reused (the `FV_*` → `FV-NN` rename shipped as new codes); the hyphenated `META-*` family already owns `_meta` shape. |
| `SRC-03` | Generalize to any resolution outside the closed vocabulary. | The house pattern of closed vocabularies refusing unknown values; the v2 block schema already enums `ResolutionTagV2`. |
| Receipt version | Keep `1.1`; drop `1.0` acceptance. No renumbering. | The receipt shape does not change. `receipts.ts` refuses to stamp a version for a change that did not happen ("Stamping the grammar version would have claimed a source change that did not happen"). UWX canonicalization stays `1.0` because envelope canonicalization reads raw block content and its rule is unchanged. |
| `superseded_blocks` | Remove. | It is labeled compatibility-only in source and duplicates `superseded`. |
| Retired scenarios | Remove the special wording; keep the generic `DQ-07`. | RFC 0072 R3 kept retired values as warnings "to preserve today's valid documents", which is a compatibility reason. The open vocabulary with extensions is the current feature. |
| `.uw.md` with structured fences | `SOURCE_CONTENT_MISMATCH`. | It is the existing code for content contradicting the selected representation; a `LEGACY` code name has no meaning without a legacy. |
| Module host vocabulary | §6 as written; reuse `PROTO-MOD-006`/`029`; no new refusal. | RFC 0078 §II tiers and closed `CONFORMANCE_PROFILES`; fix-scope discipline (no new behavior beyond the vocabulary swap). |
| Corpus directory names | `documents/`, `calc/`, `starter/{editor,refinement,agent}/`. | RFC 0078 Phase 3 tags owners per case, not per directory, so directories are named by content. `starter/` matches the `docs/starter/` ownership of starter checks. |
| Hospitality required sections | `hotel_metrics` required; brand and F&B optional. | Its class content already declares it required. Equal treatment with `dc_capacity`/`mhc_sites` (P1, RFC 0080). |
| Status lines of superseded RFCs | Edited in the Phase 1 acceptance PR, not in this draft. | A draft supersedes nothing. RFC 0080's own supersession notes landed with its acceptance. |

## Owner gates before acceptance

### G1. Legacy scalars whose replacement needs more facts

D10 assumes each structured replacement can state the same fact. For two of
the six fields it can; for four it cannot without stating facts the document
does not have, which the format forbids ("MUST NOT be inferred"):

| Scalar | Replacement | Required members of the replacement | Lone-fact expressible? |
|---|---|---|---|
| `uses.interest_reserve` | `uses.escrows[name=interest].upfront` | `name` | Yes |
| `uses.operating_reserves` | `uses.escrows[name=operating].upfront` | `name` | Yes |
| `debt_structure.rate_cap_pct` | `rate_hedge.strike_rate` | `instrument`, `notional`, `strike_rate`, `index`, `effective_date`, `expiration_date`, `post_expiration_assumption` | No: 72 of 73 corpus files state it beside a full `rate_hedge`; `hedge/0076-two-seniors-no-hedge-escrow` states it alone |
| `uses.renovation_budget`/`_contingency` | `uses.renovation.budget`/`.contingency` | `budget`, `contingency`, `contingency_used`, `drawn_to_date`, `as_of_date` | No: `capex/accept-no-renovation-stated` states a budget and no draw |
| tenant `cam_cap_pct` | `recovery_terms.cap.pct` | `recovery_terms.method` | No: `recoveries/accept-legacy-cam-cap-alone` has no method |
| `sale_triggers_reassessment` | `reassessment.trigger === "sale"` | `trigger`, `assessed_value`, `millage_rate`, `indicated_tax` | No: `tax/valid-legacy-prose-only` has no assessment |
| *(not in D10)* `uses.rate_cap_cost` | `rate_hedge.premium` (agreement `HDG-05`) | as `rate_cap_pct` above | Same pattern as the escrow lines: a `uses` ledger amount restated by an instrument field |

There is a second, numeric issue. The starter `deriveSourcesUses`
(`sourcesuses.ts:33-42`) foots `uses.total` from every numeric leaf of `uses`,
including nested objects, and skips arrays. Moving 750,000 of interest reserve
from a scalar into the `escrows` array therefore lowers the derived total by
750,000 unless the footing rule learns to count escrow `upfront` amounts, and
that is a numeric definition (AGENTS: never guess at numerics). The same
function already sums the typed `renovation` object's draw-state fields: on
`capex/accept-draw-with-verified-remaining` it derives 11,350,000 where the
budget plus contingency is 4,500,000. That is a pre-existing starter defect,
reported here and not fixed by this RFC.

**Options.** (a) Remove all six, and make each replacement able to carry the
lone fact by turning its other members into an all-or-none group (for
example, a `renovation` block with only `budget`/`contingency`; a
`reassessment` with only `trigger`). (b) Remove only the two escrow scalars
and keep the other four as the single home of their summary fact, removing
the structured duplicate field instead where both state the same thing.
(c) Remove all six and drop the lone facts from the four fixtures that state
them, accepting the information loss. **Recommendation: (a)**, together with
an owner-decided footing rule that counts `escrows[].upfront` and
`renovation.budget + contingency` exactly once. (a) keeps one way to state
each fact without inventing values. The footing rule is the numeric decision
the owner must make. Gate G1 must be decided before Phase 3, because the
re-authoring depends on it.

### G2. One block body shape

Two block body shapes coexist **independently of `uw_version`**:

- **Bare.** The payload sits at the top level with `_meta` as its first key.
  This is what Format §2.5 (v1) and v2 §2 describe, and about 635 of 759
  corpus files use it.
- **Wrapped.** `{ "section_id", "_meta", "content" }`. Both block schemas
  require it, RFC 0080 called it canonical for new examples and Lite output,
  and 124 corpus files use it (67 at 1.1, 49 at 2.0, 8 at 2.1).

`blockPayload()` tells the two apart by checking whether the body has a
`content` member, so a bare payload with a field named `content` would be
misread. The parse projection carries a second layout detector
(`cli.ts:181-191`). D1–D14 do not mention this. It is the same kind of
alternate spelling D1 removes, so Format 3.0 should have exactly one shape.
**Recommendation: bare.** It is the shape the normative prose specifies (the
owner's 2026-10-11 "spec text wins" ruling, RFC 0078 Phase 3), it is the
majority form, and it does not add a third copy of the section id beside the
fence annotation and `_meta.section`. The block schema is corrected to match.
The wrapper's `content` key becomes an ordinary payload field name. If the
owner prefers the wrapper, the same plan applies with the roles reversed.
Either way, this gate must be decided before Phase 3.

### G3. `hotel_metrics` restates `rent_roll`

Making `hotel_metrics` required (§5, as D6 directs) means every hotel document
states keys, available room nights, occupancy and ADR twice: once in the
hospitality `rent_roll` (builtin before RFC 0080) and once in `hotel_metrics`.
That is a new instance of what D10 removes. **Recommendation:** accept §5 as
written for 4.0.0, so all three new-class sections are treated alike, and
consolidate the hotel facts in a follow-up RFC. The alternative is to make
`hotel_metrics` optional for every hotel document; that is also non-gated and
uniform, but it differs from the other two classes.

## Superseded clauses

Status-line notes are added in the acceptance PR:

- **RFC 0009:** "Migration story (the back-compat parser shim)", "One shape per
  file" (both directions), the v2.2/v3.0 rows of "Deprecation timeline"
  (carried out here), the frozen-forever v1 digest rule for blocks, and the
  per-file boundary later written into v2 §1.3.
- **RFC 0017:** "Legacy detection", and the bridge pinned to Format 1.1 (via
  v2 §7 "until a future RFC moves it"; this is that RFC).
- **RFC 0022:** receipt_version 1.0 acceptance beside 1.1 (§3 shared receipt
  surface and Compatibility, as written into `UW_RECEIPT_v1.md` §10.4).
- **RFC 0025:** the explicit-override acceptance of structured `.uw.md`. The
  generic canonicalization-mismatch degradation stays.
- **RFC 0031:** §4 read-time interpretation, the 1.x warning severities and
  the legacy-tag migration tool.
- **RFC 0072:** R3's retired-value wording and the "in both 1.x and 2.x"
  clauses.
- **RFC 0078:** D12, the Compatibility analysis's "during 3.x the four old
  values stay readable", and the Phase 3 decisions on legacy aliases,
  `legacy_id` and `portable_legacy_ids`.
- **RFC 0080:** §5 in full, §6's final 0.2.0 shells, §7's "2.1 readers read
  2.0 and 1.x unchanged", and these decision rows: Lite bridge, Required hotel
  section, Compatibility identity, Native block/envelope shape (subject to G2),
  Versions, Pre-existing hospitality calculations, Compatibility severities,
  Scope identity (`declared_asset_class` only), Grouping keys and Official
  module packages.
- **RFCs 0053, 0056, 0057, 0058** (subject to G1): the clauses that keep their
  legacy scalar "working", and the agreement codes `TAX-04`, `HDG-04`/`ESC-03`,
  `CAPX-05` and `REC-10`.

## Compatibility analysis

None, by design (P5):

- **Documents.** Every document that is not Format 3.0 is refused, including
  every document produced before 4.0.0.
- **Implementations.** Protocol 3.0.0 claims do not carry over.
- **Modules.** Third-party modules must re-declare their ranges and replace
  `requires_tier`.

The only consumers are the owner's. StackUW and underwriter.cc update their
exporters to emit Format 3.0 with the 4.0.0 release, and their open
`UPSTREAM-NNN` issues are not blocked by this RFC. The deprecated npm module
packages stay deprecated and are never published again.

## Conformance impact

- **Re-authored:** every fixture listed in D5, with baselines regenerated
  where shape appears in them: parse projections (nested `meta`, no
  `superseded_blocks`), hashes, signatures, receipt digests and pack versions.
- **Removed:** `meta-v2` shim/one-shape cases, the `migrate` suite,
  `modules/runtime/01-11`, the `CLS-01`/`CLS-02`/`CLS-05` cases, the legacy-
  scalar agreement cases (`HDG-04`, `ESC-03`, `CAPX-05`, `REC-10`, `TAX-04`)
  and the deprecated-tier runner cases.
- **New:** `UNSUPPORTED_FORMAT_VERSION` for `uw_version` 1.1, 2.0, 2.1, 4.0
  and absent; `META-01` flat `_meta`; generalized `SRC-03`; `SRC-01`/`SRC-02`
  as errors; `org.uwmd.data_center` refused by `INVALID-ASSET-CLASS-002`;
  structured `.uw.md` refused by `SOURCE_CONTENT_MISMATCH`; a hotel document
  without `hotel_metrics` refused by `CLS-03`; `requires_conformance`/
  `requires_profiles` accept and refuse cases; `receipt_version` 1.0 refused.
- **Invariant (hard acceptance criterion):** every calc baseline value, the
  lender fixture (187 / 0 / 0, with per-statement evidence identical) and
  every receipt's result values are unchanged. Saguaro's newly computable
  hotel calculations are additions, listed in the Phase 3 PR.
- Tier and profile: this changes the Reader corpus (version and shape
  refusals), the Verifier corpus (codes) and the Module profile (manifest
  vocabulary).

## Reference implementation

Each phase is its own PR, in order. `[Unreleased]` carries the CHANGELOG
entries; nothing ships until Phase 6.

1. **RFC acceptance.** Owner decides G1–G3. The RFC moves to `accepted` and
   records the answers. Status-line notes are added to RFCs 0009, 0017, 0022,
   0025, 0031, 0072, 0078 and 0080 (and 0053/0056–0058 per G1).
2. **Spec, schemas, `protocol.ts`.**
   - Write `UW_FORMAT_SPEC.md` and rename `UW_PROTOCOL.md`; delete the stubs;
     rewrite `UW_RECEIPT` for 1.1 and the Lite spec §6 for 3.0.
   - Rename the block schema; update the module- and implementation-manifest
     schemas, corpus-index schema and the D10/G1 schemas.
   - In `protocol.ts`, set the new code registry and the `requires_conformance`
     types, and add `'3.0'`/`'4.0.0'` to the supported sets so `main` stays
     green.
   - Update AGENTS.md, the wiki and the docs-site copy list and link map.
3. **Corpus re-authoring.**
   - A one-off script runs `migrate --source-tags`, then
     `migrate --to-v2 --resign` with the conformance test key, then stamps
     `uw_version: "3.0"`, applies G1/G2, replaces alias and module ids,
     rewrites module manifests (§6) and pack ranges, and re-stamps hashes.
     Receipts are re-issued.
   - The PR carries a **before/after value diff** over every calc baseline,
     the lender fixture and every receipt result, and it must be empty apart
     from the listed Saguaro additions.
4. **Code deletion.**
   - Narrow the supported sets to `['3.0']`/`['4.0.0']`.
   - Delete the reshape layer and make `UWMeta` nested; delete both migrators,
     the CLI `migrate` commands and `init --format`.
   - Delete the alias, the transition rules and the module packages (with
     their release, verify and lockfile references); delete the legacy
     scalars and the items in §7.
   - Lite emits 3.0; fix the web viewer.
5. **Conformance renames** (§8), the runner and generator, and docs-site pages.
6. **Release 4.0.0** by the wiki 11 procedure: Format 3.0, Protocol 4.0.0,
   seven packages.

**Combining.** Phase 2 and the set-narrowing half of Phase 4 could be one PR
only if Phase 3 lands inside it, which makes a single unreviewable diff of
roughly 800 files. Keep 2 → 3 → 4 separate. Phase 5 is mechanical and can
fold into Phase 4 if the reviewer prefers one break; recommended separate,
because renames dominate any diff they share. Phase 1 stays alone.

## Alternatives considered

1. **Keep the read path, drop only the write path** (readers accept 1.x/2.x;
   writers emit 3.0). Rejected: the read path is the expensive half. It is
   what an independent implementer must build, and P5 rules it out.
2. **Format 2.2 instead of 3.0.** Rejected: refusing every earlier version and
   removing fields is a breaking change, and semver-per-surface (invariant 6)
   requires a major.
3. **Keep the migrators as an unsupported script.** Rejected (D4): a tool
   nobody tests rots. The one use is Phase 3, and the git history keeps it.
4. **Deprecate first, remove in 5.0.** Rejected (P5): a deprecation period
   protects users the project does not have.

## Unresolved questions

- G1–G3 above (owner gates, decided at acceptance).
- **The other `_v1` spec file names** (`UW_LITE_SPEC_v1`, `UW_RECEIPT_v1`,
  `UW_XML_MAPPING_v1`, `UW_CSV_BUNDLE_v1`, `UW_COMPOSITION_v1`) are not
  covered by D2. Recommendation: rename them in Phase 2 under the same
  convention and link map, so no spec file name carries a version. Otherwise
  they keep their names.
- **Follow-ups outside this RFC:** the `deriveSourcesUses` double count
  (G1); `MOD-CALC-ERROR`/`MOD-RULE-ERROR` naming for builtin class failures;
  the mojibake (`Â§`) in the block-v2 schema description, which Phase 2
  rewrites anyway.

## What remains after this RFC

The reference implementation supports **exactly one format version (3.0) and
one protocol version (4.0.0)**:

- one `_meta` shape and one block body shape;
- one block digest rule and one receipt version;
- one spelling for each class id and each fact;
- two conformance tiers with six profiles, and no aliases;
- one format spec file and one protocol spec file.

Every later breaking change follows P5: an RFC and a version bump, but no
transition plan, until the owner declares the standard released.

## Prior art

- **RFC 0009's own timeline** planned the shim's removal at the next major;
  this RFC carries it out.
- **Pre-1.0 semver practice** (the spirit of semver §4): before a public
  release, anything may change and no compatibility is owed. Projects such as
  Rust and Deno broke freely before their 1.0 releases for the same reason.
