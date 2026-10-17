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
records is preserved in authored-python.json (rawSHA
a6dd9fff9617fe22bce0e2deee93da73e9b1fef6988ed74fdd5921299fcc0226). The new abstract, source note and
inline record are normal zero-error/exit0 results. The new externalized record
has zero metadata errors but returns an honest typed COMP-UNRESOLVED/exit1:
this implementation does not resolve package parts. It is not a four-of-four
Python complete-validation claim. Historical cases keep META02 counts1/1/2/2;
all source/runtime hashes are unchanged, and parse-only discovery remains.
The reference CLI's separate four positives/zero-error/exit0 controls do not
certify a Python resolver or a complete Verifier tier.
