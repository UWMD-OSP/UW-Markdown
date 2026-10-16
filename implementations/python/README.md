# Independent Python structured Reader foundation

Issue [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354).
This unpublished, incomplete implementation is written independently from the
Format and Protocol. It uses Python's standard library and has no Node runtime,
external packages, hosted services, production fixture lookup, or TypeScript
translation. No PyPI name, supported Python floor or publication is decided.

The discovery manifest advertises only `parse`, **no Reader/Verifier tier,
full-validation, expression-calculation, signature, receipt or optional-profile capability**.
The adapter reads structured Format 3.0 Markdown and separately verifies stated
reserve accounts, explicit reserve-draw plans and replacement-funding commitments. It does not certify every Reader or Verifier requirement.

Implemented:

- Original UTF-8 bytes, BOM/CRLF preservation, physical block order, exact JSON
  number lexemes/pointers/byte spans, duplicate-name and malformed-source refusals.
- Appendix D frontmatter scalar/mapping/sequence parsing, including YAML quoted
  escapes and comments, with retained numeric lexemes and byte spans.
- Required frontmatter values, unknown fields/sections/extensions, last-active
  singleton selection, superseded history, registered parallel sections, active
  role-based variant opt-in and append-only collection projections.
- Payload-level Protocol VIII.2a period identities and the five registered series:
  inspect every row, preserve source order, detect year-key collisions, and
  select by exact identity with the RFC 0062 same-day cash-flow exception.
  PS-01/PS-02 evidence is partial structural inspection, not document validation.
- Protocol VIII.1 grammar parsing into immutable AST tuples and a static
  reference inventory, preserving numeric spelling, literal bracket keys and
  period identity. A syntax-only blocked-reference inventory flags spellings
  for future safe traversal; a separate structural check rejects malformed or
  unregistered period references without reading document values.
- The earlier independent seed's integer Gregorian date/day-count arithmetic,
  decimal quantizer, ordered cash totals and MOIC. These remain a small numeric
  seed, not `calc-evaluate` or financial-verification conformance.

```sh
python3 -B -m unittest discover -s implementations/python -v
python3 -B implementations/python/uwmd.py manifest
python3 -B implementations/python/uwmd.py parse conformance/documents/fixtures/01-minimal-screening.uwx.md
python3 -B conformance/runner/runner.py --impl 'python3 -B implementations/python/uwmd.py' --tier reader --no-skip
```

Observed on Python 3.12.3/Linux: **44 unit methods passed**; the genuine portable
Reader run passed **17/17**, with zero skips, failures or unverifiable cases.
That portable run is separate from the ten source-scanner tests, which inspect
17 fixture inputs but do not compare their canonical parse projections.
The additional unit method executes all nine Reader-owned malformed source
fixtures against their existing refusal codes; those cases are not portable
driver projections. Other environments require their own recorded runs.

Remaining Reader review includes complete Appendix D key-type semantics,
representation edge cases, and stronger
malformed/ambiguous-source controls. Active extension-role opt-in retains every
named variant and unannotated peer in either source order. This
seed refuses non-string-resolving bare YAML keys rather than guessing a JSON key
coercion. It preserves every physical source block even where the portable
projection exposes only the canonical value. It does not implement a signing
projection or infer verified continuity from retained history.

Full Format validation, document-level period/role resolution for calculations,
expression evaluation, dictionary result checking and the remaining applicable
Protocol II.2 verifiers remain outstanding. Separate reserve-account/draw-binding
checks, §V.12 replacement commitments and block hashes/bounded chain assessment
implement only their documented scopes. The full integrity profile, signatures,
receipts and receipt verification remain unimplemented. Missing, unsupported and
failed assertions must remain distinguishable. Passing Reader projections does
not discharge those remaining obligations.

Issue [#356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) separately affects
cross-runtime power/logarithm procedures, annuities and periodic/dated returns.
This implementation chooses none of the draft alternatives, does not hard-code
Node observations as the contract and makes no cross-runtime bit-identity claim.
Parsing, structural checks and explicit evidence/identity coverage can continue
without a new numerical decision. Draft RFCs 0085–0087 and Issue #355's optional
financial assurance profile remain separate and unaccepted here.

See [the implementation evidence and requirement inventory](../../docs/reviews/2026-10-15-python-reader-354.md).

The period foundation takes an **already selected section payload**. It does not
select active variants, parse selector paths, traverse leaves, apply overrides,
or inspect formulas for PS-03. `inspect_period_series` reports source-relative
JSON pointers and returns original row objects; `select_period_row` inspects the
whole series before returning one row. Neither API rewrites, nets or reorders
source. Missing identities in present rows warn and refuse selection; no
period identity is inferred.
No new CLI command or manifest capability is advertised.

Additional local evidence on Python 3.12.3/Windows: **59 unit methods passed**
(the unchanged 44 plus 15 period controls). The actual portable Reader driver
remains **17/17**, zero skips/failures/unverifiable cases. This does not add
Verifier conformance passes. The recovery snapshot's registry/identity concepts
were selectively reconciled against current VIII.2a/RFC 0062; its Reader,
calendar replacement, broad resolver and historical result claims were not
imported. No numerical investigation was repeated.

PS-02 is emitted once per duplicate canonical identity at the first colliding
row pointer. Duplicate refusal precedes malformed-series refusal when both are
present. Absent/null sections or series and an unmatched well-formed period
return null. A present row with missing/null identity is malformed: PS-01 warns
and selection refuses CALC-PERIOD-001, following existing whole-row inspection
precedent. VIII.2a's missing/null wording does not override its registered row
grammar or justify introducing null row identities.

Additional grammar evidence on Python 3.12.3/Windows: **74 unit methods pass**
(the preserved 59 plus 15 expression controls). All 97 frozen calc fixture
formulas are admitted by the grammar; this includes formulas whose evaluation
must fail, so no frozen result/verdict is claimed. All 171 normative dictionary
declarations produce exactly their declared static input-path sets. Frozen
period/variant formulas have exact reference inventories; the existing invalid
module formula supplies a parse-refusal prerequisite, not a module-profile pass.

`parse_expression` checks VIII.1 syntax only and retains number lexemes without
converting or calculating them. `expression_references` returns every reference
in syntax order, including duplicates and branches a later evaluator might
short-circuit. `blocked_references` inventories blocked traversal spellings
without rejecting valid grammar or claiming a runtime error. Literal dotted
keys remain distinct from path segments. `check_reference_structure` separately
checks registered period identities; it does not inspect document values, choose roles
or variants, enforce builtin arity, or produce a financial result. AST admission
and static input-set agreement do not establish metric reproduction, dependency
resolution, type correctness or any Verifier/Module capability. The manifest
and CLI remain unchanged. Local parser token/nesting limits refuse explicitly
with CALC-LIMIT-001; those limits are implementation resource bounds.

The recovery expression prototype was unreviewed input: only grammar concepts
were adapted. Its evaluator, numerical choices and incompatible Reader were
not imported. The current implementation retains the section head across a
period selector and preserves numeric lexemes, both pinned independently.

Static period-structure inspection checks every reference in the syntax tree,
including an invalid reference inside a potentially short-circuited branch.
For example, `false && dcf.unknown@Y1.noi` parses, and its static inspection
reports CALC-PERIOD-001. That is an inspection result, not an evaluator verdict:
an evaluator would have to implement the Protocol's short-circuit rules before
deciding which references to resolve. Actual evaluation remains unimplemented.

## Standalone reserve-account verification

`python -B implementations/python/uwmd.py verify-reserve-accounts <file> --json`
implements accepted Format §4.28 and Protocol §VIII.11. It snapshots parsed
source, checks closed account/period/movement facts and provenance, then checks
authored-order binary64 balance identities and explicitly claimed continuity
at the existing separately applied 2dp half-away boundary. No movement class,
missing row or financial assumption is inferred. All active reserve variants
are inspected independently; source rows and metadata remain unchanged.

The result distinguishes absent `not_checked/not_applicable`, structural or
digest/nonfinite `unverifiable`, finite disagreement `failed`, and `verified`.
Overflow does not discard later finite period evidence. Exit status is 1 for
failed/unverifiable, 0 for verified/absent. Balance agreement does not establish
source authenticity, economic completeness or correct producer classification.
No gross expenditure, cash-flow assembly, formula evaluation or receipt is made.

The prerequisite `uwmd_envelope.py` projects complete Envelope 1.0 blocks,
annotations, metadata, retained prose, collections and explicit superseded
history, including extension history. Its SHA-256 preimage excludes only the
three top-level volatile members. `uwmd_jcs.py` independently implements RFC8785
UTF-16 key ordering, Unicode/refusal and ECMAScript binary64 number serialization
using exact integer-rational shortest-decimal search; it never calls Node.
Existing frozen receipt/document-signature *subject digests* are test oracles
only. No receipt verification, document authentication or Integrity capability
is implemented by computing those source digests.

The current Reader admits role-opted extension variant maps while the accepted
Envelope schema permits a single block at each extension ID. That unresolved
representation boundary ([Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365))
produces `unverifiable/digest_unavailable`, without
inventing an envelope shape or changing either contract. Ordinary singleton
selection follows existing Reader semantics; no signature-only source guards
are added. Annotation mapping collisions also refuse unavailable projection
rather than erase an authored field.

Verification evidence: 91 Python unit methods preserve all earlier 74 controls
and execute every one of the 28 unchanged generated reserve cases through the
actual shared driver's subprocess/comparison function. They also pin published
RFC8785 vectors, independent frozen whole-source digests, prose/annotation/history
mutations, source/schema nonblank semantics, no mutation, monetary boundaries,
compound date/order findings, overflow precedence and retained finite evidence.
These 28 direct case results are **not** a portable tier/capability certification
run: the catalogue currently requires `calc-evaluate` for those cases and has
no dedicated reserve token. The manifest stays parse-only; no wrapper invents
capabilities. Genuine portable Reader runs remain separately reported as 17/17.

## Standalone reserve-draw bindings

`python -B implementations/python/uwmd.py verify-reserve-draws <file> [plan.json] --json`
implements accepted Protocol §VIII.12/RFC0065. An omitted plan returns
`not_checked/not_applicable`; explicitly supplied JSON null is invalid structure.
The plan names exact nullable variants, account/period/movement IDs, gross
lease-up TI/LC cells or cash-flow row ordinals, declared funded shares and
positive allocations. No default/base/role/fence-order fallback is used.

Each selected reserve variant is checked in full, including accounts/periods
not individually selected by an edge. Unselected reserve variants do not affect
that account verification, while the original *whole-document* Envelope digest
still binds their content, provenance and history. Selected CF/lease-up sources
undergo closed shape, finite amount, real calendar/order/contiguity, range and
registered-model checks. Binding does not recompute their financial metrics.

The verifier snapshots both inputs, validates inventories/edge uniqueness before
hashing, checks stale digests before source resolution, and refuses source
errors before allocation comparisons. It retains all finite resolved edges even
when another source fails. In authored binding order, independent draw and
expenditure sums use binary64 without intermediate rounding and the existing
separate 2dp quantum. All selected draws must be fully allocated; expenditure
totals must match the declared funded share without exceeding gross magnitude.
Overflow preserves finite edge evidence and later independent finite mismatch
findings. Gross expenditure, authored dates/periods and metadata remain unchanged;
no cash-flow generation, owner-cash remainder, transfer, classification or timing
convention is invented.

The existing frozen `superseded-source` case exposed an earlier Python semantic
projection gap: `superseded=true` in a fence must route that complete block to
history even when the optional JSON lifecycle flag is absent. A source-lifecycle
helper now serves Envelope/reserve/binding verification without injecting JSON
metadata or changing the existing Reader projection/source bytes. This fixes
implementation behavior against the accepted contract; it changes no receipt
canonicalization rule or document-authentication admission requirement.

Evidence: **103 Python methods** preserve the prior 91 controls and add twelve
focused binding methods. Every one of the **46 unchanged generated binding
cases** executes through the actual shared subprocess/comparison function,
alongside the existing 28 reserve cases. Extra controls cover exact identity,
selective/full-source verification, closed sources, precedence, monetary
boundaries, overflow with later finite findings, evidence order and no mutation.
These direct case results are not tier/capability certification: the catalogue
requires broader `calc-evaluate`, which remains unimplemented and unclaimed.
The manifest stays parse-only and genuine Reader 17/17 runs remain separate.


## Standalone replacement-funding bindings

`python -B implementations/python/uwmd.py verify-replacement-funding <file> --json`
implements accepted Protocol §V.12/RFC0070, including RFC0075 senior preference,
RFC0076 refused selections and RFC0081's optional terms group. Its two-member
CLI wrapper is **nonnormative**: `structural_issues` contains only the relevant
hedge, funding, escrow, cash-source and currency prerequisites;
`replacement_funding_verification` has the exact §V.12.3 result union. There is
no overall validation/readiness result. `validate` and `calc` remain unsupported.
Exit status is nonzero for relevant structural refusal or failed/unverifiable
binding. A lawful nonapplicable path returns `not_checked/not_applicable`.

The independent property selector preserves canonical current revisions,
excludes component/invalid roles, prefers senior debt and refuses a consulted
role collision before fallback. Exact cash lookup separately uses the authored
variant, so an unlabelled peer cannot capture an explicitly named `default`.
Shape/assumption, selection/reference, full selected-series structure and raw
payment sign/date checks precede hashing. Explicit zero is admitted; payment
must follow the initial effective date, with no expiration boundary or monetary
quantization. Debt-only findings survive refused cash-side selection;
`unresolvable_source` takes precedence when selection prevents assessment.
Known strike-only hedges have no replacement-selection claim under RFC0081;
malformed stated hedges cannot establish that exemption. Retired hedge agreement
codes do not reappear.

The digest helper hashes exactly the fixed section, authored cash variant, safe
row index, exact document currency (or canonical null), and entire ordered
cash-row vector. All authored row members, including absent versus null, remain
significant. Metadata, prose, debt and top-level cash metrics are excluded; no
metric is recomputed. This is a separate binding digest, never an Envelope or
selected-row-only hash. Lawful unrelated extension variants therefore do not
block it even when [Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365)
prevents an Envelope digest. Both published monetary-identity digests match.

The structural API never hashes. The separate async verifier snapshots before
its first await, then reports verified/equal, failed/stale binding with HDG-09,
or unverifiable structure/source/hash-provider states. Only actual inequality
produces HDG-09, in verification rather than structural errors. Source, reference,
commitment, provenance and caller objects remain unchanged. This consistency
check proves neither a verified deal nor an executed cap trade.

Evidence: **119 Python methods** preserve all prior 103 controls, including
reserve28 and reserve-draw46 direct cases. Sixteen new methods include **71
adapted standalone comparisons**: actual command subprocesses, then unchanged
shared `replacement-funding` projection and `json_subset` comparison. A test-only
adapter maps narrow structural findings to that projection's input. It does not
implement validate, change generated cases/capability flags, or claim 71 portable
or full-validation passes. The catalogue requires broader `validate`, which
remains unimplemented. Discovery stays parse-only; genuine Reader17/17 runs stay
separate.


## Block hashes and bounded chain assessment

`python -B implementations/python/uwmd.py verify-block-integrity <file> --json`
adds independent Protocol §V.9 block hashing and a bounded §V.10 chain assessment.
This command's report and local assessment vocabulary are **nonnormative**. It
is not the full `IntegrityResult`, an integrity-profile claim, full validation,
signature verification or document authentication. Discovery stays parse-only;
generic verify, validate and calc remain unsupported.

`compute_block_hash` snapshots an explicit fenced object, removes only top-level
`_meta`, canonicalizes with independent RFC8785 JCS and hashes UTF-8 using stdlib
SHA-256. The result is lowercase unprefixed hex. Literal payload `content`, nested
`_meta`, `_role`, `_overrides`, `_notes`, absent/null distinctions and array order
are included. Entire top-level provenance/lifecycle/integrity metadata is excluded.
No old digest rule, source rewrite, financial procedure or Envelope is involved.

The file checker retains every physical block, including superseded history,
with exact authored variant, source ordinal and actual hash evidence. It assesses
unambiguous singleton sequences, registered parallel identities and current
role-opted variant identities. Missing labels and explicitly named `default`
remain distinct. It does not apply financial role preferences or discard old
payloads. Where removed historical roles or multiple append-only entries leave
chain identity outside this implementation's supported domain, it retains all
block hashes but returns local `unsupported` assessment and `ok: false`, without
inventing an INT finding or choosing a new historical grouping policy. Counts
cover classified chains only. `verify_block_chain` instead takes an explicitly
addressed ordered block sequence; the caller owns that identity and ordering.

Wholly unhashed supported sequences are skipped and remain unchecked. Only
missing hashes **after** opt-in produce INT-03 warning; parent mismatches against
the immediately prior retained block produce INT-01 error; stamped content drift
produces INT-04 warning. Earlier unhashed prefixes do not acquire an extra rule.
A retained first block's non-null parent does not create a new missing-history
refusal: accepted replace/root behavior and pending history decisions are kept.
INT-02 belongs to editing and is not emitted by read-only assessment.

The nonnormative local `ok` is strict: any reported finding, unsupported chain or
unavailable hash makes it false. `complete` means only this supported assessment
finished. `unavailable` distinguishes malformed local inputs, unsupported hashing
metadata, JCS refusal or failed/malformed SHA providers from actual mismatches.
No fabricated INT-01/04 is used for those failures. Evidence for other performed
checks is retained. CLI exit is nonzero whenever local `ok` is false.

Signature presence is counted, always with `signatures_checked: false` and
`signatures_verified: 0`. No signature format, key, algorithm or authenticity
check is performed; a matching block hash does not authenticate its author or
prove that history is complete. Existing signing fixtures supply **hash-only**
evidence, never signature-conformance passes. No broader profile flag is added.

Evidence: **132 Python methods** preserve the earlier 119 controls, including
Reader17, direct reserve28/draw46 and 71 adapted replacement comparisons. Thirteen
new methods include **11 actual standalone frozen hash-only comparisons**: the
broken-parent fixture, the existing editor's pre-edit block and nine block-signing
sources. A test-only projection compares applicable INT-01/03/04 expectations via
the unchanged shared subset comparator; it never claims full signing or portable
integrity passes. Further controls cover exact scope, opt-in prefixes, independent
parent/content failures, nullable/current/history identities, unsupported grouping,
hash-provider/JCS failures, unchanged roots and snapshots before the first await.
