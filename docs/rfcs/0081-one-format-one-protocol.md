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
   seven packages. Release preparation pairs core/CLI 4.0.0 with Protocol
   4.0.0 and Format 3.0; signing moves to 0.3.0 and batch, Excel, report and
   lake take patch steps (CHANGELOG 4.0.0 records why). The RFC stays
   `accepted` until a release ships it and publication is verified.

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
| Financial comparison | Snapshot the built Phase 2 base before editing; compare all calc baselines, lender evidence, receipt verdicts, validation codes, conformance outcomes and derived uses. No other example or lender value change is authorized. | D5; owner Phase 3 acceptance criterion and follow-up. |
| capex/accept-draw-with-verified-remaining | $11,350,000 → $6,850,000: drop the duplicate legacy budget and contingency, retaining the typed group. | Original §7 exception; renovation draw accounting itself is unchanged (Q3 remains out of scope). |
| hedge/0076-two-seniors-no-hedge-escrow | $1,150,000 → $750,000: drop the $400,000 cost with no attributable stated hedge home. | Original §7 exception; no invented allocation across loans. |
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
| Single-block signing API (review S1) | `verifyBlockSignature(block, store, { uwVersion })` and `signBlock(block, key, { uwVersion, stampContentHash })` select the digest rule from the document's `uw_version` exactly as `verifyChain` does. Without it the retired 1.x rule applied, so a valid 3.0 signature reported `content_hash_mismatch`. The old selection is marked for Phase 4. | §3; `verifyChain`'s per-document selection (RFC 0009 versioned canonicalization). |
| Rendered goldens that now show stated values (review S2) | `tier-1-reader/expected/01-minimal-screening` and `16-frontmatter-yaml-scalars` (`.rendered-chat`, `.rendered-summary`) now print property facts the 1.1 wrapped block stated but the renderer could not read: Units 50, Built 1995, NRA 45,000, Land 2.1 acres, Zoning R-3, Loan/Unit $150,000, Price/Unit $200,000. The retired missing-section warning goes. These are stated values now rendered, not changed values. No other rendered golden changes beyond its version label. | §3 unwrap; D5 (no stated value changes). |
| Receipt validation summary | `receipts/issue/01-uwx-multifamily/expected-receipt.json`: validation warnings 5 → 0 (metadata-shape warnings the migration removes). Result values and verdict are unchanged. | §3; D5. |
| Preserved invalid-source control | `source/04-colon-form-rejected/expected-validation.json` reports its finding as an error (overall `errors`), because `SRC-01`/`SRC-02` are always errors in 3.0. This is the fifth changed expected-code file (a severity, not a code, so the value-diff harness counts four). | §3 ("`SRC-01` and `SRC-02` are always errors"). |
| meta-v2/06-digest-shape-insensitive (review S3) | Retired. After re-authoring its flat and nested files were byte-identical, and its subject (v1/v2 digest shape-insensitivity) is retired with the suite. The corpus is 1,054 checks (1,046 default + 3 opt-in + 5 added). | §8 (the `meta-v2` row); the rule applied to the six conflict-only controls. |
| `reserve-*/legacy-v1` | Kept, with `_meta.section` stated on all four blocks. Their distinguishing subject (both format generations admit the section, RFC 0064) is retired. They are portable cases whose ids Phase 5 rewrites, so Phase 5 removes or renames them with the other renames rather than shrinking the portable projection here. | §8 and Phase 5; keep the 332 portable projections stable in Phase 3. |
| Reserve fixtures' `{_meta, content}` bodies | 71 `reserve-accounts`/`reserve-draw-bindings` documents (162 blocks) were 2.0-era bodies without `section_id`. The re-author left them wrapped and dropped their non-canonical `provenance`/`status`/`lineage` metadata. They are now bare, and the stated source, timestamp, confidence and revision sit in their nested homes (the mapping the migrator gave the identical 1.1 legacy-v1 fixtures; the non-schema `author` is dropped there too). Plan source digests are re-stamped and `stale-digest` stays stale. Reserve verifier outcomes are unchanged. Validation: the metadata-missing warnings go, 45 documents lose `CF-02`/`LU-01`/`LU-03` errors that only the wrapper caused, and `invalid-source-date` gains `CF-01` for its stated 2026-02-30 row. | §3: a member named `content` is payload, and Phase 3 unwraps every wrapped block. |
| Migrate suite expectations (review S3) | `migrate/02` and `03` `expected.json` record the migrator's output version, `"2.0"`, and the runner compares against it. Both legacy suites are marked for Phase 4 deletion. | §4; the suite tests the migrator's output, not the corpus version. |
| Migrate fixture signatures | The re-signed `migrate/01` and `02` blocks keep `kid` `sponsor-key-1`, which the conformance keystore does not hold, so `verifyChain` reports `INT-06` where the base reported `INT-04`/`INT-07` (a stale 1.x signature). Both cases assert migration behavior, not chain verification, and pass. | Negative-control rule; the suite is deleted in Phase 4. |
| hedge/0075-malformed-hedge-beside-junior premium | The $400,000 `rate_cap_cost` becomes `premium` on the junior's hedge, which is synthesized from its own `rate_cap_pct`. That is the only well-formed hedge: the senior's `rate_hedge` is the malformed string `"rate_cap"`, kept for its `HDG-01` refusal, and the senior's `rate_cap_pct` has no typed home. The uses total is unchanged. `0076-two-seniors-no-hedge-escrow` (two synthesized hedges) and `0076-sources-refused-malformed-hedge` (only a malformed hedge) have no unique attributable home, so their cost is dropped instead. | §7 home of the rate cap's cost; no invented allocation across loans. |
| Live references to removed scalars (review S4) | The all-in yield's reserves input in Parkview, parkview-after-L6 and tier-1 `02-full-multifamily` reads `sources_uses.uses.escrows[0].upfront`, in the format spec's bracketed-index notation. No hash, signature or receipt covers it, and the lender check stays 187/0/0. | §7; format spec path notation (`units[7].current_rent`). |
| L6 post-run shape (review S5) | The JSON Schema requires the bare 3.0 block (nested `_meta`, payload beside it, no `section_id`). The runner compiles a JSON Schema shape strictly, checks the before file's frontmatter against it, and checks that it refuses the wrapper. The declarative l0a contract stays lint-only. | §3; a fixture that CI only parses proves nothing. |
| `deriveSourcesUses` document (review S6) | `parsed` is required. Without it every stated `rate_hedge.premium` was silently left out of the uses total. | §7 footing. |
| Interim old literals (review S7) | Plain strings with the Phase 4 marker on the same line, with no array-join spellings. | Reviewability: grep finds every interim literal. |
| Re-author script re-runs | Idempotent: final 3.0 documents, migrator expectations, JSON Schema files and marked literals are skipped, so a re-run cannot repair a negative control or replace the editor golden's `<volatile>` hashes. A dry run and a full `--write` re-run change nothing. Both one-off scripts carry Phase 4 deletion markers. | Negative artifact controls (above). |

### Phase 4 carry-overs recorded in Phase 3

- **Part files.** The 28 tracked `.uwpart.md` files declare no `uw_version` (the migrator refuses them for having no version line); their blocks are already bare 3.0. Before `UNSUPPORTED_FORMAT_VERSION` applies to an absent version, Phase 4 decides whether a part states `uw_version: "3.0"` or inherits its record's version.
- **Editor goldens.** Four `tier-2-editor` after-documents carry `_meta` as a block's last member, because the interim editor writes it there; §3 requires it first. Regenerate them when Phase 4 makes the editor write 3.0.
- **`reserve-*/legacy-v1`.** Removed or renamed in Phase 5 (above).

## RFC 0081 Phase 4 implementation decisions

Phase 4 started from Codex's checkpoint `841870c` (work in progress on
`codex/rfc-0081-phase4-delete`): the `metadata.ts` stamping helpers, the
builtin-class validation clean-up and most of the test conversions are its
work. The rows below record each open call, the decision and its precedent.

| Question | Phase 4 decision | Precedent / cause |
|---|---|---|
| The `UWMeta` type | One nested type whose required and optional members are exactly `uwmd-block.schema.json`'s (`UWProvenance`, `UWQuality`, `UWLifecycle`, `UWIntegrity`). `block.meta` is the parsed `_meta` object; the type was fixed, not the call sites. `UWBlock.meta_shape` is gone. | §3; owner task ("match the schema, fix the type"). |
| What an edit may say about `_meta` | An `EditOperation`'s `meta` is a `UWMetaPatch`: optional `provenance` and `quality` objects merged over the host-built `_meta`. The host owns `section`, `lifecycle` and `integrity`. Any other member, including a flat `source` or `confidence`, is refused as `PROTO-EDIT-002` rather than silently dropped; `edit-operation.schema.json` gains a closed `MetaPatch` and Protocol §V states the rule. | Invariant 5 (the host owns `_meta`); invariant 7 (schema, spec and `protocol.ts` together); closed vocabularies refuse unknown values. |
| Field overrides | Read from the block's reserved `_overrides` member (`blockOverrides`), never from `_meta`. The web editor reads and writes the same member; an empty list clears it rather than writing `[]`. | §3 reserved members. |
| `blockPayload` | Returns a copy of the block minus the reserved members `_meta`, `_role`, `_overrides` and `_notes`. Callers that mutate a payload mutate `block.content`. | §3 ("every other member is payload"). |
| `SPEC_FORMAT_VERSION` / `SPEC_PROTOCOL_VERSION` (supersedes the Phase 2 row "Final spec labels versus released implementation labels") | Deleted. With single-valued supported sets, `SUPPORTED_FORMAT_VERSIONS[0]` and `SUPPORTED_PROTOCOL_VERSIONS[0]` are the spec labels; both are now exported, and the docs site, `verify-versions` and `verify-release` read them. `SUPPORTED_FORMAT_VERSIONS` lives in `types.ts` so the parser need not import `protocol.ts` (no cycle); `protocol.ts` re-exports it. `FORMAT_VERSION`/`PROTOCOL_VERSION` stay for Phase 6. | D1; one source of truth per value. |
| Envelope and Lite inputs | `assertUWEnvelope` and the Lite bridge refuse any `uw_version` but 3.0 with `UNSUPPORTED_FORMAT_VERSION`, like the parser. | D1 ("readers refuse every other `uw_version`"). |
| Structured content under `.uw.md` with an explicit UWX representation | Still `SOURCE_CONTENT_MISMATCH`; naming the representation does not license the Lite file name. | §4; Lite spec §6. |
| Part files (Phase 3 carry-over) | A `.uwpart.md` states `uw_version: "3.0"`; a missing version is `UNSUPPORTED_FORMAT_VERSION` like any other document. Composition §2.1 and `uwpart.schema.json` require it, `stringifyUWPart` writes it, and all 28 tracked parts carry it (their bare blocks were already 3.0). | D1 applies to every parsed document; no inheritance rule exists to cite. |
| Editor goldens (Phase 3 carry-over) | The four `tier-2-editor` after-documents are regenerated with `_meta` first; the editor writes 3.0. | §3. |
| Canonicalization | `canonicalize` and `canonicalizeExact` collapse into one `canonicalize`, and Protocol §V.9 names one function. | §3 (one digest). |
| Receipts | `SUPPORTED_RECEIPT_VERSIONS` is `['1.1']`; a 1.0 receipt is refused at read (`RCP_MALFORMED`), and `RECEIPT_RESULT_TOLERANCE` is deleted. | §7. |
| The effective cascade tag | `_overrides[].resolution`, then `provenance.resolution`, then `manual` when the actor is `manual`. No tag is ever read out of `provenance.source`. | RFC 0031 (actor-only `source`); starter guide §V.7. |
| Corpus resolution values outside the closed vocabulary | `SRC-03` now always applies, which exposed 176 `resolution: manual_override` values (rewritten to `user_override`) and 21 `resolution: source_document` values (removed: a source document is an actor, not a cascade step). `_meta` is outside the digest, so no hash, signature or receipt changes. | Format §2.6 closed resolution vocabulary. |
| Module dependencies in frontmatter | `declaredModuleDependencies` reads object entries, and the restricted YAML reader's `- id: x` list items, which it returns as the string `"id: x"`. A bare string is not an entry. That reader gap for lists of mappings predates this phase and is left for a separate fix. | §5 (module lists use object entries); Format Appendix D. |
| Class contract severity | With `LEGACY_MODULE`/`PRE_RFC_BUILTIN_CALCS` gone, a class calculation error is an error for every document of the class (for example hospitality with zero available room nights). | D6 ("class rules and calcs behave identically for every document"). |
| Extension block projections | A member named `content` in an extension block is payload, so tier-1 `02-full-multifamily.parsed.json` projects `x_lender_matrix`'s full payload. | §3; Phase 3 "Canonical parse projection". |
| The renderer's pre-§4.5 NOI keys | Deleted. The L6 replay prompt's EGI line now reads `n/a` for the fixture that only stated the old key, so the cassette is re-recorded; `after.uwx.md` is unchanged. | §7; D5 (no stated value changes). |
| Module host claims | `LoadModuleOptions` takes `hostConformance` (default `verifier`) and `hostProfiles` (default every profile); a host below a manifest's requirements is `PROTO-MOD-029`. A conformance reject case states the host in `expected.host`. | §6. |
| Conformance tier vocabulary | `--tier` is `reader` or `verifier` in both drivers; anything else is a usage error. `conformance/runner/vocabulary.json`, generated from `scripts/conformance-targets.mjs`, replaces `tier-readings.json`. The portable report's `tier_reading` becomes `manifest_tier`. | §6; principle 5 (no aliases). |
| Financial-validity codes | Emitted directly by threshold; `ValidationMessage.legacy_code` is gone. | §7. |
| `@uwmd/signing` options | `VerifyBlockSignatureOptions` and `signBlock`'s `uwVersion` (Phase 3 review S1, never released) are deleted: there is one digest rule. | §3. |
| VS Code detection note | The informational code for an extension-inferred representation is `SOURCE_REPRESENTATION_INFERRED` (was `SOURCE_LEGACY_EXTENSION`); a structured `.uw.md` is an error. | §4. |
| Web viewer | Refuses any `uw_version` but 3.0 and reads `_meta.lifecycle.superseded`. | D1; §3. |
| Release scope and the matrix | `release-packages.mjs` keeps the two module package names only so the generations that shipped them keep their recorded scope; from 4.0.0 it selects seven. `VERSIONS.md` keeps the 3.0.0 matrix as the release record that `release-state` checks, adds an unreleased note, and drops the module compatibility table (no sources remain). | D6; wiki 11 (historical scope is immutable); Phase 6 owns version labels. |
| Retired and added checks | 20 checks are retired with their subject (`meta-v2` 6, `migrate` 3, `modules/runtime` 11). 35 are added: 5 `UNSUPPORTED_FORMAT_VERSION` controls, flat `_meta` and wrapper (`META-01`), an out-of-vocabulary resolution (`SRC-03`), the retired alias (`INVALID-ASSET-CLASS-002`), a `content` payload member (4 checks), a structured Lite name, a `_meta`-only edit after signing, receipt 1.0, four module refusals (8 checks with schema parity), nine lone-fact controls and two editor refusals of `meta` members outside the patch (`PROTO-EDIT-002`). The corpus is 1,069 reference checks and 336 portable cases. | Negative-control rule: a deleted path becomes a pinned refusal, never silence. |
| Before/after comparison against `0ff4096` | Identical: every pack calculation over the 737 shared documents, every derived sources/uses total, all 15 receipt verdicts and results, the lender fixture (187/0/0), all 97 calc baselines, all 89 manifest load results and every block digest and signature outcome on them. The only differences are the deleted documents, `META-V2-IN-V1` no longer reported on parts that now state 3.0, reserved members no longer in the payload projection, and four documentation pages that are not UW documents now refused for having no `uw_version`. | D5; Phase 3 comparison method. |
| Implemented RFCs whose code tables list retired codes | RFCs 0053, 0056, 0057 and 0058 keep their historical tables (their status lines already point here). `verify-codes` reads the Protocol's one "Retired agreement/transition codes are not emitted" sentence, exempts those codes from the implemented-RFC check, and fails if core still emits any of them. | Phase 1 superseded-clause notes; a guard checks the deletion rather than excusing it. |
| Naming new hedge cases | `0081-accept-strike-only` and `0081-reject-partial-terms-group` carry the RFC number, so the RFC 0056 byte-retention test still sees exactly its 14 cases. | House pattern: later RFCs' hedge cases carry their number (`0070-`, `0075-`). |
| Agent-authored `_overrides` (review of #310) | Stripped from every agent write: the Bancroft host drops it from model `section_data`, `writeAgentBlock` drops it from any agent block, and `applyEdit` drops it when the writer's source is `agent/*`. No agent-authored gap markers are kept; an agent records gaps in the `gaps` section. Human edits, including the web editor's, still write `_overrides`. The same review closed the neighbouring path: a `meta.provenance.source` other than the writer's own source is refused as `PROTO-EDIT-002`, so an agent cannot restate itself as `manual`. | Invariant 5 (the host owns provenance): an `_overrides` entry is per-field provenance the cascade honors as `user_override`, so a model-written one forges a human override. The prior shape-specific stamping dropped it implicitly. |
| The cascade's effective tag | `_overrides[].resolution`, then `provenance.resolution`, then `manual` for a `manual` actor. An `_overrides` entry that states only an actor `source` no longer shadows the block's resolution, because an actor is not a resolution. | RFC 0031 (actor-only `source`); Format §2.6. |
| The public `canonicalize` | Plain RFC 8785 JCS. It no longer strips `content_hash`/`signature` from `_meta`-shaped objects; the §3 digest excludes the whole `_meta` member. | §3. |
| A `modules` entry that is not an object with an `id` | `MOD-DEPENDENCY-UNDECLARED` (warning) per entry, for every class, instead of silence; Format §2.2a and the code registry say so. The Appendix D `id: <module>` scalar still reads. | Format §2.2a (entries are objects); closed shapes are reported, not dropped. |
| Unquoted `uw_version: 3.0` | Refused, with a message saying to quote it. The format version is the string `"3.0"` (Format §2.1 example; the envelope and part schemas pin `const: "3.0"`), and YAML reads `3.0` as the number 3. | D1; the schemas. |
| CLI refusals and `verifyProvenance` | The CLI prints a typed refusal (any error with a string `code`) as one line without a stack. `verifyProvenance` skips a head with no Format 3.0 provenance rather than throwing; `META-01` reports the shape. | Existing CLI handling of typed errors; one finding per problem. |
| `reserve-*/legacy-v1` | Kept for Phase 5's renames. They are Format 3.0 documents and exercise no v1 path. | Phase 3 row; §8. |
| Out of scope | `deriveSourcesUses`' renovation double count (Q3) and the YAML-subset list-of-mappings gap above. | Owner task boundary. |

## RFC 0081 Phase 5 implementation decisions

| Question | Phase 5 decision | Precedent / boundary |
|---|---|---|
| Corpus storage and suite names | Apply §8: `documents`, `calc`, `starter/editor`, `starter/refinement`, `starter/agent`; suite ids are `documents`, `calc`, `starter-editor`, `starter-refinement`, `starter-agent`, `starter-agent-profile`, `starter-agent-replay`. No old path or id is accepted. | §8; Product principle 5; Phase 5 is a pure rename. |
| Reserve `legacy-v1` cases | Rename both directories and scenario ids to `bare-block`, retaining their exact documents, plans, expectations and assertions. | Phase 4 carry-over; the documents are already 3.0; acceptance retains 1,069 checks and 336 portable cases. |
| Portable identity | Id and filename stem are `<owner>__<suite>__<scenario>__<operation>`. Malformed document scenarios use `malformed-<stem>`; replacement-funding projections use the reference suite `hedge`. Ownership is still the index's `target`. | §8; Protocol §II.6a; no legacy id or private reader object becomes a conformance claim. |
| Family selection and baseline updates | Preserve membership: the `calc` family includes `starter-refinement`, and `starter-agent` includes `starter-agent-profile`; replay remains separately selected. Child-only baseline updates stay refused. | Existing `suiteFamily` behavior; no behavior change in Phase 5. |
| Documentation history | RFCs, release records, prior CHANGELOG sections and immutable review/status history keep their text. The site maps their old links to current sources/pages at build time, without redirects or old pages. Current prose uses content names. | §8; Phase 2 historical spec-link precedent; PROCESS historical evidence. |
| Historical refusal inputs | Keep the former tier spellings in refusal tests and module controls; their surrounding comments/README explicitly explain the history. They are inputs proved refused, never aliases or current corpus labels. | Phase 4 negative controls; acceptance's history exception. |
| Contributor path reference | Update only the stale corpus path in `CONTRIBUTING.md`; its guidance is unchanged. | Owner's explicit instruction to update every path reference; no guidance rewrite. |
| Verification evidence | Compare every mapped reference and portable id, its owner and outcome, plus the portable case definition (paths/ids aside) and the lender's per-statement evidence. Publish the full mapping as historical RFC evidence. | Owner Phase 5 acceptance; Phase 4 comparison precedent. |

### Phase 5 outcome mapping against `2aba0775`

Historical comparison evidence only: these old addresses are not accepted paths,
suite selectors or case ids. Every mapped check keeps its owner and outcome.
The portable definitions compare exactly after the stated path/id rename; their
commands, arguments, capability requirements and expected values are unchanged.
The lender's full per-statement evidence is identical: **187 / 0 / 0**.

<details>
<summary>All 1,069 reference check mappings</summary>

| Old id | New id | Owner | Before | After |
|---|---|---|---|---|
| `1/01-minimal-screening [parse]` | `documents/01-minimal-screening [parse]` | `reader` | pass | pass |
| `1/01-minimal-screening [render-chat]` | `documents/01-minimal-screening [render-chat]` | `starter-products` | pass | pass |
| `1/01-minimal-screening [render-summary]` | `documents/01-minimal-screening [render-summary]` | `starter-products` | pass | pass |
| `1/01-minimal-screening [validate]` | `documents/01-minimal-screening [validate]` | `verifier` | pass | pass |
| `1/02-full-multifamily [parse]` | `documents/02-full-multifamily [parse]` | `reader` | pass | pass |
| `1/02-full-multifamily [render-chat]` | `documents/02-full-multifamily [render-chat]` | `starter-products` | pass | pass |
| `1/02-full-multifamily [render-summary]` | `documents/02-full-multifamily [render-summary]` | `starter-products` | pass | pass |
| `1/02-full-multifamily [validate]` | `documents/02-full-multifamily [validate]` | `verifier` | pass | pass |
| `1/04-scope-only [parse]` | `documents/04-scope-only [parse]` | `reader` | pass | pass |
| `1/04-scope-only [render-chat]` | `documents/04-scope-only [render-chat]` | `starter-products` | pass | pass |
| `1/04-scope-only [render-summary]` | `documents/04-scope-only [render-summary]` | `starter-products` | pass | pass |
| `1/04-scope-only [validate]` | `documents/04-scope-only [validate]` | `verifier` | pass | pass |
| `1/05-land-stage-overlay [parse]` | `documents/05-land-stage-overlay [parse]` | `reader` | pass | pass |
| `1/05-land-stage-overlay [render-chat]` | `documents/05-land-stage-overlay [render-chat]` | `starter-products` | pass | pass |
| `1/05-land-stage-overlay [render-summary]` | `documents/05-land-stage-overlay [render-summary]` | `starter-products` | pass | pass |
| `1/05-land-stage-overlay [validate]` | `documents/05-land-stage-overlay [validate]` | `verifier` | pass | pass |
| `1/06-mixed-use-stage-overlay [parse]` | `documents/06-mixed-use-stage-overlay [parse]` | `reader` | pass | pass |
| `1/06-mixed-use-stage-overlay [render-chat]` | `documents/06-mixed-use-stage-overlay [render-chat]` | `starter-products` | pass | pass |
| `1/06-mixed-use-stage-overlay [render-summary]` | `documents/06-mixed-use-stage-overlay [render-summary]` | `starter-products` | pass | pass |
| `1/06-mixed-use-stage-overlay [validate]` | `documents/06-mixed-use-stage-overlay [validate]` | `verifier` | pass | pass |
| `1/07-stage-overlay-control [parse]` | `documents/07-stage-overlay-control [parse]` | `reader` | pass | pass |
| `1/07-stage-overlay-control [render-chat]` | `documents/07-stage-overlay-control [render-chat]` | `starter-products` | pass | pass |
| `1/07-stage-overlay-control [render-summary]` | `documents/07-stage-overlay-control [render-summary]` | `starter-products` | pass | pass |
| `1/07-stage-overlay-control [validate]` | `documents/07-stage-overlay-control [validate]` | `verifier` | pass | pass |
| `1/08-variant-cross-checks [parse]` | `documents/08-variant-cross-checks [parse]` | `reader` | pass | pass |
| `1/08-variant-cross-checks [render-chat]` | `documents/08-variant-cross-checks [render-chat]` | `starter-products` | pass | pass |
| `1/08-variant-cross-checks [render-summary]` | `documents/08-variant-cross-checks [render-summary]` | `starter-products` | pass | pass |
| `1/08-variant-cross-checks [validate]` | `documents/08-variant-cross-checks [validate]` | `verifier` | pass | pass |
| `1/09-returns-tax-basis [parse]` | `documents/09-returns-tax-basis [parse]` | `reader` | pass | pass |
| `1/09-returns-tax-basis [render-chat]` | `documents/09-returns-tax-basis [render-chat]` | `starter-products` | pass | pass |
| `1/09-returns-tax-basis [render-summary]` | `documents/09-returns-tax-basis [render-summary]` | `starter-products` | pass | pass |
| `1/09-returns-tax-basis [validate]` | `documents/09-returns-tax-basis [validate]` | `verifier` | pass | pass |
| `1/10-declared-roles [parse]` | `documents/10-declared-roles [parse]` | `reader` | pass | pass |
| `1/10-declared-roles [render-chat]` | `documents/10-declared-roles [render-chat]` | `starter-products` | pass | pass |
| `1/10-declared-roles [render-summary]` | `documents/10-declared-roles [render-summary]` | `starter-products` | pass | pass |
| `1/10-declared-roles [validate]` | `documents/10-declared-roles [validate]` | `verifier` | pass | pass |
| `1/11-role-collision [parse]` | `documents/11-role-collision [parse]` | `reader` | pass | pass |
| `1/11-role-collision [render-chat]` | `documents/11-role-collision [render-chat]` | `starter-products` | pass | pass |
| `1/11-role-collision [render-summary]` | `documents/11-role-collision [render-summary]` | `starter-products` | pass | pass |
| `1/11-role-collision [validate]` | `documents/11-role-collision [validate]` | `verifier` | pass | pass |
| `1/12-role-eligibility [parse]` | `documents/12-role-eligibility [parse]` | `reader` | pass | pass |
| `1/12-role-eligibility [render-chat]` | `documents/12-role-eligibility [render-chat]` | `starter-products` | pass | pass |
| `1/12-role-eligibility [render-summary]` | `documents/12-role-eligibility [render-summary]` | `starter-products` | pass | pass |
| `1/12-role-eligibility [validate]` | `documents/12-role-eligibility [validate]` | `verifier` | pass | pass |
| `1/13-period-identities [parse]` | `documents/13-period-identities [parse]` | `reader` | pass | pass |
| `1/13-period-identities [render-chat]` | `documents/13-period-identities [render-chat]` | `starter-products` | pass | pass |
| `1/13-period-identities [render-summary]` | `documents/13-period-identities [render-summary]` | `starter-products` | pass | pass |
| `1/13-period-identities [validate]` | `documents/13-period-identities [validate]` | `verifier` | pass | pass |
| `1/14-student-bed-counts [parse]` | `documents/14-student-bed-counts [parse]` | `reader` | pass | pass |
| `1/14-student-bed-counts [render-chat]` | `documents/14-student-bed-counts [render-chat]` | `starter-products` | pass | pass |
| `1/14-student-bed-counts [render-summary]` | `documents/14-student-bed-counts [render-summary]` | `starter-products` | pass | pass |
| `1/14-student-bed-counts [validate]` | `documents/14-student-bed-counts [validate]` | `verifier` | pass | pass |
| `1/15-student-bed-counts-inconsistent [parse]` | `documents/15-student-bed-counts-inconsistent [parse]` | `reader` | pass | pass |
| `1/15-student-bed-counts-inconsistent [render-chat]` | `documents/15-student-bed-counts-inconsistent [render-chat]` | `starter-products` | pass | pass |
| `1/15-student-bed-counts-inconsistent [render-summary]` | `documents/15-student-bed-counts-inconsistent [render-summary]` | `starter-products` | pass | pass |
| `1/15-student-bed-counts-inconsistent [validate]` | `documents/15-student-bed-counts-inconsistent [validate]` | `verifier` | pass | pass |
| `1/16-frontmatter-yaml-scalars [parse]` | `documents/16-frontmatter-yaml-scalars [parse]` | `reader` | pass | pass |
| `1/16-frontmatter-yaml-scalars [render-chat]` | `documents/16-frontmatter-yaml-scalars [render-chat]` | `starter-products` | pass | pass |
| `1/16-frontmatter-yaml-scalars [render-summary]` | `documents/16-frontmatter-yaml-scalars [render-summary]` | `starter-products` | pass | pass |
| `1/16-frontmatter-yaml-scalars [validate]` | `documents/16-frontmatter-yaml-scalars [validate]` | `verifier` | pass | pass |
| `1/17-exit-proceeds-junior-capital [parse]` | `documents/17-exit-proceeds-junior-capital [parse]` | `reader` | pass | pass |
| `1/17-exit-proceeds-junior-capital [render-chat]` | `documents/17-exit-proceeds-junior-capital [render-chat]` | `starter-products` | pass | pass |
| `1/17-exit-proceeds-junior-capital [render-summary]` | `documents/17-exit-proceeds-junior-capital [render-summary]` | `starter-products` | pass | pass |
| `1/17-exit-proceeds-junior-capital [validate]` | `documents/17-exit-proceeds-junior-capital [validate]` | `verifier` | pass | pass |
| `1/18-content-member-is-payload [parse]` | `documents/18-content-member-is-payload [parse]` | `reader` | pass | pass |
| `1/18-content-member-is-payload [render-chat]` | `documents/18-content-member-is-payload [render-chat]` | `starter-products` | pass | pass |
| `1/18-content-member-is-payload [render-summary]` | `documents/18-content-member-is-payload [render-summary]` | `starter-products` | pass | pass |
| `1/18-content-member-is-payload [validate]` | `documents/18-content-member-is-payload [validate]` | `verifier` | pass | pass |
| `1/malformed/01-missing-section-meta` | `documents/malformed/01-missing-section-meta` | `verifier` | pass | pass |
| `1/malformed/02-low-confidence-no-review` | `documents/malformed/02-low-confidence-no-review` | `verifier` | pass | pass |
| `1/malformed/03-sources-uses-mismatch` | `documents/malformed/03-sources-uses-mismatch` | `verifier` | pass | pass |
| `1/malformed/04-broken-chain` | `documents/malformed/04-broken-chain` | `integrity` | pass | pass |
| `1/malformed/06-wrong-actor` | `documents/malformed/06-wrong-actor` | `starter-products` | pass | pass |
| `1/malformed/06-wrong-actor [validate]` | `documents/malformed/06-wrong-actor [validate]` | `verifier` | pass | pass |
| `1/malformed/07-replace-where-supersede-required` | `documents/malformed/07-replace-where-supersede-required` | `starter-products` | pass | pass |
| `1/malformed/07-replace-where-supersede-required [validate]` | `documents/malformed/07-replace-where-supersede-required [validate]` | `verifier` | pass | pass |
| `1/malformed/08-provisional-without-gap` | `documents/malformed/08-provisional-without-gap` | `verifier` | pass | pass |
| `1/malformed/09-partial-without-overrides` | `documents/malformed/09-partial-without-overrides` | `verifier` | pass | pass |
| `1/malformed/10-property-section-missing` | `documents/malformed/10-property-section-missing` | `verifier` | pass | pass |
| `1/malformed/11-yaml-flow-mapping` | `documents/malformed/11-yaml-flow-mapping` | `reader` | pass | pass |
| `1/malformed/12-yaml-flow-sequence` | `documents/malformed/12-yaml-flow-sequence` | `reader` | pass | pass |
| `1/malformed/13-yaml-invalid-escape` | `documents/malformed/13-yaml-invalid-escape` | `reader` | pass | pass |
| `1/malformed/14-yaml-unquoted-anchor` | `documents/malformed/14-yaml-unquoted-anchor` | `reader` | pass | pass |
| `1/malformed/15-uw-version-1-1` | `documents/malformed/15-uw-version-1-1` | `reader` | pass | pass |
| `1/malformed/16-uw-version-2-0` | `documents/malformed/16-uw-version-2-0` | `reader` | pass | pass |
| `1/malformed/17-uw-version-2-1` | `documents/malformed/17-uw-version-2-1` | `reader` | pass | pass |
| `1/malformed/18-uw-version-4-0` | `documents/malformed/18-uw-version-4-0` | `reader` | pass | pass |
| `1/malformed/19-uw-version-absent` | `documents/malformed/19-uw-version-absent` | `reader` | pass | pass |
| `1/malformed/20-flat-meta` | `documents/malformed/20-flat-meta` | `verifier` | pass | pass |
| `1/malformed/21-section-id-wrapper` | `documents/malformed/21-section-id-wrapper` | `verifier` | pass | pass |
| `1/malformed/22-resolution-outside-vocabulary` | `documents/malformed/22-resolution-outside-vocabulary` | `verifier` | pass | pass |
| `1/malformed/23-retired-official-alias` | `documents/malformed/23-retired-official-alias` | `verifier` | pass | pass |
| `1/malformed/mixed-use-allocation-not-unity` | `documents/malformed/mixed-use-allocation-not-unity` | `verifier` | pass | pass |
| `1/malformed/mixed-use-component-debt-refused` | `documents/malformed/mixed-use-component-debt-refused` | `verifier` | pass | pass |
| `1/malformed/mixed-use-components-on-other-class` | `documents/malformed/mixed-use-components-on-other-class` | `verifier` | pass | pass |
| `1/malformed/mixed-use-land-component` | `documents/malformed/mixed-use-land-component` | `verifier` | pass | pass |
| `1/malformed/mixed-use-noi-does-not-foot` | `documents/malformed/mixed-use-noi-does-not-foot` | `verifier` | pass | pass |
| `1/malformed/mixed-use-present-but-unmeasured` | `documents/malformed/mixed-use-present-but-unmeasured` | `verifier` | pass | pass |
| `1/malformed/mixed-use-single-component` | `documents/malformed/mixed-use-single-component` | `verifier` | pass | pass |
| `2/frontmatter-set-recommendation` | `starter-editor/frontmatter-set-recommendation` | `starter-products` | pass | pass |
| `2/gaps-section-update` | `starter-editor/gaps-section-update` | `starter-products` | pass | pass |
| `2/meta-patch-flat-key-rejected` | `starter-editor/meta-patch-flat-key-rejected` | `starter-products` | pass | pass |
| `2/meta-patch-lifecycle-rejected` | `starter-editor/meta-patch-lifecycle-rejected` | `starter-products` | pass | pass |
| `2/parent-hash-stamp` | `starter-editor/parent-hash-stamp` | `starter-products` | pass | pass |
| `2/section-replace-property` | `starter-editor/section-replace-property` | `starter-products` | pass | pass |
| `2/section-supersede-risk-rating` | `starter-editor/section-supersede-risk-rating` | `starter-products` | pass | pass |
| `2/stale-parent-rejected` | `starter-editor/stale-parent-rejected` | `starter-products` | pass | pass |
| `3-refinement/dependency-graph-multifamily` | `starter-refinement/dependency-graph-multifamily` | `starter-products` | pass | pass |
| `3/data-center-module-dependency-rounding` | `calc/data-center-module-dependency-rounding` | `verifier` | pass | pass |
| `3/data_center-price_per_kw` | `calc/data_center-price_per_kw` | `verifier` | pass | pass |
| `3/date-01-valid-leap-divisible-by-4` | `calc/date-01-valid-leap-divisible-by-4` | `verifier` | pass | pass |
| `3/date-02-valid-leap-divisible-by-400` | `calc/date-02-valid-leap-divisible-by-400` | `verifier` | pass | pass |
| `3/date-03-valid-ordinary-date` | `calc/date-03-valid-ordinary-date` | `verifier` | pass | pass |
| `3/date-04-valid-year-0000-leap` | `calc/date-04-valid-year-0000-leap` | `verifier` | pass | pass |
| `3/date-05-valid-year-9999-last-day` | `calc/date-05-valid-year-9999-last-day` | `verifier` | pass | pass |
| `3/date-06-valid-first-day-of-year` | `calc/date-06-valid-first-day-of-year` | `verifier` | pass | pass |
| `3/date-07-invalid-not-leap-year` | `calc/date-07-invalid-not-leap-year` | `verifier` | pass | pass |
| `3/date-08-invalid-century-not-leap` | `calc/date-08-invalid-century-not-leap` | `verifier` | pass | pass |
| `3/date-09-invalid-february-30` | `calc/date-09-invalid-february-30` | `verifier` | pass | pass |
| `3/date-10-invalid-april-31` | `calc/date-10-invalid-april-31` | `verifier` | pass | pass |
| `3/date-11-invalid-month-00` | `calc/date-11-invalid-month-00` | `verifier` | pass | pass |
| `3/date-12-invalid-month-13` | `calc/date-12-invalid-month-13` | `verifier` | pass | pass |
| `3/date-13-invalid-day-00` | `calc/date-13-invalid-day-00` | `verifier` | pass | pass |
| `3/date-14-invalid-one-digit-month` | `calc/date-14-invalid-one-digit-month` | `verifier` | pass | pass |
| `3/date-15-invalid-one-digit-day` | `calc/date-15-invalid-one-digit-day` | `verifier` | pass | pass |
| `3/date-16-invalid-two-digit-year` | `calc/date-16-invalid-two-digit-year` | `verifier` | pass | pass |
| `3/date-17-invalid-five-digit-year` | `calc/date-17-invalid-five-digit-year` | `verifier` | pass | pass |
| `3/date-18-invalid-signed-year` | `calc/date-18-invalid-signed-year` | `verifier` | pass | pass |
| `3/date-19-invalid-negative-year` | `calc/date-19-invalid-negative-year` | `verifier` | pass | pass |
| `3/date-20-invalid-expanded-year` | `calc/date-20-invalid-expanded-year` | `verifier` | pass | pass |
| `3/date-21-invalid-leading-space` | `calc/date-21-invalid-leading-space` | `verifier` | pass | pass |
| `3/date-22-invalid-trailing-space` | `calc/date-22-invalid-trailing-space` | `verifier` | pass | pass |
| `3/date-23-invalid-internal-space` | `calc/date-23-invalid-internal-space` | `verifier` | pass | pass |
| `3/date-24-invalid-leading-tab` | `calc/date-24-invalid-leading-tab` | `verifier` | pass | pass |
| `3/date-25-invalid-trailing-newline` | `calc/date-25-invalid-trailing-newline` | `verifier` | pass | pass |
| `3/date-26-invalid-date-time-zulu` | `calc/date-26-invalid-date-time-zulu` | `verifier` | pass | pass |
| `3/date-27-invalid-date-time-local` | `calc/date-27-invalid-date-time-local` | `verifier` | pass | pass |
| `3/date-28-invalid-zone-suffix` | `calc/date-28-invalid-zone-suffix` | `verifier` | pass | pass |
| `3/date-29-invalid-offset-suffix` | `calc/date-29-invalid-offset-suffix` | `verifier` | pass | pass |
| `3/date-30-invalid-slash-form` | `calc/date-30-invalid-slash-form` | `verifier` | pass | pass |
| `3/date-31-invalid-compact-form` | `calc/date-31-invalid-compact-form` | `verifier` | pass | pass |
| `3/date-32-invalid-week-date` | `calc/date-32-invalid-week-date` | `verifier` | pass | pass |
| `3/date-33-invalid-ordinal-date` | `calc/date-33-invalid-ordinal-date` | `verifier` | pass | pass |
| `3/date-34-invalid-full-width-digits` | `calc/date-34-invalid-full-width-digits` | `verifier` | pass | pass |
| `3/date-35-invalid-non-ascii-hyphen` | `calc/date-35-invalid-non-ascii-hyphen` | `verifier` | pass | pass |
| `3/date-36-invalid-empty-string` | `calc/date-36-invalid-empty-string` | `verifier` | pass | pass |
| `3/date-37-document-quoted-string` | `calc/date-37-document-quoted-string` | `verifier` | pass | pass |
| `3/date-38-document-unquoted-yaml-date` | `calc/date-38-document-unquoted-yaml-date` | `verifier` | pass | pass |
| `3/date-39-document-null` | `calc/date-39-document-null` | `verifier` | pass | pass |
| `3/date-40-document-absent-path` | `calc/date-40-document-absent-path` | `verifier` | pass | pass |
| `3/date-41-document-number` | `calc/date-41-document-number` | `verifier` | pass | pass |
| `3/date-42-document-boolean` | `calc/date-42-document-boolean` | `verifier` | pass | pass |
| `3/date-43-document-array` | `calc/date-43-document-array` | `verifier` | pass | pass |
| `3/date-44-document-object` | `calc/date-44-document-object` | `verifier` | pass | pass |
| `3/date-45-document-impossible-date` | `calc/date-45-document-impossible-date` | `verifier` | pass | pass |
| `3/date-46-error-no-arguments` | `calc/date-46-error-no-arguments` | `verifier` | pass | pass |
| `3/date-47-error-two-arguments` | `calc/date-47-error-two-arguments` | `verifier` | pass | pass |
| `3/date-48-error-argument-propagates` | `calc/date-48-error-argument-propagates` | `verifier` | pass | pass |
| `3/dscr-from-section` | `calc/dscr-from-section` | `verifier` | pass | pass |
| `3/hospitality-revpar` | `calc/hospitality-revpar` | `verifier` | pass | pass |
| `3/irr-01-out-of-bracket` | `calc/irr-01-out-of-bracket` | `verifier` | pass | pass |
| `3/irr-02-even-root-count` | `calc/irr-02-even-root-count` | `verifier` | pass | pass |
| `3/irr-03-conventional` | `calc/irr-03-conventional` | `verifier` | pass | pass |
| `3/irr-04-endpoint-root` | `calc/irr-04-endpoint-root` | `verifier` | pass | pass |
| `3/irr-05-degenerate` | `calc/irr-05-degenerate` | `verifier` | pass | pass |
| `3/land-usable-land-ratio` | `calc/land-usable-land-ratio` | `verifier` | pass | pass |
| `3/manufactured_housing-physical_occupancy` | `calc/manufactured_housing-physical_occupancy` | `verifier` | pass | pass |
| `3/mixed-use-absent-component-null` | `calc/mixed-use-absent-component-null` | `verifier` | pass | pass |
| `3/mixed-use-data_center_noi_share` | `calc/mixed-use-data_center_noi_share` | `verifier` | pass | pass |
| `3/mixed-use-data_center_price_per_kw` | `calc/mixed-use-data_center_price_per_kw` | `verifier` | pass | pass |
| `3/mixed-use-manufactured_housing_noi_share` | `calc/mixed-use-manufactured_housing_noi_share` | `verifier` | pass | pass |
| `3/mixed-use-manufactured_housing_price_per_site` | `calc/mixed-use-manufactured_housing_price_per_site` | `verifier` | pass | pass |
| `3/mixed-use-no-allocation-null` | `calc/mixed-use-no-allocation-null` | `verifier` | pass | pass |
| `3/mixed-use-operating-business-gop` | `calc/mixed-use-operating-business-gop` | `verifier` | pass | pass |
| `3/mixed-use-two-component-cap-rate` | `calc/mixed-use-two-component-cap-rate` | `verifier` | pass | pass |
| `3/mixed-use-two-component-noi-share` | `calc/mixed-use-two-component-noi-share` | `verifier` | pass | pass |
| `3/mixed-use-two-component-price-per-unit` | `calc/mixed-use-two-component-price-per-unit` | `verifier` | pass | pass |
| `3/period-01-year-order` | `calc/period-01-year-order` | `verifier` | pass | pass |
| `3/period-02-keyed-year` | `calc/period-02-keyed-year` | `verifier` | pass | pass |
| `3/period-03-calendar-quarter` | `calc/period-03-calendar-quarter` | `verifier` | pass | pass |
| `3/period-04-dated-series` | `calc/period-04-dated-series` | `verifier` | pass | pass |
| `3/period-05-missing` | `calc/period-05-missing` | `verifier` | pass | pass |
| `3/period-06-kind-mismatch` | `calc/period-06-kind-mismatch` | `verifier` | pass | pass |
| `3/period-07-duplicate` | `calc/period-07-duplicate` | `verifier` | pass | pass |
| `3/period-08-unregistered` | `calc/period-08-unregistered` | `verifier` | pass | pass |
| `3/period-09-same-day-unique` | `calc/period-09-same-day-unique` | `verifier` | pass | pass |
| `3/period-10-same-day-repeated` | `calc/period-10-same-day-repeated` | `verifier` | pass | pass |
| `3/period-11-same-day-absent` | `calc/period-11-same-day-absent` | `verifier` | pass | pass |
| `3/period-12-other-series-duplicate` | `calc/period-12-other-series-duplicate` | `verifier` | pass | pass |
| `3/revpar-basic` | `calc/revpar-basic` | `module` | pass | pass |
| `3/self-storage-economic-occupancy` | `calc/self-storage-economic-occupancy` | `verifier` | pass | pass |
| `3/senior-housing-care-revenue-ratio` | `calc/senior-housing-care-revenue-ratio` | `verifier` | pass | pass |
| `3/student-housing-pre-lease-rate` | `calc/student-housing-pre-lease-rate` | `verifier` | pass | pass |
| `3/student-housing-rent-per-bed-monthly` | `calc/student-housing-rent-per-bed-monthly` | `verifier` | pass | pass |
| `3/variant-01-primary-resolves` | `calc/variant-01-primary-resolves` | `verifier` | pass | pass |
| `3/variant-02-default-resolves` | `calc/variant-02-default-resolves` | `verifier` | pass | pass |
| `3/variant-03-unresolvable` | `calc/variant-03-unresolvable` | `verifier` | pass | pass |
| `3/variant-04-role-preference` | `calc/variant-04-role-preference` | `verifier` | pass | pass |
| `3/variant-05-explicit-variant` | `calc/variant-05-explicit-variant` | `verifier` | pass | pass |
| `3/variant-06-missing-section` | `calc/variant-06-missing-section` | `verifier` | pass | pass |
| `3/variant-07-explicit-missing` | `calc/variant-07-explicit-missing` | `verifier` | pass | pass |
| `3/variant-08-primary-collision` | `calc/variant-08-primary-collision` | `verifier` | pass | pass |
| `3/variant-09-role-collision` | `calc/variant-09-role-collision` | `verifier` | pass | pass |
| `3/variant-10-role-unclaimed` | `calc/variant-10-role-unclaimed` | `verifier` | pass | pass |
| `3/variant-11-explicit-beats-role` | `calc/variant-11-explicit-beats-role` | `verifier` | pass | pass |
| `4-profile/consumer-profile-contract` | `starter-agent-profile/consumer-profile-contract` | `starter-products` | pass | pass |
| `4-replay/l6-risk-rating/document` | `starter-agent-replay/l6-risk-rating/document` | `starter-products` | pass | pass |
| `4-replay/l6-risk-rating/sections` | `starter-agent-replay/l6-risk-rating/sections` | `starter-products` | pass | pass |
| `4/l0a-scope-deterministic` | `starter-agent/l0a-scope-deterministic` | `starter-products` | pass | pass |
| `4/l6-risk-rating` | `starter-agent/l6-risk-rating` | `starter-products` | pass | pass |
| `capability/01-valid-token-accepts` | `capability/01-valid-token-accepts` | `starter-products` | pass | pass |
| `capability/02-expired-token-rejects` | `capability/02-expired-token-rejects` | `starter-products` | pass | pass |
| `capability/03-wrong-section` | `capability/03-wrong-section` | `starter-products` | pass | pass |
| `capability/04-wrong-deal` | `capability/04-wrong-deal` | `starter-products` | pass | pass |
| `capability/05-sub-mismatch` | `capability/05-sub-mismatch` | `starter-products` | pass | pass |
| `capability/06-bad-signature` | `capability/06-bad-signature` | `starter-products` | pass | pass |
| `capability/07-no-escalation` | `capability/07-no-escalation` | `starter-products` | pass | pass |
| `capability/08-missing-token` | `capability/08-missing-token` | `starter-products` | pass | pass |
| `capex/accept-budget-only` | `capex/accept-budget-only` | `verifier` | pass | pass |
| `capex/accept-draw-with-verified-remaining` | `capex/accept-draw-with-verified-remaining` | `verifier` | pass | pass |
| `capex/accept-module-expense-key` | `capex/accept-module-expense-key` | `verifier` | pass | pass |
| `capex/accept-no-renovation-stated` | `capex/accept-no-renovation-stated` | `verifier` | pass | pass |
| `capex/reject-contingency-overdrawn` | `capex/reject-contingency-overdrawn` | `verifier` | pass | pass |
| `capex/reject-drawn-above-budget-plus-contingency` | `capex/reject-drawn-above-budget-plus-contingency` | `verifier` | pass | pass |
| `capex/reject-drawn-below-contingency-used` | `capex/reject-drawn-below-contingency-used` | `verifier` | pass | pass |
| `capex/reject-empty-label` | `capex/reject-empty-label` | `verifier` | pass | pass |
| `capex/reject-impossible-as-of-date` | `capex/reject-impossible-as-of-date` | `verifier` | pass | pass |
| `capex/reject-malformed-savings-begin` | `capex/reject-malformed-savings-begin` | `verifier` | pass | pass |
| `capex/reject-missing-in-noi-model` | `capex/reject-missing-in-noi-model` | `verifier` | pass | pass |
| `capex/reject-negative-budget` | `capex/reject-negative-budget` | `verifier` | pass | pass |
| `capex/reject-partial-draw-group` | `capex/reject-partial-draw-group` | `verifier` | pass | pass |
| `capex/reject-payback-against-zero-savings` | `capex/reject-payback-against-zero-savings` | `verifier` | pass | pass |
| `capex/reject-payback-disagrees` | `capex/reject-payback-disagrees` | `verifier` | pass | pass |
| `capex/reject-remaining-does-not-subtract` | `capex/reject-remaining-does-not-subtract` | `verifier` | pass | pass |
| `capex/reject-remaining-without-draw-group` | `capex/reject-remaining-without-draw-group` | `verifier` | pass | pass |
| `capex/reject-target-names-no-expense` | `capex/reject-target-names-no-expense` | `verifier` | pass | pass |
| `capital-stack/ab-mezz-notes` | `capital-stack/ab-mezz-notes` | `verifier` | pass | pass |
| `capital-stack/gd05-total-equity` | `capital-stack/gd05-total-equity` | `verifier` | pass | pass |
| `capital-stack/no-stack-single-loan` | `capital-stack/no-stack-single-loan` | `verifier` | pass | pass |
| `capital-stack/pref-cash-vs-accrued` | `capital-stack/pref-cash-vs-accrued` | `verifier` | pass | pass |
| `capital-stack/reject-waterfall-in-v1` | `capital-stack/reject-waterfall-in-v1` | `verifier` | pass | pass |
| `capital-stack/senior-mezz-pref-verified` | `capital-stack/senior-mezz-pref-verified` | `verifier` | pass | pass |
| `capital-stack/senior-reconciles-debt-structure` | `capital-stack/senior-reconciles-debt-structure` | `verifier` | pass | pass |
| `capital-stack/sizing-disagrees` | `capital-stack/sizing-disagrees` | `verifier` | pass | pass |
| `capital-stack/split-coupon` | `capital-stack/split-coupon` | `verifier` | pass | pass |
| `capital-stack/split-coupon-bad-fields` | `capital-stack/split-coupon-bad-fields` | `verifier` | pass | pass |
| `capital-stack/split-coupon-bad-total` | `capital-stack/split-coupon-bad-total` | `verifier` | pass | pass |
| `cash-flow/calc-day-count-trio` | `cash-flow/calc-day-count-trio` | `verifier` | pass | pass |
| `cash-flow/calc-diverge` | `cash-flow/calc-diverge` | `verifier` | pass | pass |
| `cash-flow/calc-early-year-day-count` | `cash-flow/calc-early-year-day-count` | `verifier` | pass | pass |
| `cash-flow/calc-missing-variant` | `cash-flow/calc-missing-variant` | `verifier` | pass | pass |
| `cash-flow/calc-override-shadow` | `cash-flow/calc-override-shadow` | `verifier` | pass | pass |
| `cash-flow/calc-xirr-decl` | `cash-flow/calc-xirr-decl` | `verifier` | pass | pass |
| `cash-flow/calc-xnpv-decl` | `cash-flow/calc-xnpv-decl` | `verifier` | pass | pass |
| `cash-flow/reject-bad-date` | `cash-flow/reject-bad-date` | `verifier` | pass | pass |
| `cash-flow/reject-duplicate-year-selection` | `cash-flow/reject-duplicate-year-selection` | `verifier` | pass | pass |
| `cash-flow/reject-early-year-unordered` | `cash-flow/reject-early-year-unordered` | `verifier` | pass | pass |
| `cash-flow/reject-unordered` | `cash-flow/reject-unordered` | `verifier` | pass | pass |
| `cash-flow/reject-xirr-no-sign-change` | `cash-flow/reject-xirr-no-sign-change` | `verifier` | pass | pass |
| `cash-flow/valid-early-year-ordering` | `cash-flow/valid-early-year-ordering` | `verifier` | pass | pass |
| `cash-flow/valid-hold-period` | `cash-flow/valid-hold-period` | `verifier` | pass | pass |
| `cash-flow/valid-same-day-selection` | `cash-flow/valid-same-day-selection` | `verifier` | pass | pass |
| `cash-flow/verify-all-metrics` | `cash-flow/verify-all-metrics` | `verifier` | pass | pass |
| `cash-flow/verify-moic-no-outflows` | `cash-flow/verify-moic-no-outflows` | `verifier` | pass | pass |
| `cash-flow/verify-procedure-refuses` | `cash-flow/verify-procedure-refuses` | `verifier` | pass | pass |
| `cash-flow/verify-same-day-flows` | `cash-flow/verify-same-day-flows` | `verifier` | pass | pass |
| `cash-flow/verify-stated-xirr-disagrees` | `cash-flow/verify-stated-xirr-disagrees` | `verifier` | pass | pass |
| `composition/composite/cycle` | `composition/composite/cycle` | `portfolio` | pass | pass |
| `composition/composite/depth-exceeded` | `composition/composite/depth-exceeded` | `portfolio` | pass | pass |
| `composition/composite/nested` | `composition/composite/nested` | `portfolio` | pass | pass |
| `composition/composite/stale-leaf` | `composition/composite/stale-leaf` | `portfolio` | pass | pass |
| `composition/inherit/ambiguous` | `composition/inherit/ambiguous` | `starter-products` | pass | pass |
| `composition/inherit/nearest-ancestor` | `composition/inherit/nearest-ancestor` | `starter-products` | pass | pass |
| `composition/lite-projection/externalized` | `composition/lite-projection/externalized` | `representations` | pass | pass |
| `composition/lite-projection/externalized [content]` | `composition/lite-projection/externalized [content]` | `representations` | pass | pass |
| `composition/reject/count-mismatch` | `composition/reject/count-mismatch` | `representations` | pass | pass |
| `composition/reject/duplicate-key` | `composition/reject/duplicate-key` | `representations` | pass | pass |
| `composition/reject/part-malformed` | `composition/reject/part-malformed` | `representations` | pass | pass |
| `composition/reject/section-mismatch` | `composition/reject/section-mismatch` | `representations` | pass | pass |
| `composition/resolve/collection-order [canonical]` | `composition/resolve/collection-order [canonical]` | `representations` | pass | pass |
| `composition/resolve/collection-order [digest]` | `composition/resolve/collection-order [digest]` | `representations` | pass | pass |
| `composition/resolve/inline-vs-external [canonical]` | `composition/resolve/inline-vs-external [canonical]` | `representations` | pass | pass |
| `composition/resolve/inline-vs-external [digest]` | `composition/resolve/inline-vs-external [digest]` | `representations` | pass | pass |
| `composition/rollup/child-mutated` | `composition/rollup/child-mutated` | `portfolio` | pass | pass |
| `composition/rollup/stated-disagrees` | `composition/rollup/stated-disagrees` | `portfolio` | pass | pass |
| `composition/rollup/verified` | `composition/rollup/verified` | `portfolio` | pass | pass |
| `composition/unresolved/missing-part` | `composition/unresolved/missing-part` | `representations` | pass | pass |
| `currency/explicit-code` | `currency/explicit-code` | `starter-products` | pass | pass |
| `currency/malformed` | `currency/malformed` | `starter-products` | pass | pass |
| `currency/malformed [validate]` | `currency/malformed [validate]` | `verifier` | pass | pass |
| `hedge/0070-after-expiration` | `hedge/0070-after-expiration` | `verifier` | pass | pass |
| `hedge/0070-ambiguous-debt` | `hedge/0070-ambiguous-debt` | `verifier` | pass | pass |
| `hedge/0070-ambiguous-sources` | `hedge/0070-ambiguous-sources` | `verifier` | pass | pass |
| `hedge/0070-bad-amount` | `hedge/0070-bad-amount` | `verifier` | pass | pass |
| `hedge/0070-bad-currency` | `hedge/0070-bad-currency` | `verifier` | pass | pass |
| `hedge/0070-bad-date` | `hedge/0070-bad-date` | `verifier` | pass | pass |
| `hedge/0070-bad-index--1` | `hedge/0070-bad-index--1` | `verifier` | pass | pass |
| `hedge/0070-bad-index-0_5` | `hedge/0070-bad-index-0_5` | `verifier` | pass | pass |
| `hedge/0070-bad-index-9007199254740992` | `hedge/0070-bad-index-9007199254740992` | `verifier` | pass | pass |
| `hedge/0070-bad-kind` | `hedge/0070-bad-kind` | `verifier` | pass | pass |
| `hedge/0070-bad-order` | `hedge/0070-bad-order` | `verifier` | pass | pass |
| `hedge/0070-bad-row-label` | `hedge/0070-bad-row-label` | `verifier` | pass | pass |
| `hedge/0070-bad-row-member` | `hedge/0070-bad-row-member` | `verifier` | pass | pass |
| `hedge/0070-before-expiration` | `hedge/0070-before-expiration` | `verifier` | pass | pass |
| `hedge/0070-currency-absent` | `hedge/0070-currency-absent` | `verifier` | pass | pass |
| `hedge/0070-currency-null` | `hedge/0070-currency-null` | `verifier` | pass | pass |
| `hedge/0070-digest-member-missing` | `hedge/0070-digest-member-missing` | `verifier` | pass | pass |
| `hedge/0070-digest-syntax` | `hedge/0070-digest-syntax` | `verifier` | pass | pass |
| `hedge/0070-empty-series` | `hedge/0070-empty-series` | `verifier` | pass | pass |
| `hedge/0070-escrow-contradiction-0` | `hedge/0070-escrow-contradiction-0` | `verifier` | pass | pass |
| `hedge/0070-escrow-contradiction-100` | `hedge/0070-escrow-contradiction-100` | `verifier` | pass | pass |
| `hedge/0070-escrow-missing` | `hedge/0070-escrow-missing` | `verifier` | pass | pass |
| `hedge/0070-escrow-reference` | `hedge/0070-escrow-reference` | `verifier` | pass | pass |
| `hedge/0070-explicit-escrow` | `hedge/0070-explicit-escrow` | `verifier` | pass | pass |
| `hedge/0070-explicit-zero` | `hedge/0070-explicit-zero` | `verifier` | pass | pass |
| `hedge/0070-invalid-effective` | `hedge/0070-invalid-effective` | `verifier` | pass | pass |
| `hedge/0070-legacy-escrow` | `hedge/0070-legacy-escrow` | `verifier` | pass | pass |
| `hedge/0070-missing-reference` | `hedge/0070-missing-reference` | `verifier` | pass | pass |
| `hedge/0070-missing-row` | `hedge/0070-missing-row` | `verifier` | pass | pass |
| `hedge/0070-missing-source` | `hedge/0070-missing-source` | `verifier` | pass | pass |
| `hedge/0070-missing-sources-uses` | `hedge/0070-missing-sources-uses` | `verifier` | pass | pass |
| `hedge/0070-missing-uses` | `hedge/0070-missing-uses` | `verifier` | pass | pass |
| `hedge/0070-nonreplacement-loan_matures_first-escrow` | `hedge/0070-nonreplacement-loan_matures_first-escrow` | `verifier` | pass | pass |
| `hedge/0070-nonreplacement-loan_matures_first-outright` | `hedge/0070-nonreplacement-loan_matures_first-outright` | `verifier` | pass | pass |
| `hedge/0070-nonreplacement-unhedged-escrow` | `hedge/0070-nonreplacement-unhedged-escrow` | `verifier` | pass | pass |
| `hedge/0070-nonreplacement-unhedged-outright` | `hedge/0070-nonreplacement-unhedged-outright` | `verifier` | pass | pass |
| `hedge/0070-on-expiration` | `hedge/0070-on-expiration` | `verifier` | pass | pass |
| `hedge/0070-outright-payment` | `hedge/0070-outright-payment` | `verifier` | pass | pass |
| `hedge/0070-payment-before-effective` | `hedge/0070-payment-before-effective` | `verifier` | pass | pass |
| `hedge/0070-payment-on-effective` | `hedge/0070-payment-on-effective` | `verifier` | pass | pass |
| `hedge/0070-positive-payment` | `hedge/0070-positive-payment` | `verifier` | pass | pass |
| `hedge/0070-reviewed-rebind` | `hedge/0070-reviewed-rebind` | `verifier` | pass | pass |
| `hedge/0070-same-day-distinct` | `hedge/0070-same-day-distinct` | `verifier` | pass | pass |
| `hedge/0070-stale-amount` | `hedge/0070-stale-amount` | `verifier` | pass | pass |
| `hedge/0070-stale-currency` | `hedge/0070-stale-currency` | `verifier` | pass | pass |
| `hedge/0070-stale-currency-removed` | `hedge/0070-stale-currency-removed` | `verifier` | pass | pass |
| `hedge/0070-stale-deletion` | `hedge/0070-stale-deletion` | `verifier` | pass | pass |
| `hedge/0070-stale-index` | `hedge/0070-stale-index` | `verifier` | pass | pass |
| `hedge/0070-stale-insertion` | `hedge/0070-stale-insertion` | `verifier` | pass | pass |
| `hedge/0070-stale-label` | `hedge/0070-stale-label` | `verifier` | pass | pass |
| `hedge/0070-stale-reorder` | `hedge/0070-stale-reorder` | `verifier` | pass | pass |
| `hedge/0070-stale-variant` | `hedge/0070-stale-variant` | `verifier` | pass | pass |
| `hedge/0070-superseded-source` | `hedge/0070-superseded-source` | `verifier` | pass | pass |
| `hedge/0070-unknown-member` | `hedge/0070-unknown-member` | `verifier` | pass | pass |
| `hedge/0070-unknown-mode` | `hedge/0070-unknown-mode` | `verifier` | pass | pass |
| `hedge/0070-unrelated-edit` | `hedge/0070-unrelated-edit` | `verifier` | pass | pass |
| `hedge/0070-variant-fallback-forbidden` | `hedge/0070-variant-fallback-forbidden` | `verifier` | pass | pass |
| `hedge/0075-junior-keyed-base` | `hedge/0075-junior-keyed-base` | `verifier` | pass | pass |
| `hedge/0075-junior-only-hedge` | `hedge/0075-junior-only-hedge` | `verifier` | pass | pass |
| `hedge/0075-malformed-hedge-beside-junior` | `hedge/0075-malformed-hedge-beside-junior` | `verifier` | pass | pass |
| `hedge/0075-senior-junior-escrow` | `hedge/0075-senior-junior-escrow` | `verifier` | pass | pass |
| `hedge/0075-senior-junior-outright` | `hedge/0075-senior-junior-outright` | `verifier` | pass | pass |
| `hedge/0075-two-seniors` | `hedge/0075-two-seniors` | `verifier` | pass | pass |
| `hedge/0076-components-only-hedge` | `hedge/0076-components-only-hedge` | `verifier` | pass | pass |
| `hedge/0076-sources-refused-escrow-mode` | `hedge/0076-sources-refused-escrow-mode` | `verifier` | pass | pass |
| `hedge/0076-sources-refused-malformed-hedge` | `hedge/0076-sources-refused-malformed-hedge` | `verifier` | pass | pass |
| `hedge/0076-sources-refused-replace` | `hedge/0076-sources-refused-replace` | `verifier` | pass | pass |
| `hedge/0076-two-seniors-hedge-malformed` | `hedge/0076-two-seniors-hedge-malformed` | `verifier` | pass | pass |
| `hedge/0076-two-seniors-hedge-unfunded` | `hedge/0076-two-seniors-hedge-unfunded` | `verifier` | pass | pass |
| `hedge/0076-two-seniors-no-hedge-escrow` | `hedge/0076-two-seniors-no-hedge-escrow` | `verifier` | pass | pass |
| `hedge/0076-two-seniors-replace-escrow` | `hedge/0076-two-seniors-replace-escrow` | `verifier` | pass | pass |
| `hedge/0081-accept-strike-only` | `hedge/0081-accept-strike-only` | `verifier` | pass | pass |
| `hedge/0081-reject-partial-terms-group` | `hedge/0081-reject-partial-terms-group` | `verifier` | pass | pass |
| `hedge/accept-full-hedge-and-escrows` | `hedge/accept-full-hedge-and-escrows` | `verifier` | pass | pass |
| `hedge/accept-no-hedge-stated` | `hedge/accept-no-hedge-stated` | `verifier` | pass | pass |
| `hedge/reject-duplicate-escrow-name` | `hedge/reject-duplicate-escrow-name` | `verifier` | pass | pass |
| `hedge/reject-escrow-funding-nothing` | `hedge/reject-escrow-funding-nothing` | `verifier` | pass | pass |
| `hedge/reject-expiration-before-effective` | `hedge/reject-expiration-before-effective` | `verifier` | pass | pass |
| `hedge/reject-hedge-on-fixed-loan` | `hedge/reject-hedge-on-fixed-loan` | `verifier` | pass | pass |
| `hedge/reject-other-escrow-without-label` | `hedge/reject-other-escrow-without-label` | `verifier` | pass | pass |
| `hedge/reject-replace-without-escrow` | `hedge/reject-replace-without-escrow` | `verifier` | pass | pass |
| `hedge/reject-replacement-escrow-without-assumption` | `hedge/reject-replacement-escrow-without-assumption` | `verifier` | pass | pass |
| `hedge/reject-reserved-collar` | `hedge/reject-reserved-collar` | `verifier` | pass | pass |
| `hedge/reject-reserved-swap` | `hedge/reject-reserved-swap` | `verifier` | pass | pass |
| `hedge/reject-strike-as-percent` | `hedge/reject-strike-as-percent` | `verifier` | pass | pass |
| `hedge/reject-unknown-escrow-name` | `hedge/reject-unknown-escrow-name` | `verifier` | pass | pass |
| `hedge/reject-unstated-expiry-assumption` | `hedge/reject-unstated-expiry-assumption` | `verifier` | pass | pass |
| `lease-up-projection/component` | `lease-up-projection/component` | `starter-products` | pass | pass |
| `lease-up-projection/decreasing` | `lease-up-projection/decreasing` | `starter-products` | pass | pass |
| `lease-up-projection/duplicate-map` | `lease-up-projection/duplicate-map` | `starter-products` | pass | pass |
| `lease-up-projection/exact-zero` | `lease-up-projection/exact-zero` | `starter-products` | pass | pass |
| `lease-up-projection/extra-map` | `lease-up-projection/extra-map` | `starter-products` | pass | pass |
| `lease-up-projection/failed` | `lease-up-projection/failed` | `starter-products` | pass | pass |
| `lease-up-projection/gap` | `lease-up-projection/gap` | `starter-products` | pass | pass |
| `lease-up-projection/invalid-date` | `lease-up-projection/invalid-date` | `starter-products` | pass | pass |
| `lease-up-projection/missing-amount` | `lease-up-projection/missing-amount` | `starter-products` | pass | pass |
| `lease-up-projection/missing-map` | `lease-up-projection/missing-map` | `starter-products` | pass | pass |
| `lease-up-projection/monthly-leap` | `lease-up-projection/monthly-leap` | `starter-products` | pass | pass |
| `lease-up-projection/quarterly` | `lease-up-projection/quarterly` | `starter-products` | pass | pass |
| `lease-up-projection/same-day` | `lease-up-projection/same-day` | `starter-products` | pass | pass |
| `lease-up-projection/unverifiable` | `lease-up-projection/unverifiable` | `starter-products` | pass | pass |
| `lease-up-projection/wrong-variant` | `lease-up-projection/wrong-variant` | `starter-products` | pass | pass |
| `lease-up/reject-bad-period` | `lease-up/reject-bad-period` | `verifier` | pass | pass |
| `lease-up/reject-empty-schedule` | `lease-up/reject-empty-schedule` | `verifier` | pass | pass |
| `lease-up/reject-gapped-periods` | `lease-up/reject-gapped-periods` | `verifier` | pass | pass |
| `lease-up/valid-ground-up-absorption` | `lease-up/valid-ground-up-absorption` | `verifier` | pass | pass |
| `lease-up/valid-value-add-turnover` | `lease-up/valid-value-add-turnover` | `verifier` | pass | pass |
| `lease-up/verify-missing-denominator` | `lease-up/verify-missing-denominator` | `verifier` | pass | pass |
| `lease-up/verify-stated-sum-disagrees` | `lease-up/verify-stated-sum-disagrees` | `verifier` | pass | pass |
| `lease-up/warn-stabilized-mismatch` | `lease-up/warn-stabilized-mismatch` | `verifier` | pass | pass |
| `lease-up/warn-turnover-no-rent-roll` | `lease-up/warn-turnover-no-rent-roll` | `verifier` | pass | pass |
| `lease/reject-break-after-expiration` | `lease/reject-break-after-expiration` | `verifier` | pass | pass |
| `lease/reject-clause-without-details` | `lease/reject-clause-without-details` | `verifier` | pass | pass |
| `lease/reject-details-without-clause` | `lease/reject-details-without-clause` | `verifier` | pass | pass |
| `lease/reject-duplicate-penalty-component` | `lease/reject-duplicate-penalty-component` | `verifier` | pass | pass |
| `lease/reject-duplicate-step-date` | `lease/reject-duplicate-step-date` | `verifier` | pass | pass |
| `lease/reject-fractional-notice` | `lease/reject-fractional-notice` | `verifier` | pass | pass |
| `lease/reject-lc-balance-above-original` | `lease/reject-lc-balance-above-original` | `verifier` | pass | pass |
| `lease/reject-named-trigger-without-names` | `lease/reject-named-trigger-without-names` | `verifier` | pass | pass |
| `lease/reject-reduction-without-value` | `lease/reject-reduction-without-value` | `verifier` | pass | pass |
| `lease/reject-schedule-on-flat-lease` | `lease/reject-schedule-on-flat-lease` | `verifier` | pass | pass |
| `lease/reject-step-outside-term` | `lease/reject-step-outside-term` | `verifier` | pass | pass |
| `lease/reject-steps-out-of-order` | `lease/reject-steps-out-of-order` | `verifier` | pass | pass |
| `lease/reject-termination-right-with-value` | `lease/reject-termination-right-with-value` | `verifier` | pass | pass |
| `lease/reject-threshold-as-percent` | `lease/reject-threshold-as-percent` | `verifier` | pass | pass |
| `lease/reject-ti-balance-above-original` | `lease/reject-ti-balance-above-original` | `verifier` | pass | pass |
| `lease/reject-unknown-penalty-component` | `lease/reject-unknown-penalty-component` | `verifier` | pass | pass |
| `lease/valid-every-clause` | `lease/valid-every-clause` | `verifier` | pass | pass |
| `lease/valid-full-rent-reduction` | `lease/valid-full-rent-reduction` | `verifier` | pass | pass |
| `lease/valid-no-clauses-stated` | `lease/valid-no-clauses-stated` | `verifier` | pass | pass |
| `lease/valid-null-penalty` | `lease/valid-null-penalty` | `verifier` | pass | pass |
| `lease/valid-single-step-mid-term` | `lease/valid-single-step-mid-term` | `verifier` | pass | pass |
| `lite/01-minimal [canonical]` | `lite/01-minimal [canonical]` | `representations` | pass | pass |
| `lite/01-minimal [compile-report]` | `lite/01-minimal [compile-report]` | `representations` | pass | pass |
| `lite/01-minimal [digest]` | `lite/01-minimal [digest]` | `representations` | pass | pass |
| `lite/01-minimal [parse]` | `lite/01-minimal [parse]` | `representations` | pass | pass |
| `lite/01-minimal [projection-report]` | `lite/01-minimal [projection-report]` | `representations` | pass | pass |
| `lite/01-minimal [projection]` | `lite/01-minimal [projection]` | `representations` | pass | pass |
| `lite/01-minimal [render-roundtrip]` | `lite/01-minimal [render-roundtrip]` | `representations` | pass | pass |
| `lite/01-minimal [render]` | `lite/01-minimal [render]` | `representations` | pass | pass |
| `lite/01-minimal [uwx]` | `lite/01-minimal [uwx]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [canonical]` | `lite/02-full-deal-summary [canonical]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [compile-report]` | `lite/02-full-deal-summary [compile-report]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [digest]` | `lite/02-full-deal-summary [digest]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [parse]` | `lite/02-full-deal-summary [parse]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [projection-report]` | `lite/02-full-deal-summary [projection-report]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [projection]` | `lite/02-full-deal-summary [projection]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [render-roundtrip]` | `lite/02-full-deal-summary [render-roundtrip]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [render]` | `lite/02-full-deal-summary [render]` | `representations` | pass | pass |
| `lite/02-full-deal-summary [uwx]` | `lite/02-full-deal-summary [uwx]` | `representations` | pass | pass |
| `lite/03-display-variants [canonical]` | `lite/03-display-variants [canonical]` | `representations` | pass | pass |
| `lite/03-display-variants [compile-report]` | `lite/03-display-variants [compile-report]` | `representations` | pass | pass |
| `lite/03-display-variants [digest]` | `lite/03-display-variants [digest]` | `representations` | pass | pass |
| `lite/03-display-variants [parse]` | `lite/03-display-variants [parse]` | `representations` | pass | pass |
| `lite/03-display-variants [projection-report]` | `lite/03-display-variants [projection-report]` | `representations` | pass | pass |
| `lite/03-display-variants [projection]` | `lite/03-display-variants [projection]` | `representations` | pass | pass |
| `lite/03-display-variants [render-roundtrip]` | `lite/03-display-variants [render-roundtrip]` | `representations` | pass | pass |
| `lite/03-display-variants [render]` | `lite/03-display-variants [render]` | `representations` | pass | pass |
| `lite/03-display-variants [uwx]` | `lite/03-display-variants [uwx]` | `representations` | pass | pass |
| `lite/04-typed-values [canonical]` | `lite/04-typed-values [canonical]` | `representations` | pass | pass |
| `lite/04-typed-values [compile-report]` | `lite/04-typed-values [compile-report]` | `representations` | pass | pass |
| `lite/04-typed-values [digest]` | `lite/04-typed-values [digest]` | `representations` | pass | pass |
| `lite/04-typed-values [parse]` | `lite/04-typed-values [parse]` | `representations` | pass | pass |
| `lite/04-typed-values [projection-report]` | `lite/04-typed-values [projection-report]` | `representations` | pass | pass |
| `lite/04-typed-values [projection]` | `lite/04-typed-values [projection]` | `representations` | pass | pass |
| `lite/04-typed-values [render-roundtrip]` | `lite/04-typed-values [render-roundtrip]` | `representations` | pass | pass |
| `lite/04-typed-values [render]` | `lite/04-typed-values [render]` | `representations` | pass | pass |
| `lite/04-typed-values [uwx]` | `lite/04-typed-values [uwx]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [canonical]` | `lite/05-prose-and-normalization [canonical]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [compile-report]` | `lite/05-prose-and-normalization [compile-report]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [digest]` | `lite/05-prose-and-normalization [digest]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [parse]` | `lite/05-prose-and-normalization [parse]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [projection-report]` | `lite/05-prose-and-normalization [projection-report]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [projection]` | `lite/05-prose-and-normalization [projection]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [render-roundtrip]` | `lite/05-prose-and-normalization [render-roundtrip]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [render]` | `lite/05-prose-and-normalization [render]` | `representations` | pass | pass |
| `lite/05-prose-and-normalization [uwx]` | `lite/05-prose-and-normalization [uwx]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [canonical]` | `lite/06-decimal-exact-percents [canonical]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [compile-report]` | `lite/06-decimal-exact-percents [compile-report]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [digest]` | `lite/06-decimal-exact-percents [digest]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [parse]` | `lite/06-decimal-exact-percents [parse]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [projection-report]` | `lite/06-decimal-exact-percents [projection-report]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [projection]` | `lite/06-decimal-exact-percents [projection]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [render-roundtrip]` | `lite/06-decimal-exact-percents [render-roundtrip]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [render]` | `lite/06-decimal-exact-percents [render]` | `representations` | pass | pass |
| `lite/06-decimal-exact-percents [uwx]` | `lite/06-decimal-exact-percents [uwx]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [canonical]` | `lite/07-decimal-exact-fractions [canonical]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [compile-report]` | `lite/07-decimal-exact-fractions [compile-report]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [digest]` | `lite/07-decimal-exact-fractions [digest]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [parse]` | `lite/07-decimal-exact-fractions [parse]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [projection-report]` | `lite/07-decimal-exact-fractions [projection-report]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [projection]` | `lite/07-decimal-exact-fractions [projection]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [render-roundtrip]` | `lite/07-decimal-exact-fractions [render-roundtrip]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [render]` | `lite/07-decimal-exact-fractions [render]` | `representations` | pass | pass |
| `lite/07-decimal-exact-fractions [uwx]` | `lite/07-decimal-exact-fractions [uwx]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [canonical]` | `lite/08-frontmatter-yaml-scalars [canonical]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [compile-report]` | `lite/08-frontmatter-yaml-scalars [compile-report]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [digest]` | `lite/08-frontmatter-yaml-scalars [digest]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [parse]` | `lite/08-frontmatter-yaml-scalars [parse]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [projection-report]` | `lite/08-frontmatter-yaml-scalars [projection-report]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [projection]` | `lite/08-frontmatter-yaml-scalars [projection]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [render-roundtrip]` | `lite/08-frontmatter-yaml-scalars [render-roundtrip]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [render]` | `lite/08-frontmatter-yaml-scalars [render]` | `representations` | pass | pass |
| `lite/08-frontmatter-yaml-scalars [uwx]` | `lite/08-frontmatter-yaml-scalars [uwx]` | `representations` | pass | pass |
| `lite/compile/01-period-unsupported` | `lite/compile/01-period-unsupported` | `representations` | pass | pass |
| `lite/compile/02-scenario-unsupported` | `lite/compile/02-scenario-unsupported` | `representations` | pass | pass |
| `lite/compile/03-unit-mismatch` | `lite/compile/03-unit-mismatch` | `representations` | pass | pass |
| `lite/compile/04-field-unknown` | `lite/compile/04-field-unknown` | `representations` | pass | pass |
| `lite/compile/05-frontmatter-required` | `lite/compile/05-frontmatter-required` | `representations` | pass | pass |
| `lite/compile/06-target-conflict` | `lite/compile/06-target-conflict` | `representations` | pass | pass |
| `lite/equivalence/decimal-exactness-percent-vs-fraction` | `lite/equivalence/decimal-exactness-percent-vs-fraction` | `representations` | pass | pass |
| `lite/equivalence/display-formatting-invariance` | `lite/equivalence/display-formatting-invariance` | `representations` | pass | pass |
| `lite/malformed/01-missing-version` | `lite/malformed/01-missing-version` | `representations` | pass | pass |
| `lite/malformed/02-unsupported-version` | `lite/malformed/02-unsupported-version` | `representations` | pass | pass |
| `lite/malformed/03-duplicate-identity` | `lite/malformed/03-duplicate-identity` | `representations` | pass | pass |
| `lite/malformed/04-empty-value` | `lite/malformed/04-empty-value` | `representations` | pass | pass |
| `lite/malformed/05-anchor-without-field` | `lite/malformed/05-anchor-without-field` | `representations` | pass | pass |
| `lite/malformed/06-frontmatter-nesting` | `lite/malformed/06-frontmatter-nesting` | `representations` | pass | pass |
| `lite/malformed/07-frontmatter-duplicate` | `lite/malformed/07-frontmatter-duplicate` | `representations` | pass | pass |
| `lite/malformed/08-frontmatter-syntax` | `lite/malformed/08-frontmatter-syntax` | `representations` | pass | pass |
| `lite/malformed/09-missing-frontmatter` | `lite/malformed/09-missing-frontmatter` | `representations` | pass | pass |
| `lite/malformed/10-unclosed-frontmatter` | `lite/malformed/10-unclosed-frontmatter` | `representations` | pass | pass |
| `lite/malformed/11-attribute-syntax` | `lite/malformed/11-attribute-syntax` | `representations` | pass | pass |
| `lite/malformed/12-attribute-duplicate` | `lite/malformed/12-attribute-duplicate` | `representations` | pass | pass |
| `lite/malformed/13-frontmatter-flow-sequence` | `lite/malformed/13-frontmatter-flow-sequence` | `representations` | pass | pass |
| `lite/malformed/14-frontmatter-flow-mapping` | `lite/malformed/14-frontmatter-flow-mapping` | `representations` | pass | pass |
| `lite/malformed/15-frontmatter-invalid-escape` | `lite/malformed/15-frontmatter-invalid-escape` | `representations` | pass | pass |
| `lite/malformed/16-structured-under-lite-name` | `lite/malformed/16-structured-under-lite-name` | `representations` | pass | pass |
| `locale/calc-locale-invariant` | `locale/calc-locale-invariant` | `starter-products` | pass | pass |
| `locale/csv-stays-canonical` | `locale/csv-stays-canonical` | `starter-products` | pass | pass |
| `locale/render-de-DE` | `locale/render-de-DE` | `starter-products` | pass | pass |
| `locale/render-en-GB` | `locale/render-en-GB` | `starter-products` | pass | pass |
| `locale/render-fr-FR` | `locale/render-fr-FR` | `starter-products` | pass | pass |
| `locale/render-ja-JP` | `locale/render-ja-JP` | `starter-products` | pass | pass |
| `locale/render-zh-CN` | `locale/render-zh-CN` | `starter-products` | pass | pass |
| `locale/unsupported-locale-refuses` | `locale/unsupported-locale-refuses` | `starter-products` | pass | pass |
| `locale/unsupported-locale-refuses [validate]` | `locale/unsupported-locale-refuses [validate]` | `verifier` | pass | pass |
| `market-data/promote/confidence-preserved` | `market-data/promote/confidence-preserved` | `starter-products` | pass | pass |
| `market-data/promote/explicit` | `market-data/promote/explicit` | `starter-products` | pass | pass |
| `market-data/promote/explicit [resolves as input of record]` | `market-data/promote/explicit [resolves as input of record]` | `starter-products` | pass | pass |
| `market-data/reject/carries-deal-id` | `market-data/reject/carries-deal-id` | `verifier` | pass | pass |
| `market-data/reject/duplicate-field-path` | `market-data/reject/duplicate-field-path` | `verifier` | pass | pass |
| `market-data/reject/empty-basis` | `market-data/reject/empty-basis` | `verifier` | pass | pass |
| `market-data/reject/impossible-as-of` | `market-data/reject/impossible-as-of` | `verifier` | pass | pass |
| `market-data/reject/no-as-of` | `market-data/reject/no-as-of` | `verifier` | pass | pass |
| `market-data/reject/no-provider` | `market-data/reject/no-provider` | `verifier` | pass | pass |
| `market-data/reject/unknown-field-path` | `market-data/reject/unknown-field-path` | `verifier` | pass | pass |
| `market-data/resolve/ambiguous-as-of` | `market-data/resolve/ambiguous-as-of` | `starter-products` | pass | pass |
| `market-data/resolve/most-recent-wins` | `market-data/resolve/most-recent-wins` | `starter-products` | pass | pass |
| `market-data/resolve/staleness` | `market-data/resolve/staleness` | `starter-products` | pass | pass |
| `market-data/valid/quarterly-observations` | `market-data/valid/quarterly-observations` | `verifier` | pass | pass |
| `metrics/Agave-Court-Apts-Scottsdale-AZ.uwx.md` | `metrics/Agave-Court-Apts-Scottsdale-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Cactus-Crossing-Retail-Mesa-AZ.uwx.md` | `metrics/Cactus-Crossing-Retail-Mesa-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md` | `metrics/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md` | `metrics/Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Lite-ratio-token-retains-stated-precision` | `metrics/Lite-ratio-token-retains-stated-precision` | `verifier` | pass | pass |
| `metrics/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md` | `metrics/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | `metrics/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | `metrics/Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Parkview-Apts-Glendale-AZ.uw.md` | `metrics/Parkview-Apts-Glendale-AZ.uw.md` | `verifier` | pass | pass |
| `metrics/Parkview-Apts-Glendale-AZ.uwx.md` | `metrics/Parkview-Apts-Glendale-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Riverside-Office-Phoenix-AZ.uwx.md` | `metrics/Riverside-Office-Phoenix-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md` | `metrics/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | `metrics/Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Sonoran-Self-Storage-Peoria-AZ.uwx.md` | `metrics/Sonoran-Self-Storage-Peoria-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | `metrics/Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | `verifier` | pass | pass |
| `metrics/all-class-LTV-uses-underwritten-value-with-lazy-price-fallback` | `metrics/all-class-LTV-uses-underwritten-value-with-lazy-price-fallback` | `verifier` | pass | pass |
| `metrics/all-income-classes-require-total-equity` | `metrics/all-income-classes-require-total-equity` | `verifier` | pass | pass |
| `metrics/all-income-classes-stated-Y1-and-lazy-fallback` | `metrics/all-income-classes-stated-Y1-and-lazy-fallback` | `verifier` | pass | pass |
| `metrics/coarse-statements-verify-or-fail-at-the-minimum` | `metrics/coarse-statements-verify-or-fail-at-the-minimum` | `verifier` | pass | pass |
| `metrics/currency-quantum-and-one-cent-negative` | `metrics/currency-quantum-and-one-cent-negative` | `verifier` | pass | pass |
| `metrics/declared-senior-selection-and-unresolved-equity` | `metrics/declared-senior-selection-and-unresolved-equity` | `verifier` | pass | pass |
| `metrics/dictionary-formula-controls-comparison` | `metrics/dictionary-formula-controls-comparison` | `verifier` | pass | pass |
| `metrics/explicit-null-does-not-become-zero` | `metrics/explicit-null-does-not-become-zero` | `verifier` | pass | pass |
| `metrics/half-away-from-zero-at-output-only` | `metrics/half-away-from-zero-at-output-only` | `verifier` | pass | pass |
| `metrics/inputs-and-definition-remain-unchanged` | `metrics/inputs-and-definition-remain-unchanged` | `verifier` | pass | pass |
| `metrics/invalid-input-refuses` | `metrics/invalid-input-refuses` | `verifier` | pass | pass |
| `metrics/market-data/Phoenix-Multifamily-2026-Q2.uwx.md` | `metrics/market-data/Phoenix-Multifamily-2026-Q2.uwx.md` | `verifier` | pass | pass |
| `metrics/missing-input-is-not-a-default` | `metrics/missing-input-is-not-a-default` | `verifier` | pass | pass |
| `metrics/mixed-use-allocation-is-stated` | `metrics/mixed-use-allocation-is-stated` | `verifier` | pass | pass |
| `metrics/parkview-after-L6.uwx.md` | `metrics/parkview-after-L6.uwx.md` | `verifier` | pass | pass |
| `metrics/primary-size-is-unrounded-and-uninferred` | `metrics/primary-size-is-unrounded-and-uninferred` | `verifier` | pass | pass |
| `metrics/source-tokens-preserve-zeroes-exponents-and-addresses` | `metrics/source-tokens-preserve-zeroes-exponents-and-addresses` | `verifier` | pass | pass |
| `metrics/standalone/externalized-deal.uwx.md` | `metrics/standalone/externalized-deal.uwx.md` | `verifier` | pass | pass |
| `metrics/standalone/inline-deal.uwx.md` | `metrics/standalone/inline-deal.uwx.md` | `verifier` | pass | pass |
| `metrics/standalone/package/records/externalized-deal.uwx.md` | `metrics/standalone/package/records/externalized-deal.uwx.md` | `verifier` | pass | pass |
| `metrics/stated-precision-minimum-and-no-double-rounding` | `metrics/stated-precision-minimum-and-no-double-rounding` | `verifier` | pass | pass |
| `metrics/stated-value-tampering` | `metrics/stated-value-tampering` | `verifier` | pass | pass |
| `metrics/verifier-import-graph-excludes-starter-engine` | `metrics/verifier-import-graph-excludes-starter-engine` | `verifier` | pass | pass |
| `metrics/zero-divisor-refuses` | `metrics/zero-divisor-refuses` | `verifier` | pass | pass |
| `modules/accept/01-minimal` | `modules/accept/01-minimal` | `module` | pass | pass |
| `modules/accept/01-minimal [schema-parity]` | `modules/accept/01-minimal [schema-parity]` | `module` | pass | pass |
| `modules/accept/02-full-surface` | `modules/accept/02-full-surface` | `module` | pass | pass |
| `modules/accept/02-full-surface [schema-parity]` | `modules/accept/02-full-surface [schema-parity]` | `module` | pass | pass |
| `modules/accept/03-calc-round-to` | `modules/accept/03-calc-round-to` | `module` | pass | pass |
| `modules/accept/03-calc-round-to [schema-parity]` | `modules/accept/03-calc-round-to [schema-parity]` | `module` | pass | pass |
| `modules/accept/04-declares-asset-class` | `modules/accept/04-declares-asset-class` | `module` | pass | pass |
| `modules/accept/04-declares-asset-class [schema-parity]` | `modules/accept/04-declares-asset-class [schema-parity]` | `module` | pass | pass |
| `modules/asset-classes/01-module-loaded` | `modules/asset-classes/01-module-loaded` | `module` | pass | pass |
| `modules/asset-classes/02-fallback-degraded` | `modules/asset-classes/02-fallback-degraded` | `module` | pass | pass |
| `modules/asset-classes/03-unresolved` | `modules/asset-classes/03-unresolved` | `module` | pass | pass |
| `modules/asset-classes/04-undeclared-modules` | `modules/asset-classes/04-undeclared-modules` | `module` | pass | pass |
| `modules/asset-classes/same-document-across-hosts` | `modules/asset-classes/same-document-across-hosts` | `module` | pass | pass |
| `modules/builtin/01-hospitality-fixture` | `modules/builtin/01-hospitality-fixture` | `verifier` | pass | pass |
| `modules/builtin/02-no-comp-set` | `modules/builtin/02-no-comp-set` | `verifier` | pass | pass |
| `modules/builtin/03-occupancy-as-percent` | `modules/builtin/03-occupancy-as-percent` | `verifier` | pass | pass |
| `modules/builtin/04-required-section-missing` | `modules/builtin/04-required-section-missing` | `verifier` | pass | pass |
| `modules/builtin/05-wrong-asset-class` | `modules/builtin/05-wrong-asset-class` | `verifier` | pass | pass |
| `modules/builtin/06-data-center-fixture` | `modules/builtin/06-data-center-fixture` | `verifier` | pass | pass |
| `modules/builtin/07-data-center-pue-below-one` | `modules/builtin/07-data-center-pue-below-one` | `verifier` | pass | pass |
| `modules/builtin/08-data-center-no-comp` | `modules/builtin/08-data-center-no-comp` | `verifier` | pass | pass |
| `modules/builtin/09-data-center-required-section` | `modules/builtin/09-data-center-required-section` | `verifier` | pass | pass |
| `modules/builtin/10-data-center-as-industrial` | `modules/builtin/10-data-center-as-industrial` | `verifier` | pass | pass |
| `modules/builtin/11-data-center-fallback` | `modules/builtin/11-data-center-fallback` | `verifier` | pass | pass |
| `modules/builtin/12-mhc-fixture` | `modules/builtin/12-mhc-fixture` | `verifier` | pass | pass |
| `modules/builtin/13-mhc-no-poh` | `modules/builtin/13-mhc-no-poh` | `verifier` | pass | pass |
| `modules/builtin/14-mhc-no-poh-rent-absent` | `modules/builtin/14-mhc-no-poh-rent-absent` | `verifier` | pass | pass |
| `modules/builtin/15-mhc-zero-pad-rent` | `modules/builtin/15-mhc-zero-pad-rent` | `verifier` | pass | pass |
| `modules/builtin/16-mhc-zero-home-rent` | `modules/builtin/16-mhc-zero-home-rent` | `verifier` | pass | pass |
| `modules/builtin/17-mhc-zero-both-rents` | `modules/builtin/17-mhc-zero-both-rents` | `verifier` | pass | pass |
| `modules/builtin/18-mhc-zero-debt-and-egi` | `modules/builtin/18-mhc-zero-debt-and-egi` | `verifier` | pass | pass |
| `modules/builtin/19-mhc-missing-section` | `modules/builtin/19-mhc-missing-section` | `verifier` | pass | pass |
| `modules/builtin/20-mhc-missing-total_sites` | `modules/builtin/20-mhc-missing-total_sites` | `verifier` | pass | pass |
| `modules/builtin/21-mhc-missing-occupied_sites` | `modules/builtin/21-mhc-missing-occupied_sites` | `verifier` | pass | pass |
| `modules/builtin/22-mhc-missing-park_owned_homes` | `modules/builtin/22-mhc-missing-park_owned_homes` | `verifier` | pass | pass |
| `modules/builtin/23-mhc-missing-weighted_pad_rent_monthly` | `modules/builtin/23-mhc-missing-weighted_pad_rent_monthly` | `verifier` | pass | pass |
| `modules/builtin/24-mhc-missing-as_of_date` | `modules/builtin/24-mhc-missing-as_of_date` | `verifier` | pass | pass |
| `modules/builtin/25-mhc-missing-home-rent` | `modules/builtin/25-mhc-missing-home-rent` | `verifier` | pass | pass |
| `modules/builtin/26-mhc-null-home-rent` | `modules/builtin/26-mhc-null-home-rent` | `verifier` | pass | pass |
| `modules/builtin/27-mhc-total_sites-0` | `modules/builtin/27-mhc-total_sites-0` | `verifier` | pass | pass |
| `modules/builtin/28-mhc-total_sites-negative-1` | `modules/builtin/28-mhc-total_sites-negative-1` | `verifier` | pass | pass |
| `modules/builtin/29-mhc-total_sites-1_5` | `modules/builtin/29-mhc-total_sites-1_5` | `verifier` | pass | pass |
| `modules/builtin/30-mhc-occupied_sites-negative-1` | `modules/builtin/30-mhc-occupied_sites-negative-1` | `verifier` | pass | pass |
| `modules/builtin/31-mhc-occupied_sites-180_5` | `modules/builtin/31-mhc-occupied_sites-180_5` | `verifier` | pass | pass |
| `modules/builtin/32-mhc-occupied_sites-201` | `modules/builtin/32-mhc-occupied_sites-201` | `verifier` | pass | pass |
| `modules/builtin/33-mhc-park_owned_homes-negative-1` | `modules/builtin/33-mhc-park_owned_homes-negative-1` | `verifier` | pass | pass |
| `modules/builtin/34-mhc-park_owned_homes-20_5` | `modules/builtin/34-mhc-park_owned_homes-20_5` | `verifier` | pass | pass |
| `modules/builtin/35-mhc-park_owned_homes-201` | `modules/builtin/35-mhc-park_owned_homes-201` | `verifier` | pass | pass |
| `modules/builtin/36-mhc-weighted_pad_rent_monthly-negative-1` | `modules/builtin/36-mhc-weighted_pad_rent_monthly-negative-1` | `verifier` | pass | pass |
| `modules/builtin/37-mhc-poh_home_rent_monthly-negative-1` | `modules/builtin/37-mhc-poh_home_rent_monthly-negative-1` | `verifier` | pass | pass |
| `modules/builtin/38-mhc-home-rent-without-poh` | `modules/builtin/38-mhc-home-rent-without-poh` | `verifier` | pass | pass |
| `modules/builtin/39-mhc-type-total_sites-string` | `modules/builtin/39-mhc-type-total_sites-string` | `verifier` | pass | pass |
| `modules/builtin/40-mhc-type-total_sites-boolean` | `modules/builtin/40-mhc-type-total_sites-boolean` | `verifier` | pass | pass |
| `modules/builtin/41-mhc-type-total_sites-object` | `modules/builtin/41-mhc-type-total_sites-object` | `verifier` | pass | pass |
| `modules/builtin/42-mhc-type-occupied_sites-string` | `modules/builtin/42-mhc-type-occupied_sites-string` | `verifier` | pass | pass |
| `modules/builtin/43-mhc-type-occupied_sites-boolean` | `modules/builtin/43-mhc-type-occupied_sites-boolean` | `verifier` | pass | pass |
| `modules/builtin/44-mhc-type-occupied_sites-object` | `modules/builtin/44-mhc-type-occupied_sites-object` | `verifier` | pass | pass |
| `modules/builtin/45-mhc-type-park_owned_homes-string` | `modules/builtin/45-mhc-type-park_owned_homes-string` | `verifier` | pass | pass |
| `modules/builtin/46-mhc-type-park_owned_homes-boolean` | `modules/builtin/46-mhc-type-park_owned_homes-boolean` | `verifier` | pass | pass |
| `modules/builtin/47-mhc-type-park_owned_homes-object` | `modules/builtin/47-mhc-type-park_owned_homes-object` | `verifier` | pass | pass |
| `modules/builtin/48-mhc-type-weighted_pad_rent_monthly-string` | `modules/builtin/48-mhc-type-weighted_pad_rent_monthly-string` | `verifier` | pass | pass |
| `modules/builtin/49-mhc-type-weighted_pad_rent_monthly-boolean` | `modules/builtin/49-mhc-type-weighted_pad_rent_monthly-boolean` | `verifier` | pass | pass |
| `modules/builtin/50-mhc-type-weighted_pad_rent_monthly-object` | `modules/builtin/50-mhc-type-weighted_pad_rent_monthly-object` | `verifier` | pass | pass |
| `modules/builtin/51-mhc-type-poh_home_rent_monthly-string` | `modules/builtin/51-mhc-type-poh_home_rent_monthly-string` | `verifier` | pass | pass |
| `modules/builtin/52-mhc-type-poh_home_rent_monthly-boolean` | `modules/builtin/52-mhc-type-poh_home_rent_monthly-boolean` | `verifier` | pass | pass |
| `modules/builtin/53-mhc-type-poh_home_rent_monthly-object` | `modules/builtin/53-mhc-type-poh_home_rent_monthly-object` | `verifier` | pass | pass |
| `modules/builtin/54-mhc-date-presence-only-impossible` | `modules/builtin/54-mhc-date-presence-only-impossible` | `verifier` | pass | pass |
| `modules/builtin/55-mhc-date-presence-only-malformed` | `modules/builtin/55-mhc-date-presence-only-malformed` | `verifier` | pass | pass |
| `modules/builtin/56-mhc-date-presence-only-non-string` | `modules/builtin/56-mhc-date-presence-only-non-string` | `verifier` | pass | pass |
| `modules/builtin/57-mhc-missing-standard-amounts` | `modules/builtin/57-mhc-missing-standard-amounts` | `verifier` | pass | pass |
| `modules/builtin/58-mhc-fallback` | `modules/builtin/58-mhc-fallback` | `verifier` | pass | pass |
| `modules/builtin/59-mhc-as-multifamily` | `modules/builtin/59-mhc-as-multifamily` | `verifier` | pass | pass |
| `modules/builtin/60-mhc-cent-rounding` | `modules/builtin/60-mhc-cent-rounding` | `verifier` | pass | pass |
| `modules/builtin/61-data-center-dependency-rounding` | `modules/builtin/61-data-center-dependency-rounding` | `verifier` | pass | pass |
| `modules/registry/01-section-unrelated` | `modules/registry/01-section-unrelated` | `module` | pass | pass |
| `modules/registry/02-calculation-unrelated` | `modules/registry/02-calculation-unrelated` | `module` | pass | pass |
| `modules/registry/03-view-model-unrelated` | `modules/registry/03-view-model-unrelated` | `module` | pass | pass |
| `modules/registry/04-sibling-dependents-unrelated` | `modules/registry/04-sibling-dependents-unrelated` | `module` | pass | pass |
| `modules/registry/05-dependent-pair-not-a-conflict` | `modules/registry/05-dependent-pair-not-a-conflict` | `module` | pass | pass |
| `modules/registry/06-section-override` | `modules/registry/06-section-override` | `module` | pass | pass |
| `modules/registry/07-calculation-override` | `modules/registry/07-calculation-override` | `module` | pass | pass |
| `modules/registry/08-view-model-override` | `modules/registry/08-view-model-override` | `module` | pass | pass |
| `modules/registry/09-override-dependency-later-reader-refused` | `modules/registry/09-override-dependency-later-reader-refused` | `module` | pass | pass |
| `modules/registry/10-override-sibling-reader-refused` | `modules/registry/10-override-sibling-reader-refused` | `module` | pass | pass |
| `modules/registry/11-override-reader-depends-on-overrider` | `modules/registry/11-override-reader-depends-on-overrider` | `module` | pass | pass |
| `modules/registry/12-override-scope-narrower-refused` | `modules/registry/12-override-scope-narrower-refused` | `module` | pass | pass |
| `modules/registry/13-override-scope-covering-allowed` | `modules/registry/13-override-scope-covering-allowed` | `module` | pass | pass |
| `modules/registry/14-override-reads-before-own-refused` | `modules/registry/14-override-reads-before-own-refused` | `module` | pass | pass |
| `modules/registry/15-unrelated-reader-refused` | `modules/registry/15-unrelated-reader-refused` | `module` | pass | pass |
| `modules/registry/16-transitive-only-pair-refused` | `modules/registry/16-transitive-only-pair-refused` | `module` | pass | pass |
| `modules/registry/17-override-text-not-a-read` | `modules/registry/17-override-text-not-a-read` | `module` | pass | pass |
| `modules/registry/18-override-scope-section-refused` | `modules/registry/18-override-scope-section-refused` | `module` | pass | pass |
| `modules/registry/19-override-scope-view-model-refused` | `modules/registry/19-override-scope-view-model-refused` | `module` | pass | pass |
| `modules/registry/20-override-self-read-refused` | `modules/registry/20-override-self-read-refused` | `module` | pass | pass |
| `modules/registry/21-chain-override-dependent-reader-refused` | `modules/registry/21-chain-override-dependent-reader-refused` | `module` | pass | pass |
| `modules/registry/22-override-past-current-owner-refused` | `modules/registry/22-override-past-current-owner-refused` | `module` | pass | pass |
| `modules/registry/23-first-declarer-earlier-reader-allowed` | `modules/registry/23-first-declarer-earlier-reader-allowed` | `module` | pass | pass |
| `modules/registry/24-override-scope-narrower-and-unscoped-refused` | `modules/registry/24-override-scope-narrower-and-unscoped-refused` | `module` | pass | pass |
| `modules/reject/01-unknown-top-level-key` | `modules/reject/01-unknown-top-level-key` | `module` | pass | pass |
| `modules/reject/01-unknown-top-level-key [schema-parity]` | `modules/reject/01-unknown-top-level-key [schema-parity]` | `module` | pass | pass |
| `modules/reject/02-agent-layer-malformed` | `modules/reject/02-agent-layer-malformed` | `module` | pass | pass |
| `modules/reject/02-agent-layer-malformed [schema-parity]` | `modules/reject/02-agent-layer-malformed [schema-parity]` | `module` | pass | pass |
| `modules/reject/03-view-model-malformed` | `modules/reject/03-view-model-malformed` | `module` | pass | pass |
| `modules/reject/03-view-model-malformed [schema-parity]` | `modules/reject/03-view-model-malformed [schema-parity]` | `module` | pass | pass |
| `modules/reject/04-section-malformed` | `modules/reject/04-section-malformed` | `module` | pass | pass |
| `modules/reject/04-section-malformed [schema-parity]` | `modules/reject/04-section-malformed [schema-parity]` | `module` | pass | pass |
| `modules/reject/05-id-too-short` | `modules/reject/05-id-too-short` | `module` | pass | pass |
| `modules/reject/05-id-too-short [schema-parity]` | `modules/reject/05-id-too-short [schema-parity]` | `module` | pass | pass |
| `modules/reject/06-calc-unknown-key` | `modules/reject/06-calc-unknown-key` | `module` | pass | pass |
| `modules/reject/06-calc-unknown-key [schema-parity]` | `modules/reject/06-calc-unknown-key [schema-parity]` | `module` | pass | pass |
| `modules/reject/07-depends-on-malformed` | `modules/reject/07-depends-on-malformed` | `module` | pass | pass |
| `modules/reject/07-depends-on-malformed [schema-parity]` | `modules/reject/07-depends-on-malformed [schema-parity]` | `module` | pass | pass |
| `modules/reject/08-nondeterministic-calc` | `modules/reject/08-nondeterministic-calc` | `module` | pass | pass |
| `modules/reject/08-nondeterministic-calc [schema-parity]` | `modules/reject/08-nondeterministic-calc [schema-parity]` | `module` | pass | pass |
| `modules/reject/09-unparseable-formula` | `modules/reject/09-unparseable-formula` | `module` | pass | pass |
| `modules/reject/09-unparseable-formula [schema-parity]` | `modules/reject/09-unparseable-formula [schema-parity]` | `module` | pass | pass |
| `modules/reject/10-calc-round-to-out-of-range` | `modules/reject/10-calc-round-to-out-of-range` | `module` | pass | pass |
| `modules/reject/10-calc-round-to-out-of-range [schema-parity]` | `modules/reject/10-calc-round-to-out-of-range [schema-parity]` | `module` | pass | pass |
| `modules/reject/11-calc-round-to-non-integer` | `modules/reject/11-calc-round-to-non-integer` | `module` | pass | pass |
| `modules/reject/11-calc-round-to-non-integer [schema-parity]` | `modules/reject/11-calc-round-to-non-integer [schema-parity]` | `module` | pass | pass |
| `modules/reject/12-asset-class-not-namespaced` | `modules/reject/12-asset-class-not-namespaced` | `module` | pass | pass |
| `modules/reject/12-asset-class-not-namespaced [schema-parity]` | `modules/reject/12-asset-class-not-namespaced [schema-parity]` | `module` | pass | pass |
| `modules/reject/13-asset-class-shadows-builtin` | `modules/reject/13-asset-class-shadows-builtin` | `module` | pass | pass |
| `modules/reject/13-asset-class-shadows-builtin [schema-parity]` | `modules/reject/13-asset-class-shadows-builtin [schema-parity]` | `module` | pass | pass |
| `modules/reject/14-asset-class-bad-fallback` | `modules/reject/14-asset-class-bad-fallback` | `module` | pass | pass |
| `modules/reject/14-asset-class-bad-fallback [schema-parity]` | `modules/reject/14-asset-class-bad-fallback [schema-parity]` | `module` | pass | pass |
| `modules/reject/15-asset-class-duplicate-id` | `modules/reject/15-asset-class-duplicate-id` | `module` | pass | pass |
| `modules/reject/15-asset-class-duplicate-id [schema-parity]` | `modules/reject/15-asset-class-duplicate-id [schema-parity]` | `module` | pass | pass |
| `modules/reject/16-retired-requires-tier` | `modules/reject/16-retired-requires-tier` | `module` | pass | pass |
| `modules/reject/16-retired-requires-tier [schema-parity]` | `modules/reject/16-retired-requires-tier [schema-parity]` | `module` | pass | pass |
| `modules/reject/17-requires-conformance-outside-vocabulary` | `modules/reject/17-requires-conformance-outside-vocabulary` | `module` | pass | pass |
| `modules/reject/17-requires-conformance-outside-vocabulary [schema-parity]` | `modules/reject/17-requires-conformance-outside-vocabulary [schema-parity]` | `module` | pass | pass |
| `modules/reject/18-requires-profiles-unknown` | `modules/reject/18-requires-profiles-unknown` | `module` | pass | pass |
| `modules/reject/18-requires-profiles-unknown [schema-parity]` | `modules/reject/18-requires-profiles-unknown [schema-parity]` | `module` | pass | pass |
| `modules/reject/19-host-below-requirements` | `modules/reject/19-host-below-requirements` | `module` | pass | pass |
| `modules/reject/19-host-below-requirements [schema-parity]` | `modules/reject/19-host-below-requirements [schema-parity]` | `module` | pass | pass |
| `packages/accept/01-valid-deal-with-note` | `packages/accept/01-valid-deal-with-note` | `representations` | pass | pass |
| `packages/accept/01-valid-deal-with-note [schema]` | `packages/accept/01-valid-deal-with-note [schema]` | `representations` | pass | pass |
| `packages/accept/02-extension-link-type` | `packages/accept/02-extension-link-type` | `representations` | pass | pass |
| `packages/accept/02-extension-link-type [schema]` | `packages/accept/02-extension-link-type [schema]` | `representations` | pass | pass |
| `packages/invariant/binary-roundtrip` | `packages/invariant/binary-roundtrip` | `representations` | pass | pass |
| `packages/invariant/context-omits-source-bytes` | `packages/invariant/context-omits-source-bytes` | `representations` | pass | pass |
| `packages/invariant/context-valid` | `packages/invariant/context-valid` | `representations` | pass | pass |
| `packages/invariant/deterministic-encoding` | `packages/invariant/deterministic-encoding` | `representations` | pass | pass |
| `packages/invariant/no-member-only-projection` | `packages/invariant/no-member-only-projection` | `starter-products` | pass | pass |
| `packages/invariant/verify-clean` | `packages/invariant/verify-clean` | `representations` | pass | pass |
| `packages/invariant/verify-tampered` | `packages/invariant/verify-tampered` | `representations` | pass | pass |
| `packages/reject/01-dangling-link` | `packages/reject/01-dangling-link` | `representations` | pass | pass |
| `packages/reject/02-duplicate-member-id` | `packages/reject/02-duplicate-member-id` | `representations` | pass | pass |
| `packages/reject/03-duplicate-path` | `packages/reject/03-duplicate-path` | `representations` | pass | pass |
| `packages/reject/04-zip-traversal-path` | `packages/reject/04-zip-traversal-path` | `representations` | pass | pass |
| `packages/reject/05-wrong-layer-edge` | `packages/reject/05-wrong-layer-edge` | `representations` | pass | pass |
| `packages/reject/06-bad-digest-format` | `packages/reject/06-bad-digest-format` | `representations` | pass | pass |
| `packages/reject/07-unknown-role` | `packages/reject/07-unknown-role` | `representations` | pass | pass |
| `portfolio-relationships/01-valid-multi-deal` | `portfolio-relationships/01-valid-multi-deal` | `portfolio` | pass | pass |
| `portfolio-relationships/02-missing-provenance` | `portfolio-relationships/02-missing-provenance` | `portfolio` | pass | pass |
| `portfolio-relationships/03-duplicate-id` | `portfolio-relationships/03-duplicate-id` | `portfolio` | pass | pass |
| `portfolio-relationships/04-dangling-edge` | `portfolio-relationships/04-dangling-edge` | `portfolio` | pass | pass |
| `portfolio-relationships/05-unknown-preservation` | `portfolio-relationships/05-unknown-preservation` | `portfolio` | pass | pass |
| `portfolio-relationships/06-wrong-layer` | `portfolio-relationships/06-wrong-layer` | `portfolio` | pass | pass |
| `portfolio-relationships/07-package-projection` | `portfolio-relationships/07-package-projection` | `portfolio` | pass | pass |
| `property-cash-flow-assembly/boundary-acquisition-equal` | `property-cash-flow-assembly/boundary-acquisition-equal` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-acquisition-outside` | `property-cash-flow-assembly/boundary-acquisition-outside` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-early-gross-sale` | `property-cash-flow-assembly/boundary-early-gross-sale` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-early-reserve-return` | `property-cash-flow-assembly/boundary-early-reserve-return` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-early-sale-cost` | `property-cash-flow-assembly/boundary-early-sale-cost` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-extra-coverage-cell` | `property-cash-flow-assembly/boundary-extra-coverage-cell` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-extra-mapping` | `property-cash-flow-assembly/boundary-extra-mapping` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-february-2027` | `property-cash-flow-assembly/boundary-february-2027` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-february-2028` | `property-cash-flow-assembly/boundary-february-2028` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-financing-tax` | `property-cash-flow-assembly/boundary-financing-tax` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-following-period` | `property-cash-flow-assembly/boundary-following-period` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-invalid-boolean` | `property-cash-flow-assembly/boundary-invalid-boolean` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-invalid-empty` | `property-cash-flow-assembly/boundary-invalid-empty` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-invalid-null` | `property-cash-flow-assembly/boundary-invalid-null` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-invalid-object` | `property-cash-flow-assembly/boundary-invalid-object` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-invalid-unknown` | `property-cash-flow-assembly/boundary-invalid-unknown` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-map-order` | `property-cash-flow-assembly/boundary-map-order` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-missing-reserve-coverage` | `property-cash-flow-assembly/boundary-missing-reserve-coverage` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-beyond` | `property-cash-flow-assembly/boundary-monthly-beyond` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-boundary` | `property-cash-flow-assembly/boundary-monthly-boundary` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-boundary-absent` | `property-cash-flow-assembly/boundary-monthly-boundary-absent` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-boundary-within_final_period` | `property-cash-flow-assembly/boundary-monthly-boundary-within_final_period` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-inside-absent` | `property-cash-flow-assembly/boundary-monthly-inside-absent` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-inside-allow_exclusive_end` | `property-cash-flow-assembly/boundary-monthly-inside-allow_exclusive_end` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-inside-within_final_period` | `property-cash-flow-assembly/boundary-monthly-inside-within_final_period` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-leading-year` | `property-cash-flow-assembly/boundary-monthly-leading-year` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-overflow-inside` | `property-cash-flow-assembly/boundary-monthly-overflow-inside` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-year-rollover` | `property-cash-flow-assembly/boundary-monthly-year-rollover` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-monthly-year-rollover-beyond` | `property-cash-flow-assembly/boundary-monthly-year-rollover-beyond` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-named-sale-deductions` | `property-cash-flow-assembly/boundary-named-sale-deductions` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-nested-option` | `property-cash-flow-assembly/boundary-nested-option` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-projected-after-sale` | `property-cash-flow-assembly/boundary-projected-after-sale` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-projected-before-acquisition` | `property-cash-flow-assembly/boundary-projected-before-acquisition` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-beyond` | `property-cash-flow-assembly/boundary-quarterly-beyond` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-boundary` | `property-cash-flow-assembly/boundary-quarterly-boundary` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-boundary-absent` | `property-cash-flow-assembly/boundary-quarterly-boundary-absent` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-boundary-within_final_period` | `property-cash-flow-assembly/boundary-quarterly-boundary-within_final_period` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-inside-absent` | `property-cash-flow-assembly/boundary-quarterly-inside-absent` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-inside-allow_exclusive_end` | `property-cash-flow-assembly/boundary-quarterly-inside-allow_exclusive_end` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-inside-within_final_period` | `property-cash-flow-assembly/boundary-quarterly-inside-within_final_period` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-leading-year` | `property-cash-flow-assembly/boundary-quarterly-leading-year` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-overflow-inside` | `property-cash-flow-assembly/boundary-quarterly-overflow-inside` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-year-rollover` | `property-cash-flow-assembly/boundary-quarterly-year-rollover` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-quarterly-year-rollover-beyond` | `property-cash-flow-assembly/boundary-quarterly-year-rollover-beyond` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-reserve-gross-sale` | `property-cash-flow-assembly/boundary-reserve-gross-sale` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-reserve-spending` | `property-cash-flow-assembly/boundary-reserve-spending` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-reserved-defeasance` | `property-cash-flow-assembly/boundary-reserved-defeasance` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-reserved-loan_payoff` | `property-cash-flow-assembly/boundary-reserved-loan_payoff` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-reserved-prepayment_penalty` | `property-cash-flow-assembly/boundary-reserved-prepayment_penalty` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-restricted-reserve` | `property-cash-flow-assembly/boundary-restricted-reserve` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-source-after-sale` | `property-cash-flow-assembly/boundary-source-after-sale` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-source-duplicate` | `property-cash-flow-assembly/boundary-source-duplicate` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-source-gap` | `property-cash-flow-assembly/boundary-source-gap` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-source-malformed` | `property-cash-flow-assembly/boundary-source-malformed` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-source-mixed` | `property-cash-flow-assembly/boundary-source-mixed` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-source-reordered` | `property-cash-flow-assembly/boundary-source-reordered` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-supplemental-after-sale` | `property-cash-flow-assembly/boundary-supplemental-after-sale` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-supplemental-before-acquisition` | `property-cash-flow-assembly/boundary-supplemental-before-acquisition` | `verifier` | pass | pass |
| `property-cash-flow-assembly/boundary-unknown-reserve-return` | `property-cash-flow-assembly/boundary-unknown-reserve-return` | `verifier` | pass | pass |
| `property-cash-flow-assembly/currency-mismatch` | `property-cash-flow-assembly/currency-mismatch` | `verifier` | pass | pass |
| `property-cash-flow-assembly/duplicate-row` | `property-cash-flow-assembly/duplicate-row` | `verifier` | pass | pass |
| `property-cash-flow-assembly/failed-lease-up` | `property-cash-flow-assembly/failed-lease-up` | `verifier` | pass | pass |
| `property-cash-flow-assembly/false-reserve-assertion` | `property-cash-flow-assembly/false-reserve-assertion` | `verifier` | pass | pass |
| `property-cash-flow-assembly/lease-up-overlap` | `property-cash-flow-assembly/lease-up-overlap` | `verifier` | pass | pass |
| `property-cash-flow-assembly/missing-coverage` | `property-cash-flow-assembly/missing-coverage` | `verifier` | pass | pass |
| `property-cash-flow-assembly/null-expense` | `property-cash-flow-assembly/null-expense` | `verifier` | pass | pass |
| `property-cash-flow-assembly/positive-expense` | `property-cash-flow-assembly/positive-expense` | `verifier` | pass | pass |
| `property-cash-flow-assembly/post-sale-cash` | `property-cash-flow-assembly/post-sale-cash` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-duplicate-sale-deduction-row` | `property-cash-flow-assembly/reject-duplicate-sale-deduction-row` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-label-on-named-deduction` | `property-cash-flow-assembly/reject-label-on-named-deduction` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-net-proceeds-off-by-a-cent` | `property-cash-flow-assembly/reject-net-proceeds-off-by-a-cent` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-other-without-label` | `property-cash-flow-assembly/reject-other-without-label` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-partial-sale-deduction-naming` | `property-cash-flow-assembly/reject-partial-sale-deduction-naming` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-reserved-defeasance` | `property-cash-flow-assembly/reject-reserved-defeasance` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-reserved-levered-deduction` | `property-cash-flow-assembly/reject-reserved-levered-deduction` | `verifier` | pass | pass |
| `property-cash-flow-assembly/reject-sale-deduction-outside-cell` | `property-cash-flow-assembly/reject-sale-deduction-outside-cell` | `verifier` | pass | pass |
| `property-cash-flow-assembly/unverifiable-lease-up` | `property-cash-flow-assembly/unverifiable-lease-up` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-map-order` | `property-cash-flow-assembly/valid-map-order` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-monthly-leap` | `property-cash-flow-assembly/valid-monthly-leap` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-named-sale-deductions` | `property-cash-flow-assembly/valid-named-sale-deductions` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-no-reserves` | `property-cash-flow-assembly/valid-no-reserves` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-other-sale-deduction` | `property-cash-flow-assembly/valid-other-sale-deduction` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-quarterly` | `property-cash-flow-assembly/valid-quarterly` | `verifier` | pass | pass |
| `property-cash-flow-assembly/valid-same-day` | `property-cash-flow-assembly/valid-same-day` | `verifier` | pass | pass |
| `property-cash-flow-assembly/wrong-variant` | `property-cash-flow-assembly/wrong-variant` | `verifier` | pass | pass |
| `receipts/issue/01-uwx-multifamily` | `receipts/issue/01-uwx-multifamily` | `starter-products` | pass | pass |
| `receipts/issue/01-uwx-multifamily [re-issuance stable]` | `receipts/issue/01-uwx-multifamily [re-issuance stable]` | `starter-products` | pass | pass |
| `receipts/issue/02-lite-industrial` | `receipts/issue/02-lite-industrial` | `starter-products` | pass | pass |
| `receipts/issue/02-lite-industrial [re-issuance stable]` | `receipts/issue/02-lite-industrial [re-issuance stable]` | `starter-products` | pass | pass |
| `receipts/refuse/01-lite-parse-errors` | `receipts/refuse/01-lite-parse-errors` | `starter-products` | pass | pass |
| `receipts/refuse/02-no-pack-for-asset-class` | `receipts/refuse/02-no-pack-for-asset-class` | `starter-products` | pass | pass |
| `receipts/verify/01-clean` | `receipts/verify/01-clean` | `verifier` | pass | pass |
| `receipts/verify/02-record-mutated` | `receipts/verify/02-record-mutated` | `verifier` | pass | pass |
| `receipts/verify/03-result-disagrees` | `receipts/verify/03-result-disagrees` | `verifier` | pass | pass |
| `receipts/verify/04-unknown-pack` | `receipts/verify/04-unknown-pack` | `verifier` | pass | pass |
| `receipts/verify/05-signed-no-backend` | `receipts/verify/05-signed-no-backend` | `verifier` | pass | pass |
| `receipts/verify/06-lite-canonicalization-superseded` | `receipts/verify/06-lite-canonicalization-superseded` | `verifier` | pass | pass |
| `receipts/verify/07-market-data-absent` | `receipts/verify/07-market-data-absent` | `verifier` | pass | pass |
| `receipts/verify/08-market-data-mutated` | `receipts/verify/08-market-data-mutated` | `verifier` | pass | pass |
| `receipts/verify/09-multifamily-old-pack-version` | `receipts/verify/09-multifamily-old-pack-version` | `verifier` | pass | pass |
| `receipts/verify/10-rehashed-one-cent` | `receipts/verify/10-rehashed-one-cent` | `verifier` | pass | pass |
| `receipts/verify/11-rehashed-subquantum-ratio` | `receipts/verify/11-rehashed-subquantum-ratio` | `verifier` | pass | pass |
| `receipts/verify/12-receipt-version-1-0` | `receipts/verify/12-receipt-version-1-0` | `verifier` | pass | pass |
| `recoveries/accept-legacy-cam-cap-alone` | `recoveries/accept-legacy-cam-cap-alone` | `verifier` | pass | pass |
| `recoveries/accept-no-recovery-stated` | `recoveries/accept-no-recovery-stated` | `verifier` | pass | pass |
| `recoveries/accept-recovery-true-up` | `recoveries/accept-recovery-true-up` | `verifier` | pass | pass |
| `recoveries/accept-true-up-lands-in-cash-flows` | `recoveries/accept-true-up-lands-in-cash-flows` | `verifier` | pass | pass |
| `recoveries/reject-cap-without-accumulation` | `recoveries/reject-cap-without-accumulation` | `verifier` | pass | pass |
| `recoveries/reject-capped-above-uncapped` | `recoveries/reject-capped-above-uncapped` | `verifier` | pass | pass |
| `recoveries/reject-cash-flow-ref-dangling` | `recoveries/reject-cash-flow-ref-dangling` | `verifier` | pass | pass |
| `recoveries/reject-member-without-method` | `recoveries/reject-member-without-method` | `verifier` | pass | pass |
| `recoveries/reject-method-without-input` | `recoveries/reject-method-without-input` | `verifier` | pass | pass |
| `recoveries/reject-pool-names-no-expense` | `recoveries/reject-pool-names-no-expense` | `verifier` | pass | pass |
| `recoveries/reject-pool-names-the-total` | `recoveries/reject-pool-names-the-total` | `verifier` | pass | pass |
| `recoveries/reject-share-as-percent` | `recoveries/reject-share-as-percent` | `verifier` | pass | pass |
| `recoveries/reject-share-disagrees-with-pool` | `recoveries/reject-share-disagrees-with-pool` | `verifier` | pass | pass |
| `recoveries/reject-true-up-not-capped-less-billed` | `recoveries/reject-true-up-not-capped-less-billed` | `verifier` | pass | pass |
| `recoveries/reject-true-up-period-inverted` | `recoveries/reject-true-up-period-inverted` | `verifier` | pass | pass |
| `recoveries/reject-true-up-period-open` | `recoveries/reject-true-up-period-open` | `verifier` | pass | pass |
| `reserve-accounts/absent` | `reserve-accounts/absent` | `verifier` | pass | pass |
| `reserve-accounts/balance-mismatch` | `reserve-accounts/balance-mismatch` | `verifier` | pass | pass |
| `reserve-accounts/bank-interest` | `reserve-accounts/bank-interest` | `verifier` | pass | pass |
| `reserve-accounts/broken-continuity` | `reserve-accounts/broken-continuity` | `verifier` | pass | pass |
| `reserve-accounts/currency-disagrees` | `reserve-accounts/currency-disagrees` | `verifier` | pass | pass |
| `reserve-accounts/duplicate-account` | `reserve-accounts/duplicate-account` | `verifier` | pass | pass |
| `reserve-accounts/duplicate-movement` | `reserve-accounts/duplicate-movement` | `verifier` | pass | pass |
| `reserve-accounts/duplicate-period` | `reserve-accounts/duplicate-period` | `verifier` | pass | pass |
| `reserve-accounts/empty-explicit-movements` | `reserve-accounts/empty-explicit-movements` | `verifier` | pass | pass |
| `reserve-accounts/half-away-mismatch` | `reserve-accounts/half-away-mismatch` | `verifier` | pass | pass |
| `reserve-accounts/invalid-date` | `reserve-accounts/invalid-date` | `verifier` | pass | pass |
| `reserve-accounts/large-cent-draw-contribution` | `reserve-accounts/large-cent-draw-contribution` | `verifier` | pass | pass |
| `reserve-accounts/large-cent-multiple-contributions` | `reserve-accounts/large-cent-multiple-contributions` | `verifier` | pass | pass |
| `reserve-accounts/large-cent-one-cent-mismatch` | `reserve-accounts/large-cent-one-cent-mismatch` | `verifier` | pass | pass |
| `reserve-accounts/legacy-v1` | `reserve-accounts/bare-block` | `verifier` | pass | pass |
| `reserve-accounts/lender-reserve` | `reserve-accounts/lender-reserve` | `verifier` | pass | pass |
| `reserve-accounts/missing-movements` | `reserve-accounts/missing-movements` | `verifier` | pass | pass |
| `reserve-accounts/missing-source` | `reserve-accounts/missing-source` | `verifier` | pass | pass |
| `reserve-accounts/negative-movement` | `reserve-accounts/negative-movement` | `verifier` | pass | pass |
| `reserve-accounts/overflow` | `reserve-accounts/overflow` | `verifier` | pass | pass |
| `reserve-accounts/overflow-then-finite-periods` | `reserve-accounts/overflow-then-finite-periods` | `verifier` | pass | pass |
| `reserve-accounts/quantum-equal` | `reserve-accounts/quantum-equal` | `verifier` | pass | pass |
| `reserve-accounts/unclassified` | `reserve-accounts/unclassified` | `verifier` | pass | pass |
| `reserve-accounts/unknown-field` | `reserve-accounts/unknown-field` | `verifier` | pass | pass |
| `reserve-accounts/unordered-movements` | `reserve-accounts/unordered-movements` | `verifier` | pass | pass |
| `reserve-accounts/unordered-periods` | `reserve-accounts/unordered-periods` | `verifier` | pass | pass |
| `reserve-accounts/verified-source-classes` | `reserve-accounts/verified-source-classes` | `verifier` | pass | pass |
| `reserve-accounts/wrong-previous-period` | `reserve-accounts/wrong-previous-period` | `verifier` | pass | pass |
| `reserve-draw-bindings/absent` | `reserve-draw-bindings/absent` | `verifier` | pass | pass |
| `reserve-draw-bindings/ambiguous-net-row` | `reserve-draw-bindings/ambiguous-net-row` | `verifier` | pass | pass |
| `reserve-draw-bindings/cent-multiple-draws` | `reserve-draw-bindings/cent-multiple-draws` | `verifier` | pass | pass |
| `reserve-draw-bindings/cent-one-cent-share` | `reserve-draw-bindings/cent-one-cent-share` | `verifier` | pass | pass |
| `reserve-draw-bindings/cent-one-cent-unallocated` | `reserve-draw-bindings/cent-one-cent-unallocated` | `verifier` | pass | pass |
| `reserve-draw-bindings/cent-split-draw` | `reserve-draw-bindings/cent-split-draw` | `verifier` | pass | pass |
| `reserve-draw-bindings/closed-plan` | `reserve-draw-bindings/closed-plan` | `verifier` | pass | pass |
| `reserve-draw-bindings/duplicate-edge` | `reserve-draw-bindings/duplicate-edge` | `verifier` | pass | pass |
| `reserve-draw-bindings/duplicate-selected-draw` | `reserve-draw-bindings/duplicate-selected-draw` | `verifier` | pass | pass |
| `reserve-draw-bindings/duplicate-source-row` | `reserve-draw-bindings/duplicate-source-row` | `verifier` | pass | pass |
| `reserve-draw-bindings/excess-draw-allocation` | `reserve-draw-bindings/excess-draw-allocation` | `verifier` | pass | pass |
| `reserve-draw-bindings/external-release` | `reserve-draw-bindings/external-release` | `verifier` | pass | pass |
| `reserve-draw-bindings/funded-share-disagrees` | `reserve-draw-bindings/funded-share-disagrees` | `verifier` | pass | pass |
| `reserve-draw-bindings/incomplete-draw` | `reserve-draw-bindings/incomplete-draw` | `verifier` | pass | pass |
| `reserve-draw-bindings/invalid-source-date` | `reserve-draw-bindings/invalid-source-date` | `verifier` | pass | pass |
| `reserve-draw-bindings/lease-up-component` | `reserve-draw-bindings/lease-up-component` | `verifier` | pass | pass |
| `reserve-draw-bindings/legacy-v1` | `reserve-draw-bindings/bare-block` | `verifier` | pass | pass |
| `reserve-draw-bindings/lender-reserve` | `reserve-draw-bindings/lender-reserve` | `verifier` | pass | pass |
| `reserve-draw-bindings/many-to-many-partial` | `reserve-draw-bindings/many-to-many-partial` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-account` | `reserve-draw-bindings/missing-account` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-completeness` | `reserve-draw-bindings/missing-completeness` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-expenditure-row` | `reserve-draw-bindings/missing-expenditure-row` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-movement` | `reserve-draw-bindings/missing-movement` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-period` | `reserve-draw-bindings/missing-period` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-reserve-variant` | `reserve-draw-bindings/missing-reserve-variant` | `verifier` | pass | pass |
| `reserve-draw-bindings/missing-source` | `reserve-draw-bindings/missing-source` | `verifier` | pass | pass |
| `reserve-draw-bindings/nonfinite-allocation` | `reserve-draw-bindings/nonfinite-allocation` | `verifier` | pass | pass |
| `reserve-draw-bindings/null-plan` | `reserve-draw-bindings/null-plan` | `verifier` | pass | pass |
| `reserve-draw-bindings/one-to-one` | `reserve-draw-bindings/one-to-one` | `verifier` | pass | pass |
| `reserve-draw-bindings/operating-expense` | `reserve-draw-bindings/operating-expense` | `verifier` | pass | pass |
| `reserve-draw-bindings/overbinding-gross` | `reserve-draw-bindings/overbinding-gross` | `verifier` | pass | pass |
| `reserve-draw-bindings/partial-expenditure` | `reserve-draw-bindings/partial-expenditure` | `verifier` | pass | pass |
| `reserve-draw-bindings/reserve-balance-mismatch` | `reserve-draw-bindings/reserve-balance-mismatch` | `verifier` | pass | pass |
| `reserve-draw-bindings/same-day-identities` | `reserve-draw-bindings/same-day-identities` | `verifier` | pass | pass |
| `reserve-draw-bindings/split-draw` | `reserve-draw-bindings/split-draw` | `verifier` | pass | pass |
| `reserve-draw-bindings/stale-digest` | `reserve-draw-bindings/stale-digest` | `verifier` | pass | pass |
| `reserve-draw-bindings/stated-final-boundary` | `reserve-draw-bindings/stated-final-boundary` | `verifier` | pass | pass |
| `reserve-draw-bindings/subcent-allocation` | `reserve-draw-bindings/subcent-allocation` | `verifier` | pass | pass |
| `reserve-draw-bindings/superseded-source` | `reserve-draw-bindings/superseded-source` | `verifier` | pass | pass |
| `reserve-draw-bindings/unbound-selected-draw` | `reserve-draw-bindings/unbound-selected-draw` | `verifier` | pass | pass |
| `reserve-draw-bindings/unclassified-movement` | `reserve-draw-bindings/unclassified-movement` | `verifier` | pass | pass |
| `reserve-draw-bindings/undeclared-draw-edge` | `reserve-draw-bindings/undeclared-draw-edge` | `verifier` | pass | pass |
| `reserve-draw-bindings/wrong-category` | `reserve-draw-bindings/wrong-category` | `verifier` | pass | pass |
| `reserve-draw-bindings/wrong-currency` | `reserve-draw-bindings/wrong-currency` | `verifier` | pass | pass |
| `reserve-draw-bindings/wrong-expenditure-variant` | `reserve-draw-bindings/wrong-expenditure-variant` | `verifier` | pass | pass |
| `reserve-draw-bindings/wrong-gross-sign` | `reserve-draw-bindings/wrong-gross-sign` | `verifier` | pass | pass |
| `scenario/01-stabilized_acquisition` | `scenario/01-stabilized_acquisition` | `verifier` | pass | pass |
| `scenario/02-ground_up_development` | `scenario/02-ground_up_development` | `verifier` | pass | pass |
| `scenario/03-value_add` | `scenario/03-value_add` | `verifier` | pass | pass |
| `scenario/04-lease_up` | `scenario/04-lease_up` | `verifier` | pass | pass |
| `scenario/05-house_flip` | `scenario/05-house_flip` | `verifier` | pass | pass |
| `scenario/06-commercial_flip` | `scenario/06-commercial_flip` | `verifier` | pass | pass |
| `scenario/07-property_conversion` | `scenario/07-property_conversion` | `verifier` | pass | pass |
| `scenario/08-land_banking` | `scenario/08-land_banking` | `verifier` | pass | pass |
| `scenario/09-absent` | `scenario/09-absent` | `verifier` | pass | pass |
| `scenario/10-null` | `scenario/10-null` | `verifier` | pass | pass |
| `scenario/11-unlisted` | `scenario/11-unlisted` | `verifier` | pass | pass |
| `scenario/12-retired-build_to_rent` | `scenario/12-retired-build_to_rent` | `verifier` | pass | pass |
| `scenario/13-retired-nnn_single_tenant` | `scenario/13-retired-nnn_single_tenant` | `verifier` | pass | pass |
| `scenario/14-retired-lihtc_section8` | `scenario/14-retired-lihtc_section8` | `verifier` | pass | pass |
| `scenario/15-retired-distressed_reo` | `scenario/15-retired-distressed_reo` | `verifier` | pass | pass |
| `scenario/16-namespaced` | `scenario/16-namespaced` | `verifier` | pass | pass |
| `scenario/17-malformed-namespace` | `scenario/17-malformed-namespace` | `verifier` | pass | pass |
| `scenario/18-non-string` | `scenario/18-non-string` | `verifier` | pass | pass |
| `scenario/19-btr-fallback` | `scenario/19-btr-fallback` | `verifier` | pass | pass |
| `scenario/20-btr-carrier-conflict` | `scenario/20-btr-carrier-conflict` | `verifier` | pass | pass |
| `scenario/21-btr-class-scope` | `scenario/21-btr-class-scope` | `verifier` | pass | pass |
| `scenario/22-free-subtypes` | `scenario/22-free-subtypes` | `verifier` | pass | pass |
| `scenario/23-btr-reverse-conflict` | `scenario/23-btr-reverse-conflict` | `verifier` | pass | pass |
| `sensitivity/01-exit-value-grid` | `sensitivity/01-exit-value-grid` | `sensitivity` | pass | pass |
| `sensitivity/02-error-cell` | `sensitivity/02-error-cell` | `sensitivity` | pass | pass |
| `sensitivity/03-document-unchanged` | `sensitivity/03-document-unchanged` | `sensitivity` | pass | pass |
| `sensitivity/04-refuse-same-variable` | `sensitivity/04-refuse-same-variable` | `sensitivity` | pass | pass |
| `sensitivity/05-refuse-over-cell-limit` | `sensitivity/05-refuse-over-cell-limit` | `sensitivity` | pass | pass |
| `signing/blocks/01-signed-valid` | `signing/blocks/01-signed-valid` | `integrity` | pass | pass |
| `signing/blocks/02-signed-tampered` | `signing/blocks/02-signed-tampered` | `integrity` | pass | pass |
| `signing/blocks/03-signed-unknown-kid` | `signing/blocks/03-signed-unknown-kid` | `integrity` | pass | pass |
| `signing/blocks/04-signed-no-hash` | `signing/blocks/04-signed-no-hash` | `integrity` | pass | pass |
| `signing/blocks/05-signed-no-backend` | `signing/blocks/05-signed-no-backend` | `integrity` | pass | pass |
| `signing/blocks/06-meta-edited-after-signing` | `signing/blocks/06-meta-edited-after-signing` | `integrity` | pass | pass |
| `signing/blocks/present-count is backend-independent` | `signing/blocks/present-count is backend-independent` | `integrity` | pass | pass |
| `signing/modules/01-valid` | `signing/modules/01-valid` | `integrity` | pass | pass |
| `signing/modules/02-tampered` | `signing/modules/02-tampered` | `integrity` | pass | pass |
| `signing/modules/03-unknown-kid` | `signing/modules/03-unknown-kid` | `integrity` | pass | pass |
| `signing/modules/04-unsigned` | `signing/modules/04-unsigned` | `integrity` | pass | pass |
| `signing/modules/05-unsupported-scheme` | `signing/modules/05-unsupported-scheme` | `integrity` | pass | pass |
| `signing/modules/06-malformed` | `signing/modules/06-malformed` | `integrity` | pass | pass |
| `size-intensive/cc-13-silent-for-mixed-use` | `size-intensive/cc-13-silent-for-mixed-use` | `verifier` | pass | pass |
| `size-intensive/cc-13-warns-and-does-not-refuse` | `size-intensive/cc-13-warns-and-does-not-refuse` | `starter-products` | pass | pass |
| `size-intensive/csv-exports-size-for-every-class` | `size-intensive/csv-exports-size-for-every-class` | `starter-products` | pass | pass |
| `size-intensive/lite-round-trip-non-multifamily` | `size-intensive/lite-round-trip-non-multifamily` | `starter-products` | pass | pass |
| `size-intensive/pack-agreement` | `size-intensive/pack-agreement` | `starter-products` | pass | pass |
| `size-intensive/registry-covers-every-class` | `size-intensive/registry-covers-every-class` | `verifier` | pass | pass |
| `size-intensive/report-cover-states-size` | `size-intensive/report-cover-states-size` | `starter-products` | pass | pass |
| `source/01-actor-and-resolution` | `source/01-actor-and-resolution` | `verifier` | pass | pass |
| `source/02-legacy-tag-in-source` | `source/02-legacy-tag-in-source` | `verifier` | pass | pass |
| `source/03-unmatched-supersedes` | `source/03-unmatched-supersedes` | `starter-products` | pass | pass |
| `source/04-colon-form-rejected` | `source/04-colon-form-rejected` | `starter-products` | pass | pass |
| `source/04-colon-form-rejected [validate]` | `source/04-colon-form-rejected [validate]` | `verifier` | pass | pass |
| `source/05-custom-policies-no-catchall` | `source/05-custom-policies-no-catchall` | `starter-products` | pass | pass |
| `standalone/composition/inline-external-canonical` | `standalone/composition/inline-external-canonical` | `representations` | pass | pass |
| `standalone/composition/inline-external-digest` | `standalone/composition/inline-external-digest` | `representations` | pass | pass |
| `standalone/fragments/standalone-parse` | `standalone/fragments/standalone-parse` | `representations` | pass | pass |
| `standalone/lease-abstract/api-shape` | `standalone/lease-abstract/api-shape` | `representations` | pass | pass |
| `standalone/package/context-boundary` | `standalone/package/context-boundary` | `representations` | pass | pass |
| `standalone/package/integrity` | `standalone/package/integrity` | `representations` | pass | pass |
| `standalone/package/manifest` | `standalone/package/manifest` | `representations` | pass | pass |
| `standalone/profiles/externalized-deal` | `standalone/profiles/externalized-deal` | `representations` | pass | pass |
| `standalone/profiles/inline-deal` | `standalone/profiles/inline-deal` | `representations` | pass | pass |
| `standalone/profiles/lease-abstract-v1` | `standalone/profiles/lease-abstract-v1` | `representations` | pass | pass |
| `standalone/profiles/source-note-v1` | `standalone/profiles/source-note-v1` | `representations` | pass | pass |
| `stochastic/01-uniform-determinism` | `stochastic/01-uniform-determinism` | `stochastic` | pass | pass |
| `stochastic/02-different-seed-differs` | `stochastic/02-different-seed-differs` | `stochastic` | pass | pass |
| `stochastic/02-different-seed-differs [differs from 01-uniform-determinism]` | `stochastic/02-different-seed-differs [differs from 01-uniform-determinism]` | `stochastic` | pass | pass |
| `stochastic/03-triangular-from-default-ranges` | `stochastic/03-triangular-from-default-ranges` | `stochastic` | pass | pass |
| `stochastic/04-normal-is-not-bit-exact` | `stochastic/04-normal-is-not-bit-exact` | `stochastic` | pass | pass |
| `stochastic/05-refuse-missing-seed` | `stochastic/05-refuse-missing-seed` | `stochastic` | pass | pass |
| `stochastic/06-refuse-no-random-inputs` | `stochastic/06-refuse-no-random-inputs` | `stochastic` | pass | pass |
| `tax/reject-abated-above-full` | `tax/reject-abated-above-full` | `verifier` | pass | pass |
| `tax/reject-assessed-value` | `tax/reject-assessed-value` | `verifier` | pass | pass |
| `tax/reject-attributes-without-group` | `tax/reject-attributes-without-group` | `verifier` | pass | pass |
| `tax/reject-duplicate-period` | `tax/reject-duplicate-period` | `verifier` | pass | pass |
| `tax/reject-freeze-decreasing` | `tax/reject-freeze-decreasing` | `verifier` | pass | pass |
| `tax/reject-indicated-tax-off-by-a-cent` | `tax/reject-indicated-tax-off-by-a-cent` | `verifier` | pass | pass |
| `tax/reject-mixed-period-granularity` | `tax/reject-mixed-period-granularity` | `verifier` | pass | pass |
| `tax/reject-partial-assessment-group` | `tax/reject-partial-assessment-group` | `verifier` | pass | pass |
| `tax/reject-ratio-without-basis` | `tax/reject-ratio-without-basis` | `verifier` | pass | pass |
| `tax/reject-stabilized-mismatch` | `tax/reject-stabilized-mismatch` | `verifier` | pass | pass |
| `tax/reject-terminal-missing-in-exit-noi` | `tax/reject-terminal-missing-in-exit-noi` | `verifier` | pass | pass |
| `tax/reject-terminal-uses-going-in-basis` | `tax/reject-terminal-uses-going-in-basis` | `verifier` | pass | pass |
| `tax/reject-undeclared-rounding` | `tax/reject-undeclared-rounding` | `verifier` | pass | pass |
| `tax/reject-unknown-trigger` | `tax/reject-unknown-trigger` | `verifier` | pass | pass |
| `tax/valid-abatement-phase-in` | `tax/valid-abatement-phase-in` | `verifier` | pass | pass |
| `tax/valid-holding-years-order-numerically` | `tax/valid-holding-years-order-numerically` | `verifier` | pass | pass |
| `tax/valid-legacy-prose-only` | `tax/valid-legacy-prose-only` | `verifier` | pass | pass |
| `tax/valid-terminal-explained-difference` | `tax/valid-terminal-explained-difference` | `verifier` | pass | pass |
| `tax/valid-terminal-ties-to-exit` | `tax/valid-terminal-ties-to-exit` | `verifier` | pass | pass |
| `tax/valid-trigger-only` | `tax/valid-trigger-only` | `verifier` | pass | pass |
| `tax/valid-typed-basis` | `tax/valid-typed-basis` | `verifier` | pass | pass |
| `waterfall/reject-capped-final-split` | `waterfall/reject-capped-final-split` | `verifier` | pass | pass |
| `waterfall/reject-clawback-cap-not-promote-received` | `waterfall/reject-clawback-cap-not-promote-received` | `verifier` | pass | pass |
| `waterfall/reject-clawback-floor-rate-as-percent` | `waterfall/reject-clawback-floor-rate-as-percent` | `verifier` | pass | pass |
| `waterfall/reject-clawback-irr-floor-without-rate` | `waterfall/reject-clawback-irr-floor-without-rate` | `verifier` | pass | pass |
| `waterfall/reject-clawback-preferred-shortfall-without-pref` | `waterfall/reject-clawback-preferred-shortfall-without-pref` | `verifier` | pass | pass |
| `waterfall/reject-clawback-tax-rate-as-percent` | `waterfall/reject-clawback-tax-rate-as-percent` | `verifier` | pass | pass |
| `waterfall/reject-clawback-unknown-basis` | `waterfall/reject-clawback-unknown-basis` | `verifier` | pass | pass |
| `waterfall/reject-dangling-ref` | `waterfall/reject-dangling-ref` | `verifier` | pass | pass |
| `waterfall/reject-gp-share-le-target` | `waterfall/reject-gp-share-le-target` | `verifier` | pass | pass |
| `waterfall/reject-hurdle-mode-single-hurdle` | `waterfall/reject-hurdle-mode-single-hurdle` | `verifier` | pass | pass |
| `waterfall/reject-irr-hurdle-lp-share-zero` | `waterfall/reject-irr-hurdle-lp-share-zero` | `verifier` | pass | pass |
| `waterfall/reject-irr-hurdle-non-increasing` | `waterfall/reject-irr-hurdle-non-increasing` | `verifier` | pass | pass |
| `waterfall/reject-irr-hurdle-on-final-split` | `waterfall/reject-irr-hurdle-on-final-split` | `verifier` | pass | pass |
| `waterfall/reject-irr-hurdle-out-of-range` | `waterfall/reject-irr-hurdle-out-of-range` | `verifier` | pass | pass |
| `waterfall/reject-no-capital` | `waterfall/reject-no-capital` | `verifier` | pass | pass |
| `waterfall/reject-out-of-order` | `waterfall/reject-out-of-order` | `verifier` | pass | pass |
| `waterfall/verify-classic-outcomes` | `waterfall/verify-classic-outcomes` | `verifier` | pass | pass |
| `waterfall/verify-classic-schedule` | `waterfall/verify-classic-schedule` | `verifier` | pass | pass |
| `waterfall/verify-clawback-absent` | `waterfall/verify-clawback-absent` | `verifier` | pass | pass |
| `waterfall/verify-clawback-amount-disagrees` | `waterfall/verify-clawback-amount-disagrees` | `verifier` | pass | pass |
| `waterfall/verify-clawback-capped-at-promote` | `waterfall/verify-clawback-capped-at-promote` | `verifier` | pass | pass |
| `waterfall/verify-clawback-em-floor` | `waterfall/verify-clawback-em-floor` | `verifier` | pass | pass |
| `waterfall/verify-clawback-irr-floor-already-met` | `waterfall/verify-clawback-irr-floor-already-met` | `verifier` | pass | pass |
| `waterfall/verify-clawback-net-of-tax` | `waterfall/verify-clawback-net-of-tax` | `verifier` | pass | pass |
| `waterfall/verify-clawback-preferred-shortfall-zero` | `waterfall/verify-clawback-preferred-shortfall-zero` | `verifier` | pass | pass |
| `waterfall/verify-clawback-stated-without-provision` | `waterfall/verify-clawback-stated-without-provision` | `verifier` | pass | pass |
| `waterfall/verify-combined-hurdles-any-mode` | `waterfall/verify-combined-hurdles-any-mode` | `verifier` | pass | pass |
| `waterfall/verify-combined-hurdles-em-binds` | `waterfall/verify-combined-hurdles-em-binds` | `verifier` | pass | pass |
| `waterfall/verify-combined-hurdles-irr-binds` | `waterfall/verify-combined-hurdles-irr-binds` | `verifier` | pass | pass |
| `waterfall/verify-compound-pref` | `waterfall/verify-compound-pref` | `verifier` | pass | pass |
| `waterfall/verify-compound-pref-then-irr` | `waterfall/verify-compound-pref-then-irr` | `verifier` | pass | pass |
| `waterfall/verify-em-hurdle-boundary` | `waterfall/verify-em-hurdle-boundary` | `verifier` | pass | pass |
| `waterfall/verify-irr-hurdle-already-met` | `waterfall/verify-irr-hurdle-already-met` | `verifier` | pass | pass |
| `waterfall/verify-irr-hurdle-boundary` | `waterfall/verify-irr-hurdle-boundary` | `verifier` | pass | pass |
| `waterfall/verify-irr-hurdle-crossing` | `waterfall/verify-irr-hurdle-crossing` | `verifier` | pass | pass |
| `waterfall/verify-irr-hurdle-interleaved-call` | `waterfall/verify-irr-hurdle-interleaved-call` | `verifier` | pass | pass |
| `waterfall/verify-irr-ladder` | `waterfall/verify-irr-ladder` | `verifier` | pass | pass |
| `waterfall/verify-moic-no-contributions` | `waterfall/verify-moic-no-contributions` | `verifier` | pass | pass |
| `waterfall/verify-no-catchup` | `waterfall/verify-no-catchup` | `verifier` | pass | pass |
| `waterfall/verify-promote-overstated` | `waterfall/verify-promote-overstated` | `verifier` | pass | pass |
| `waterfall/verify-unresolvable-series` | `waterfall/verify-unresolvable-series` | `verifier` | pass | pass |
| `waterfall/warn-clawback-without-distribution` | `waterfall/warn-clawback-without-distribution` | `verifier` | pass | pass |

</details>

<details>
<summary>All 336 portable case mappings</summary>

| Old id | New id | Owner | Before | After |
|---|---|---|---|---|
| `module/tier-3/revpar-basic` | `module__calc__revpar-basic__calc` | `module` | pass | pass |
| `reader/tier-1/01-minimal-screening/parse` | `reader__documents__01-minimal-screening__parse` | `reader` | pass | pass |
| `reader/tier-1/02-full-multifamily/parse` | `reader__documents__02-full-multifamily__parse` | `reader` | pass | pass |
| `reader/tier-1/04-scope-only/parse` | `reader__documents__04-scope-only__parse` | `reader` | pass | pass |
| `reader/tier-1/05-land-stage-overlay/parse` | `reader__documents__05-land-stage-overlay__parse` | `reader` | pass | pass |
| `reader/tier-1/06-mixed-use-stage-overlay/parse` | `reader__documents__06-mixed-use-stage-overlay__parse` | `reader` | pass | pass |
| `reader/tier-1/07-stage-overlay-control/parse` | `reader__documents__07-stage-overlay-control__parse` | `reader` | pass | pass |
| `reader/tier-1/08-variant-cross-checks/parse` | `reader__documents__08-variant-cross-checks__parse` | `reader` | pass | pass |
| `reader/tier-1/09-returns-tax-basis/parse` | `reader__documents__09-returns-tax-basis__parse` | `reader` | pass | pass |
| `reader/tier-1/10-declared-roles/parse` | `reader__documents__10-declared-roles__parse` | `reader` | pass | pass |
| `reader/tier-1/11-role-collision/parse` | `reader__documents__11-role-collision__parse` | `reader` | pass | pass |
| `reader/tier-1/12-role-eligibility/parse` | `reader__documents__12-role-eligibility__parse` | `reader` | pass | pass |
| `reader/tier-1/13-period-identities/parse` | `reader__documents__13-period-identities__parse` | `reader` | pass | pass |
| `reader/tier-1/14-student-bed-counts/parse` | `reader__documents__14-student-bed-counts__parse` | `reader` | pass | pass |
| `reader/tier-1/15-student-bed-counts-inconsistent/parse` | `reader__documents__15-student-bed-counts-inconsistent__parse` | `reader` | pass | pass |
| `reader/tier-1/16-frontmatter-yaml-scalars/parse` | `reader__documents__16-frontmatter-yaml-scalars__parse` | `reader` | pass | pass |
| `reader/tier-1/17-exit-proceeds-junior-capital/parse` | `reader__documents__17-exit-proceeds-junior-capital__parse` | `reader` | pass | pass |
| `reader/tier-1/18-content-member-is-payload/parse` | `reader__documents__18-content-member-is-payload__parse` | `reader` | pass | pass |
| `starter-products/tier-1/01-minimal-screening/render-chat` | `starter-products__documents__01-minimal-screening__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/01-minimal-screening/render-summary` | `starter-products__documents__01-minimal-screening__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/02-full-multifamily/render-chat` | `starter-products__documents__02-full-multifamily__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/02-full-multifamily/render-summary` | `starter-products__documents__02-full-multifamily__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/04-scope-only/render-chat` | `starter-products__documents__04-scope-only__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/04-scope-only/render-summary` | `starter-products__documents__04-scope-only__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/05-land-stage-overlay/render-chat` | `starter-products__documents__05-land-stage-overlay__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/05-land-stage-overlay/render-summary` | `starter-products__documents__05-land-stage-overlay__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/06-mixed-use-stage-overlay/render-chat` | `starter-products__documents__06-mixed-use-stage-overlay__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/06-mixed-use-stage-overlay/render-summary` | `starter-products__documents__06-mixed-use-stage-overlay__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/07-stage-overlay-control/render-chat` | `starter-products__documents__07-stage-overlay-control__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/07-stage-overlay-control/render-summary` | `starter-products__documents__07-stage-overlay-control__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/08-variant-cross-checks/render-chat` | `starter-products__documents__08-variant-cross-checks__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/08-variant-cross-checks/render-summary` | `starter-products__documents__08-variant-cross-checks__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/09-returns-tax-basis/render-chat` | `starter-products__documents__09-returns-tax-basis__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/09-returns-tax-basis/render-summary` | `starter-products__documents__09-returns-tax-basis__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/10-declared-roles/render-chat` | `starter-products__documents__10-declared-roles__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/10-declared-roles/render-summary` | `starter-products__documents__10-declared-roles__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/11-role-collision/render-chat` | `starter-products__documents__11-role-collision__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/11-role-collision/render-summary` | `starter-products__documents__11-role-collision__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/12-role-eligibility/render-chat` | `starter-products__documents__12-role-eligibility__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/12-role-eligibility/render-summary` | `starter-products__documents__12-role-eligibility__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/13-period-identities/render-chat` | `starter-products__documents__13-period-identities__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/13-period-identities/render-summary` | `starter-products__documents__13-period-identities__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/14-student-bed-counts/render-chat` | `starter-products__documents__14-student-bed-counts__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/14-student-bed-counts/render-summary` | `starter-products__documents__14-student-bed-counts__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/15-student-bed-counts-inconsistent/render-chat` | `starter-products__documents__15-student-bed-counts-inconsistent__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/15-student-bed-counts-inconsistent/render-summary` | `starter-products__documents__15-student-bed-counts-inconsistent__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/16-frontmatter-yaml-scalars/render-chat` | `starter-products__documents__16-frontmatter-yaml-scalars__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/16-frontmatter-yaml-scalars/render-summary` | `starter-products__documents__16-frontmatter-yaml-scalars__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/17-exit-proceeds-junior-capital/render-chat` | `starter-products__documents__17-exit-proceeds-junior-capital__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/17-exit-proceeds-junior-capital/render-summary` | `starter-products__documents__17-exit-proceeds-junior-capital__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-1/18-content-member-is-payload/render-chat` | `starter-products__documents__18-content-member-is-payload__render-chat` | `starter-products` | pass | pass |
| `starter-products/tier-1/18-content-member-is-payload/render-summary` | `starter-products__documents__18-content-member-is-payload__render-summary` | `starter-products` | pass | pass |
| `starter-products/tier-2/frontmatter-set-recommendation` | `starter-products__starter-editor__frontmatter-set-recommendation__edit` | `starter-products` | pass | pass |
| `starter-products/tier-2/section-replace-property` | `starter-products__starter-editor__section-replace-property__edit` | `starter-products` | pass | pass |
| `starter-products/tier-2/section-supersede-risk-rating` | `starter-products__starter-editor__section-supersede-risk-rating__edit` | `starter-products` | pass | pass |
| `verifier/replacement-funding/0070-after-expiration` | `verifier__hedge__0070-after-expiration__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-ambiguous-debt` | `verifier__hedge__0070-ambiguous-debt__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-ambiguous-sources` | `verifier__hedge__0070-ambiguous-sources__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-amount` | `verifier__hedge__0070-bad-amount__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-currency` | `verifier__hedge__0070-bad-currency__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-date` | `verifier__hedge__0070-bad-date__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-index--1` | `verifier__hedge__0070-bad-index--1__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-index-0_5` | `verifier__hedge__0070-bad-index-0_5__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-index-9007199254740992` | `verifier__hedge__0070-bad-index-9007199254740992__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-kind` | `verifier__hedge__0070-bad-kind__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-order` | `verifier__hedge__0070-bad-order__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-row-label` | `verifier__hedge__0070-bad-row-label__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-bad-row-member` | `verifier__hedge__0070-bad-row-member__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-before-expiration` | `verifier__hedge__0070-before-expiration__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-currency-absent` | `verifier__hedge__0070-currency-absent__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-currency-null` | `verifier__hedge__0070-currency-null__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-digest-member-missing` | `verifier__hedge__0070-digest-member-missing__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-digest-syntax` | `verifier__hedge__0070-digest-syntax__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-empty-series` | `verifier__hedge__0070-empty-series__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-escrow-contradiction-0` | `verifier__hedge__0070-escrow-contradiction-0__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-escrow-contradiction-100` | `verifier__hedge__0070-escrow-contradiction-100__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-escrow-missing` | `verifier__hedge__0070-escrow-missing__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-escrow-reference` | `verifier__hedge__0070-escrow-reference__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-explicit-escrow` | `verifier__hedge__0070-explicit-escrow__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-explicit-zero` | `verifier__hedge__0070-explicit-zero__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-invalid-effective` | `verifier__hedge__0070-invalid-effective__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-legacy-escrow` | `verifier__hedge__0070-legacy-escrow__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-missing-reference` | `verifier__hedge__0070-missing-reference__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-missing-row` | `verifier__hedge__0070-missing-row__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-missing-source` | `verifier__hedge__0070-missing-source__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-missing-sources-uses` | `verifier__hedge__0070-missing-sources-uses__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-missing-uses` | `verifier__hedge__0070-missing-uses__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-nonreplacement-loan_matures_first-escrow` | `verifier__hedge__0070-nonreplacement-loan_matures_first-escrow__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-nonreplacement-loan_matures_first-outright` | `verifier__hedge__0070-nonreplacement-loan_matures_first-outright__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-nonreplacement-unhedged-escrow` | `verifier__hedge__0070-nonreplacement-unhedged-escrow__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-nonreplacement-unhedged-outright` | `verifier__hedge__0070-nonreplacement-unhedged-outright__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-on-expiration` | `verifier__hedge__0070-on-expiration__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-outright-payment` | `verifier__hedge__0070-outright-payment__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-payment-before-effective` | `verifier__hedge__0070-payment-before-effective__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-payment-on-effective` | `verifier__hedge__0070-payment-on-effective__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-positive-payment` | `verifier__hedge__0070-positive-payment__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-reviewed-rebind` | `verifier__hedge__0070-reviewed-rebind__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-same-day-distinct` | `verifier__hedge__0070-same-day-distinct__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-amount` | `verifier__hedge__0070-stale-amount__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-currency` | `verifier__hedge__0070-stale-currency__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-currency-removed` | `verifier__hedge__0070-stale-currency-removed__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-deletion` | `verifier__hedge__0070-stale-deletion__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-index` | `verifier__hedge__0070-stale-index__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-insertion` | `verifier__hedge__0070-stale-insertion__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-label` | `verifier__hedge__0070-stale-label__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-reorder` | `verifier__hedge__0070-stale-reorder__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-stale-variant` | `verifier__hedge__0070-stale-variant__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-superseded-source` | `verifier__hedge__0070-superseded-source__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-unknown-member` | `verifier__hedge__0070-unknown-member__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-unknown-mode` | `verifier__hedge__0070-unknown-mode__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-unrelated-edit` | `verifier__hedge__0070-unrelated-edit__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0070-variant-fallback-forbidden` | `verifier__hedge__0070-variant-fallback-forbidden__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0075-junior-keyed-base` | `verifier__hedge__0075-junior-keyed-base__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0075-junior-only-hedge` | `verifier__hedge__0075-junior-only-hedge__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0075-malformed-hedge-beside-junior` | `verifier__hedge__0075-malformed-hedge-beside-junior__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0075-senior-junior-escrow` | `verifier__hedge__0075-senior-junior-escrow__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0075-senior-junior-outright` | `verifier__hedge__0075-senior-junior-outright__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0075-two-seniors` | `verifier__hedge__0075-two-seniors__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-components-only-hedge` | `verifier__hedge__0076-components-only-hedge__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-sources-refused-escrow-mode` | `verifier__hedge__0076-sources-refused-escrow-mode__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-sources-refused-malformed-hedge` | `verifier__hedge__0076-sources-refused-malformed-hedge__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-sources-refused-replace` | `verifier__hedge__0076-sources-refused-replace__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-two-seniors-hedge-malformed` | `verifier__hedge__0076-two-seniors-hedge-malformed__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-two-seniors-hedge-unfunded` | `verifier__hedge__0076-two-seniors-hedge-unfunded__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-two-seniors-no-hedge-escrow` | `verifier__hedge__0076-two-seniors-no-hedge-escrow__validate` | `verifier` | pass | pass |
| `verifier/replacement-funding/0076-two-seniors-replace-escrow` | `verifier__hedge__0076-two-seniors-replace-escrow__validate` | `verifier` | pass | pass |
| `verifier/reserve-accounts/absent` | `verifier__reserve-accounts__absent__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/balance-mismatch` | `verifier__reserve-accounts__balance-mismatch__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/bank-interest` | `verifier__reserve-accounts__bank-interest__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/broken-continuity` | `verifier__reserve-accounts__broken-continuity__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/currency-disagrees` | `verifier__reserve-accounts__currency-disagrees__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/duplicate-account` | `verifier__reserve-accounts__duplicate-account__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/duplicate-movement` | `verifier__reserve-accounts__duplicate-movement__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/duplicate-period` | `verifier__reserve-accounts__duplicate-period__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/empty-explicit-movements` | `verifier__reserve-accounts__empty-explicit-movements__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/half-away-mismatch` | `verifier__reserve-accounts__half-away-mismatch__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/invalid-date` | `verifier__reserve-accounts__invalid-date__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/large-cent-draw-contribution` | `verifier__reserve-accounts__large-cent-draw-contribution__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/large-cent-multiple-contributions` | `verifier__reserve-accounts__large-cent-multiple-contributions__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/large-cent-one-cent-mismatch` | `verifier__reserve-accounts__large-cent-one-cent-mismatch__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/legacy-v1` | `verifier__reserve-accounts__bare-block__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/lender-reserve` | `verifier__reserve-accounts__lender-reserve__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/missing-movements` | `verifier__reserve-accounts__missing-movements__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/missing-source` | `verifier__reserve-accounts__missing-source__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/negative-movement` | `verifier__reserve-accounts__negative-movement__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/overflow` | `verifier__reserve-accounts__overflow__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/overflow-then-finite-periods` | `verifier__reserve-accounts__overflow-then-finite-periods__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/quantum-equal` | `verifier__reserve-accounts__quantum-equal__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/unclassified` | `verifier__reserve-accounts__unclassified__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/unknown-field` | `verifier__reserve-accounts__unknown-field__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/unordered-movements` | `verifier__reserve-accounts__unordered-movements__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/unordered-periods` | `verifier__reserve-accounts__unordered-periods__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/verified-source-classes` | `verifier__reserve-accounts__verified-source-classes__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-accounts/wrong-previous-period` | `verifier__reserve-accounts__wrong-previous-period__verify-reserve-accounts` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/absent` | `verifier__reserve-draw-bindings__absent__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/ambiguous-net-row` | `verifier__reserve-draw-bindings__ambiguous-net-row__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/cent-multiple-draws` | `verifier__reserve-draw-bindings__cent-multiple-draws__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/cent-one-cent-share` | `verifier__reserve-draw-bindings__cent-one-cent-share__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/cent-one-cent-unallocated` | `verifier__reserve-draw-bindings__cent-one-cent-unallocated__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/cent-split-draw` | `verifier__reserve-draw-bindings__cent-split-draw__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/closed-plan` | `verifier__reserve-draw-bindings__closed-plan__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/duplicate-edge` | `verifier__reserve-draw-bindings__duplicate-edge__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/duplicate-selected-draw` | `verifier__reserve-draw-bindings__duplicate-selected-draw__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/duplicate-source-row` | `verifier__reserve-draw-bindings__duplicate-source-row__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/excess-draw-allocation` | `verifier__reserve-draw-bindings__excess-draw-allocation__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/external-release` | `verifier__reserve-draw-bindings__external-release__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/funded-share-disagrees` | `verifier__reserve-draw-bindings__funded-share-disagrees__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/incomplete-draw` | `verifier__reserve-draw-bindings__incomplete-draw__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/invalid-source-date` | `verifier__reserve-draw-bindings__invalid-source-date__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/lease-up-component` | `verifier__reserve-draw-bindings__lease-up-component__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/legacy-v1` | `verifier__reserve-draw-bindings__bare-block__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/lender-reserve` | `verifier__reserve-draw-bindings__lender-reserve__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/many-to-many-partial` | `verifier__reserve-draw-bindings__many-to-many-partial__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-account` | `verifier__reserve-draw-bindings__missing-account__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-completeness` | `verifier__reserve-draw-bindings__missing-completeness__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-expenditure-row` | `verifier__reserve-draw-bindings__missing-expenditure-row__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-movement` | `verifier__reserve-draw-bindings__missing-movement__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-period` | `verifier__reserve-draw-bindings__missing-period__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-reserve-variant` | `verifier__reserve-draw-bindings__missing-reserve-variant__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/missing-source` | `verifier__reserve-draw-bindings__missing-source__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/nonfinite-allocation` | `verifier__reserve-draw-bindings__nonfinite-allocation__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/null-plan` | `verifier__reserve-draw-bindings__null-plan__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/one-to-one` | `verifier__reserve-draw-bindings__one-to-one__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/operating-expense` | `verifier__reserve-draw-bindings__operating-expense__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/overbinding-gross` | `verifier__reserve-draw-bindings__overbinding-gross__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/partial-expenditure` | `verifier__reserve-draw-bindings__partial-expenditure__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/reserve-balance-mismatch` | `verifier__reserve-draw-bindings__reserve-balance-mismatch__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/same-day-identities` | `verifier__reserve-draw-bindings__same-day-identities__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/split-draw` | `verifier__reserve-draw-bindings__split-draw__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/stale-digest` | `verifier__reserve-draw-bindings__stale-digest__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/stated-final-boundary` | `verifier__reserve-draw-bindings__stated-final-boundary__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/subcent-allocation` | `verifier__reserve-draw-bindings__subcent-allocation__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/superseded-source` | `verifier__reserve-draw-bindings__superseded-source__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/unbound-selected-draw` | `verifier__reserve-draw-bindings__unbound-selected-draw__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/unclassified-movement` | `verifier__reserve-draw-bindings__unclassified-movement__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/undeclared-draw-edge` | `verifier__reserve-draw-bindings__undeclared-draw-edge__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/wrong-category` | `verifier__reserve-draw-bindings__wrong-category__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/wrong-currency` | `verifier__reserve-draw-bindings__wrong-currency__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/wrong-expenditure-variant` | `verifier__reserve-draw-bindings__wrong-expenditure-variant__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/reserve-draw-bindings/wrong-gross-sign` | `verifier__reserve-draw-bindings__wrong-gross-sign__verify-reserve-draws` | `verifier` | pass | pass |
| `verifier/scenario/01-stabilized_acquisition` | `verifier__scenario__01-stabilized_acquisition__validate` | `verifier` | pass | pass |
| `verifier/scenario/02-ground_up_development` | `verifier__scenario__02-ground_up_development__validate` | `verifier` | pass | pass |
| `verifier/scenario/03-value_add` | `verifier__scenario__03-value_add__validate` | `verifier` | pass | pass |
| `verifier/scenario/04-lease_up` | `verifier__scenario__04-lease_up__validate` | `verifier` | pass | pass |
| `verifier/scenario/05-house_flip` | `verifier__scenario__05-house_flip__validate` | `verifier` | pass | pass |
| `verifier/scenario/06-commercial_flip` | `verifier__scenario__06-commercial_flip__validate` | `verifier` | pass | pass |
| `verifier/scenario/07-property_conversion` | `verifier__scenario__07-property_conversion__validate` | `verifier` | pass | pass |
| `verifier/scenario/08-land_banking` | `verifier__scenario__08-land_banking__validate` | `verifier` | pass | pass |
| `verifier/scenario/09-absent` | `verifier__scenario__09-absent__validate` | `verifier` | pass | pass |
| `verifier/scenario/10-null` | `verifier__scenario__10-null__validate` | `verifier` | pass | pass |
| `verifier/scenario/11-unlisted` | `verifier__scenario__11-unlisted__validate` | `verifier` | pass | pass |
| `verifier/scenario/12-retired-build_to_rent` | `verifier__scenario__12-retired-build_to_rent__validate` | `verifier` | pass | pass |
| `verifier/scenario/13-retired-nnn_single_tenant` | `verifier__scenario__13-retired-nnn_single_tenant__validate` | `verifier` | pass | pass |
| `verifier/scenario/14-retired-lihtc_section8` | `verifier__scenario__14-retired-lihtc_section8__validate` | `verifier` | pass | pass |
| `verifier/scenario/15-retired-distressed_reo` | `verifier__scenario__15-retired-distressed_reo__validate` | `verifier` | pass | pass |
| `verifier/scenario/16-namespaced` | `verifier__scenario__16-namespaced__validate` | `verifier` | pass | pass |
| `verifier/scenario/17-malformed-namespace` | `verifier__scenario__17-malformed-namespace__validate` | `verifier` | pass | pass |
| `verifier/scenario/18-non-string` | `verifier__scenario__18-non-string__validate` | `verifier` | pass | pass |
| `verifier/scenario/19-btr-fallback` | `verifier__scenario__19-btr-fallback__validate` | `verifier` | pass | pass |
| `verifier/scenario/20-btr-carrier-conflict` | `verifier__scenario__20-btr-carrier-conflict__validate` | `verifier` | pass | pass |
| `verifier/scenario/21-btr-class-scope` | `verifier__scenario__21-btr-class-scope__validate` | `verifier` | pass | pass |
| `verifier/scenario/22-free-subtypes` | `verifier__scenario__22-free-subtypes__validate` | `verifier` | pass | pass |
| `verifier/scenario/23-btr-reverse-conflict` | `verifier__scenario__23-btr-reverse-conflict__validate` | `verifier` | pass | pass |
| `verifier/tier-1/01-minimal-screening/validate` | `verifier__documents__01-minimal-screening__validate` | `verifier` | pass | pass |
| `verifier/tier-1/02-full-multifamily/validate` | `verifier__documents__02-full-multifamily__validate` | `verifier` | pass | pass |
| `verifier/tier-1/04-scope-only/validate` | `verifier__documents__04-scope-only__validate` | `verifier` | pass | pass |
| `verifier/tier-1/05-land-stage-overlay/validate` | `verifier__documents__05-land-stage-overlay__validate` | `verifier` | pass | pass |
| `verifier/tier-1/06-mixed-use-stage-overlay/validate` | `verifier__documents__06-mixed-use-stage-overlay__validate` | `verifier` | pass | pass |
| `verifier/tier-1/07-stage-overlay-control/validate` | `verifier__documents__07-stage-overlay-control__validate` | `verifier` | pass | pass |
| `verifier/tier-1/08-variant-cross-checks/validate` | `verifier__documents__08-variant-cross-checks__validate` | `verifier` | pass | pass |
| `verifier/tier-1/09-returns-tax-basis/validate` | `verifier__documents__09-returns-tax-basis__validate` | `verifier` | pass | pass |
| `verifier/tier-1/10-declared-roles/validate` | `verifier__documents__10-declared-roles__validate` | `verifier` | pass | pass |
| `verifier/tier-1/11-role-collision/validate` | `verifier__documents__11-role-collision__validate` | `verifier` | pass | pass |
| `verifier/tier-1/12-role-eligibility/validate` | `verifier__documents__12-role-eligibility__validate` | `verifier` | pass | pass |
| `verifier/tier-1/13-period-identities/validate` | `verifier__documents__13-period-identities__validate` | `verifier` | pass | pass |
| `verifier/tier-1/14-student-bed-counts/validate` | `verifier__documents__14-student-bed-counts__validate` | `verifier` | pass | pass |
| `verifier/tier-1/15-student-bed-counts-inconsistent/validate` | `verifier__documents__15-student-bed-counts-inconsistent__validate` | `verifier` | pass | pass |
| `verifier/tier-1/16-frontmatter-yaml-scalars/validate` | `verifier__documents__16-frontmatter-yaml-scalars__validate` | `verifier` | pass | pass |
| `verifier/tier-1/17-exit-proceeds-junior-capital/validate` | `verifier__documents__17-exit-proceeds-junior-capital__validate` | `verifier` | pass | pass |
| `verifier/tier-1/18-content-member-is-payload/validate` | `verifier__documents__18-content-member-is-payload__validate` | `verifier` | pass | pass |
| `verifier/tier-3/data-center-module-dependency-rounding` | `verifier__calc__data-center-module-dependency-rounding__calc` | `verifier` | pass | pass |
| `verifier/tier-3/data_center-price_per_kw` | `verifier__calc__data_center-price_per_kw__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-01-valid-leap-divisible-by-4` | `verifier__calc__date-01-valid-leap-divisible-by-4__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-02-valid-leap-divisible-by-400` | `verifier__calc__date-02-valid-leap-divisible-by-400__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-03-valid-ordinary-date` | `verifier__calc__date-03-valid-ordinary-date__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-04-valid-year-0000-leap` | `verifier__calc__date-04-valid-year-0000-leap__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-05-valid-year-9999-last-day` | `verifier__calc__date-05-valid-year-9999-last-day__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-06-valid-first-day-of-year` | `verifier__calc__date-06-valid-first-day-of-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-07-invalid-not-leap-year` | `verifier__calc__date-07-invalid-not-leap-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-08-invalid-century-not-leap` | `verifier__calc__date-08-invalid-century-not-leap__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-09-invalid-february-30` | `verifier__calc__date-09-invalid-february-30__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-10-invalid-april-31` | `verifier__calc__date-10-invalid-april-31__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-11-invalid-month-00` | `verifier__calc__date-11-invalid-month-00__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-12-invalid-month-13` | `verifier__calc__date-12-invalid-month-13__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-13-invalid-day-00` | `verifier__calc__date-13-invalid-day-00__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-14-invalid-one-digit-month` | `verifier__calc__date-14-invalid-one-digit-month__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-15-invalid-one-digit-day` | `verifier__calc__date-15-invalid-one-digit-day__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-16-invalid-two-digit-year` | `verifier__calc__date-16-invalid-two-digit-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-17-invalid-five-digit-year` | `verifier__calc__date-17-invalid-five-digit-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-18-invalid-signed-year` | `verifier__calc__date-18-invalid-signed-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-19-invalid-negative-year` | `verifier__calc__date-19-invalid-negative-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-20-invalid-expanded-year` | `verifier__calc__date-20-invalid-expanded-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-21-invalid-leading-space` | `verifier__calc__date-21-invalid-leading-space__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-22-invalid-trailing-space` | `verifier__calc__date-22-invalid-trailing-space__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-23-invalid-internal-space` | `verifier__calc__date-23-invalid-internal-space__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-24-invalid-leading-tab` | `verifier__calc__date-24-invalid-leading-tab__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-25-invalid-trailing-newline` | `verifier__calc__date-25-invalid-trailing-newline__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-26-invalid-date-time-zulu` | `verifier__calc__date-26-invalid-date-time-zulu__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-27-invalid-date-time-local` | `verifier__calc__date-27-invalid-date-time-local__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-28-invalid-zone-suffix` | `verifier__calc__date-28-invalid-zone-suffix__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-29-invalid-offset-suffix` | `verifier__calc__date-29-invalid-offset-suffix__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-30-invalid-slash-form` | `verifier__calc__date-30-invalid-slash-form__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-31-invalid-compact-form` | `verifier__calc__date-31-invalid-compact-form__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-32-invalid-week-date` | `verifier__calc__date-32-invalid-week-date__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-33-invalid-ordinal-date` | `verifier__calc__date-33-invalid-ordinal-date__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-34-invalid-full-width-digits` | `verifier__calc__date-34-invalid-full-width-digits__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-35-invalid-non-ascii-hyphen` | `verifier__calc__date-35-invalid-non-ascii-hyphen__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-36-invalid-empty-string` | `verifier__calc__date-36-invalid-empty-string__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-37-document-quoted-string` | `verifier__calc__date-37-document-quoted-string__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-38-document-unquoted-yaml-date` | `verifier__calc__date-38-document-unquoted-yaml-date__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-39-document-null` | `verifier__calc__date-39-document-null__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-40-document-absent-path` | `verifier__calc__date-40-document-absent-path__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-41-document-number` | `verifier__calc__date-41-document-number__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-42-document-boolean` | `verifier__calc__date-42-document-boolean__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-43-document-array` | `verifier__calc__date-43-document-array__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-44-document-object` | `verifier__calc__date-44-document-object__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-45-document-impossible-date` | `verifier__calc__date-45-document-impossible-date__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-46-error-no-arguments` | `verifier__calc__date-46-error-no-arguments__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-47-error-two-arguments` | `verifier__calc__date-47-error-two-arguments__calc` | `verifier` | pass | pass |
| `verifier/tier-3/date-48-error-argument-propagates` | `verifier__calc__date-48-error-argument-propagates__calc` | `verifier` | pass | pass |
| `verifier/tier-3/dscr-from-section` | `verifier__calc__dscr-from-section__calc` | `verifier` | pass | pass |
| `verifier/tier-3/hospitality-revpar` | `verifier__calc__hospitality-revpar__calc` | `verifier` | pass | pass |
| `verifier/tier-3/irr-01-out-of-bracket` | `verifier__calc__irr-01-out-of-bracket__calc` | `verifier` | pass | pass |
| `verifier/tier-3/irr-02-even-root-count` | `verifier__calc__irr-02-even-root-count__calc` | `verifier` | pass | pass |
| `verifier/tier-3/irr-03-conventional` | `verifier__calc__irr-03-conventional__calc` | `verifier` | pass | pass |
| `verifier/tier-3/irr-04-endpoint-root` | `verifier__calc__irr-04-endpoint-root__calc` | `verifier` | pass | pass |
| `verifier/tier-3/irr-05-degenerate` | `verifier__calc__irr-05-degenerate__calc` | `verifier` | pass | pass |
| `verifier/tier-3/land-usable-land-ratio` | `verifier__calc__land-usable-land-ratio__calc` | `verifier` | pass | pass |
| `verifier/tier-3/manufactured_housing-physical_occupancy` | `verifier__calc__manufactured_housing-physical_occupancy__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-absent-component-null` | `verifier__calc__mixed-use-absent-component-null__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-data_center_noi_share` | `verifier__calc__mixed-use-data_center_noi_share__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-data_center_price_per_kw` | `verifier__calc__mixed-use-data_center_price_per_kw__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-manufactured_housing_noi_share` | `verifier__calc__mixed-use-manufactured_housing_noi_share__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-manufactured_housing_price_per_site` | `verifier__calc__mixed-use-manufactured_housing_price_per_site__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-no-allocation-null` | `verifier__calc__mixed-use-no-allocation-null__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-operating-business-gop` | `verifier__calc__mixed-use-operating-business-gop__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-two-component-cap-rate` | `verifier__calc__mixed-use-two-component-cap-rate__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-two-component-noi-share` | `verifier__calc__mixed-use-two-component-noi-share__calc` | `verifier` | pass | pass |
| `verifier/tier-3/mixed-use-two-component-price-per-unit` | `verifier__calc__mixed-use-two-component-price-per-unit__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-01-year-order` | `verifier__calc__period-01-year-order__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-02-keyed-year` | `verifier__calc__period-02-keyed-year__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-03-calendar-quarter` | `verifier__calc__period-03-calendar-quarter__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-04-dated-series` | `verifier__calc__period-04-dated-series__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-05-missing` | `verifier__calc__period-05-missing__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-06-kind-mismatch` | `verifier__calc__period-06-kind-mismatch__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-07-duplicate` | `verifier__calc__period-07-duplicate__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-08-unregistered` | `verifier__calc__period-08-unregistered__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-09-same-day-unique` | `verifier__calc__period-09-same-day-unique__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-10-same-day-repeated` | `verifier__calc__period-10-same-day-repeated__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-11-same-day-absent` | `verifier__calc__period-11-same-day-absent__calc` | `verifier` | pass | pass |
| `verifier/tier-3/period-12-other-series-duplicate` | `verifier__calc__period-12-other-series-duplicate__calc` | `verifier` | pass | pass |
| `verifier/tier-3/self-storage-economic-occupancy` | `verifier__calc__self-storage-economic-occupancy__calc` | `verifier` | pass | pass |
| `verifier/tier-3/senior-housing-care-revenue-ratio` | `verifier__calc__senior-housing-care-revenue-ratio__calc` | `verifier` | pass | pass |
| `verifier/tier-3/student-housing-pre-lease-rate` | `verifier__calc__student-housing-pre-lease-rate__calc` | `verifier` | pass | pass |
| `verifier/tier-3/student-housing-rent-per-bed-monthly` | `verifier__calc__student-housing-rent-per-bed-monthly__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-01-primary-resolves` | `verifier__calc__variant-01-primary-resolves__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-02-default-resolves` | `verifier__calc__variant-02-default-resolves__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-03-unresolvable` | `verifier__calc__variant-03-unresolvable__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-04-role-preference` | `verifier__calc__variant-04-role-preference__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-05-explicit-variant` | `verifier__calc__variant-05-explicit-variant__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-06-missing-section` | `verifier__calc__variant-06-missing-section__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-07-explicit-missing` | `verifier__calc__variant-07-explicit-missing__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-08-primary-collision` | `verifier__calc__variant-08-primary-collision__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-09-role-collision` | `verifier__calc__variant-09-role-collision__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-10-role-unclaimed` | `verifier__calc__variant-10-role-unclaimed__calc` | `verifier` | pass | pass |
| `verifier/tier-3/variant-11-explicit-beats-role` | `verifier__calc__variant-11-explicit-beats-role__calc` | `verifier` | pass | pass |

</details>

## RFC 0081 Phase 6 implementation decisions

| Question | Phase 6 decision | Precedent / boundary |
|---|---|---|
| Release labels | `FORMAT_VERSION = '3.0'` and `PROTOCOL_VERSION = '4.0.0'`, each equal to the single member of its supported set; a test pins both equalities. The literals stay, because `verify-versions`, `verify-release` and the docs site read them from source. | D1; the Phase 4 row on `SPEC_*` constants ("`FORMAT_VERSION`/`PROTOCOL_VERSION` stay for Phase 6"). |
| Core/CLI version | 4.0.0. | D1 and §1; the 2.0.0/3.0.0 precedent of a core major with a Protocol major that breaks public surfaces. |
| Dependent package versions | Signing 0.2.26 → **0.3.0**: its exported signatures are unchanged, but `stampBlockSignature` writes `_meta.integrity`, `verifyBlockSignature` reads only it, and the digest excludes `_meta`, so a 0.2.26 signature does not verify. Batch, Excel, report and lake take a patch step: their exported APIs are unchanged and what they dropped applies only to documents core refuses. | Semver 0.x: a break moves the minor (lake 0.1.2 → 0.2.0, the module packages 0.1.13 → 0.2.0). Every dependent took a patch step for the 2.0.0 and 3.0.0 core majors. The Phase 3 `uwVersion` option and `VerifyBlockSignatureOptions` never shipped, so they do not count. |
| Release scope | Seven packages; `release.yml` and `releasePackagesForGeneration` already select them for ≥ 4.0.0 (Phase 4). | D6. |
| VERSIONS.md compatibility rule 1 | Rewritten: a reader supports exactly the format it names, unknown sections stay informative (Protocol §II.1 item 3, §XII.1–XII.2). It cited the starter-product §III.1 stub that Phase 2 deleted. | D2; §XII.3. |
| Migration guidance | A CHANGELOG 4.0.0 note for the owner's consumers: the 3.0.0 CLI's `migrate --source-tags` and `migrate --to-v2` (which writes Format 2.0), then the remaining Format 3.0 steps by hand. No migrator returns. | §4 and P5; Compatibility analysis (the only consumers are the owner's). |
| RFC status | Stays `accepted` in the tagged tree; the post-publication reconciliation moves it to `implemented`. | Wiki 11 release states; the 3.0.0 precedent (#305, #306). |

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
