---
rfc: 0081
title: 'One format, one protocol: remove backward compatibility (pre-release cleanup)'
status: accepted
accepted: 2026-10-11
author: claude-code (agent proposal, from owner direction 2026-10-11)
created: 2026-10-11
depends_on:
  - 0009
  - 0078
  - 0080
supersedes:
  - 0006 (the hotel_metrics field set only)
  - 0009 (v1/v2 coexistence, the read shim, the per-file boundary and the block digest scope only)
  - 0017 (legacy detection and the Lite-to-1.1 bridge only)
  - 0022 (receipt_version 1.0 acceptance only)
  - 0025 (the explicit-override path for structured .uw.md only)
  - 0031 (legacy source tags and the read-time interpretation only)
  - 0053 (sale_triggers_reassessment and TAX-04 only)
  - 0056 (rate_cap_pct, the reserve and cap-cost scalars, HDG-04, HDG-05 and ESC-03 only)
  - 0057 (the renovation scalars and CAPX-05 only)
  - 0058 (cam_cap_pct and REC-10 only)
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

**Accepted 2026-10-11.** A coding agent wrote this RFC from the owner's
direction of 2026-10-11 (Product principle 5, D1–D14). It was drafted in PR
#307, and the owner (Jared) decided its three open gates and the other open
questions the same day; the answers are recorded in
[Owner decisions at acceptance](#owner-decisions-at-acceptance-2026-10-11).
Merging PR #307 records acceptance. The change is breaking for the Format
(3.0), the Protocol (4.0.0) and `@uwmd/core` (4.0.0). Implementation follows in
Phases 2–6 under [Reference implementation](#reference-implementation), each in
its own PR.

## Summary

The project is live but pre-release: the owner is its only user. It still
carries the compatibility machinery of a mature standard:

- four readable format versions (1.0, 1.1, 2.0, 2.1);
- six honored protocol contracts (1.14.0 through 3.0.0);
- two `_meta` shapes, with a reshape layer in both directions;
- two block body shapes;
- two migration tools;
- a deprecated class alias and two deprecated module packages;
- four deprecated conformance tier names;
- legacy scalar fields beside their structured replacements;
- hotel facts stated in two sections;
- version-conditional severities.

This RFC removes all of it:

- **One format.** Format 3.0 is the 2.1 shape (nested `_meta`, the twelve
  builtins) minus every alternate spelling. It is described by one spec file,
  and it is the only format any reader accepts.
- **One protocol.** Protocol 4.0.0 is the only protocol contract.
- **No transition plan.** There are no grandfathered documents, deprecation
  periods, aliases, shims, migration tools or old-version readers. The repo's
  own corpus is re-authored once, with financial values unchanged, and then
  the migrators are deleted.

## Motivation

- **Owner direction.** Product principle 5 (2026-10-11): *"we dont need back
  compatability yet, there are no users other than me and this is
  essentially pre-release despite being live. we can and should clean things
  up better and do not need legacy support for old modules basically."*
- **Compatibility is most of the surface.** A reader today has to implement
  all of the following, and none of it changes what a document *means*:
  - two `_meta` shapes and two block body shapes;
  - two digest canonicalizations;
  - per-file severities for `SRC-01`/`SRC-02`;
  - `META-V2-IN-V1`/`META-V1-IN-V2`;
  - the `org.uwmd.data_center` alias;
  - module-gated hospitality rules and a version-gated `CLS-04`.

  All of it is code an independent implementer must write to claim
  conformance (RFC 0078's boundary test: a lender verifying with only the
  standard).
- **The format has two specs.** `UW_FORMAT_SPEC_v1.md` (4,113 lines) is the
  base. `UW_FORMAT_SPEC_v2.md` (387 lines) is a delta that amends it "for 2.0
  files only". A reader has to merge the two in their head to learn what a 2.1
  document is.
- **The compatibility windows were designed for adopters who do not exist.**
  RFC 0009's own timeline planned this step: "v3.0: flat shape removed from
  the spec … v3 readers MAY drop the shim". Every other window (RFC 0078's
  "during 3.x", RFC 0080 §5) protects documents that only the owner has, and
  the owner's consumers update.
- **One removal is overdue.** FV `legacy_code` was promised to travel "for one
  release; v1.2 drops `legacy_code` entirely" (`validator.ts:68-70`). Core
  3.0.0 still emits it.

## Owner direction (binding)

| # | Direction (owner, 2026-10-11) | Inventory facts (verified on `main` at `5b94c9f`) |
|---|---|---|
| P5 | Clean breaks beat compatibility layers. No grandfathering, deprecation periods, aliases, shims, migration tools or old-version readers. A breaking normative change gets an RFC and a version bump but no transition plan. | Product principle 5. |
| D1 | Ship as **Format 3.0, Protocol 4.0.0, `@uwmd/core` 4.0.0**. Format 3.0 is the 2.1 shape minus every alternate spelling, and it is the only supported format. Readers refuse every other `uw_version` with one clear error. `SUPPORTED_FORMAT_VERSIONS = ['3.0']` and `SUPPORTED_PROTOCOL_VERSIONS = ['4.0.0']`. The major supersedes Protocol 3.0's "during 3.x" promises. | `protocol.ts:54` reads `['1.0','1.1','2.0','2.1']`, and no corpus file declares 1.0. `protocol.ts:65` honors `1.14.0, 2.0.0, 2.1.0, 2.2.0, 2.25.0, 3.0.0`. No reader refuses an unknown `uw_version` today; Protocol §XII.3 only says to refuse *editing* a newer major. |
| D2 | **One format spec.** Merge `UW_FORMAT_SPEC_v1.md` (base) and `UW_FORMAT_SPEC_v2.md` (delta) into `spec/UW_FORMAT_SPEC.md`, describing only Format 3.0, and delete both old files. Rename the protocol to `spec/UW_PROTOCOL.md`. Remove the 34 "Moved to … starter products guide" stubs; the starter guide is their home. | All 34 stubs are in `UW_PROTOCOL_v1.md` (§III.1–III.6, §IV, §V.1/V.5–V.8, §VIII.2b/2c, §IX, §XIV). |
| D3 | **Delete on-disk v1 flat `_meta`:** parser shape detection, `META-V2-IN-V1`/`META-V1-IN-V2`, the version-conditional `SRC-01`/`SRC-02` severity, the v1 block-hash branch, the `?? '1.1'` defaults, the v1 `uwmd-block.schema.json` shape and the `section_id` alias. The target is an in-memory `UWMeta` that matches the on-disk nested shape, so no reshape layer survives (Phase 4 decides the mechanics). | `meta-shape.ts` (both reshapes); `parser.ts:361-388`; `validator.ts:3146-3230`; `integrity.ts:83-95, 267, 397`; `envelope.ts:95, 317`; `renderer.ts:373, 435, 731` and `report.ts:290`; shape selection in `editor.ts`/`runner.ts`. About 67 flat-field reads of `block.meta.*` in 17 non-test source files. |
| D4 | **Delete the migration tooling** after one last use to re-author the corpus: `migrate-to-v2.ts`, `migrate-source-tags.ts`, the CLI `migrate` commands, their exports, the conformance `migrate` suite and RFC 0031's legacy `_meta.source` tags. `uwmd init` writes only Format 3.0 (drop `--format`). | `cli.ts:478-580, 1461-1478, 2071-2072`; `init.ts:13-16, 108-114`; `index.ts:45` and `browser.ts:55` export `migrateSourceTags`/`mapLegacySource`. `migrate-to-v2.ts` writes 2.0, not 3.0. It refuses signed blocks unless given a key (`--resign`) and refuses legacy-tag blocks until `--source-tags` has run. |
| D5 | **Re-author every fixture and example** to Format 3.0. Signed fixtures are re-signed, receipt fixtures re-issued and content hashes recomputed. **Financial values never change; only envelope and metadata shape do.** That is a hard acceptance criterion: the lender fixture and every calc baseline value must stay identical. | Conformance `.md` files: 435 at 1.1, 227 at 2.0, 54 at 2.1. Examples: 20 at 1.1, 2 at 2.1 (Mesa Gateway, Desert Palms). Also about 26 package, tool and docs fixtures and about 85 inline test strings. Seven corpus files carry signatures; the test key is `conformance/signing/keys/signer-private.jwk.json`. The lender fixture reads 187 verified / 0 failed / 0 unverifiable. |
| D6 | **Remove the RFC 0080 transition surface:** the `org.uwmd.data_center` alias, `CLS-01`, `CLS-02`, the frontmatter `id: org.uwmd.*` grandfathering, `declared_asset_class`, the batch and lake alias branches (keep `toBuiltinAssetClass` as the plain builtin lookup), and the `LEGACY_MODULE`/`PRE_RFC_BUILTIN_CALCS` severity switching. `CLS-04` is always an error, and class rules and calcs behave identically for every document. Hospitality has no module-gated behavior. Re-author alias fixtures with builtin ids. Delete both module packages, the `conformance/modules/runtime` shell scenarios and every release, verify and lockfile reference; releases from 4.0.0 publish seven packages. | `types.ts:593-597`; `asset-class.ts:243-249`; `validator.ts:3071-3078`; `builtin-class-validation.ts:12-104`; `cli.ts:1186-1189`; `uwmd-batch/src/index.ts:308`; `uwmd-lake/src/plan.ts:529-535`. 15 corpus files use `org.uwmd.data_center`. `conformance/modules/runtime/01-11`. The module packages appear in `release.yml`, `release-packages.mjs`, `release-state`, `verify-versions`, `verify-lockfile`, `run-conformance` and the lockfile. Both packages were deprecated on npm on 2026-10-11. |
| D7 | **Old protocol and module ranges.** A module manifest must declare ranges satisfied by 4.0.0 and 3.0. All 12 builtin packs move to `requires_protocol: '^4.0.0'` and `requires_format: '^3.0'`, with a new pack major version (receipts pin pack versions, so receipt fixtures are re-issued). Module conformance manifests and signed module fixtures are regenerated. | 10 packs declare `^1.0.0`/`^1.1.0`. `data_center` and `manufactured_housing` declare `>=2.25.0`/`>=2.1.0`. All 12 declare `requires_tier: tier-3-calc-host`. `modules.ts:1012-1049` satisfies ranges against any supported version. |
| D8 | **Conformance tier names.** Delete `LEGACY_TIER_READINGS`, the `readConformanceTier` aliasing, `ViewerTier`, the numeric `--tier` shorts, legacy `--tier=<suite>`, the deprecation notices, the `legacy_id`/`portable_legacy_ids`/`migration_base`/`before` bookkeeping and the deprecated manifest enum values. Rename the `tier-*` directories, suite ids and portable case ids to content names. Docs-site pages follow, with no redirects. | `protocol.ts:91-142`; `scripts/conformance-targets.mjs:18-45, 99-104`; `conformance/runner/runner.py:64, 402` and `tier-readings.json`; `corpus-index.json`; the deprecated `tier` branch of `implementation-manifest.schema.json`. 319 tracked files outside RFC and release history name a tier. |
| D9 | **Module tier vocabulary.** Replace `ModuleManifest.requires_tier` (tier-1..4) and the host tier with the Protocol 3.0 vocabulary: `requires_conformance: 'reader' \| 'verifier'` plus an optional `requires_profiles`. | `module-manifest.schema.json` requires `requires_tier`; `modules.ts:30, 138, 596-619, 1018-1024` (`PROTO-MOD-006`, `PROTO-MOD-029`). |
| D10 | **Remove the legacy scalars that have structured replacements:** `rate_cap_pct` (HDG-04), `uses.interest_reserve`/`uses.operating_reserves` (ESC-03), `uses.renovation_*` (CAPX-05), `cam_cap_pct` (REC-10) and `sale_triggers_reassessment` (TAX-04), so each fact has one way to be stated. Retire the agreement codes. | Four of the replacements could not state the lone fact; G1 below makes them able to. |
| D11 | **Other deprecated items:** FV `legacy_code`; structured content under `.uw.md` (refuse; no migration); `superseded_blocks` (remove if it only serves compatibility); `getRequiredSections`; the renderer's pre-§4.5 NOI keys; the retired-scenario special wording (remove if it is compatibility); receipt_version 1.0 and Lite canonicalization 1.0; `RECEIPT_RESULT_TOLERANCE`. | `validator.ts:66-93`; `source-representation.ts:66-186`; `cli.ts:171-221`; `protocol.ts:772`; `renderer.ts:398-413`; `scenario.ts:20`, `validator.ts:211-222`; `receipts.ts:68, 92`; `UW_RECEIPT_v1.md` §10.4 ("MUST accept both `1.0` and `1.1`"); `UW_LITE_SPEC_v1.md` §6. |
| D12 | **The Lite bridge emits Format 3.0 for all twelve classes,** and the Lite spec is updated. | `lite-bridge.ts:11, 16, 320-342, 509-520`: ten classes compile to flat 1.1 and two to wrapped nested 2.1. Explicit Lite `uw_version` values pass through. |
| D13 | **Keep, because these are not compatibility:** `RCP-06/07/10` (a version or engine mismatch is unverifiable), the `INT-08` deprecated algorithms, the generic `canonicalize`/`sha256Hex` digest, the historical release evidence in `docs/releases`, the `releasePackagesForGeneration` history (edited to drop the module packages going forward), Excel's no-MCP-sheet path, and the web viewer (fixed to read the nested shape). | `tools/web-viewer/index.html:161-165` reads only the flat `_meta.section`/`_meta.superseded`. |
| D14 | **Supersession.** List each compatibility clause this RFC supersedes, and note the partial supersession in each affected RFC's status line. | See [Superseded clauses](#superseded-clauses). |

## Owner decisions at acceptance (2026-10-11)

The draft raised three gates and several open questions. The owner decided
all of them:

| # | Question | Owner decision |
|---|---|---|
| G1 | Legacy scalars whose structured replacement could not state the lone fact | Option (a): each replacement gains the ability to state the lone fact, and no fixture invents a value. `rate_cap_cost` vs `premium` (`HDG-05`) gets the same treatment. Footing rule: the moved amounts count in the derived uses total exactly as the scalars did, so no derived total changes. |
| G2 | One block body shape | **Bare.** A block is the section payload with one inline `_meta` key; the `{section_id, _meta, content}` wrapper is not allowed in documents. The envelope representation keeps its own structure, and the conversion is mechanical because the fence carries the section id. The schemas change to match the spec text. The block hash is the canonical JSON of the payload minus `_meta`. |
| G3 | Hotel facts stated in both `rent_roll` and `hotel_metrics` | **Consolidate now.** Each fact lives once: keys, ADR, occupancy and available room nights live in the hospitality `rent_roll` (builtin precedent), and `hotel_metrics` keeps only facts not stated elsewhere. RevPAR stays `rooms_revenue / available_room_nights`, and the `CC-HOSP` rules read the single home. |
| Q1 | The other `_v1` spec files | Rename them in Phase 2 alongside the format and protocol specs. |
| Q2 | Mojibake in `uwmd-block-v2.schema.json` | Phase 2 fixes it; that schema is itself renamed and merged. |
| Q3 | The `deriveSourcesUses` renovation double count | **Out of scope for RFC 0081.** The owner handles it separately. |

## Proposed change

### 1. Versions

- **Format 3.0.** `uw_version: "3.0"` is REQUIRED in frontmatter. A reader MUST
  refuse a document whose `uw_version` is absent or is anything other than
  `"3.0"`, with **`UNSUPPORTED_FORMAT_VERSION`** (parse stage, error). The
  message names the declared value and the one supported value. There is no
  partial read, no display-only mode and no tolerance for a newer minor.
- **Protocol 4.0.0.** The 4.0.0 contract is Protocol 3.0.0 with every
  compatibility clause below removed, `requires_tier` replaced (§6) and the
  tier-alias machinery gone (§8). §XII.3 is rewritten: the format-version
  refusal above replaces "refuse to edit a newer major". §XII.4 keeps the
  protocol-range rule.
- **`@uwmd/core` 4.0.0** ships with CLI 4.0.0. Other package versions move by
  semver-per-surface at release preparation.
- **Constants:** `FORMAT_VERSION = '3.0'`, `SUPPORTED_FORMAT_VERSIONS = ['3.0']`,
  `PROTOCOL_VERSION = '4.0.0'` and `SUPPORTED_PROTOCOL_VERSIONS = ['4.0.0']`.
  Module `requires_format`/`requires_protocol` ranges are checked against
  those single values.

### 2. One spec file per spec, no version in any file name

`spec/UW_FORMAT_SPEC.md` describes Format 3.0 only. Version history lives in
the RFCs and the CHANGELOG, not in the normative text. Disposition:

| Source | Disposition in `UW_FORMAT_SPEC.md` |
|---|---|
| v1 front matter, Part I, Part II (except §2.4 body and §2.5) | Kept, with the version banner set to 3.0. |
| v1 §2.4 data block | Kept, and states the bare block body (§3 below) normatively. |
| v1 §2.5 flat `_meta` table and the "only valid form for 1.x" paragraph | **Replaced** by v2 §2 (nested `_meta`) and v2 §3 (`_overrides`). |
| v1 §2.6 source identifiers | Kept, without the read-time interpretation, migration notes or legacy-tag tables. The actor grammar is always enforced, and the resolution vocabulary is the v2 §4.1 closed set. |
| v1 Part III provenance model | Kept, with the single block digest rule of §3 below. The v1 and v2 digest rules, the migration text and the signature-loss text are deleted. |
| v1 Part IV section registry | Kept, with the §7 field changes, the §5 hospitality fields, and the RFC 0080 "Official class sections" appendix moved into Part IV beside the other sections. |
| v1 Part V validation | Kept, with every per-generation clause removed (no "in both format generations", no "warning in 1.x"). |
| v1 Part VI toolchain | Kept, with the v2 §7 amendments applied: no `migrate`, `init` writes 3.0, and the Lite bridge emits 3.0. §6.1 parse output drops `superseded_blocks`. |
| v1 Part VII and Appendices A–D | Kept. |
| v2 §1 versioning and the one-shape rule | **Replaced** by §1 above. With one shape there is nothing to mix. |
| v2 §4 vocabulary changes | Folded into §2.6 as plain rules, without the "at 2.0" framing. |
| v2 §5 canonicalization and migration, §6 deprecations, §8 conformance, Appendix A shape mapping | **Deleted.** §3 below gives the digest rule; conformance is described against the renamed corpus. |
| v2 "Signed block roles" and v2 §8 official builtin classes | Moved to their topical homes: §2.8 for roles, §2.2 and Part IV for classes. |

**Renamed spec files.**

- The protocol becomes `spec/UW_PROTOCOL.md`. This supersedes RFC 0078 D12's
  "rename in a later editorial pass".
- The other specs drop their version suffix in the same phase (owner Q1):
  - `UW_LITE_SPEC.md`
  - `UW_RECEIPT.md`
  - `UW_XML_MAPPING.md`
  - `UW_CSV_BUNDLE.md`
  - `UW_COMPOSITION.md`
- The protocol's 34 starter stubs are deleted, and the §0/§I section map points
  to `docs/starter/` once.
- Appendix E's worked example re-authors the `org.uwmd.hospitality` manifest
  as a neutral third-party example (`com.example.*`), because there is no
  longer an official module.

Every in-repo link follows the renames. Historical RFCs and release records
are not edited. Instead, the docs-site prebuild link map resolves each old
file name to its new page, so the site build does not fail on dead links (the
RFC 0025 / PR #57 failure mode). This is a build-time link map, not a redirect.

### 3. One block shape, one `_meta` shape, one digest (G2)

**Block body.** A Format 3.0 data block is the fenced JSON object of §2.4.

- Its members are the **section payload** plus up to four reserved members:
  - `_meta` — REQUIRED, the first key;
  - `_role` — optional (RFC 0040);
  - `_overrides` — optional (v2 §3);
  - `_notes` — optional.
- Every other member is payload. A payload member may be named `content` like
  any other field.
- The section id is carried by the fence annotation (`uw:section`) and by
  `_meta.section`. It is never a block member.
- A block with a top-level `section_id` member (the retired
  `{section_id, _meta, content}` wrapper) is refused with **`META-01`**.
- `blockPayload()` stops guessing at layout: the payload is the object minus
  the reserved members. The parse projection's wrapped-fence branch
  (`cli.ts:181-191`) is deleted, and the bare-fence projection rule of
  Protocol §II.6a.6 applies unchanged.

**Envelope.** The Document Envelope (`uw-document-envelope`) keeps its own
structure. An envelope block is `{ annotation, content, prose? }`, where
`content` is the fenced object. Conversion in both directions is mechanical,
because the annotation carries the section id.

**`_meta`.**

- `_meta` MUST be the nested object: `section`, `provenance`, `quality`,
  `lifecycle`, and optional `integrity`. Readers never reshape it.
- A block whose `_meta` lacks the nested `provenance` and `lifecycle` objects
  is also **`META-01`** (error: "block is not in the Format 3.0 shape").
  `META-V2-IN-V1` and `META-V1-IN-V2` are retired.
- The provenance-completeness family is unchanged: `META_MISSING`,
  `META_FIELD_MISSING_<FIELD>` and `META_LOW_CONFIDENCE_NO_REVIEW_FLAG`.
- `_meta.section` is the only spelling; the `section_id` alias inside `_meta`
  is gone.
- `SRC-01` and `SRC-02` are always errors. No read-time interpretation moves a
  resolution tag out of `provenance.source`.
- `SRC-03` changes from "`resolution` is `manual`" to "`provenance.resolution`
  is outside the closed resolution vocabulary" (error).
- The in-memory `UWMeta` becomes the nested shape (the D3 target), and
  `UWBlock.meta_shape` is removed.

**Block digest (normative).** A block's `content_hash` is the lowercase
hexadecimal SHA-256 of the UTF-8 bytes of the RFC 8785 (JCS) canonical JSON
serialization of the block object **with its `_meta` member removed**:

- Every other member is included: all payload fields, plus `_role`,
  `_overrides` and `_notes` when present.
- Nothing else is excluded, defaulted or reordered beyond JCS.
- The reference serializer is the existing `canonicalizeExact`, so no new
  serializer is introduced.

This rule has three consequences:

- **What the hash covers.** `content_hash` commits to what the block states,
  not to who stated it. `_meta` (provenance, quality, lifecycle and the whole
  `integrity` object, including `parent_hash` and `algorithm`) is outside the
  digest.
- **What a signature covers.** The signature input is unchanged
  (`content_hash`, `section`, `actor`, `timestamp`, `kid`, `signed_at`; RFC
  0010 "What is signed"). A signature therefore still binds the author and
  time to the content. It no longer binds `parent_hash` transitively, which is
  exactly what RFC 0010 §4 intended ("re-rooting a chain after a merge must not
  invalidate every prior signature"); its note that the repository did not
  deliver this is resolved.
- **Chain verification.** `parent_hash` is still compared with the prior
  block's `content_hash` (`INT-*` codes). An edit that changes only `_meta`
  leaves `content_hash` unchanged.

The generic `canonicalize`/`sha256Hex` remains for receipts and other
non-block digests (D13).

**One block schema.** `uwmd-block-v2.schema.json` and `uwmd-block.schema.json`
merge into a single `uwmd-block.schema.json`:

- an object with REQUIRED `_meta` (the nested definitions);
- optional `_role`, `_overrides` and `_notes`;
- `"not": {"required": ["section_id"]}`;
- other members allowed (the payload, governed by the per-section schemas).

The merged file is written as clean UTF-8, which fixes the `Â§` mojibake (owner
Q2), and its description no longer mentions `META-*` mixing.

### 4. No migration tooling

The migrators are used exactly once, in Phase 3. They are then deleted along
with their exports, CLI commands, tests and the `migrate` conformance suite.

- `uwmd init` writes Format 3.0 bare nested blocks and takes no `--format`.
- Structured fences in a file named `.uw.md` are refused with
  **`SOURCE_CONTENT_MISMATCH`**, the existing code for content that
  contradicts its representation.
- `SOURCE_LEGACY_STRUCTURED`, the explicit-UWX override that accepted the old
  name with a warning, and `migrateLegacyUWMarkdown` are removed.

### 5. Builtin classes without transition rules; hospitality consolidated (G3)

**Identity.**

- `toBuiltinAssetClass(raw)` returns a value only for the twelve builtin ids.
- `org.uwmd.data_center` is an ordinary namespaced id. It is refused by
  `INVALID-ASSET-CLASS-002`, like every namespaced id that ends in a builtin
  name.
- `CLS-01`, `CLS-02` and `CLS-05` are retired. `CLS-05` ("new ids require
  Format 2.1") cannot fire when only 3.0 exists.
- `declaredModuleDependencies` reads only the object-list spelling. A
  `modules` entry naming `org.uwmd.hospitality` or `org.uwmd.datacenters` is
  an ordinary dependency that no installed module satisfies.
- `uwmd scope` drops `declared_asset_class`. Batch and lake group by the stated
  id.

**Every class follows the same rules.**

- `CLS-03` and `CLS-04` are errors for every document.
- A class-content calculation that fails reports `MOD-CALC-ERROR` (error).
- Class rules keep their declared severity regardless of `uw_version`,
  `modules` list or prior packaging.
- `PRE_RFC_BUILTIN_CALCS` and `LEGACY_MODULE` are deleted.

**Hospitality: each fact lives once.** Resulting fields:

| Home | Field | Status | Notes |
|---|---|---|---|
| `property` | `keys` (integer ≥ 0) | as today (primary size, Protocol §XIII) | The key count's single home. `hotel_metrics.key_count` and `rent_roll.keys` are removed. |
| `rent_roll` | `available_room_nights` (integer ≥ 0) | **required** by the hospitality class contract (`CLS-04` when `rent_roll` is stated without it) | Keys × days in the period. `rent_roll` itself stays required by the §5.1 stage lists (`DQ-06`). |
| `rent_roll` | `occupied_room_nights` (integer ≥ 0) | optional | Input to the dictionary `occupancy`/`adr`. |
| `rent_roll` | `adr` (number ≥ 0) | optional | The stated ADR. Moved from `hotel_metrics.adr`. |
| `rent_roll` | `occupancy` (fraction, 0–1) | optional | The stated occupancy. Moved from `hotel_metrics.occupancy`. |
| `hotel_metrics` | `market_revpar` (number or null) | optional; the section is **optional** | The comp-set RevPAR for the same period, the only fact not stated elsewhere. `adr`, `occupancy`, `available_room_nights` and `key_count` are removed from this section. |
| `hotel_brand` | `flag`, `franchise_fee_pct_of_rooms`, `marketing_fund_pct`, `loyalty_program_pct`, `term_years` | optional; section optional | Unchanged. |
| `hotel_food_beverage` | `fb_revenue`, `fb_cogs`, `fb_labor`, `complimentary_breakfast_cost_per_occupied_room` | optional; section optional | Unchanged. |

Hospitality has **no class-required section**. Its required class facts sit in
`rent_roll`, which the stage lists already require. This replaces the D6
default ("`hotel_metrics` required"), which had assumed `hotel_metrics` kept
its facts.

**Hospitality calculations and rules.**

- `revpar` stays `noi_model.income.rooms_revenue / rent_roll.available_room_nights`.
- `revpar_index` and `fb_gross_margin` are unchanged.
- `total_room_revenue` becomes `rent_roll.adr * rent_roll.occupancy * rent_roll.available_room_nights`.
- `room_revenue_per_key` becomes `round(total_room_revenue, 2) / property.keys`.
- Both keep their null guards, units and `round_to`. Their dictionary entries
  are re-pathed in Phase 2. The formulas are the same; only the input paths
  move.
- `CC-HOSP-01`, `CC-HOSP-03` and `CC-HOSP-04` are unchanged.
- `CC-HOSP-02` reads `rent_roll.occupancy` (`rent_roll.occupancy == null ||
  (rent_roll.occupancy >= 0 && rent_roll.occupancy <= 1)`).

**Hospitality corpus.**

- **Saguaro Select.** `rent_roll.keys` (142) is dropped because `property.keys`
  (142) states it, and Saguaro needs no `hotel_metrics`. Its newly computable
  `total_room_revenue` and `room_revenue_per_key` are listed additions.
- **`builtin-classes/01-03`.**
  - Move `adr` and `occupancy` into `rent_roll`, which already states the
    same `available_room_nights` (29,200).
  - Restate the non-standard `property.key_count` (80) as `property.keys`.
    The per-key size intensives that become computable are listed additions.
  - Keep `hotel_metrics.market_revpar`.
- **`builtin-classes/04`.** Its subject, a missing required `hotel_metrics`,
  no longer exists. It is replaced by a `CLS-04` case: a hospitality
  `rent_roll` without `available_room_nights`.

**Module packages.** `packages/uwmd-module-data-center` and
`packages/uwmd-module-hospitality` are deleted, together with
`conformance/modules/runtime/01-11` and every reference in release, verify and
lockfile tooling. From 4.0.0 the release publishes seven packages: core, CLI,
signing, batch, Excel, report and lake. `releasePackagesForGeneration` keeps
the module packages for generations before 4.0.0.

### 6. Module manifests: `requires_conformance` and `requires_profiles`

`requires_tier` is removed from `ModuleManifest`, the module-manifest schema,
`protocol.ts` and Protocol §X. Two fields replace it:

- **`requires_conformance`** (REQUIRED): `"reader"` or `"verifier"`, the minimum
  Protocol tier (§II.1/§II.2) a host must claim to load the module.
  `reader` < `verifier`.
- **`requires_profiles`** (OPTIONAL): an array of unique members of the closed
  `CONFORMANCE_PROFILES` list. The host must claim every profile listed.
  Absent means none.

Rules:

- A module that declares calculations SHOULD declare
  `requires_conformance: "verifier"` and `requires_profiles: ["module"]`.
  This replaces today's equally non-enforced "requires at least
  tier-3-calc-host", and no new refusal is added.
- An invalid value or an unknown profile is `PROTO-MOD-006`.
- A host whose claimed tier is below `requires_conformance`, or that lacks a
  listed profile, is `PROTO-MOD-029`.
- `LoadModuleOptions.hostTier` becomes `hostConformance` (default
  `"verifier"`) and `hostProfiles` (default: the profiles in the reference
  implementation's `ImplementationManifest`).
- The twelve builtin packs declare `requires_conformance: "verifier"` with no
  profiles.
- Re-authored module fixtures map `tier-1-reader`/`tier-2-editor` to `reader`
  and `tier-3-calc-host`/`tier-4-agent-host` to `verifier`. They add `module`
  to `requires_profiles` only when the manifest declares calculations. Every
  fixture keeps its accept/refuse outcome.

### 7. One way to state each fact (G1)

Each removed scalar's fact moves to a structured home that can now state it
alone. The phrase "**all-or-none**" means that stating some members of the
group but not all of them is a shape error under the section's existing shape
code.

**Reserves (`ESC-03` retired).**

- `uses.interest_reserve` and `uses.operating_reserves` are removed.
- The fact is stated as `uses.escrows[]` with `{"name": "interest" | "operating",
  "upfront": <amount>}`. That is valid today: only `name` is required, and
  `ESC-01` needs `upfront` or `monthly`.

**Rate cap strike (`HDG-04` retired).**

- `debt_structure.rate_cap_pct` is removed.
- `rate_hedge` now requires only `instrument` and `strike_rate`.
- `notional`, `index`, `effective_date`, `expiration_date` and
  `post_expiration_assumption` form the **terms group**, which is
  all-or-none (`HDG-01`).
- The lone fact is `"rate_hedge": {"instrument": "rate_cap", "strike_rate": 0.035}`.
- `HDG-01` (on stated members), `HDG-02` and `HDG-03` apply to every hedge.
- `HDG-06`, `HDG-07`, `HDG-08`, `HDG-09`, `HDG-10`, `replacement_funding` and
  the hedge clauses of `ESC-04` evaluate only when the terms group is stated.
  A strike-only hedge therefore never triggers a selection check.

**Rate cap cost (`HDG-05` retired).**

- `uses.rate_cap_cost` is removed. The cost's single home is
  `rate_hedge.premium`. RFC 0056 lists `rate_cap_cost` among the "four flat
  scalars" of `uses` that its typed fields describe.
- `premium` keeps its `HDG-01` shape rule. It needs no terms group, so a hedge
  may state `{"instrument", "premium"}` together with `strike_rate`.
- Documents that stated both the cost and the premium already agree, because
  `HDG-05` enforced it.
- A cost-only document moves the amount onto its single stated hedge.

**Renovation (`CAPX-05` retired).**

- `uses.renovation_budget` and `uses.renovation_contingency` are removed.
- `uses.renovation` requires no member except at least one of `budget` or
  `contingency`.
- `contingency_used`, `drawn_to_date` and `as_of_date` form the **draw group**,
  which is all-or-none. Stating it requires both `budget` and `contingency`.
  `contingency_remaining` is allowed only with the draw group.
- `CAPX-01` applies to the stated members. `CAPX-02`, `CAPX-03` and `CAPX-04`
  evaluate only with the draw group.
- The lone fact is `"renovation": {"budget": 4000000}`. No draw figure is
  invented.

**CAM cap (`REC-10` retired).**

- Tenant `cam_cap_pct` is removed.
- `recovery_terms` may state `cap` alone. `method` is required as soon as any
  member other than `cap` is stated.
- The lone fact is `"recovery_terms": {"cap": {"pct": 0.05}}`, with `over` and
  `accumulation` left unstated as today.
- `REC` rules that read `method` evaluate only when it is stated.

**Sale-triggered reassessment (`TAX-04` retired).**

- `sale_triggers_reassessment` is removed.
- `reassessment` now requires only `trigger`.
- `assessed_value`, `millage_rate` and `indicated_tax` form the **assessment
  group**, which is all-or-none. `jurisdiction`, `value_basis`,
  `assessment_ratio` and `round_to_decimals` are allowed only with that group.
- `TAX-01`, `TAX-02` and `TAX-03` evaluate only with the assessment group.
- The lone fact is `"reassessment": {"trigger": "sale"}`. Every corpus document
  states the old boolean as `true`. The only `false` is the retired `TAX-04`
  negative control. A `false` named no trigger, so a document that knows only
  "not on sale" states nothing rather than inventing one.

**Footing rule.** `deriveSourcesUses` derives `uses.total`, when `uses` is
stated, as today's sum of the numeric leaves of `uses` plus:

- the `upfront` of each `uses.escrows` entry named `interest` or `operating`,
  each counted once;
- the `premium` of each `rate_hedge` stated in an active `debt_structure`
  block, each counted once.

Other escrow names stay uncounted, as today. The typed `renovation` object's
leaves are already summed by today's rule, so a document that stated only the
renovation scalars and becomes `renovation: {budget, contingency}` derives the
same total.

For every document that stated each fact once, the derived total is
unchanged. Two corpus documents differ, and neither total is pinned by any
baseline:

- `capex/accept-draw-with-verified-remaining` stated the renovation scalars
  **and** the typed object. Today's sum counts both, on top of the separate,
  out-of-scope draw-field double count (owner Q3). Removing the scalars lowers
  its still-defective total from 11,350,000 to 6,850,000. This RFC neither
  fixes nor preserves that defect.
- `hedge/0076-two-seniors-no-hedge-escrow` states one 400,000 cap cost and
  `rate_cap_pct` on two identical senior variants. Each senior becomes a
  strike-only hedge, but the cost cannot be attributed to either without
  inventing a fact. Phase 3 drops the amount: the fixture asserts only
  `ESC-04` and `unverifiable/invalid_structure`, neither of which reads it.
  Phase 3 reports the dropped amount for owner confirmation.

**Also removed:**

- **FV `legacy_code`.** `ValidationMessage.legacy_code`, `fvCode()` and the
  `FV_*` mapping are removed.
- **`superseded_blocks`** in `uwmd parse` JSON. The source labels it
  compatibility-only (`cli.ts:171-172`).
- **`getRequiredSections`.**
- **The renderer's pre-§4.5 NOI keys** (`noiLegacyValue`).
- **The retired-scenario wording.** `RETIRED_SCENARIOS` and its special
  message are removed. A retired value gets the ordinary `DQ-07` warning; the
  open-scenario `DQ-07` rule itself stays.
- **Receipt versions.** `receipt_version` stays **`1.1`**, and it is the only
  accepted value (`SUPPORTED_RECEIPT_VERSIONS = ['1.1']`). Lite
  canonicalization is `1.1` only. `UW_RECEIPT.md` describes 1.1 directly.
  `RECEIPT_RESULT_TOLERANCE` is deleted, and `RCP-10` stays (D13).
- **The web viewer** now reads `_meta.lifecycle.superseded` and
  `_meta.section`.

### 8. Conformance names

- Tier aliases are removed in every form listed in D8. `--tier` accepts
  `reader` or `verifier`, fixture families are selected with `--suite`, and
  any other `--tier` value is a usage error.
  `ImplementationManifest.tier` is `"reader" | "verifier"` only.

| Today | 4.0.0 | Suite id(s) | Why |
|---|---|---|---|
| `tier-1-reader/` (`fixtures`, `expected`, `malformed`) | `documents/` | `documents` | The base documents are parsed (Reader), validated (Verifier) and rendered (starter products): 20, 31 and 34 cases, plus 1 integrity case. A `reader/` directory would mislabel 66 of its 86 cases. |
| `tier-1-reader/v2-fixtures/` (suite `meta-v2`) | removed | — | Its shim, one-shape and digest shape-insensitivity cases test deleted behavior. The `META-01` refusals move to `documents/malformed`, and the defaulted-`algorithm` case is retired with the new digest scope. |
| `tier-2-editor/` | `starter/editor/` | `starter-editor` | 6 starter-products cases. |
| `tier-3-calc-host/` | `calc/` | `calc` | 96 Verifier cases plus `revpar-basic` (Module). |
| `tier-3-calc-host/refinement/` | `starter/refinement/` | `starter-refinement` | Starter. |
| `tier-4-agent-host/` (`fixtures`, `profile`, `replay`) | `starter/agent/` | `starter-agent`, `starter-agent-profile`, `starter-agent-replay` | Starter. |
| `migrate/`, `modules/runtime/` | removed | — | D4, D6. |

- Portable case ids keep the `<owner>__<suite>__<scenario>__<op>` pattern
  with the new suite ids, for example
  `reader__documents__01-minimal-screening__parse`.
- `legacy_id`, `portable_legacy_ids`, `migration_base` and `before` are
  removed from `corpus-index.json` and its schema.
- Docs-site conformance pages follow the new names, with no redirects.

## Decisions

The calls this RFC makes where D1–D14 and the owner's acceptance answers leave
a detail open:

| Question | Decision | Why (precedent) |
|---|---|---|
| Error for an unsupported or absent `uw_version` | `UNSUPPORTED_FORMAT_VERSION`, parse stage, error. | `UNSUPPORTED_YAML_FEATURE` and `ENVELOPE_UNSUPPORTED_VERSION`; D1's "one clear error". |
| Wrapper member or flat `_meta` in a 3.0 file | One code, `META-01`. Retire both `META-V*` codes. | Codes are not renamed in place (the `FV_*` → `FV-NN` precedent). The hyphenated `META-*` family already owns block shape. |
| `SRC-03` | Generalize it to any resolution outside the closed vocabulary. | House pattern of closed vocabularies; the block schema already enumerates `ResolutionTagV2`. |
| Digest serializer | JCS via the existing `canonicalizeExact`. No `_meta`-aware stripping is needed once `_meta` is excluded whole. | G2 (owner); RFC 0010 "Canonicalization uses RFC 8785 (JCS)". |
| Receipt version | Keep `1.1` and drop `1.0`. No renumbering. | The receipt shape does not change. `receipts.ts` refuses to stamp a version for a change that did not happen. UWX canonicalization stays `1.0`: envelope canonicalization reads the raw fenced object, and its rule is unchanged. |
| `superseded_blocks` | Remove. | The source labels it compatibility-only, and it duplicates `superseded`. |
| Retired scenarios | Remove the special wording and keep the generic `DQ-07`. | RFC 0072 R3's reason for the special wording is compatibility. |
| `.uw.md` with structured fences | `SOURCE_CONTENT_MISMATCH`. | The existing code for content that contradicts its representation. |
| Module host vocabulary | As §6 states. Reuse `PROTO-MOD-006`/`029` and add no new refusal. | RFC 0078 §II tiers; fix-scope discipline. |
| Corpus directory names | `documents/`, `calc/`, `starter/{editor,refinement,agent}/`. | RFC 0078 Phase 3 tags owners per case, so directories are named by content. |
| Key count's home (G3) | `property.keys`, not `rent_roll`. | It is the builtin primary size: Protocol §XIII and the dictionary's `price_per_key`/`loan_per_key`/`noi_per_key` read it, and RFC 0080 put every primary size on `property`. G3's "builtin precedent" points here. The other three hotel facts live in `rent_roll`. |
| Hospitality required section (G3) | None. The required facts are in `rent_roll`. | G3 consolidation leaves `hotel_metrics` holding one nullable comp-set figure, and requiring that section would require nothing. |
| Home of the rate cap's cost (G1) | `rate_hedge.premium`. | RFC 0056 lists `rate_cap_cost` among the "four flat scalars" its typed fields describe. Nine corpus documents state `premium` with no cost, two of them testing a missing `sources_uses`/`uses`. The opposite choice would force `sources_uses` blocks into them. |
| Lone-fact groups (G1) | All-or-none groups under the existing shape codes. Dependent rules evaluate only when their group is stated. | RFC 0056 group-statement precedent (`ESC-01`: "at least one of the two stated"); no new code family. |
| Status lines of superseded RFCs | Edited in this acceptance PR. | Matches the RFC 0080 precedent. |

## Superseded clauses

Each RFC below carries a status-line note pointing here:

- **RFC 0006:** the `hotel_metrics` field set (now `market_revpar` only).
- **RFC 0009:**
  - "Migration story (the back-compat parser shim)";
  - "One shape per file" (both directions);
  - "Deprecation timeline" (carried out here);
  - the v1 and v2 block digest rules under "Canonicalization, integrity, and
    signatures across the shape change" (replaced by §3 above);
  - the per-file boundary later written into v2 §1.3.
- **RFC 0017:** "Legacy detection", and the bridge pinned to Format 1.1.
- **RFC 0022:** acceptance of receipt_version 1.0 beside 1.1, as written into
  `UW_RECEIPT_v1.md` §10.4.
- **RFC 0025:** the explicit-override acceptance of a structured `.uw.md`.
- **RFC 0031:** §4 read-time interpretation, the 1.x warning severities and the
  legacy-tag migration tool.
- **RFC 0053:** `sale_triggers_reassessment`, `TAX-04`, and the required
  assessment members (now an all-or-none group).
- **RFC 0056:**
  - `rate_cap_pct`, `uses.interest_reserve`, `uses.operating_reserves` and
    `uses.rate_cap_cost`;
  - `HDG-04`, `HDG-05` and `ESC-03`;
  - the hedge's required set (the terms group is now all-or-none).
- **RFC 0057:** `uses.renovation_budget`/`_contingency`, `CAPX-05`, and the
  required draw members (now an all-or-none group).
- **RFC 0058:** `cam_cap_pct`, `REC-10`, and `method` being required when only a
  `cap` is stated.
- **RFC 0072:** R3's retired-value wording and the "in both 1.x and 2.x"
  clauses.
- **RFC 0078:** D12; the Compatibility analysis's "during 3.x the four old
  values stay readable"; the Phase 3 decisions on legacy aliases, `legacy_id`
  and `portable_legacy_ids`.
- **RFC 0080:**
  - §5 in full;
  - §6's final 0.2.0 shells;
  - §7's "2.1 readers read 2.0 and 1.x unchanged";
  - the decision rows Lite bridge, Required hotel section, Compatibility
    identity, Native block/envelope shape, Versions, Pre-existing hospitality
    calculations, Compatibility severities, Scope identity
    (`declared_asset_class`), Grouping keys and Official module packages;
  - §4's placement of the hotel facts in `hotel_metrics`.

RFC 0010 is not superseded. §3 restores its §4 intent, so its implementation
note about hash scope no longer applies; that RFC carries a short note saying
so.

## Compatibility analysis

None, by design (P5):

- **Documents.** Every document that is not Format 3.0 is refused, including
  every document produced before 4.0.0.
- **Implementations.** Protocol 3.0.0 claims do not carry over.
- **Modules.** Third-party modules must re-declare their ranges and replace
  `requires_tier`.

The only consumers are the owner's. StackUW and underwriter.cc update their
exporters to emit Format 3.0 with the 4.0.0 release. The deprecated npm module
packages stay deprecated and are never published again.

## Conformance impact

- **Re-authored.** Every fixture listed in D5, with baselines regenerated
  where shape appears in them: parse projections (nested `meta`, bare
  payloads, no `superseded_blocks`), hashes (§3 rule), signatures, receipt
  digests and pack versions.
- **Removed.**
  - the `meta-v2` suite and the `migrate` suite;
  - `modules/runtime/01-11`;
  - the `CLS-01`/`CLS-02`/`CLS-05` cases;
  - the `HDG-04`, `HDG-05`, `ESC-03`, `CAPX-05`, `REC-10` and `TAX-04` agreement
    cases;
  - `builtin-classes/04`;
  - the deprecated-tier runner cases.
- **New.**
  - `UNSUPPORTED_FORMAT_VERSION` for `uw_version` 1.1, 2.0, 2.1, 4.0 and
    absent;
  - `META-01` for a flat `_meta` and for a `section_id` wrapper member;
  - a bare payload with a field named `content`, read as payload;
  - the §3 digest: a `_meta`-only edit keeps `content_hash`, and a payload
    edit changes it;
  - the generalized `SRC-03`;
  - `org.uwmd.data_center` refused by `INVALID-ASSET-CLASS-002`;
  - a structured `.uw.md` refused by `SOURCE_CONTENT_MISMATCH`;
  - a hospitality `rent_roll` without `available_room_nights` refused by
    `CLS-04`;
  - `CC-HOSP-02` read from `rent_roll`;
  - the lone-fact acceptances and all-or-none refusals of §7;
  - accept and refuse cases for `requires_conformance`/`requires_profiles`;
  - `receipt_version` 1.0 refused.
- **Invariant (hard acceptance criterion).** These are unchanged:
  - every calc baseline value;
  - the lender fixture (187 / 0 / 0, with identical per-statement evidence);
  - every receipt's result values;
  - every derived uses total except the two §7 documents.

  The newly computable hotel calculations and per-key intensives are listed
  as additions.
- **Tiers and profiles.** This changes the Reader corpus (version and shape
  refusals), the Verifier corpus (codes and the hospitality paths) and the
  Module profile (manifest vocabulary).

## Reference implementation

Each phase is its own PR, in order. `[Unreleased]` carries the CHANGELOG
entries, and nothing ships until Phase 6.

1. **RFC acceptance** (this PR, #307). Record the owner's decisions and add the
   status-line notes listed under [Superseded clauses](#superseded-clauses).
2. **Spec, schemas and `protocol.ts`.**
   - Write `UW_FORMAT_SPEC.md`.
   - Rename every `_v1` spec file (§2) and delete the protocol stubs.
   - Rewrite `UW_RECEIPT.md` for 1.1, the Lite spec §6 for 3.0 and Protocol
     §V.9/§V.10 for the §3 digest.
   - Merge the block schemas and fix the mojibake. Update the module-manifest,
     implementation-manifest, corpus-index, hedge, renovation,
     recovery-terms, tax-reassessment and hotel-section schemas, and the
     hospitality dictionary paths.
   - In `protocol.ts`, set the new code registry and the
     `requires_conformance` types, and add `'3.0'`/`'4.0.0'` to the supported
     sets so `main` stays green.
   - Update AGENTS.md, the wiki, and the docs-site copy list and link map.
3. **Corpus re-authoring.**
   - A one-off script:
     - runs `migrate --source-tags`, then `migrate --to-v2 --resign` with the
       conformance test key;
     - stamps `uw_version: "3.0"` and unwraps every wrapped block into the
       bare shape;
     - moves the §7 scalars and the §5 hotel facts;
     - replaces alias and module ids, and rewrites module manifests (§6) and
       pack ranges;
     - re-stamps hashes under the §3 rule and re-signs. Receipts are
       re-issued.
   - The PR carries a **before/after value diff** over every calc baseline,
     the lender fixture, every receipt result and every derived uses total.
     The diff must be empty except for the listed additions and the two §7
     documents.
4. **Code deletion.**
   - Narrow the supported sets to `['3.0']`/`['4.0.0']`.
   - Delete the reshape layer and the wrapper handling, make `UWMeta` nested,
     and implement the §3 digest.
   - Delete both migrators, the CLI `migrate` commands and `init --format`.
   - Delete the alias, the transition rules, the module packages and their
     tooling references.
   - Delete the legacy scalars and the remaining items in §7; implement the
     lone-fact groups and the footing rule; move the hospitality fields.
   - Make Lite emit bare 3.0 and fix the web viewer.
5. **Conformance renames** (§8), the runner and generator, and the docs-site
   pages.
6. **Release 4.0.0** by the wiki 11 procedure: Format 3.0, Protocol 4.0.0,
   seven packages.

**Combining.** Phase 2 and the set-narrowing half of Phase 4 could share a PR
only if Phase 3 landed inside it, which would make one unreviewable diff of
roughly 800 files. Keep 2 → 3 → 4 separate. Phase 5 is mechanical and could
fold into Phase 4. Keeping it separate is recommended, because renames
dominate any diff they share.

## RFC 0081 Phase 2 implementation decisions

| Question | Phase 2 decision | Precedent / boundary |
|---|---|---|
| Final spec labels versus released implementation labels | Specs describe Format 3.0 / Protocol 4.0.0. Export SPEC_FORMAT_VERSION / SPEC_PROTOCOL_VERSION, and add them to supported sets; keep FORMAT_VERSION, PROTOCOL_VERSION and package versions unchanged. Version guards compare the spec banner to its accepted constant and retain the release matrix checks. | RFC 0081 Reference implementation phases 2, 4 and 6; invariant 6. |
| Schema/type lockstep while the old loader remains | Export ProtocolModuleManifest with required requires_conformance and optional requires_profiles, plus ProtocolImplementationManifest with only reader/verifier. The final schemas admit no retired vocabulary. Keep runtime ModuleManifest and alias readers until Phase 4. | RFC §6 and Phase 2 requires_conformance types; Phase 4 code deletion; invariant 7. |
| Schema checks on fixtures before Phase 3 | Test-only projections change only the named module tier and case/index bookkeeping; invalid and unknown values stay invalid. Bare-block schema checks project the existing wrapper without changing its model round-trip checks. Original corpus inputs and all existing assertions remain. Remove projections in later phases. | RFC phased ordering; no runtime compatibility, corpus re-authoring deferred to Phase 3. |
| Hospitality dictionary/pack parity across phases | Re-path only total_room_revenue and room_revenue_per_key to rent_roll ADR/occupancy/available nights and property.keys. Parity projects only these four addresses; arithmetic, null guards, units, precision and all other definitions compare exactly. Packs and financial baselines remain unchanged in Phase 2. | Owner G3 and RFC §5 explicitly re-path dictionary in Phase 2; runtime move in Phase 4. |
| Lone-fact group schema representation | Use dependentRequired for all-or-none terms/draw/assessment groups, and method-dependent recovery members; require at least budget or contingency. Replacement funding requires the terms group. Preserve existing field ranges and closed unions. | Owner G1; RFC §7; existing JSON Schema 2020-12 and HDG/CAPX/REC/TAX shape conventions. |
| Historical spec links and documentation | Current links use versionless filenames; historical RFC/release sources remain byte-identical. The docs-site build rewrites old spec filenames to the new pages. One format page replaces the delta page; no retained spec files, routes or redirects. | RFC §2 / owner Q1; RFC 0025 dead-link precedent. |
| Refusal registry staging | Register UNSUPPORTED_FORMAT_VERSION and META-01, and expose the final closed resolution vocabulary with generalized SRC-03 copy. Existing runtime emissions and their retirement remain Phase 4. | RFC Decisions and D3/D10/D11; Phase 2 new code registry, Phase 4 execution changes. |
| Block digest wording (review B1) | §3 governs every spec: `content_hash` is JCS of the block minus `_meta`; a `_meta`-only change keeps the hash and the signature; a signature does not bind `parent_hash` transitively. Protocol §V.11.2 drops the "covered like any other `_meta` field" text, the re-signing paragraph and the erratum link. | Owner (review of PR #308); §3 above; RFC 0010 §4 intent. |
| `null` in a G1 group (review S6) | A member stated as `null` is not stated in every G1 group: it neither triggers nor satisfies a group requirement, so `replacement_funding: null`, `contingency_remaining: null` and `jurisdiction: null` need no group. The schemas use null-exempt `dependentSchemas` for nullable members; a non-nullable member stated as `null` stays a type error. | Owner; `ESC-04` absent/null equivalence. |
| Lone recovery cap and REC-02 (review S6) | A lone `cap` is valid without `method`, `over` or `accumulation`. Once `method` is stated, a stated `cap.pct` requires `cap.accumulation` (REC-02, also in the schema). | Owner; G1 lone-fact intent; RFC 0058's no-default rule. |
| Dropped normative text (review B3) | Restore every MUST/SHOULD/table the merge dropped that this RFC does not remove: `partial`/`provisional` and the provisional-label SHOULD, the closed `_overrides[].reason` vocabulary, the cascade-tag MUST, §V.9's non-finite and `undefined` rules, the `META_FIELD_MISSING_<FIELD>` list (code names unchanged, so `VERSION` names `lifecycle.revision`), the `DQ-07` preserve MUST, and the RFC 0071/0074 module floors restated as `>=4.0.0`. | Owner; §2 disposition ("Kept"); §3 keeps the provenance-completeness family unchanged. |
| Hospitality `rent_roll` schema (review S7) | No `rent_roll` schema exists for any class, so add only the open class-contract fragment `rent-roll-hospitality.schema.json`: `available_room_nights` required, `occupied_room_nights`/`adr`/`occupancy` optional and non-nullable as §5 types them, `keys` refused, other members unconstrained. | §5 G3 table; the field-fragment pattern of `lease-recovery-terms` and `renovation-draw`. |
| Envelope frontmatter version (review B2) | The envelope schema drops the retired `CLS-05` "Format 2.1" conditionals and pins `frontmatter.uw_version` to `"3.0"`, agreeing with `format_version`. | D1; §5 retires `CLS-05`. |
| Dangling references (review S3) | Re-point every reference to a removed section (starter stubs, format v2 sections) to its current home, and add `scripts/spec-refs.mjs` to `verify-indexes` so a spec `§` target, `spec_ref` or spec link that resolves to nothing fails CI. | RFC 0025 / PR #57 dead-link precedent. |
| Docs-site version labels | Spec links and the home version card show `SPEC_FORMAT_VERSION`/`SPEC_PROTOCOL_VERSION`; the card notes the implementation's versions while they differ. | §2 one spec per page; Phase 6 aligns the release labels. |
| Web editor reads class contracts | `@uwmd/core` and `@uwmd/core/browser` export the pure-data `BUILTIN_CLASS_CONTENT`, replacing the editor test's deep import of core's `dist/`. | Invariant 2 (tools consume core's public entry); AGENTS export rule. |

## RFC 0081 Phase 3 implementation decisions

| Question | Phase 3 decision | Precedent / cause |
|---|---|---|
| Corpus versus released versions | Re-author stated document versions and module/pack ranges now; keep package/release labels and all old runtime paths until Phases 4 and 6. Mark interim old paths for deletion. | Reference implementation Phase 3; owner task boundary. |
| Saguaro planned additions | total_room_revenue: null → $6,080,000; room_revenue_per_key: null → $42,816.90. All stated figures and lender evidence remain identical. Jared confirmed on 2026-10-11 that these are the planned additions, and authorized continuing. | RFC §5; owner follow-up. |
| Financial comparison | Snapshot the built Phase 2 base before editing; compare all calc baselines, lender evidence, receipt verdicts, validation codes, conformance outcomes and derived uses. No example or lender value change is authorized. | D5; owner Phase 3 acceptance criterion and follow-up. |
| Additional fixture exceptions | Jared approved all five below on 2026-10-11: they follow mechanically from §7. Retire a fixture whose only assertion is a retired conflict code; preserve any live refusal. Report every further fixture-only value change with its cause; stop for any example/lender value change. | Owner follow-up to the measured corpus inventory. |
| capex/reject-legacy-budget-disagrees | $9,470,000 → $6,470,000 before retirement: removing the disagreeing $3,000,000 legacy budget leaves the typed budget. | Retired CAPX-05-only conflict control; owner approved exception. |
| hedge/reject-legacy-reserve-disagrees | $750,000 → $500,000 before retirement: removing the legacy reserve leaves the stated escrow upfront. | Retired ESC-03-only conflict control; owner approved exception. |
| hedge/reject-premium-disagrees-with-use | $500,000 → $410,000 before retirement: the typed premium is the single cost home. | Retired HDG-05-only conflict control; owner approved exception. |
| hedge/0070-ambiguous-debt | $1,150,000 → $1,550,000: each of two stated $400,000 premiums counts once, alongside the $750,000 interest escrow. Keep its live refusal. | §7 footing; owner approved exception. |
| hedge/0076-sources-refused-malformed-hedge | Each sources variant: $1,150,000 → $750,000. Drop the $400,000 cost because the malformed hedge supplies no usable attributable home; keep its live refusal. | No invented attribution; owner approved exception. |

| Deferred product writers and retiring tests | Lite/init emission remains unchanged until Phase 4; test-only projections synthesize old migration/reader inputs from the authored 3.0 corpus. No product compatibility shim is added. | Phase 3 boundary explicitly retains the old readers and migrators. |
| Retired conflict controls | Delete the six conflict-only conformance cases for CAPX-05, ESC-03, HDG-04/05, REC-10 and TAX-04, plus their conflict-only unit test groups. Keep every live refusal assertion. | Owner follow-up; a removed spelling has no meaningful conflict assertion. |
| Negative artifact controls | Re-stamp valid hashes/signatures/receipts, then preserve intentional tampering, invalid source vocabulary, malformed parent links and stale digests. | Existing conformance refusals must remain evidence, not become passing documents. |
| Historical forensic record | Preserve docs/reviews/2026-10-02-outright-cap-replacement.evidence.json's captured attempted document verbatim; it is immutable evidence cited by an RFC, not an authored fixture. Release history and staged version labels also remain. | PROCESS historical design reviews; D13 and Phase 6 boundary. |
| Null group members | Treat null as unstated when deciding whether G1's full terms/draw/assessment group is present. | Phase 2 review clarification; no invented facts. |

| Canonical parse projection | Apply the same block projection to extension blocks as standard sections; portable parse evidence stays a declaration of content, not private reader objects. | Protocol §II.6a.6 and the existing reference-runner projection. |
| G3 validation deltas | Moving existing keys to property.keys removes nine CC-13 warnings; 3.0 applies the class-contract severity consistently. Re-author the missing-hotel-input control to a rent_roll missing available_room_nights, preserving its required-field refusal as CLS-04. | G3, D6 and the Phase 2 hospitality schema; no stated financial value changes. |
| Package guard metadata | Check source manifests' requires_conformance instead of requires_tier, and update VERSIONS.md's compatibility columns without changing package versions or pins. | D9, existing source/build/JSON parity guards; release remains Phase 6. |

## Alternatives considered

1. **Keep the read path and drop only the write path** (readers accept
   1.x/2.x, writers emit 3.0). Rejected: the read path is the expensive half,
   and P5 rules it out.
2. **Format 2.2 instead of 3.0.** Rejected: refusing every earlier version and
   removing fields is a breaking change, and semver-per-surface (invariant 6)
   requires a major.
3. **Keep the migrators as an unsupported script.** Rejected (D4): a tool
   nobody tests rots, and git history keeps the one use.
4. **Deprecate first and remove in 5.0.** Rejected (P5).
5. **The wrapped block shape (G2).** Rejected by the owner. It contradicts the
   spec text, adds a third copy of the section id, and 635 of 759 corpus files
   are already bare.
6. **Keep hotel facts in `hotel_metrics` and make it required (G3 draft
   default).** Rejected by the owner: it states the same facts twice.

## Unresolved questions

None for this RFC. The owner placed these outside it:

- the `deriveSourcesUses` double count of the typed `renovation` draw fields
  (owner Q3, handled separately);
- `MOD-CALC-ERROR`/`MOD-RULE-ERROR` naming for builtin class failures.

## What remains after this RFC

The reference implementation supports **exactly one format version (3.0) and
one protocol version (4.0.0)**:

- one block body shape, one `_meta` shape and one block digest rule;
- one receipt version;
- one spelling for each class id and one home for each fact;
- two conformance tiers with six profiles and no aliases;
- one spec file per spec, with no version in any file name.

Every later breaking change follows P5: an RFC and a version bump but no
transition plan, until the owner declares the standard released.

## Prior art

- **RFC 0009's own timeline** planned the shim's removal at the next major;
  this RFC carries it out.
- **RFC 0010's signing design** intended a content hash that does not bind
  `parent_hash`; §3 delivers it.
- **Pre-1.0 semver practice** (the spirit of semver §4): before a public
  release, anything may change and no compatibility is owed.
