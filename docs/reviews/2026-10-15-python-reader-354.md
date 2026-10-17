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
