# RFC 0095 attribution population — independent read-only census

Evidence for Issue #354 / [draft PR #389](https://github.com/UWMD-OSP/UW-Markdown/pull/389), not acceptance or activation. The owner's U1 direction keeps `DQ-06`/info for stage readiness and prevents duplicate attribution errors. No production, schema, source, expectation or receipt changed.

## Basis and reproduction

Exact input main: `fa9a9ea37d31b918f5993eae4276b159f31719f3`. Draft reviewed: `cf3112951537fe0b69f1f06239fcc3330e6303c6`. Accepted RFCs 0090/0091/0093 supply parent precedence, retained-physical/current-MODEL identity union and current canonical authority. Input and runtime source hashes appear in the JSON manifest.

- [Reproduction script](2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.mjs)
- [Human-summary JSON and all 89 newly assessed standalone refs](2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.json)
- [Complete source/block/composition trace](2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.all-records.json.gz)
- JSON SHA-256: `36bffdec7e7d54e4032aa08a70354896a59eda8b59537a9e7bf5bd59e42610cb`
- Gzip SHA-256: `d186ce8d5d607d50855ee5cdaf4ce0ef6799553c0eb40ff82215db719ab28d7e`
- Decoded full JSON SHA-256: `036108a1142da019a822b1e18a29606788cadc0b0a81e1b2975c7194ca833d43`
- Runtime: Node `v24.14.1`, TypeScript `5.9.3`, `win32` / `10.0.26200`.

With the existing TypeScript development dependency installed, from the repository root:

```sh
node docs/reviews/2026-10-17-validation-diagnostic-gap-354.attribution-population-0095.mjs
```

Alternatively use `--typescript` with the absolute path to an installed `typescript/lib/typescript.js`. `--repo`, `--base` and `--output` are explicit overrides. The script reads exact Git blob bytes with `git cat-file --batch`, transpiles base runtime sources to a temporary directory, and executes the unchanged AST-extracted `checkDataQuality` with its actual helpers. It does not use stale `dist`, normalize source bytes or overwrite expectations. Repository writes are only the requested JSON and compressed companion. The full trace contains all 880 original source-byte hashes, all block identities/origins, current model paths, parent gates, canonical and override triggers, carrier shapes and observed attribution results. `gzip.open(..., 'rt', encoding='utf-8')` plus `json.load` reads the full trace.

## Exact standalone population

| Observation | Count |
|---|---:|
| Tracked `.uwx.md` / `.uwpart.md` / `.uw.md` source files | 880 |
| Sources reaching the current fenced parser | 816 |
| Typed parser refusals | 9 |
| `.uw.md` / Lite sources outside authored fenced-source census | 55 |
| Retained-physical/current-MODEL identity union | 2,238 |
| Old sections/current-variant attribution population | 2,149 |
| Newly assessed references across 49 paths | 89 |
| New references with admitted canonical parents | 87 |
| New references preserving old parent precedence | 2 |
| New candidate reference findings | 0 |

The 89 new references are 22 history/superseded, 15 pipeline-log, 7 custom-calculation, 6 custom-scenario, 22 projected extension and 17 physically retained references lost from the reduced model. Current named variants already belong to the old pass; they are not all newly assessed. The physical union has no additional model-only references in these unmutated standalone sources. Equal values never deduplicate distinct objects. Authored controls exercise mutable MODEL additions/replacements and exact-reference aliases separately.

The two precedence controls are `conformance/hedge/0070-superseded-source/deal.uwx.md:63` (whole metadata absent) and `conformance/documents/malformed/33-meta-pass-order.uwx.md:80` (retired wrapper). Exact positions/gates are retained per row; neither becomes a new reference error through a parent already refused under accepted rules.

Old `checkDataQuality` walks only `parsed.sections`, including current variants. Its market trigger uses convenience `block.meta.provenance.resolution` or any `_overrides` entry resolution, and its missing-carrier condition uses JavaScript falsiness. It does not enforce the analogous inherited-reference requirement or inspect other collections. Actual old execution over all 816 parsed sources emits zero attribution DQ-06/error and encounters zero exceptions. The stage-readiness DQ-06/info pass is not changed or reclassified by this research.

The candidate inventory uses current canonical content after the accepted wrapper/provenance/lifecycle parent gate. Both canonical resolution and **ANY own stated object-override resolution** trigger the respective inherited/market carrier, including duplicate, shadowed and unmatched paths. Trigger multiplicity produces one required-absence predicate per carrier per distinct block. Stated carriers are independently shape-checked even without a trigger. Null/false/scalars/arrays are invalid-present, not absent. Required object children use the draft's exact string/digest/integer predicates. `as_of` is assessed for string shape here; the owner-selected U3 calendar domain is independently tested by the adjacent date-only research controls. This census does not claim complete date-profile validation. This is an attribution/reference census, **not** a complete META-05/06 optional-field or conditional-agent-id inventory.

## Current reference evidence and source intent

Only `conformance/market-data/promote/explicit/deal-after-promotion.uwx.md:9` states `market_data_accepted`. Its `market_data_ref` supplies document identity, `as_of: "2026-06-30"`, a correctly shaped digest and rationale. No block states `inherited_assumption` or an inherited carrier. One block has `_overrides`, without either trigger. No admitted old or newly assessed reference has a candidate carrier failure. Sparse current source coverage is not proof of complete future implementation or zero total RFC0095 impact.

The new population comprises 66 refs in 37 conformance files, 17 refs in ten example files and six refs in two download templates. Of these, 33 are in explicitly named malformed/reject locations, 33 other conformance refs have no metadata-validity intent inferred, 16 are ordinary example refs, one is a negative example by path inference and six are template refs. Each record states this path-only classification boundary. A financial or authentication verdict is not treated as a metadata-validity promise. Templates are not observed producer output. Embedded TypeScript/Python test literals, JSON-carried setup, ZIP members and Lite-generated model blocks are not independent tracked fenced-source files in this census. Existing market-data/cascade/stage-readiness tests are hash-pinned as supporting evidence; no unexecuted test suite is claimed to pass.

The fenced parser produced no non-strict JSON placeholders. Of 38 part sources, 36 pass actual `parseUWPart` and two fail part-specific admission. Those two remain listed separately and are not claimed to be usable composition inputs merely because their JSON fences parsed. The 55 Lite paths are present in the full source manifest, explicitly excluded from authored fenced-block counting rather than treated as parser failures or empty successful documents.

## Composed SOURCE accounting — separate, not additive

Twelve local-directory attempts use actual `parseUWPart`/`resolveComposition`: seven resolve, three remain unresolved and two stop at part load/admission. Only local `parts/`, or sibling `../parts/` for a `records/` directory, supplies candidates. This is an explicit **path-derived local packaging assumption**, not a corpus-wide resolver. Every association, issue and refusal is retained.

Across the seven resolved operations: 12 root physical refs +21 consumed-part physical refs =33 physical; seven synthesized current MODEL refs produce union40. Old DQ sees 12 section refs; the proposed union newly assesses 28 originals (seven replaced root directives and 21 consumed-part originals). These are source references replaced in the assembled projection, not overwritten source peers. None has a trigger or invalid carrier. Each of four example packages loads five parts but consumes only three rent-roll parts; unused operating-statement/cash-flow parts are excluded. These are repeated operation-local uses of the standalone sources and must not be added as new unique repository records. Unresolved or malformed composition is not a successful reduced population.

## Independently authored census controls

The following 17 controls execute only in the census. They are not new conformance fixtures, frozen expected-result changes or activated diagnostics. Findings count reference predicates only. Current DQ observations retain its old population, convenience authority, falsy-reference behavior and exception boundary.

| Control | Candidate reference findings | Observed old attribution errors |
|---|---:|---:|
| `historical-market-reference` | 1 | 0 |
| `overwritten-extension-market` | 1 | 0 |
| `append-pipeline_log` | 1 | 0 |
| `append-custom_calculations` | 1 | 0 |
| `append-custom_scenarios` | 1 | 0 |
| `current-variants-already-assessed` | 1 | 1 |
| `shadowed-inherited-override` | 1 | 0 |
| `unmatched-market-override` | 1 | 1 |
| `both-triggers-duplicate-suppression` | 2 | 1 |
| `present-false-carrier-not-absence` | 1 | 1 |
| `stated-untriggered-carrier-typed-domain` | 2 | 0 |
| `old-parent-refusal-suppresses-new-carrier` | 0 | 1 |
| `invalid-null-override-keeps-observed-runtime-refusal` | 0 | 0 / TypeError observed |
| `mutable-canonical-meta-replaces-convenience-cache` | 1 | 0 |
| `exact-reference-dedup-vs-distinct-model-added` | 1 | 0 |
| `actual-copied-model` | 0 | 0 |

The null-override TypeError is explicitly observed, not reclassified as an accepted typed refusal or silently repaired. Future governed annotation admission must make later consumers tolerate rejected entries. The controls also prove that copying a MODEL loses its parser-private physical association, while canonical replacement and in-place supplied MODEL authority cannot be overridden by stale raw or convenience metadata.

## Exact newly assessed source paths

Opening-fence line numbers identify every physical reference; section, variant, model path and parent gate are in JSON. No row has a new candidate reference finding.

| Source | New refs | Opening-fence lines |
|---|---:|---|
| `conformance/document-signatures/01-valid/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/02-relabel/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/03-flip/deal.uwx.md` | 1 | 44 |
| `conformance/document-signatures/04-splice/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/06-frontmatter/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/07-cosmetic/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/08-missing/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/09-unknown-key/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/10-padded/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/11-time-edited/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/12-unsupported-version/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/13-duplicate-active/deal.uwx.md` | 2 | 6, 119 |
| `conformance/document-signatures/14-no-backend/deal.uwx.md` | 1 | 6 |
| `conformance/document-signatures/15-retained-prose/deal.uwx.md` | 1 | 7 |
| `conformance/documents/fixtures/02-full-multifamily.uwx.md` | 4 | 2288, 2416, 2523, 2617 |
| `conformance/documents/fixtures/13-period-identities.uwx.md` | 1 | 88 |
| `conformance/documents/malformed/04-broken-chain.uwx.md` | 1 | 29 |
| `conformance/documents/malformed/27-actor-nonstrings.uwx.md` | 4 | 10, 37, 64, 91 |
| `conformance/documents/malformed/28-actor-physical-evidence.uwx.md` | 6 | 10, 64, 91, 118, 145, 172 |
| `conformance/documents/malformed/29-actor-shape-precedence.uwx.md` | 1 | 13 |
| `conformance/documents/malformed/30-meta-placement.uwx.md` | 3 | 80, 84, 88 |
| `conformance/documents/malformed/31-meta-section.uwx.md` | 8 | 80, 84, 88, 92, 96, 100, 104, 108 |
| `conformance/documents/malformed/32-meta-quality.uwx.md` | 8 | 80, 84, 88, 92, 96, 100, 104, 108 |
| `conformance/documents/malformed/33-meta-pass-order.uwx.md` | 2 | 80, 84 |
| `conformance/hedge/0070-superseded-source/deal.uwx.md` | 1 | 63 |
| `conformance/lite/expected/01-minimal.uwx.md` | 1 | 39 |
| `conformance/lite/expected/02-full-deal-summary.uwx.md` | 1 | 127 |
| `conformance/lite/expected/03-display-variants.uwx.md` | 1 | 127 |
| `conformance/lite/expected/04-typed-values.uwx.md` | 1 | 129 |
| `conformance/lite/expected/05-prose-and-normalization.uwx.md` | 1 | 39 |
| `conformance/lite/expected/06-decimal-exact-percents.uwx.md` | 1 | 99 |
| `conformance/lite/expected/07-decimal-exact-fractions.uwx.md` | 1 | 99 |
| `conformance/lite/expected/08-frontmatter-yaml-scalars.uwx.md` | 1 | 39 |
| `conformance/reserve-draw-bindings/superseded-source/deal.uwx.md` | 1 | 74 |
| `conformance/starter/agent/replay/l6-risk-rating/after.uwx.md` | 1 | 242 |
| `conformance/starter/editor/fixtures/parent-hash-stamp/after.uwx.md` | 1 | 28 |
| `conformance/starter/editor/fixtures/section-supersede-risk-rating/after.uwx.md` | 1 | 23 |
| `docs/downloads/templates/blank-analyst.uwx.md` | 3 | 738, 772, 804 |
| `docs/downloads/templates/blank-screener.uwx.md` | 3 | 738, 772, 804 |
| `examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md` | 1 | 475 |
| `examples/Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | 1 | 396 |
| `examples/Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | 1 | 393 |
| `examples/Parkview-Apts-Glendale-AZ.uwx.md` | 4 | 2288, 2416, 2523, 2617 |
| `examples/Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | 1 | 375 |
| `examples/Sonoran-Self-Storage-Peoria-AZ.uwx.md` | 1 | 370 |
| `examples/Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | 1 | 335 |
| `examples/parkview-after-L6.uwx.md` | 5 | 1744, 2288, 2416, 2523, 2834 |
| `examples/verification/deal.uwx.md` | 1 | 475 |
| `examples/verification/deal.wrong-cap-rate.uwx.md` | 1 | 475 |

## Typed parser refusals

These remain earlier failures and are never counted as successful empty attribution populations.

| Source | Code |
|---|---|
| `conformance/documents/malformed/11-yaml-flow-mapping.uwx.md` | `UNSUPPORTED_YAML_FEATURE` |
| `conformance/documents/malformed/12-yaml-flow-sequence.uwx.md` | `UNSUPPORTED_YAML_FEATURE` |
| `conformance/documents/malformed/13-yaml-invalid-escape.uwx.md` | `UNSUPPORTED_YAML_FEATURE` |
| `conformance/documents/malformed/14-yaml-unquoted-anchor.uwx.md` | `UNSUPPORTED_YAML_FEATURE` |
| `conformance/documents/malformed/15-uw-version-1-1.uwx.md` | `UNSUPPORTED_FORMAT_VERSION` |
| `conformance/documents/malformed/16-uw-version-2-0.uwx.md` | `UNSUPPORTED_FORMAT_VERSION` |
| `conformance/documents/malformed/17-uw-version-2-1.uwx.md` | `UNSUPPORTED_FORMAT_VERSION` |
| `conformance/documents/malformed/18-uw-version-4-0.uwx.md` | `UNSUPPORTED_FORMAT_VERSION` |
| `conformance/documents/malformed/19-uw-version-absent.uwx.md` | `UNSUPPORTED_FORMAT_VERSION` |

## Activation boundary

This independently establishes the exact population expansion at the assigned base, with zero current tracked-source attribution deltas. The stage-only DQ-06 direction requires removal of the old attribution emission when its governed replacement is implemented; never retain both. It does not remove stage readiness or CC-14 suppression. Final implementation still needs exact field/pass ordering, both trigger families, parent precedence and ordinary result/CLI/receipt-policy tests in TypeScript and Python. The U3 date-only direction is fixed by the owner and independently tested in the adjacent date controls; one ordinary carrier date is not exhaustive date-domain evidence. All other optional-field/agent-presence effects remain outside this census.

Re-run on the final implementation/activation base, including the separately pending RFC0094 implementation. No source or frozen expectation change follows solely from this attribution inventory. It does not establish full Python validation capability, final CI, carrier authenticity or external-reference availability.

Review added an exact-string guard to both trigger lookups: a JSON array containing a tag never asserts that tag. The dedicated non-string canonical/override control passes; corpus populations and findings are unchanged. The integrator separately verified all880 source hashes and all89 newly assessed rows with a fresh parser-only observer.

Only the exact main base is a Git input to reproduction; the original cf311295 review head is a citation, not a required old Git object. For a shallow checkout, fetch the pinned base first: `git fetch origin fa9a9ea37d31b918f5993eae4276b159f31719f3`.
