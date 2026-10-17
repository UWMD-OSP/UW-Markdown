---
rfc: 0090
title: Admit required provenance actors with an explicit diagnostic
status: draft
author: codex
created: 2026-10-17
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0090: Admit required provenance actors with an explicit diagnostic

## Summary

Extend `META-01`/error narrowly to a missing, null, exact-empty or non-string
canonical `_meta.provenance.actor` after existing block-shape precedence.
Check every retained physical block, including history, append-only entries and
unselected peers, without fabricating attribution or changing content selection.
Make the distinction between fresh-source validation and mutable-model assessment
explicit. The owner approved this direction, but **this RFC remains draft**:
final review, acceptance and synchronized activation are separate gates. No
version or release is selected, and no conformance expectation changes merely
because this draft exists.

## Motivation

Format2.5b and ProtocolV.3 already require an initiating principal.
`UWProvenance.actor` is a required string; the normative block schema requires
`actor`, `type: string`, `minLength: 1`. The existing validator does not allocate
a diagnostic for that requirement. Its `META-01` covers bare/nested shape, while
ProtocolIII.6a closes `META_FIELD_MISSING_<FIELD>` to five names that exclude
`ACTOR`. Schema rejection and the preserved positive diagnostic corpus therefore
disagree. None of these artifacts generally outranks the others; this RFC
reconciles the joint contract explicitly.

The [original decision packet](https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6229116406)
identifies twelve unchanged source/expectation pairs at main
`b2ac5d8f068308fd690de824b963135974ec5fb8`, with78 missing actors.
It reuses twelve actual historical TypeScript CLI executions and preserves their
original results. Its proposed78 errors and eight CLI0-to1 transitions are a
counterfactual, not a new execution or a complete all-corpus impact claim.

## Proposed change

### D1. Principal domain and one diagnostic

For an otherwise admitted bare/nested block, a validator MUST emit exactly one
`META-01` of severity `error`, field `_meta.provenance.actor`, when that member
is absent, null, the exact empty string, or any non-string value. Every nonempty
string passes this predicate, including whitespace-only strings. The validator
MUST NOT trim, normalize, require the `source` namespace grammar, infer a
principal from another field, or insert a principal. This is a presence/type
rule, not proof of identity, authorization or authenticity.

The canonical inline payload member `block.content._meta` supplies this
predicate. A divergent convenience `block.meta` alias MUST NOT silently repair
or replace that content. This RFC allocates no new inconsistency diagnostic for
such a hand-built model and does not change other checks' existing inputs.

### D2. Preserve old shape and completeness precedence

Apply these decisions per assessed block, in this order:

| Condition | Actor-pass disposition |
|---|---|
| Top-level retired `section_id` wrapper, or present `_meta` that is not a non-array object, or missing/malformed nested `provenance` or `lifecycle` object | Preserve existing shape handling; emit no additional actor finding for that block. |
| Entire inline `_meta` absent, with no wrapper-shape failure | Preserve existing whole-missing-meta handling; emit no actor cascade. |
| Otherwise actor absent/null/exact-empty/non-string | One `META-01`/error at `_meta.provenance.actor`. |
| Otherwise nonempty actor string | No actor finding. |

This does not broaden existing malformed-wrapper checks to every physical block
or turn all metadata-schema failures into `META-01`. Existing completeness
warnings and informational findings retain their current applicability, codes,
severity and relative order. In particular the five closed missing-field
suffixes remain unchanged; this RFC adds neither `META_FIELD_MISSING_ACTOR` nor
a separate actor code. Independent existing errors on other fields still apply.

All preexisting metadata-shape findings remain before the new actor findings.
Insert the actor pass after that shape checkpoint and before role, period-series
and source-vocabulary checks. Retain the relative order of all old findings.
Actor findings follow retained physical source order, then model-only traversal
order as defined below. Use available section/source context without inventing
source positions for hand-built blocks. Equal-valued but distinct physical
blocks owe distinct findings; the same retained object MUST NOT be reported
twice merely because routing also exposes it in a projected collection.

### D3. Physical applicability and operation-local authority

For document/source validation, the operation MUST parse the exact supplied
source and retain its recognized structured blocks **before routing/reduction**.
Actor admission MUST cover that inventory: current and superseded builtin
blocks, every variant/peer, all three append-only collections, extension blocks
and physically overwritten selections. Being historical, unselected, unknown
or an extension does not exempt this predicate. Existing parse refusals remain
earlier failures. This does not make a history record current, recalculate its
financial values or assert complete provenance/history authority under RFC0085.

A mutable parsed model is a different input contract. `validateUWFile(parsed,
thresholdOverrides?)` MUST assess the model supplied to it and MUST NOT reparse
`parsed.raw` behind the caller. `raw` does not establish freshness or permission
to ignore model mutations. For an object produced by the reference parser, keep
its operation-local pre-routing block inventory as actual block references.
The actor pass assesses that retained inventory followed by current projected
model blocks not already present by exact object identity. In-place changes to
those references are observed; added or replacement model blocks are assessed.
Removing/replacing a projected entry does not erase its original retained
physical block. To change source evidence intentionally, edit the source and
freshly parse/validate that exact input.

For a hand-built, deserialized or copied model without that parser-object
association, assess only the blocks supplied in its collections. Never fabricate
omitted peers/history from `raw`, infer a complete physical inventory from a
reduced map, or advertise a full-source assessment. An inventory of mutable
references is not an immutable source-byte attestation. Even a parse-origin
model with retained blocks is not a certificate that its current model equals
`raw` after edits. Source-taking operations requiring a source conclusion must
freshly parse the source they actually receive.

The reference traversal appends model-only blocks in existing shape-check order:
`sections` in entry order (variant entries in entry order), `superseded` in entry
and array order, `pipeline_log`, `custom_calculations`, `custom_scenarios`, then
`extensions` in entry order. Deduplicate only exact block object identity across
that union, not section ids, variants, values, line numbers or payload hashes.
No public DTO, reduced projection or Envelope member is added by this contract.

### D4. Synchronized contract and schema parity

Update Format2.5b/2.5 diagnostic prose and ProtocolIII.6a/V.3 alongside the
reference diagnostic/remediation registry, implementation and conformance
expectations. `spec/schemas/uwmd-block.schema.json` and `UWProvenance` already
require the principal and must be verified unchanged rather than edited merely
to make this PR appear synchronized. Schema `minLength: 1` and nonempty-string
admission agree on whitespace and null/type rejection. No unrelated metadata
shape, role, financial or historical-authority rule is changed.

## Compatibility analysis

Original actor-less records retain their exact bytes and remain parseable under
the existing parser, but a validator implementing this accepted proposal emits
new errors. A parse-only Reader owes no new validation claim. A Reader claiming
`validate`, and every Verifier, must implement the accepted actor rule within
its declared source/model operation boundary. This draft does not promote the
Python implementation's discovery beyond parse-only or complete its Verifier.
Module manifests and metric arithmetic are unchanged; authored module/extension
blocks receive the same actor predicate when assessed.

New expectations on unchanged source do not change canonical subjects, block
hashes, numerical values or signatures. Actually editing actor values would
leave V.9 payload hashes unchanged (`_meta` is excluded) but change V.11 signing
inputs and potentially document/Envelope/receipt subjects. Do not repair the
corpus by inventing principals. Historical subjects, signatures, receipts and
original expected verdicts remain identifiable as historical evidence, never
retroactively authenticated under this rule.

Validation consumers need explicit measured consequences. CLI validation may
now refuse; newly issued receipt validation counts/signing inputs may change.
This RFC creates no rule refusing every receipt on validation errors, and does
not alter existing receipt recomputation, signature, canonicalization-version
or verdict precedence. V.13's existing source-admission guards remain separate.
The implementation review must inventory actual consumer results rather than
assert universal receipt invariance or invent a new refusal.

Apply the [owner's prelaunch compatibility policy](../../VERSIONS.md#public-launch-compatibility-policy-owner-decision-2026-10-16):
all pre5 releases are historical, with no old-reader, grandfathering or migration
shim requirement. Format/Protocol/package versions remain independent decisions
for their actual changes. This draft selects none;5.0 publication still needs
separate owner launch approval. RFC0085,0088 and0089 retain separate ownership
and draft status.

## Conformance impact

Preserve the original source bytes and original expectations by full Git
identity before preparing governed changed expectations. The twelve known
portable document stems below are under `conformance/documents/fixtures/`
(`.uwx.md`) and `conformance/documents/expected/` (`.validation.json`); the
original pair for each is pinned by the exact main commit above and the linked
packet. These counts are the original proposal, pending executed implementation
results and wider inventory; they are not a new baseline.

| Stem | Proposed additional errors | Original status/CLI exit |
|---|---:|---|
| `05-land-stage-overlay` | 9 | clean/0 |
| `06-mixed-use-stage-overlay` | 10 | clean/0 |
| `07-stage-overlay-control` | 9 | clean/0 |
| `08-variant-cross-checks` | 11 | warnings/0 |
| `09-returns-tax-basis` | 2 | errors/1 |
| `10-declared-roles` | 11 | clean/0 |
| `11-role-collision` | 8 | clean/0 |
| `12-role-eligibility` | 8 | errors/1 |
| `13-period-identities` | 3 | errors/1 |
| `14-student-bed-counts` | 2 | clean/0 |
| `15-student-bed-counts-inconsistent` | 2 | errors/1 |
| `17-exit-proceeds-junior-capital` | 3 | clean/0 |

Acceptance requires exact source/old-expectation hashes and new expected
findings/status/exit changes, including any wider corpus consumers. Do not run
an unreviewed blanket `--update`. Negative controls must cover missing/null/
empty/numeric/boolean/array/object actors, valid arbitrary and whitespace
strings, whole-missing `_meta`, malformed wrapper/nested shape precedence,
multiple physical peers, superseded and overwritten entries, all append-only
collections and extensions. Pin issue multiplicity/order and actor field paths.

Mutable-model controls must cover in-place canonical actor edits, model-only
additions, replacements/removals retaining physical evidence, divergent meta
aliases, stale `raw`, hand-built and cloned objects, exact-reference duplicate
exposure and equal-valued distinct physical blocks. Source controls must use a
fresh operation-local parse and preserve untouched bytes. Receipt and signing
controls must record actual validation/admission/signature consequences while
retaining their already-accepted rules.

## Reference implementation

`@uwmd/verify` owns the parser/validator/registry change; core's existing
re-export remains sufficient. A private parser-origin inventory can be a
`WeakMap<ParsedUWFile, readonly UWBlock[]>` keyed by the original parsed object,
without a serialized field or new public export. Only actor admission consults
that inventory in this proposal; existing current-value checks are not
wholesale redirected to physical history. Code must preserve object references
and protect the inventory container from accidental callback mutation.

Affected reference files are `parser.ts`, `validator.ts`, `protocol.ts` and their
focused tests. Add schema/type parity checks and independently matched Python
predicate/source controls without changing its CLI/capability claims. Integration
owns actual broader consumer/conformance disposition and exact-head CI. This
worker draft supplies no activated implementation, acceptance or full-suite
result. Implementations in other languages may retain their own physical block
inventory so long as they meet the same operation and diagnostic contract.

## Alternatives considered

- A dedicated actor error adds vocabulary but requires a new registered code;
  the narrow `META-01` extension reuses the structural-admission checkpoint.
- `META_FIELD_MISSING_ACTOR`/warning changes the closed five-name completeness
  family, misses malformed present values and does not provide this refusal.
- Inferring actor from `source`, email, agent id or a local user fabricates
  attribution; whitespace trimming adds a principal grammar not required here.
- Reparsing `parsed.raw` silently validates stale evidence and ignores caller
  edits. Checking reduced collections alone loses overwritten peers/history;
  an immutable parse cache also ignores legitimate in-place model changes.
- Requiring a new complete DTO/Envelope or importing V.13's stronger signing
  admission expands into RFC0089 and is unnecessary for this bounded rule.
- Exempting historical or extension blocks weakens the required principal and
  incorrectly treats history non-reclassification as metadata immunity.

## Unresolved questions

Final owner review must accept the exact diagnostic allocation, operation
boundary and governed expectations after independent material review. The
implementation/affected-consumer inventory must demonstrate all claimed
results; counts above alone cannot close that gate. Independent version and
release placement remain later decisions. There is no open question about
whether a required actor can be inferred or made optional by implementation.

## Prior art

The accepted Format nested provenance schema and RFC0081's bare block/shape
precedence establish the existing principal domain and diagnostic boundary.
ProtocolV.13 / RFC0084 demonstrates why source-taking operations account for
physical blocks before a reduced model can hide them; this proposal does not
import that feature's narrower authenticated source domain. ProtocolII keeps
parsing, validation and complete Verifier obligations distinct.
