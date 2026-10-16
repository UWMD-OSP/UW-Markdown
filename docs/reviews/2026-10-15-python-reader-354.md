# Independent Python structured Reader foundation — Issue #354

Status: **partial `parse` capability, no Reader/Verifier tier certification**.
Related: [Issue #354](https://github.com/UWMD-OSP/UW-Markdown/issues/354),
[Issue #356](https://github.com/UWMD-OSP/UW-Markdown/issues/356), and
[PR #358](https://github.com/UWMD-OSP/UW-Markdown/pull/358).

This main-based lane starts at
`50bf4c13206560848c5bb9b045f4532ad3cd8633`. It preserves the existing independent
numeric/source foundation and its nine numeric plus ten source tests, then adds
restricted frontmatter parsing, structured Markdown routing and a Node-free CLI.
It does not depend on accepting draft RFC 0088 or on the broader experimental
reader/evaluator patches preserved from another session.

The implementation is specification-first. No TypeScript reader was used as an
implementation template. Production modules do not execute Node, query expected
outputs, call hosted services, select underwriting assumptions or build models.
The existing portable driver supplies the independent external test oracle.

## Integration and preserved seed evidence

PR #358 is based directly on main, independently of draft RFC 0088 acceptance.
The numeric seed and its nine tests, source scanner and its ten tests, and Python
ignore rules retain the exact reviewed bytes from the preceding source lane.
Only Reader/frontend tests are added; none of those nineteen controls is removed.
The earlier seed correction and 840,000-comparison calendar evidence remain in
[PR #357](https://github.com/UWMD-OSP/UW-Markdown/pull/357) and its immutable
reviewed commit `334029e96e439643b373e69cf47e0940dd720d34`. The initial 4,310-vector
numerical experiment and all its limitations remain in that separate workstream;
this Reader implementation neither repeats it nor selects its observed answers.

The coordinator transfers ownership of the existing three-OS Python CI controls
into this main-based foundation and adds actual portable Reader runs/artifacts.
After this foundation merges, the numerical branch can rebase and cease carrying
those same files in its diff. That is one implementation with preserved lineage,
not an alternative Python kernel or a dependency on RFC acceptance. The manifest's
`0.0.0-dev` is an unpublished experimental identity, not a package/publication or
launch-version decision. Exact-head CI and the coordinator's applicable shared
checks are recorded separately from the local Python results below.

## Requirements inventory

The joint contract includes [Format Part II and Appendix D](../../spec/UW_FORMAT_SPEC.md),
[Protocol II.1, II.6a and XII](../../spec/UW_PROTOCOL.md), applicable schemas and
the normative corpus. Passing 17 portable projections alone is not proof of
every Reader obligation. The manifest deliberately has `capabilities: ["parse"]`,
empty profiles and no tier; it advertises no validation or financial verdict.

| Existing obligation | Implemented evidence | Remaining boundary |
| --- | --- | --- |
| II.1.1: surface required frontmatter | Explicit test checks all ten named fields; no schema defaults | Required-field/schema validity remains validation, not claimed |
| II.1.2: recognize standard section IDs | Generic annotated-block handling; test covers original 21 and every subsequent Format Part IV ID | Section-specific schema checks not claimed |
| II.1.3, XII.1–2: unknown content is informative | Unknown frontmatter keys, unknown sections and `x_*` payload retained; extension-role variant opt-in preserves named peers in either source order | Other representation implementations and full edge-case audit remain outstanding |
| II.1.4, Format 2.7: most recent active block canonical | Physical history retained; last active singleton selected; superseded blocks stay in document order | Retention is not authenticated continuity; V.13 signing guards not implemented |
| Format 2.8: variants and active-role opt-in | Registered parallel sections retained by key; named role-bearing variants collect unannotated peers regardless of order; superseded roles do not activate selection | Calculation role resolution/collision refusals not implemented or claimed |
| Append-only sections | Every active log/calculation/scenario block retained in source order | Pipeline-log portable projection uses complete log objects; other collections use wrapped blocks; no edit claim |
| II.1 byte preservation | Original immutable bytes, BOM/CRLF and UTF-8 spans retained; projections do not rewrite source | No edit or serialization round-trip capability |
| Appendix D | Scalar types, comments, quotes/escapes, one nested mapping level, scalar sequences, empty sequence, feature refusals | Bare numeric/bool/null keys deliberately refuse rather than guessing JSON coercion; no complete Appendix D claim |
| II.6a.6 portable projection | Genuine external-driver run: 17/17, no skips; one unit method also executes the other nine Reader-owned frozen refusals | Complete key-type/capability audit still required before tier certification |
| XII.3 version refusal | Absent/non-string/non-3.0 version refused with existing code and declared/supported values | Only structured Markdown implemented |
| II.1.5 conditional validator obligations | No `validate` flag; missing checks are not reported as clean | Full Verifier validation remains outstanding |

The Format's historic count of “21” is not used to discard later section IDs.
Physical blocks remain available even where a canonical projection selects one.
No metadata defaults are injected; absent and explicit null remain distinct.
A payload member named `content` is ordinary data. `_notes` remains in the
original parsed block and is excluded only from the II.6a parse projection.

## Source, YAML and precision handling

`uwmd_source.py` remains the single carrier scanner and JSON-token decoder.
`uwmd_frontmatter.py` interprets exactly its retained frontmatter byte span.
`uwmd_reader.py` routes those blocks; it does not scan Markdown again.
`uwmd.py` exposes only `manifest` and `parse <file>`.

Both JSON and YAML numbers retain original spelling, pointers and UTF-8 byte
offsets separately from binary64 values. `1.2300`, `1e-6`, `-0` and
`9007199254740993` are not reconstructed from float formatting. Multibyte
characters before a number cannot move its source span.

The final string-key review reproduced an unjustified empty-key refusal:
the expanded quoted-key test failed before correction, then passed after the
decoder admitted empty quoted keys at both mapping levels. Quoted `#`-leading
and embedded-colon keys remain strings; empty-key numeric pointers (`/` and
`/nested/`) retain exact spans/precision. Bare empty or non-string-resolving keys
remain refused without choosing the separately unresolved key-coercion policy.

Appendix D retains YAML 1.2 scalar meaning. The decoder follows the
[Core tag-resolution table](https://yaml.org/spec/1.2.2/#1032-tag-resolution):
unsigned octal/hex spellings resolve numerically; signed prefixed spellings
remain strings; decimal signs are admitted. This is implementation
reconciliation, not an amendment to Appendix D. Escaped VT/FF decode; raw
prohibited controls refuse. Printable NEL/U+2028/U+2029 inside one-line scalars
are not split into fictitious lines. Only CR/LF delimit physical YAML lines.
Plain standalone `-`, `?`, `:` and terminal colons refuse rather than being
mistaken for scalar text; quoted versions and admitted URL/internal punctuation
remain strings. The final review added these controls and extension-role
variant controls without changing the normative corpus.

Duplicate decoded JSON/YAML keys refuse rather than silently select. Non-finite
values and malformed source refuse. `UNSUPPORTED_YAML_FEATURE`,
`UNSUPPORTED_FORMAT_VERSION` and `SOURCE_CONTENT_MISMATCH` are existing codes;
other source failures remain local uncoded diagnostics, not new validator
obligations or financial failure states. The inherited JSON depth limit remains
an explicit resource refusal, not a normative limit.

## Actual verification

Environment: Python 3.12.3, Linux x86_64/glibc 2.39. Python tests and the
implementation process use the standard library only. No Excel or independent
financial return recalculation is claimed.

| Command | Actual result |
| --- | --- |
| `python3 -B -m unittest discover -s implementations/python -v` | **44 passed**, zero failures: 9 existing numeric + 10 existing source + 10 frontmatter + 15 Reader tests |
| `python3 -B conformance/runner/runner.py --impl 'python3 -B /tmp/uwmd-batch2-python/implementations/python/uwmd.py' --tier reader --no-skip --manifest-out /tmp/uwmd-batch2-python-reader-evidence.json` | **17/17 portable Reader passed**, zero failures, skips or unverifiable cases; exit 0 |

The driver launches the Python CLI independently and compares the unmodified
normative parse baselines. Production modules never load those baselines.
The generated machine-path/timing manifest is local evidence; CI should retain
exact-head cross-platform manifests as artifacts rather than repository data.

The unchanged ten source tests separately inspect 17 input files, 107 physical
blocks and 831 JSON numeric tokens. Those are physical checks, **not** another
17 conformance passes. The nine numeric tests include the earlier calendar
correction: the original seed incorrectly expected year-zero rejection,
contrary to Protocol VIII.3. The corrected seed uses integer Gregorian
arithmetic and is retained without adopting RFC 0088.

Prior source-lane remote CI and local subprocess failures remain historical
evidence for their exact trees, not passes for this tree. No local full-suite
failure is reclassified. The coordinator records applicable npm, documentation
and exact-head GitHub gates separately. Portable Reader results remain distinct
from reference conformance, starter tests and independent Verifier certification.

### Nine nonportable Reader-owned refusal checks

The corpus index owns 26 checks as Reader: the 17 portable parse projections and
the following nine existing malformed-document refusals. A single new unit
method reads these Reader-owned index entries, opens their frozen source and
expected-code files, requires `must_parse: false`, and checks the actual raised
code. It neither invokes TypeScript nor changes any baseline or generator.

| Scenario under `conformance/documents/malformed/` | Existing expected code |
| --- | --- |
| `11-yaml-flow-mapping` | `UNSUPPORTED_YAML_FEATURE` |
| `12-yaml-flow-sequence` | `UNSUPPORTED_YAML_FEATURE` |
| `13-yaml-invalid-escape` | `UNSUPPORTED_YAML_FEATURE` |
| `14-yaml-unquoted-anchor` | `UNSUPPORTED_YAML_FEATURE` |
| `15-uw-version-1-1` | `UNSUPPORTED_FORMAT_VERSION` |
| `16-uw-version-2-0` | `UNSUPPORTED_FORMAT_VERSION` |
| `17-uw-version-2-1` | `UNSUPPORTED_FORMAT_VERSION` |
| `18-uw-version-4-0` | `UNSUPPORTED_FORMAT_VERSION` |
| `19-uw-version-absent` | `UNSUPPORTED_FORMAT_VERSION` |

All nine pass within the 44-method run. The original controls tested similar
YAML refusals and different version inputs, but had not executed these exact
sources. The new method closes that specific evidence gap. This is not a claim
that the TypeScript reference runner ran against Python, nor nine additional
portable passes. All currently indexed Reader cases are now exercised through
these two explicitly identified test paths; completeness beyond the corpus
remains a distinct specification review.

### Remaining key-type question before a tier claim

Appendix D preserves YAML 1.2 scalar meaning and says mapping keys must be
simple scalars. It does not explicitly say they must be string-valued scalars.
Protocol XII.1 requires unknown keys to be preserved, while II.6a.6 and the
envelope schema represent frontmatter as a JSON object, whose member names are
strings. The Format's named-field examples do not establish a closed lexical
grammar for unknown keys. The safe-expression identifier grammar governs
expressions, not frontmatter admission.

The precise unresolved question is whether non-string-resolving bare keys such
as `12:`, `true:` and `null:` are outside the UW YAML subset, requiring authors
to quote them, or are admitted and need a specified lossless JSON mapping with
explicit collision rules (for example bare `true` versus quoted `'true'`).
The implementation currently refuses these keys and documents that limitation;
it does not select a coercion rule. This narrow contract clarification is
required before claiming complete Appendix D/Reader support. Existing frozen
Reader refusals do not answer it; no financial or numerical decision is involved.

## Next bounded work and numerical dependencies

Before a Reader tier claim, complete the above-contract review, especially the
specific key-type question and representation edge cases. Verifier work
can proceed on structural checks, period/variant identities, safe-expression
parsing, ordinary arithmetic/null/refusal rules, dictionary checks without
disputed transcendentals, and explicit cash-flow coverage. Advertised
capabilities must be complete; passing subsets do not justify silent omissions.

Issue #356 independently governs power/logarithm-dependent procedures: periodic
NPV/IRR, dated XNPV/XIRR, annuities, NPER and composed checks. This lane selects
no running-product rule, fractional-power algorithm, tolerance, expectation,
receipt migration or cross-runtime bit-identity promise.

Full Format validation, metric verification, all required Protocol II.2
stated-result verifiers, receipts and receipt verification remain unimplemented
here. No projection/model-generation engine, AI-agent runtime, provider SDK or
new optional profile is introduced. RFCs 0085–0088 remain separate drafts;
Issue #355's assurance scope is not expanded by this implementation.

## Bounded period foundation follow-up

This follow-up leaves all existing numeric/source/Reader/frontmatter production
files and their 44 tests unchanged. `uwmd_periods.py` adds the closed five-entry
VIII.2a registry, kind-qualified selector identities, keyed `year_01`/`year_1`
collision detection, all-row inspection and row selection in an already selected
section payload. It uses the existing Gregorian predicate, including year zero.
The existing malformed period fixture supplies one additional narrow source
integration control; its PS-03 and unrelated validation expectations are not
claimed as implemented.

Recovery snapshot `experimental/recovery-python-354-2026-10-15` was inspected as
unreviewed input. Its registry/identity concepts were useful missing foundations;
they were reconciled against current Protocol VIII.2a and RFC 0062 and adapted
without its incompatible Reader or whole-document resolver. No historical
experimental pass count is attributed to this branch.

The APIs report PS-01 warnings and PS-02 errors with JSON pointers relative to
the supplied payload. Malformed rows are all inspected before selection refuses
CALC-PERIOD-001, with existing duplicate-refusal precedence preserved when both
errors are present. A present row with absent/null identity is malformed,
warns PS-01 and refuses selection; no identity is inferred. Non-cash series reject any duplicate
identity; cash-flow series allow repeated valid dates and refuse CALC-PERIOD-002
only when the requested date repeats. Inspection retains original row objects
and authored order, including repeated same-day rows.

Local follow-up environment: Python 3.12.3, Windows. The 59-method unit run
passes (unchanged 44 + 15 new period methods); the actual external portable
Reader driver passes 17/17 with zero skips, failures or unverifiable cases.
Neither result certifies Verifier conformance. The manifest and CLI remain
parse-only. Full document validation, active variant/role selection for calcs,
expression parsing and selector-path integration, safe leaf traversal, override
addressing, PS-03 and all financial verification remain unfinished. No RFC,
version, publication or numerical-policy decision changes.

Frozen corpus checks are narrow API evidence, distinct from portable passes:

| Existing frozen input/baseline | Exact exercised obligation |
| --- | --- |
| `documents/fixtures/13-period-identities` / validation baseline | Exact PS-01 warning and PS-02 error pairs, filtered to these implemented codes; PS-03 and unrelated codes stay unclaimed |
| `cash-flow/reject-duplicate-year-selection` | Exact expected structural code set (PS-02) and both frozen selector refusal codes |
| `cash-flow/valid-same-day-selection` | Absent PS-family diagnostics, exact preserved source-row projection, and repeated/unique/absent-date outcomes |
| `calc/fixtures/period-02`, `03`, `05`–`12` | Ten single-reference selector outcomes against frozen result values/refusal codes; test-only extraction, no expression or calc capability claim |

The arithmetic formulas in `period-01` and `period-04` remain outside this
payload API's scope. No arithmetic was added to make those fixtures pass.

Integrator reconciliation limits PS-02 to one diagnostic per duplicate canonical
identity, at the first colliding row's source-relative pointer; all subsequent
rows remain retained. Duplicate refusals take precedence over malformed-series
refusals when both exist, including a repeated requested cash-flow date. The
follow-up tests pin those mixed cases. Issue order follows source traversal;
this partial API does not promise the reference validator's diagnostic ordering.

The phrase "missing or null section/series/period resolves to null" in VIII.2a
could refer either to an unmatched lookup or an absent identity on a present
row. Its adjacent whole-row inspection obligation and registered year/date
lexical grammars do not admit null identities. Existing implementation precedent
also treats such rows as malformed; the frozen selector fixtures do not settle
the wording ambiguity independently. The conservative decision here preserves
that refusal: absent/null section or series, an empty valid series, and no
matching well-formed identity return null; a present row missing its identity
or explicitly stating null warns PS-01 and refuses CALC-PERIOD-001. Tests
separate these cases across year/date/calendar series. No new interpretation is
presented as authoritative and no spec or frozen baseline changes.

### Local repository gates for the period follow-up

Fresh isolated Windows dependencies resolve every `@uwmd/*` package to this
worktree. Python 3.12.3 and Node 24.14.1/npm 11.21.0 were used. Root build, all
4,179 workspace tests across 185 files, test typechecks, official reference
conformance (1,089/1,089), documentation build, and index/code/version/lockfile
guards passed. Lint exited zero with the existing unused `PARKVIEW` warning in
the docs theme. The final reviewed Python production code separately passed all
59 unit methods and the actual external portable Reader driver 17/17 with zero
failures, skips or unverifiable cases.

These current Windows results do not erase the historical Linux subprocess
failures or substitute for exact-head CI. Node 20/22 and cross-platform Python
results belong to their remote CI runs. This evidence adds no portable
Verifier capability, financial convention or independent spreadsheet result.

---

## 2026-10-16 — Issue #365 joint representation RFC intake

Read-only intake published here at the owner's request on 2026-10-16. This is a joint normative representation question, not a Python-specific implementation defect. **Analysis and recommendation only; no RFC, version, compatibility, authentication-admission or implementation decision is accepted here.**

Baseline: current main `64b9b109abd1d0851087f31c49f07409b5433142` ([merge #366](https://github.com/UWMD-OSP/UW-Markdown/pull/366)). The normative Format, Protocol, receipt, Envelope, RFC 0014/0040/0066 and representation sources cited below are unchanged from issue #365's baseline `b733127df50962469b7f08936ae2bd6de3e46747`. Source links are pinned to the merged main. [Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365) already records the gap; no duplicate issue is needed. The subsequent [draft RFC 0089](../rfcs/0089-lossless-extension-envelope.md) proposes a candidate; it does not accept this intake's recommendations. Earlier open/closed issue and RFC review found related Reader retention, interchange and snapshot-authentication work, but no accepted resolution of this exact joint contract.

### Intake recommendation and owner boundary

Preserve the Format's generic role-opted extension semantics and resolve the container mismatch through a **versioned, minimal extension-entry change**, leaving unrelated Envelope collections alone. A plain block-or-string-keyed-map is a candidate, not an established lossless answer: exact unlabelled versus named identity must first be settled as described below. If that candidate cannot represent every admitted exact identity, use an explicit extension-entry form that can, rather than silently reserving a legal name or normalizing identities. A uniform rewrite of every collection has wider cost without a demonstrated need for this gap.

The smallest genuine owner choice is the scope of the clean break: **minimal explicit extension representation, or a broader uniform active-block structure**. Preserving admitted named extension peers is already required; it is not an optional capability to trade away. The RFC must specify the selected wire shape, exact-identity rule and canonical commitment regime before implementation. Choose the actual version labels and release placement through the normal owner process. This intake assigns no new version numbers, adds no historical readers or migration layer, and authorizes no implementation.

### 1. The accepted contracts must be read together

| Contract | Requirement and consequence |
|---|---|
| Format §2.8 / RFC 0040 | Roles are permitted on any section, including standalone blocks. A role-bearing section with explicit variant fences collects **all active named variants**, outside the builtin registry, before version selection. Conversion preserves roles. An extension does not lose this general rule merely because its id starts `x_`. [Format roles and opt-in](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_FORMAT_SPEC.md#L580), [RFC 0040 contract](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0040-variant-role-resolution.md#L29), [writer preservation](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0040-variant-role-resolution.md#L89) |
| RFC 0066 | Records that role/variant opt-in applies generically; without that opt-in, repeated ordinary blocks retain update routing. It does not amend the extension wire shape. [routing observations and scope](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0066-calc-identifier-variant-resolution.md#L235) |
| Format §4.21 | Extension ids begin `x_`; parsers collect them under `parsed.extensions[id]`; extension schema and cross-section consistency validation are skipped. This is a collection rule, not permission to discard a legal peer. [extension rules](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_FORMAT_SPEC.md#L3233) |
| RFC 0014 / Envelope schema | `sections[id]` admits a block or variant map; `extensions[id]` admits one block. The schema repeats that asymmetry. Generic `superseded[id]` arrays have no exclusion for extension ids. [normative type](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0014-multi-format-interchange.md#L102), [sections schema](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/schemas/uw-document-envelope.schema.json#L64), [extensions and history schema](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/schemas/uw-document-envelope.schema.json#L85) |
| Model fidelity | Preserve complete fenced payload, its sole `_meta`, annotation and exact preceding block prose; preserve scalar types, absence versus presence, arrays, variants and superseded order. A model encoding must decode to the same semantic Envelope. [preservation and equivalence](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0014-multi-format-interchange.md#L135) |

Thus two named active `x_review` variants, one opting the section into roles and the other lacking a role, cannot be represented under the declared singleton extension entry without dropping a block or inventing an unapproved shape. Storing only the chosen financial/primary block also changes the complete document commitment. Moving peers into `sections`, inventing a payload wrapper, aggregating them, or declaring an export a model-fidelity representation does not cure that loss.

Current TypeScript types and routing are implementation evidence of the gap, not authority to narrow the Format: [ParsedUWFile singleton extension type](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/types.ts#L503) and [extension routing before generic variant routing](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/parser.ts#L467). Python's refusal to compute a whole-source digest for an unrepresentable extension map is conservative; this intake does not replace it with invented canonical bytes.

### 2. Exact identity constrains the candidate shape

`variant` is a string in the Format; neither the inspected Format nor accepted RFC 0040/0066 reserves the literal name `default`. Generic selection precedence mentioning `default` is not a prohibition on authoring that name. Existing string-map routing projects an absent label to the key `default`. That projection collides if a source is otherwise admitted with both an unlabelled current block and a current block explicitly named `default`. [fence field](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_FORMAT_SPEC.md#L383), [current fallback key](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/parser.ts#L481)

The accepted opt-in text specifically promises *named* variants. Its peer-without-role precedent does not alone prove that every mixed unlabelled/named source is admitted as parallel. RFC 0066 records one-current-block routing when all variants are absent, but does not close this mixed collision. **Do not label the collision a separately proven ordinary Reader bug; close the admission condition in the RFC before claiming a raw string map is fully lossless.**

Two independent contracts make normalization unacceptable as a general identity rule:

- VIII.12 references use null for an unlabelled source and a string for that exact authored variant, with no default/base/role/key fallback. V.12 cash-flow bindings likewise require the exact explicitly authored variant. [reserve binding identity](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L3119), [modeled-payment identity](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1076)
- V.13 intentionally uses absent-to-`default` in its singleton collision *admission key* and refuses ambiguity. It also explicitly refuses repeated extension ids and superseded extension blocks. Those are authentication restrictions, not a global reserved-name rule or permission for ordinary codecs to overwrite blocks. [snapshot admission guards](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1384)

The representation choice must either demonstrate that a problematic combination has only one current block under accepted routing, or encode distinct exact identities when both are admitted. An explicit null slot or tagged identity is possible research material; no particular encoding is selected here. Empty and unusual legal labels, labels `annotation`/`content`, JSON Pointer characters `/` and `~`, and existing unsafe-key guards also need explicit tests. Do not use the presence of a property named `annotation` as the only block/map discriminator, or introduce new label bans as an implementation shortcut.

### 3. Lossless options and compatibility consequences

| Option | Benefit | Required accounting / limitation |
|---|---|---|
| Widen singleton extensions in place under existing Envelope stamp | Small type/schema delta; previously representable singleton canonical values could remain unchanged if their projection and stamp remain identical. | Older strict decoders reject maps. It is not universally compatible. Same-version correction would need explicit normative justification and proof about old admitted preimages/refusals; an earlier erratum is not blanket permission. It also does not solve nullable identity automatically. Not recommended as an unannounced patch. |
| Versioned minimal extension entry | Bounded correction; preserves current collection namespaces, payloads and history; avoids restructuring unrelated builtin sections. | Must make exact identity and block/map discrimination unambiguous, update codecs and commitment versions coherently, and acknowledge broad digest effects if the Envelope stamp changes. Recommended scope. |
| Uniform tagged records/lists for all active collections | Can express exact nullable identity and avoid structural guessing consistently. | Larger public type/wire/path break across all ordinary sections. Lists introduce order semantics unless a deterministic identity ordering is explicitly governed. No accepted financial requirement demands this broader change. |

For every option, preserve `_meta`, `_role`, other ordinary payload members, annotations, prose, unknown Envelope members, absence/null distinctions and ordered history. Existing `superseded` is a usable location for extension history under the ordinary Envelope schema; do not claim a new active-entry map alone solves history. No direct merge of recovery designs is appropriate.

### 4. JSON, XML, CSV and discovery must agree

- **JSON:** wire shape is the Envelope; the shared JSON schema is semantic authority. Update the type, structural validator, parse/projection/reconstruction and JSON round-trip together. Unknown members remain preserved. [JSON authority](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0014-multi-format-interchange.md#L214)
- **XML:** its generic typed tree can mechanically carry a nested extension map or explicit entry, but the declared model is Envelope 1.0 and the codec validates that contract. Update admitted Envelope validation and the mapping's stated version relationship coherently. A new Envelope label does not by itself imply a new XML namespace; mapping/namespace decisions are separate. The XSD alone does not prove full semantic conformance. [XML contract](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_XML_MAPPING.md#L12), [version attributes](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_XML_MAPPING.md#L36), [digest checks](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_XML_MAPPING.md#L95)
- **CSV:** normalized block descriptors and exact Envelope JSON Pointers are part of reconstruction. Current extension rows require `variant: null`, no ordinal and one `/extensions/<id>` block. Enumeration, reconstruction, `block_ref`, flattening, manifest version/digest checks and deterministic bundle expectations need real changes, not just a schema allowance. [bundle tables and pointers](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_CSV_BUNDLE.md#L24), [manifest integrity](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_CSV_BUNDLE.md#L50), [current enumeration](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/uwcsv.ts#L439), [current reconstruction restriction](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/uwcsv.ts#L720)
- **Discovery/negotiation:** capabilities expose `representation_version`, not an accepted-Envelope-version set. HTTP Accept selects an encoding and fidelity, not a version of its neutral model. Existing media-type dispatch strips parameters, so inventing `;version=...` is not working version negotiation. A clean break can ship one newly supported regime with accurate descriptors and fail closed on unsupported versions; simultaneous version negotiation would itself need a governed contract and is unnecessary under the proposed clean-break scope. MCP conversion must still decode once through the same shared Envelope. [capability and negotiation contract](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0014-multi-format-interchange.md#L166), [HTTP selection](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/bindings/UW_HTTP_BINDING_v1.md#L35), [registry behavior](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/codec.ts#L34), [MCP conversion](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/bindings/UW_MCP_BINDING_v1.md#L81)

### 5. Canonical commitments and authentication

Keep RFC 8785 and SHA-256. JCS recursively sorts object keys by UTF-16 code units, preserves array order and Unicode strings without normalization, and specifies ECMAScript primitive serialization. It cannot reconstruct a discarded block or choose an absent identity. A new container preimage changes a commitment even when JCS itself is unchanged. No number renderer, financial kernel, quantum, tolerance or RFC 0088 choice is needed. [RFC 8785 §§3.1–3.2.4](https://www.rfc-editor.org/rfc/rfc8785.html#section-3)

The complete Envelope semantic digest removes exactly top-level `generated_at`, `generator` and `semantic_digest`; it includes `envelope_version`. Therefore changing that stamp changes **every structured subject digest**, including singleton-only documents with otherwise unchanged values. Do not describe the effect as limited to extension-bearing documents. Conversely, retaining the stamp and identical projection can preserve already representable preimages; that requires explicit decision and proof, not an assumption. [Envelope semantic value and hash](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-verify/src/envelope.ts#L169), [receipt subject definition](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_RECEIPT.md#L87)

| Surface | Consequence / preserved boundary |
|---|---|
| Receipts | Update the canonical subject regime explicitly when its commitment rules change; `canonicalization_version` is independent of representation version. Existing mismatch precedence is RCP-10 for differing canonicalization versions with disagreeing digests, not a new claim of tampering. Do not rewrite/relabel historical receipts. A fresh artifact is independently issued under the selected regime. The separate quantized `results_digest` need not change from a container-only change. [receipt precedence](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_RECEIPT.md#L165), [version behavior](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_RECEIPT.md#L263), [result commitment](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_RECEIPT.md#L120) |
| Document signatures V.13 | The current source projection, artifact subject and schema pin exact versions and guards. Unsupported versions remain unverifiable/INT-14; a same-regime subject mismatch remains failed/INT-11; required authentication accepts only verified. Update the regime through the RFC without silently changing existing canonical bytes. **Do not loosen duplicate/superseded-extension or other guarded-source admission merely because a new ordinary codec can preserve it.** Any broader authenticatable source domain is a separate explicit decision. [exact subject](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1357), [projection and unchanged canonicalization](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1398), [states and precedence](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1431), [signature schema](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/schemas/uw-document-signature.schema.json#L10) |
| Block integrity / block signatures | Block content hash removes `_meta` only; the block signature commits its six existing fields. A pure outer-container correction changes neither subject if their values stay the same. Block signatures do not authenticate complete peer assembly or substitute for V.13. Preserve chain/lifecycle rules and never use block verification to bypass document admission. [block hash](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L831), [block signature input](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L940) |
| Modeled payment binding V.12 | Separate preimage: exact variant/index, full ordered selected series, document currency and fixed section. It excludes unrelated document metadata/prose and is not a whole-Envelope digest. Container-only changes need not move it. [fixed preimage](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1092), [exclusions](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L1130) |
| Lease-up projection / property cash-flow assembly | Complete source Envelope digest, including history, travels with exact source evidence; downstream assembly carries that source identity. Preserve snapshot agreement; reissue derived artifacts when their governed source identity changes. [lease-up commitment](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L2473), [assembly shape](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L2841) |
| Reserves / reserve-draw bindings | VIII.11 and VIII.12 use the complete Envelope digest even when checking selected sources. Keep full-document identity, exact variants, digest-unavailable/stale states and evidence precedence. A binding plan currently has only a digest, not an independent canonicalization label; an old plan can become stale under a newly selected regime. Never auto-rehash it into a verified plan. [reserve digest](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L3055), [binding plan and precedence](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_PROTOCOL.md#L3119) |

Additional implementation consumers to inventory in the RFC: package primary semantic commitments ([package helper](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-core/src/cli-packages.ts#L125)), batch semantic/fact identities ([batch identity](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-batch/src/index.ts#L162)), lake semantic primary keys and flattened paths ([lake ingestion](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-lake/src/ingest.ts#L35)), workbook source contracts and stale checks ([workbook contract](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-excel/src/mcpSheet.ts#L139), [workbook stale check](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/packages/uwmd-excel/src/mcpSheet.ts#L362)), and HTTP semantic ETags/digest headers ([HTTP validators](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/bindings/UW_HTTP_BINDING_v1.md#L53)). A changed canonical regime can change identity/cache keys without changing financial payload. Keep old issued artifacts as evidence; do not rewrite a stored subject or primary key as though its new hash had always been its identity. Raw-file package hashes, row-specific commitments and financial formulas remain distinct subjects.

### 6. Version requirements and bounded RFC delivery

Envelope version governs container shape; Format version governs section semantics; codec/bundle versions are independent. Fixing representation completeness need not invent a new Markdown grammar or change which named role-opted extensions are legal. But the RFC must explicitly reconcile the existing Format wording, Protocol verification references, receipt canonicalization subject and document-signature constants with the selected container. Do not automatically copy one surface's version into another. [independent Envelope/Format/codec contract](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/rfcs/0014-multi-format-interchange.md#L130), [independent canonicalization version](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/spec/UW_RECEIPT.md#L291)

Changes to document meaning or verification are Protocol changes, not merely starter-product semver. Public type changes also require package accounting and exact dependency repins. A Format major requires a Protocol major, but there is no basis here to declare that the Markdown Format must change simply because the neutral container does. Existing launch/reserved-major policy constrains release placement; do not solve that by silently calling a break minor or choosing a literal major here. [version matrix rules](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/VERSIONS.md#L404), [Protocol/package policy](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/wiki/11-build-release-governance.md#L53), [launch version policy](https://github.com/UWMD-OSP/UW-Markdown/blob/64b9b109abd1d0851087f31c49f07409b5433142/docs/wiki/11-build-release-governance.md#L88) The proposed pre-release correction uses a clean break rather than compatibility readers or migration machinery; release placement remains owner-controlled.

A bounded RFC/implementation should cover only the chosen representation correction, shared projection/schema/types, three model mappings, descriptor/binding documentation, commitment/version accounting and conformance. It must include:

1. Both source orders for two named role-opted extension peers; one peer without a role; role-free/superseded-role controls preserving accepted routing.
2. Complete payload/provenance/annotation/prose, unknown members, absent/null/types and extension history; every admitted block accounted exactly once across Markdown, JSON, XML and CSV.
3. Explicit unlabelled versus named `default` admission/identity cases, block/map discrimination and escaped labels; no fallback selection or overwritten peer.
4. Independent expected Envelope values and canonical UTF-8 subjects, plus cross-codec digest equality. Do not derive the expected contract solely from current TypeScript output or loosen JCS errors.
5. Previously representable singleton cases demonstrating the exact selected version/preimage effect, received-digest mismatch rejection, and receipt/signature version/state precedence. Existing issued subjects are not edited.
6. V.13 repeated/superseded-extension refusals retained unless the owner separately approves an authentication-domain expansion; ordinary history round-trip must not imply authenticated history admission.
7. Whole-source reserve/binding digest behavior, stale binding refusal without arithmetic, and untouched separate block/row/result commitments. No financial convention or experimental numerical kernel activation.

This original intake changed no source files, normative text, RFC state, PR/issue or public branch. Its publication and draft RFC are documentation-only follow-ups; this evidence section does not adopt their proposal. The separate final #366 code review examined exact head `deebe48ce697b787c763b033e614763f8937f73c` and reported no material defect; completed prior test and numerical investigations were not repeated.

### 2026-10-16 — Draft RFC 0089 candidate refinement (not acceptance)

The separate [draft RFC 0089](../rfcs/0089-lossless-extension-envelope.md) now
spells candidate source-to-mode rules, exact null/string identity, canonical
peer ordering, JSON/XML/CSV mapping examples and positive/negative/cross-version
fixture procedures. Its [small frozen preimage experiment](../../experiments/envelope-0089/README.md)
contains five synthetic subjects checked independently with Python and Node.
It demonstrates stamp-only digest impact and one-peer mode identity in a bounded
ASCII/integer domain; it does not establish general JCS, codec or signature
conformance, change current admission, or implement the candidate. Current CSV
extension descriptors use null; the proposed new mapping explicitly changes
current extension rows to exact annotation identity and keeps historical row
semantics separate. Receipt RCP-10 still requires digest disagreement as well as
version difference; document-signature shape/version/source checks retain their
accepted precedence. The owner has not accepted the tagged design, mixed
null/default admission or any version/release allocation. All current normative
artifacts and historical expectations remain unchanged.
