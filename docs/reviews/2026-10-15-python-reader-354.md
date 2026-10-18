> **Owner rule,2026-10-17:** prelaunch compatibility, migration/version analysis
> and historical-artifact retention work described below is retired. Apply the
> rule in AGENTS.md/CLAUDE.md. Current diagnostic/conformance tests remain;
> the old retention inventory and replay companion are not required checks.

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

**Current Lane C disposition — 2026-10-17:** the owner approved the exact
RFC0089 design direction: D1 tagged single/variants, D2 role-opted nullable
identity distinct from literal default, D2b portable minimum, total ASCII
JSON-lexical XML, complete CSV block-extra/empty carriers and complete E_NEXT/
C_NEXT subject under unchanged V.13 admission and Receipt5.5. RFC0089 remains
draft until remaining evidence/synchronized contract gates pass. No production
schema, capability, version or publication is authorized. No selected package
choice remains open, and no prelaunch compatibility/archival work is scheduled.

The focused [model-admission checkpoint](../../experiments/envelope-0089/model-admission/README.md)
adds six schema/semantic tests on a newly authored complete ten-block value,
80 metadata-shape negatives and10 layer-attributed candidate refusals. It keeps
the normative schema unchanged. Empty builtin variant slots are refused by its
existing minProperties1 rule even though the earlier experimental carrier can
encode them; empty outer collections and history arrays remain lawful. Three
conditional provenance controls illustrate that schema admission is not complete
Format validation. These are engineering boundaries, not new diagnostic
allocations or owner decisions. Accepted RFC0090/0091 remain authority.

Prior portable five-test/all-OS, namespace38, raw JSON and codec proofs are reused;
no completed matrix is repeated. Full source/physical accounting, complete
conditional/domain/transport admission and actual supported-subject public
signing/receipt state-machine evidence remain open. See the
[owner direction and remaining gates](../rfcs/0089-lossless-extension-envelope.md#exact-owner-approved-direction).
Earlier intake observations below describe their stated checkpoints, not current
compatibility obligations or permission to activate the representation.

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

### 2026-10-16 — Current Envelope1 compatibility proof (read-only)

The [existing-contract experiment](../../experiments/envelope-0089/README.md#current-envelope1-admission-proof-separate-from-candidate-design)
checks the frozen historical empty1.0 and candidate tagged values through
unchanged repository schemas with existing Ajv2020 and the existing public
verified-JSON runtime. Ten precise layer controls and five low-level hash checks
pass; the measured validator versions and schema/source/built-module hashes are
frozen separately. E_NEXT alone fails version admission. The candidate wrappers
under an intentionally false1.0 stamp fail missing required block annotation/
content before digest comparison. Unknown members are still admitted; this is
not a new ban on mode/blocks keys. Raw semantic hash helpers agree on candidate
bytes but do not validate/admit their version or shape. No candidate codec,
custom schema, compatibility shim, new conformance fixture or Protocol verdict
is introduced. Signature/receipt/XML/CSV execution and general candidate
validation remain unclaimed. Mixed-identity design, independent versioning and
release placement remain unapproved owner decisions.

### 2026-10-16 — Concrete unaccepted RFC0089 codec/reissuance examples

The [isolated candidate lab](../../experiments/envelope-0089/README.md#complete-candidate-codec-artifacts-and-explicit-reissuance-examples)
now freezes five complete JSON/XML/normalized-CSV models, four original structured
sources with physical accounting/reissuance plans, exact canonical subjects and
artifact inventories. The examples cover single, one-peer variants, mixed null/
literal-default, ordered history and direct-model unknown members. Twenty
focused Python methods and two independent Node subject/artifact tests pass.
The lab is a validation/codec subset, not a complete normative validator or new
Reader/Verifier capability; unsupported prototype domains refuse explicitly.
Controls also pin finite binary64 token decoding, exact XML structural whitespace
and existing ECMAScript prose trimming; these are accepted value/whitespace
semantics, not new numeric or source contracts.
Legal JSON strings/member names that XML1 cannot express remain legal JSON/CSV
and trigger an explicit XML refusal; a versioned escaped-string/name mapping is
an unapproved design option. Source reprojection uses retained physical blocks,
not the existing default-key ParsedUWFile/portable projection, whose mixed-null/
default collision this Envelope candidate alone does not fix. Admitting that
mixed identity entails public projection/type/Protocol/Format accounting too.
Missing original source plus no complete attributable archive blocks migration;
old subjects remain immutable and new authentication/receipts/plans require their
own approved issuance. V.13 guards, all existing schemas/codecs, current digests,
receipts, conformance flags/expectations and reserved5.0 remain unchanged.


### 2026-10-16 — Independent Astra RFC0089 review: existing defects and design gates

External input: `Recommendation keep RFC 0089 in dra.txt`, 17,559 original bytes,
SHA256 `60c4469f95d1317d469362b159dd9be7f1ca37740dad89aaaac6fd5b04d9614d`.
It reviewed main `3eee0fbab3f5682dc345804782994dc22d321fae` and draft368
`2ebe454a923072018e1af067285dd3140a10d40f`. Its recommendations are evidence,
not instructions, owner decisions or automatically established defects. The
integrator independently inspected the accepted contracts/current code, checked
RFC8785 and XML1, and separately reproduced the canonicalizer word/byte behavior.
The existing Envelope experiment contains focused executable reproductions and
frozen source/schema/runtime/observation identities. Production files, normative
schemas, existing fixtures/results, package versions and release states remain
unchanged.

| Finding | Classification and independently established scope |
|---|---|
| TypeScript extension peer/history loss | **Verified.** `parser.ts` routes `x_` before superseded/variant handling. The four-physical-block source retains only one extension and no extension history. Changing a discarded active peer, or discarded history, changes raw source SHA256 but leaves its receipt subject unchanged. A fixed control receipt still verifies; this is a lossy projection, not a cryptographic collision. Python retains both named peers/history and refuses the unavailable Envelope1 digest; V.13 refuses that source. |
| Lone-surrogate JCS admission | **Verified.** Distinct U+D800/U+D801/U+DC00 strings, as values and keys, retain distinct UTF16 code units in canonical text but UTF8 conversion substitutes U+FFFD. Their digest inputs match the real U+FFFD string. Schema and verified-JSON admission do not catch it. Valid surrogate pairs remain distinct. RFC8785 §3.2.2.2 requires refusal, not substitution/normalization. |
| CSV block extras | **Verified.** The unchanged Envelope schema admits an extra outer block member. Encoding then decoding loses it and fails CSV_DIGEST_MISMATCH, both directory and actual ZIP APIs; the no-extra control passes. Payload/annotation extras and unknown outer-document members are separate carriers and do not solve this block-member loss. |
| Universal XML1 mapping over the admitted JCS domain | **Contradicted.** NUL/U+FFFE/U+FFFF values or member names are legal JCS strings and outside XML1's Char production; XML character references cannot make them legal. The lab's explicit refusal is safe, but does not prove universal interchange. |
| Tagged candidate's full fidelity | **Partially verified.** Five frozen models/60 artifacts demonstrate the stated bounded domain, identities, mode, explicit history, payload/prose and local negative controls. Nonempty builtin composition, legal block extras, empty history slots and overwritten unmarked revisions remain outside the prototype. Absence/literal-default source coexistence is an unaccepted decision. |
| Commitment and reissuance effects | **Partially verified.** Envelope stamps, wrappers and newly retained content change subject bytes; current commitment/version and source guards are inspectable and old-regime controls are reproducible. Candidate accounting plans are not real receipts, signatures, authenticated archives or executed migrations. |
| Complete cross-implementation/new-regime interoperability | **Unverified.** Node independently verifies subjects/artifacts, not a second XML/CSV decoder. New-regime authentication, actual candidate ZIP exchange and full-domain independent migration remain unproved. |
| RFC0085 retained-history compatibility | **Partially verified as architecture.** Lossless retention can support its proposed authority; neither draft is accepted and metadata/hashes alone cannot prove historical completeness. No archive replacement or transfer of old authentication is justified. |

#### Existing-contract defect dispositions; no activation in this PR

1. **Shared JCS Unicode rejection:** a small separate implementation correction is
   justified under the already adopted RFC8785 contract. Reject unpaired high/low
   surrogates in the shared string serializer, covering values and member names;
   preserve valid pairs, U+FFFD, control escaping, UTF16 sort order and all valid
   preimages. Regression controls must cover direct/nested values/keys and public
   digest/receipt/signature boundaries. This changes historically accepted invalid
   inputs to refusal and can change receipt/document verdicts. Prepare a bounded
   patch for review, but obtain explicit disposition of those authentication
   compatibility effects before activation; never sanitize input or rewrite an
   old artifact to keep it verified. No new numerical/financial rule is needed.
2. **Extension routing/source-accounting:** accepted Format2.8/RFC0040/0066 require
   named peers, but Envelope1 cannot represent them. Do not repair peer storage
   by inventing a map in its singleton slot. Moving explicit history routing
   earlier can also change current heads and authenticated subjects. A bounded
   parser/history correction or whole-source receipt guard needs an exact
   compatibility decision and regression evidence before activation. Retain the
   source and V.13 guard; the coherent lossless public/wire correction stays in
   RFC0089. No automatic first/last-peer choice, digest refresh or receipt rewrite.
3. **CSV legal block members:** the defect is established, but full preservation
   has no existing CSV1 carrier: the normative scope vocabulary is closed to
   annotation/meta/content, plus separately carried prose. A fourth scope is a
   mapping change, not an implementation-only interpretation. Keep its complete
   carrier/version proposal in RFC0089. An encoder-side refusal could prevent a
   self-unreadable artifact, but would narrow current accepted inputs; it is not
   a model-fidelity fix or permission to drop members. No schema tightening,
   silent extra field, downgraded view claim or baseline rewrite is authorized.

The receipt projection example does not establish that a real historical issued
receipt was exploited or that the discarded content was previously authenticated.
The frozen receipt is an unsigned, fixed constant-calculation control. It proves
the current binding omission and verdict path. Block signatures cover their own
subjects; they do not prove full peer assembly. Do not retroactively widen the
scope of an old digest/signature.

#### Exact remaining normative decisions for draft0089

- Choose the lossless tagged extension design and its precise current/history
  domain; settle mixed absent/literal-default identity and the corresponding
  portable minimum projection, public API and Format/Protocol consequences.
  Same-identity current-revision controls must reconcile Format2.7's last-current
  text with observed TypeScript higher-revision/first-tie routing. Preserve
  physical accounting separately; no prototype refusal becomes normative by use.
- Approve a carrier for every schema-admitted block member, including unknown
  extras, across JSON/CSV/XML and all current/history/builtin collections. The
  RFC proposes an explicit new-version `block-extra` typed-row scope.
- Choose total reversible XML lexical escaping for both names and values or an
  explicitly partial representability contract. The RFC now defines an ASCII
  JSON-string lexical alternative, strict decode/duplicate rules and a separate
  base64 option; none is accepted or silently added to XML1.
- Select coherent subject/version and independent codec/Format/Protocol/package
  accounting, unsupported-version/refusal precedence and clean-break new issuance
  from complete attributable retained content. Preserve historical artifacts and
  unchanged independent block/V.12 subjects. No number or release is selected;
  UWMD5.0 remains reserved for its owner-approved public launch.

Preserving V.13's repeated/superseded-extension authentication refusal is the
current scope. Expanding it would require an additional explicit decision and
independent authentication proof; codec acceptance cannot imply that expansion.
RFC0085's authority model remains under its existing ownership. Existing source
archives must not be replaced by clean projections or claims of recovered history.

Before acceptance, freeze independent complete expected models/preimages and
positive/negative/cross-version fixtures for each chosen boundary. Add a genuinely
independent XML/CSV decoder, actual candidate ZIP/security evidence, new-regime
receipt/signature execution and unsupported-version/migration/refusal controls.
Resolve existing defect dispositions explicitly. Production deployment and any
release remain separately controlled; green research CI does not accept a draft.


Integrator replay caught and corrected evidence harness defects before publishing
this intake: an unwired read-only output option, fresh volatile timestamp
comparison, and Windows Python stdin decoding UTF8 through cp1252. The original
worker observations remain archived and are not treated as valid same-source
Python/valid-Unicode evidence. Corrected strict UTF8 transport checks exact source
SHA equality and valid Unicode canonical bytes. All three production findings
remain independently reproduced; no conformance expectation or production source
changed. Host object prototypes are detached before comparing serialized JSON
evidence; original volatile timestamps are explicit replay inputs for exact
transport comparison. Successful replays supersede the failed harness checkpoint,
without rewriting its original observation bytes.

### 2026-10-16 — Bounded JCS correction: authenticated-input compatibility

DraftPR373 separates existing RFC8785 string admission from RFC0089's proposed
container/mappings. The initial minimal guard leaves valid subjects unchanged,
but rejecting invalid Unicode affects more than source digests. The linked
`2026-10-15-python-reader-354.jcs-boundaries.repro.mjs` and preserved
`2026-10-15-python-reader-354.jcs-boundaries.initial.json` reproduce baseline
versus initial guard behavior using synthetic constant/string packs and recording
stubs. Stubs establish ordering, never cryptographic validity. Source and built
canonicalizer hashes are recorded; these are research observations, not fixture
expectations or newly selected normative outcomes.

The initial guard made signed receipt metadata/payload canonicalization and late
invalid-string results digest verification throw; invalid document key ids reached
INT13/backend_error without a backend call. Invalid block-signing actor/kid inputs
also threw. Unsigned receipt metadata and fields excluded from each committed
input were unaffected. Direct digest/signing-input helpers appropriately retain
a typed domain refusal. Do not globally reject excluded metadata to simplify
handling, or label all these cases source RCP09.

Independent accepted-contract review identifies bounded existing-code handling:
Receipt5.1 step4/signature nonvalidation uses RCP01, step6/nonrecomputable results
digest uses late RCP04; issuance requires the existing typed RCP_COMPUTATION_FAILED
error. ProtocolV.13/RFC0084 malformed admitted signing input uses INT09 rather than
a backend-outage label. Block six-field signing-input refusal uses existing INT07
malformed-signature handling with present count retained and backend uncalled.
These are routine implementation catches, not new receipt codes or separate
owner-controlled conventions. Existing earlier subject/input/pack/key/backend
and engine precedence must remain intact. Only the internal Unicode error is
caught; arbitrary backend exceptions are not relabeled as invalid signatures.

RequiredCI38995064642 at initial0af95aff failed one existing XML assertion: the
earlier JCS rejection escaped instead of XML_CHARACTER_INVALID. The correction
preserves that exact XML public boundary using a private typed Unicode subclass;
it does not change XML1's domain, mappings or any existing assertion. Focused
183 tests, build and test typecheck pass after that correction; broader boundary
regressions remain an explicit follow-up checkpoint. The failed CI is retained,
not described as green.

The genuine owner hold remains activation and historical invalid-subject/verdict
consequences. No source sanitization, old-artifact rewrite, receipt reissuance,
version allocation, normative schema change or release is authorized. Full
Envelope/CSV/XML interoperability remains a separate unaccepted RFC0089 decision.


The final bounded correction implements those existing-code catches and preserves
receipt issuance's original validation/option-read/await ordering. Its
`2026-10-15-python-reader-354.jcs-boundaries.corrected.json` replay uses the exact
same original source as the retained initial observations and records current
source/built-module hashes. Signed receipt metadata now fails RCP01 with backend0;
no backend still gives earlier RCP08, and unsigned metadata remains unchanged.
Late unencodable results use RCP04; issuance throws typed RCP_COMPUTATION_FAILED.
Document signing input preflight follows existing shape admission and precedes
version/source/backend, so malformed encoding is INT09 even with an unknown
version; an encoding-valid unknown subject is still INT14 before source checks.
Block kid/actor inputs produce INT07 with present count retained/backend0.
Direct helpers still refuse invalid domains, and actual backend exceptions retain
their prior behavior. These mappings use accepted contracts, not owner choices
about a new receipt rule.

All234 focused actual Vitest tests across five files, package build, test typecheck
and focused lint pass. The same-source independent boundary replay passes.
Required final-head CI remains a separate checkpoint; neither the failed initial
run nor these focused results are a claim of complete interoperability. Historical
invalid-subject activation remains owner-held, with no fixture or version changes.

### 2026-10-16 — Explicit launch policy and completed JCS disposition

The [owner policy](../../VERSIONS.md#public-launch-compatibility-policy-owner-decision-2026-10-16)
makes 5.0 the first public compatibility baseline. Earlier review/hold language
above records its dated investigation state; it does not require prelaunch
readers, receipt regimes, migration shims or old malformed-input acceptance.
Strict RFC8785 refusal is now approved forward behavior. #373 merged as
`765e2c4b6e2caf532f13d06c94234615932b47c7` after exact reviewed-head
CI38995962876; exact-main CI38999614992 is separate integration evidence.

The [final real Ed25519 review](https://github.com/UWMD-OSP/UW-Markdown/pull/373#issuecomment-6229113331)
retains original invalid-source artifacts and proves corrected source refusal.
A separately supplied valid U+FFFD peer can still match an old subject/signature;
this does not recover the historical preimage or authenticate malformed input.
No retrospective revocation, silent normalization or new-semantic historical
authentication is claimed. The completed JCS correction needs no additional
legacy-support decision in RFC0089. Parser peer/history and CSV block-extra
representation remain separate governed defects and draft design work. Their
historical subjects/results remain audit evidence, not compatibility gates.
The specific Envelope/projection/codec and RFC0085 history-authority choices,
new-regime authentication evidence and independent version allocation remain
unapproved. No experiment, frozen answer, schema or release is changed here.

### 2026-10-17 — Exact minimum and real authentication decision checkpoint

The [focused decision proof](https://github.com/UWMD-OSP/UW-Markdown/blob/c1c60b879e5e41530fcc35a5b949147328f7b9ed/experiments/envelope-0089/decision-proof/README.md)
reuses seven unchanged candidate models and four original source files. It
freezes the proposed exact extension/history parse minimum separately from the
complete subject. Real Ed25519 controls (public research seed) retain42 mutation
pairs and14 label pairs: payload/metadata/notes/prose change commitments; key
order and excluded Envelope volatility do not. Notes/prose can change full
subjects while leaving the portable minimum unchanged. Cryptographic byte
binding is not source completeness, trusted issuance or financial verification.

Actual current V.13 admission precedes candidate document gating: singleton and
one-peer sources map exactly to the complete frozen model after admission;
mixed nullable peers and ordered extension history refuse INT15, and three
model-only inputs have no attributable source gate. Current-label document
artifacts and literal1 constant-pack receipts verify with real backends; changed
source notes refuse INT11/RCP01 before backend execution. Candidate document
labels refuse INT14. Candidate receipt controls yield RCP10 because both digest
and canonicalization version differ, not simply because a label is unsupported.

Four additional actual Receipt5.5 controls preserve matching digests: changing
only signed canonicalization-version metadata proceeds to the real backend;
retaining its original test signature fails RCP01, while a new disposable test
signature verifies. This does not implement that canonicalizer, reissue a
historical artifact or change accepted receipt rules. No candidate financial
receipt is issued. V.13's extra source bans are not new receipt prerequisites.

Root and independent numerical-lane reviews found no material remaining defect;
root read-only executions reproduce both matrices and focused Biome passes.
The original WindowsNode24 observations, full179source/86compiled hash maps,
helper/spec/schema identities and all prior21/60 artifacts remain unchanged.
Ordinary Node20 CI reuses its existing build for exact deterministic material
replay; actual CI results must be recorded separately from this local evidence.

The draft converges to three linked owner choices: tagged/null identity plus
exact portable minimum; total lexical XML/full CSV block-extra and explicit
empty-collection carrier; a new complete semantic subject with unchanged V.13
admission and Receipt5.5. Empty-container and full schema/domain fixtures,
independent codec/platform/namespace/ZIP evidence and actual candidate financial
receipt verification remain incomplete. Direction approval does not complete
these acceptance gates. RFC0085 retained-history authority and RFC0088 numerics
remain separately unaccepted. No normative, package/version or launch change.

### 2026-10-17 — Governed actor reconciliation candidate

The owner explicitly approved the Issue354 diagnostic direction: required
nonempty actor, narrow META-01/error, all retained physical blocks, no inferred
attribution and existing wrapper/missing-metadata precedence.
[RFC0090](../rfcs/0090-provenance-actor-admission.md) remains draft for final
text acceptance. Its synchronized implementation, Format/Protocol prose and
proposed expectations do not activate the contract on main. Schema and public
types already require actor and remain unchanged. No public version, receipt
rule, arithmetic or release state is selected.

The independent actor-inventory companions preserve the original main
`b2ac5d8f068308fd690de824b963135974ec5fb8`, source/old expectation identities,
actual candidate findings, negative controls and operation-specific consequences.
The original798 source files yield738 validations and60 parse refusals;162
API inputs gain574 actor errors, with no other issue-object/order changes.
This broad API observation is distinct from actual consumers. All111 original
portable validate calls execute:12 changed responses/78 actor errors, eight
0-to1 exits, four1-to1 and99 byte-equivalent responses/exits. The known12
paths are listed in RFC0090 and the original Issue354 packet.

The original native indexed replay is1089/1089 before and1052/1089 after
against untouched old expectations. Exactly37 assertions differ:12 validation
projections,24 displays for those same documents, and
`conformance/capital-stack/senior-reconciles-debt-structure/expected.json`.
Only those measured expected files are prepared explicitly. Display changes
are actor lines/derived overall status/token counts; capital-stack CC-03
financial agreement/disagreement is retained beside the new actor finding.
Original sources and old expectations stay pinned in Git; no automatic update
or fabricated principal repairs them. Six new disposable malformed fixtures
24–29 yield1095/1095 under the proposed expectations. The first root checkpoint
reported1070pass/25fail after the12 validation changes but before the25
remaining governed display/reconciliation dispositions; that failure is retained.

Independent review caught and corrected two material scope gaps: the Python
partial inspector's unsupported META-01 allocation for late metadata/section
disagreement could suppress actor admission, and new synthetic `x:` fixtures
did not use the real `x_` extension route. The Python requirements remain uncoded
local findings with unsuccessful local assessment; no required actor is hidden.
The corrected extension control exercises actual overwritten physical evidence.

The parser keeps an internal operation-local inventory of mutable block
references; no public DTO or Envelope shape changes. Validation observes model
edits and never reparses stale `raw`; copied models cannot claim omitted-source
coverage. Physical-shape precedence is explicitly governed rather than silently
letting overwritten malformed wrappers escape both checks. Other historical
financial/source/role checks retain their applicability.

Receipt/signature consequences are measured separately in the
[complete inventory](./2026-10-15-python-reader-354.actor-inventory.json), using
the [read-only observer](./2026-10-15-python-reader-354.actor-inventory.mjs).
The32 paired native consumer events (four issueReceipt returns, two issuance
refusals,11 verifyReceipt and15 verifyDocumentSignature) have identical inputs
and results/refusals. A separate same-byte actor-absent probe preserves subject
`sha256:a9f6e8470143980521ec443b378ca42722805f435a3deaf7731a13dfae5d7d37`
and results, while policy errors change0-to1 and the signing payload changes
only by that count. Both engines' own/cross unsigned verification stays verified;
this is no cryptographic signature/backend claim. A new focused receipt control
removes an actor only from a disposable Parkview copy. Issuance records one additional validation error while calculations remain
identical, and existing verifyReceipt still verifies that newly issued receipt.
Actually removing actor content changes its semantic subject; changing diagnostic
allocation on identical source bytes does not. New policy counts can change a
new receipt's signing payload. No old receipt is rewritten, reissued or declared
authenticated under a new rule.

The separate Python complete-validation checkpoint306c136f has242 local tests
and actual Reader17/17; it preserves actor RFC work separately and still
advertises parse only. These are distinct from the actor candidate's163 Python
methods. RFC0085/0088/0089 remain separately draft; final RFC0090 text acceptance
and exact-head integration review are still required.

### 2026-10-17 — Accepted RFC0090 integration corrections

The owner accepted the substantive contract and governed expectation disposition
reviewed at `c870dbd63e6972ae849faf31a2be68ec43855377`, authorizing integration
after the final corrections and exact-head CI. RFC0090/index and current
Format/Protocol/status prose now record acceptance. Package/specification release
versions remain unallocated; no publication or launch is authorized. The dated
candidate section and frozen inventory above remain historical evidence.

The final registry remediation retains the bare-payload/inline nested metadata
and matching-section instructions and explicitly adds the required nonempty
`_meta.provenance.actor`, with no inferred attribution. Existing shape issues
receive that guidance through enrichment. Accordingly, the frozen c870 proof of
unchanged nonactor issue objects is scoped to that head: final codes, severities,
fields, shape messages, applicability and unrelated ordering are unchanged, while
the requested remediation copy is intentionally different. A consumer-level
shape regression pins both guidance paths; actor-specific guidance remains
unchanged. No diagnostic trigger or result precedence changes in this correction.

Final independent review rechecks the37 measured expected-file dispositions
and eight derived exits against the original main and reviewed head, all original
source/authenticated artifacts, physical/model identity and historical controls,
and measured receipt effects. The six new negative fixtures merely replace
their draft citation labels with the accepted RFC name; their asserted codes
and source bytes are unchanged. No original expectation is regenerated or
unrelated baseline altered. Final exact-head and post-merge exact-main CI are
recorded on PR376 and the existing Issue354 amendment; no prior green run is
substituted for either gate.

### 2026-10-17 — Nine native refusals and draft RFC0091

[RFC0091](../rfcs/0091-required-metadata-booleans.md) isolates the two missing
required-boolean allocations without extending accepted RFC0090. Its table
identifies all nine exact native source cases and separates three REC owning
conditions and three rejected containers from three nested-valid documents
missing six boolean members. The local inspector evidence is preserved even
when an existing owning error makes that condition handled; independent
findings cannot be suppressed by an unrelated or actor-only META-01.

The [exhaustive evidence](./2026-10-17-validation-diagnostic-gap-354.evidence.json)
preserves the original nine dcc5bd0a actual CLI responses, unchanged source
hashes, rebuilt current-main TypeScript findings, all734 source hashes and the
independently equal Python/Node two-boolean inventory. It is a sensitivity
experiment, not an activated validator. The separate prior27-schema audit is
preserved [losslessly](./2026-10-17-validation-diagnostic-gap-354.formal-audit.json.gz)
(raw SHA256 c39c817afb2cb13f6b75da7f66ec47bc72074d1831e484e3711da5cabf9b482a).
It establishes applicability observations, not126 newly allocated errors.

Run the [read-only reproduction](./2026-10-17-validation-diagnostic-gap-354.repro.py)
after `npm run build`, with `--out` pointing to a disposable report. It assesses
725 admitted sources/9 parse refusals and captures reference results.205 source
documents expose943 absent booleans (488 review/455 superseded), including two
history instances; none of111 portable validate inputs is exposed. This is not
zero overall consumer impact. The four standalone example sources are outside
that734-source slice.

The separate [in-memory counterfactual](./2026-10-17-validation-diagnostic-gap-354.counterfactual.mjs)
loads the compiled validator with only the draft boolean pass inserted after
actor admission. It changes no source/dist file or expectation; it is never a
production/CI activation hook. Run its documented command on the pinned main
build to reproduce1090 native passes/five differences/zero updated baselines.
The RFC lists each affected check and distinguishes expected-error-set changes
from zero-error standalone example assertions. Original sources, schemas,
expectations, signatures, receipts and versions stay unchanged. Normal required
CI runs without the research hook and must remain green.


## RFC0091 implementation acceptance packet

Owner direction authorizes the bounded implementation and independent verification,
not final RFC acceptance or merge. RFC0091 remains draft. Candidate production
changes implement only META-02/error and META-03/error for absent, null or
nonboolean canonical review/superseded members, with both booleans valid.
META-01, closed completeness suffixes, low-confidence info and unrelated typed
admission remain unchanged. No coercion, inferred flags or source repair.

TypeScript: 18 focused controls plus all25 accepted actor/shape controls pass;
complete workspace4291 tests pass. Python's isolated source change630b03a2
(e3807b0a in the integrator) adds eight controls; bounded main-based175 methods
pass. Independent review of both implementations found no material predicate,
parent precedence, physical/history, mutable-model or identity-order defect.
Model-only section attribution follows existing traversal context, not invented
annotation authority. The Python WIP separately consumes only exact matching
field/block/error/predicate ownership; missing quality and unrelated local
requirements remain visible. Its0a6cf833 checkpoint passes299 methods,
111 actual validation CLI cases and Reader17 locally on Windows. Initial274e
capital-stack expectation failure is preserved; the explicit union correction
adds only02/03, retaining CC-03 iff financially mismatched. Discovery remains
parse-only; this is not complete validation/Verifier or three-OS WIP proof.

### Exact original-source impact and disposition

[The read-only verification companion](./2026-10-17-validation-diagnostic-gap-354.implementation.py)
checks the [manifest](./2026-10-17-validation-diagnostic-gap-354.implementation.json)
and losslessly archived raw baseline/candidate observations. The original
27-schema/734-source audit and original read-only counterfactual are preserved
unchanged; actor-specific observer proposal fields are historical, not a new
boolean oracle. Actual candidate findings independently match all943 proposed
locations in205 unchanged uwx sources:488 review and455 superseded absences,
including two historical findings. No source is repaired. The wider804-input
direct API scan admits744/refuses60 unchanged;223 direct-assessment inputs gain
961 findings. The extra18 are uwpart fragment inputs, not18 newly failing
whole-document/native cases. There are96 direct-API validation-status changes;
these are not96 portable expectation changes.

Independent dispositions retain every205 source/943 field location,195 owning
expectation identities and actual-consumer links.54 source identities have
historical whole-validation calls;151 are reached by scoped APIs or lack such
a call in that frozen journal. That historical graph is qualified; the new
current-run consumer journal is the actual candidate evidence. Invalid fixture
purpose, narrower financial/profile assertions and positive examples must not
be conflated. No205-file baseline rewrite is justified.

Actual13 additional baseline/candidate CLI subprocesses confirm all nine native
inputs stay exit1, the three admitted missing-boolean cases gain exactly six
findings, and all four positive kit examples flip0-to1 with six META-02 errors.
Full error/warning/info partitions and original source bytes are checked.

All111 actual portable validate subprocess responses, exits and source/case
identities are exactly equal to baseline. All32 paired native issuance,
receipt-verification and document-signature consumer events are exactly equal.
The actual initial native runner confirms1090 pass/5 differences/0updates.
One explicit candidate expectation change adds02/03 to the capital-stack
agree/mismatch code unions on unchanged sources; CC-03 remains mismatch-only.
Its exact original bytes and all2648 original corpus artifact identities are
preserved. All other original corpus artifacts remain byte-identical. After
that governed correction, native conformance is1091 pass/4 fail/0updates.

The four remaining failures are `standalone/profiles/lease-abstract-v1`,
`source-note-v1`, `inline-deal`, `externalized-deal`. Six top-level blocks omit
human_review_required, while superseded is explicitlyfalse and actors are
example-kit. Their original and introducing canonical revisions contain no
review-boolean declaration; narrative review_status/flags cannot supply one.
Accepted RFC0048's definition of done promises every example parses and
validates. Keeping the existing zero-error assertions exposes that genuine
joint-contract conflict rather than hiding it in expected diagnostics.

The complete kit audit preserves17 disk source/copy files with20 omitted review
members,12 historical-version checks, three identical embedded record copies,
and the original ZIP's10entries/ninepayloads. Package/semantic identity tests
continue passing with original bytes. `buildMeta` already defaults reviewfalse
and supersededfalse for NEW metadata; this is not an author declaration for an
omitted historical member. No original file, ZIP, signed subject or issued
receipt was changed.

**Smallest remaining owner disposition:** choose (a) genuinely author replacement
positive kit examples with explicit review declarations and provenance, retaining
originals as history, or (b) explicitly amend RFC0048's positive-validation promise
and classify the originals as metadata-incomplete historical/focused examples.
The integrator recommends (a) for a clean launch kit, with new authored identity
and packaging verified, rather than inferring missing values. Neither option
is activated by provisional diagnostic direction. The four failures are not
permission to weaken validation or silently accept final RFC text.

### Receipt and adopter boundaries

[The executable receipt probe](./2026-10-17-validation-diagnostic-gap-354.receipts.mjs)
uses original Parkview bytes plus disposable, JSON-validated in-memory omissions.
Four vectors establish exact0/1/1/2 new policy errors; baseline/candidate subjects,
computation/results and every other receipt member stay equal per same-byte
vector. All16 issuer/verifier pairings preserve unsigned verified, real
public-test Ed25519 verified, missing-backend unverifiable and tampered-policy
signature failed (RCP-01). No historical artifact is authenticated or reissued.
The initial harness removed finalsuperseded leaving a trailingcomma; two failed
assumption runs were stopped, independently diagnosed, and the transformation
now preserves validJSON and checks each fence before issuance. That malformed
input was not evidence of a flag/receipt implementation defect. A baseline
rebuild did not resolve the harness error and is not claimed as the fix.

Same-byte diagnostics change no V9 payload hash, V11 block-signature bytes,
document/Envelope or receipt subject. Actually inserting a boolean changes raw,
package and complete document/Envelope/receipt subjects, but V9 excludes all_meta
and V11 binds content_hash/section/actor/timestamp/kid/signed_at, so a boolean-only
edit does not itself change V11 signing bytes. New author/timestamp can. New
receipt policy counts change receipt signing bytes; verification semantics and
precedence are unchanged. Validation status or a receipt's policy count is not
a financial verification verdict. Existing CLI/tests transport errors normally;
no producer/adopter interface, public type/export, schema, version or release
is changed. RFC0085/0088/0089 remain separately draft;5.0 remains owner-reserved.

### Integration gates

The bounded validators, registry, Format/Protocol candidate text, tests and one
attributed expectation are synchronized in draft#378. Existing schemas already
require these booleans and remain byte-identical. Exact-final-head CI will be
recorded in the PR and Issue354. Four positive-example contract failures block
green integration/final acceptance; do not describe the earlier green draft-only
run39066205003 as implementation evidence. Final owner acceptance and subsequent
exact-main CI remain separate gates; no merge is authorized in this packet.

Local portable reference conformance350/350 passes independently even though the
native positive-example gate blocks the ordinary CI job before its portable step.
Initial docs builds exposed a review link outside the docs-site copy set; the
link must target its preserved GitHub artifact, not an uncopied local page.

The additional13-CLI replay explicitly maps and traces each checkout's own
core/verify runtime. An initial baseline invocation followed the numerical
worktree's shared node_modules junction into candidate verify; that report is
archived as negative harness evidence and is excluded from baseline claims.
The corrected26-process report pins all resolved URLs, loaded files, raw streams
and sources, confirming the0-to1 example exits. Direct verifier receipt API
closures contain no @uwmd imports and are independently verified unaffected.
All eight deterministic test signatures are preserved and independently verified
with node:crypto against the included SPKI and exact canonical payloads.


## RFC0091 owner option (a) — authored replacement positive kit

Owner disposition2026-10-17 selects genuinely new positive examples, while all
four originals, the original ZIP and signed/receipt evidence stay byte-identical
as metadata-incomplete history. RFC0048's positive-validation promise remains
as written. This direction does not accept RFC0091 or authorize readiness/merge.

New kit: `examples/standalone/authored-2026-10-17/`, author
`codex/standalone-kit-2026-10-17`, authored_at2026-10-17T21:34:15Z,
source`system/standalone-kit`; package`pkg:standalone:authored:2026-10-17`.
The lease abstract is`doc:standalone:2026-10-17:lease-abstract`, source note
`note:standalone:2026-10-17:transcription`. Both deal carriers represent NEW
logical deal`uw_standalone_authored_2026_10_17`; distinct physical members are
`example:standalone:2026-10-17:inline-deal` and`...:externalized-deal`, with
distinct byte digests. This preserves the full resolved canonical/digest equality
required by RFC0048 without ignoring any frontmatter or metadata.

| New top-level block | Review required | Superseded | Authored reason |
|---|---|---|---|
| lease abstract / deal_context | true | false | Review unresolved illustrative legal terms before use; this is a new revision-1 document head. |
| source note / deal_context | true | false | Compare the illustrative transcription with an actual source before use; this is a new note head. |
| inline / property | false | false | A deliberately authored fictional structural example needs no human fact-review for that purpose; this is the new record head. |
| inline / rent_roll | true | false | Review illustrative tenant inputs before underwriting reliance; this is the new record head. |
| externalized / property | false | false | The same fictional structural property and NEW logical record head in the externalized carrier. |
| externalized / rent_roll | true | false | The same tenant-input review requirement and NEW record head, retained through externalization. |

Exact one-line reasons are canonical provenance.notes and declarations.json;
no boolean is derived from review_status or narrative flags. False for a fictional
property is not evidence of a real property review. New fragments have explicit
reviewtrue/supersededfalse and own part IDs; new source text is an explicit
illustrative stand-in. No new financial amount, formula or result is computed.

Original21 non-README standalone artifacts (including the original ZIP) and
all original subject/signature/receipt/schema fixtures are pinned among2731
unchanged artifacts in history.json. The original README is updated only for
historical classification and directing adopters to the new kit. Original
corpus-index/metrics expected bytes are separately preserved;11case/index rows
and4new metric expectations are appended, with every old row unchanged/in order.
Those new metric rows retain the same existing total_units-only observation
on unchanged fictional numeric payloads, not a numerical rebaseline.

The original four zero-error assertions keep their exact predicate while loading
the replacement positives. All seven original auxiliary API/fragment/composition/
package assertions continue on original bytes; the same seven also test the new
kit. Eight additional node:test controls verify immutable history, additive-only
expectations, six declarations/reasons, explicit missing-flag negative findings,
old six META02 errors, four actual CLI exits/partitions/source preservation,
new fragment validity/full canonical equivalence, and deterministic ZIP identity/
semantic verification/source-context exclusion. No assertion is weakened.

Authoring controls caught a double-prefixed new part reference and an old
illustrative cash-flow `flows` member outside accepted Format4.26. Only the new
copy now uses `series` with the same two rows; the old fragment is unchanged.
Manual probe initially addressed UWPart.frontmatter instead of UWPart.part_id;
the focused test then needed UWPart.blocks rather than treating variant maps
as blocks. Those harness/data-authoring corrections do not change production
selection, validation or arithmetic. Default crypto-light package verification
without an injected semantic resolver reports unverifiable by design; the actual
public CLI and explicit semantic-resolver controls verify all four semantic
digests. No weaker verification status is claimed as VERIFIED.

### Downstream writer inventory and activation consequences

`2026-10-17-validation-diagnostic-gap-354.writers.json` preserves a bounded,
independently audited source/probe summary. Full private auditSHA
559d5a75da445999d66c4af3495ae1f5e686250868865e038671396dc2a2d0b0
remains in the existing maintainer evidence; unrelated private guidance/status
is deliberately excluded from this public inventory.

| Writer/path | Observed current behavior | If RFC0091 activates |
|---|---|---|
| StackUW packages/underwriting-engine/src/export/meta-v2.ts: reshapeMetaV1toV2 | Old/direct helper preserves missing flat review/superseded values; its comments concern the historical Format2 path. | Not evidence of the current Format3 emission path. A bypassed output with admitted canonical parents can owe META02/03; existing Format2/wrapper refusals retain precedence. |
| StackUW same file: toFormat3Meta; serialize.ts public Format3 branch; export-to-uwmd.ts default3.0 | Explicit canonical review and superseded booleans via flatvalue??false; Markdown, envelope, MCP/HTTP export routes call this adapter. | Well-typed emitted booleans do not gain META02/03. This is no proof of review truth, all conformance, or deployed version. Untyped nonbooleans still owe errors. |
| StackUW backend/services/uwmd/marketDataDocument.ts | Emits false/false explicitly. | No missing-boolean finding on that emitted shape. |
| StackUW internal watermark metadata | Sparse flat metadata is adapted at final Format3 serialization. | Do not confuse an internal sparse object with an emitted canonical block. |
| UWMD buildMeta and its init/editor/host/Lite callers | Emit both booleans; sparse editor patches merge with full metadata. | Well-typed fresh helper output is unaffected; no generic safe-writer claim for untyped patches. |
| UWMD low-level writeAgentBlock/restamp/renderer/Envelope codecs | Preserve caller-authored metadata and can retain omissions; they do not promise source repair. | Missing/invalid flags under admitted parents gain errors, including retained physical history; newly issued policy counts/validation exits can change. No source repair or automatic receipt-verdict rule follows. |

At StackUW sourceheadfea704ee6a2b4d01057f216880678445347c76fe, the blanket claim
that the current engine Format3 writer omits the booleans is **contradicted** by
source and synthetic adapter/serializer probes. The narrower old-helper omission
is **verified**. Four metadata-only controls cover absent/false/true/untyped values;
this is not a financial engine run or live deployed-service audit. No downstream
repository was edited. Adoption owners remain responsible for any bypassed old
writer, explicit malformed flags or existing authored records; the validator
must not default or rewrite those sources to suppress new errors.

Final exact-head CI and independent checkpoint verification will be recorded
in existing PR378/Issue354. RFC0091 stays draft/unmerged; all other RFCs retain
their separate states. No package/specification version, tag or release.


Bounded independent Python WIP0a6c replay of the four new and four historical
records is preserved losslessly in authored-python.json.gz (rawSHA
a6dd9fff9617fe22bce0e2deee93da73e9b1fef6988ed74fdd5921299fcc0226). The new abstract, source note and
inline record are normal zero-error/exit0 results. The new externalized record
has zero metadata errors but returns an honest typed COMP-UNRESOLVED/exit1:
this implementation does not resolve package parts. It is not a four-of-four
Python complete-validation claim. Historical cases keep META02 counts1/1/2/2;
all source/runtime hashes are unchanged, and parse-only discovery remains.
The reference CLI's separate four positives/zero-error/exit0 controls do not
certify a Python resolver or a complete Verifier tier.

The original Python8 audit JSON has CRLF outer formatting; its gzip archive
preserves those exact bytes (compressedSHA b5e60b34ac175cacc87f8eea5c16e555a0ce6b3fc5f3049a3647388edb1a27f7).
No Git text conversion of an evidence JSON display copy is used as raw identity.

Independent replacement-kit checkpoint review at9c874bb0 is preserved losslessly
in authored-review.json.gz (rawSHA
29ae23a83bb9519ff441111fadd93f55aa67bb5ffc184e9449196e108046cd0f). Eight focused tests and the18 indexed
standalone assertions pass; all21 original non-README standalone artifacts and
all2731 protected Git subjects match the pinned c558 committed bytes exactly.
Only11new index rows and4new metric rows are appended. The new ZIP hasSHA
8cb9ce0d80784c367a9f545621a27189685c8efab0a82f10254cafd4dedb0679;
its10members plusmanifest, all copies/digests and semantic-resolver checks pass.
The actual public package CLI returns VERIFIED/exit0. The low-level no-provider
API remains honestly unverifiable for semantic digests; it is not substituted
for the explicit semantic/CLI proof. All original auxiliary predicates remain.

Local integration at the committed kit checkpoint passes native1106/1106 and
portable350/350 with zero updates/skips. Exact-final-head CI remains required
before any readiness representation. Earlier c558 CI39070553296's14success/
3failure/1skip is preserved as the old four-example contract failure, not
retrospectively relabeled green. Draft status and final owner acceptance remain.


The first authored-kit CI39072486033 atf8090509 exposed an overbroad new ZIP
reproduction assertion: it compared native-host re-encoding with an archive
created in a different timezone. Existing deal-package-zip.ts27–35 explicitly
permits local DOS timestamp differences; schema/RFC0018 exclude those fields
from member semantic identity. This is a test/fixture-parameter error, not an
established production codec defect or a new portability contract. The failed
run and its logs remain preserved; its passing steps are not a green run.

The authored archive's timezone parameterEtc/GMT+7 is now explicit in declarations;
its exact SHA8cb9ce0d...edb0679 and bytes remain unchanged. Exact-byte reproduction
uses an isolated child with that declared environment parameter. Native-host
repeat encoding, full decoded manifest/member equality, all raw member hashes,
four semantic digests and original2731-artifact preservation remain checked.
No assertion of source/member/subject integrity or positive validity is loosened;
no archive normalized, no production codec/schema/numerical semantics changed.

Independent timezone evidence is preserved losslessly in zip-timezone.json.gz
(rawSHA9aabdea10939c72714f4b7fd332c7dc3fef081cb224f253ab9ad531d2c78d637). Both archives are9228bytes;
only44 DOS timestamp bytes differ across11local/11central headers, while all
member names/uncompressed bytes are identical. Etc/GMT+7 exactly reproduces
frozenSHA8cb9...0679; UTC produces2c3c3767b3773b9e91d66898c1ee589eba44b935c79b1c6c00b04712b451419b.
The corrected eight controls pass under UTC with both Node24.14.1 and the
preserved official Node20.20.2 executable. No storedZIP or UWX byte changes.


## RFC0091 owner acceptance — 2026-10-17

The owner has now decided: "RFC 0091 goes to acceptance. I've reviewed the six
review declarations in the authored-2026-10-17 kit and accept them as written."
Earlier draft/pending language and raw candidate reports above remain historical
evidence of their checkpoints, not the current RFC status. RFC/index/status and
live example/Python guidance now record accepted, unreleased status.

The owner requires final review and green exact-final-head CI before merging,
with all2,731 protected artifacts byte-identical. Activation adds META-02/03
errors on incomplete admitted canonical metadata, including retained history;
validation exit codes and newly issued receipt policy counts may change. Sources
and historical subjects are never repaired or rewritten. No receipt-verdict rule,
schema, numerical procedure, version or release is changed by finalization.
The exact final-head/main evidence is recorded in PR378 and Issue354's existing
living comment. RFC0091 contains the breaking-impact recommendation and one
writer migration note, explicitly distinguishing StackUW's false defaults from
authorial review/lifecycle intent. RFC0085/0088/0089 remain separate drafts.
