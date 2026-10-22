---
rfc: 0097
title: Refuse invalid selected institution configuration before validation
status: accepted
author: UWMD maintainers
created: 2026-10-19
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0097: Refuse invalid selected institution configuration before validation

## Summary

Define an operation-level refusal when a selected institution configuration
cannot be read or fails the bounded admission rules below. A genuinely missing
automatic sidecar still leaves validation defaults in force. A selected invalid
file never becomes successful validation under defaults or partially applied
overrides. Define two typed errors, deterministic preflight/transport and an
atomic three-key adapter. No new financial threshold, formula or comparison
rule is introduced. The owner accepted this contract on2026-10-19 at4a31eb3c;
synchronized implementation follows on Issue354.

Prior drafting authority,2026-10-19, quoted verbatim:

> Proceed with the refusal-contract RFC draft I approved: validate refuses a selected unreadable or malformed institution config with exact typed transport; missing automatic sidecars still use defaults; no new financial thresholds; drafting only.

Owner acceptance,2026-10-19, quoted verbatim:

> RFC 0097 (#396 at 4a31eb3c) is accepted as drafted: VAL-INSTITUTION-CONFIG-UNREADABLE and -MALFORMED as operation errors with error-only JSON and exit 1, one explicitly selected path or the lexical sidecar with no merging or fallback, the strict JSON profile as written, atomic admission of the three flat overrides, missing automatic sidecars still default. Mark ready, merge on green, then implement in TS and Python together on the #354 lane.

This RFC is separate from accepted payload admission RFC0096 and the Python
complete-validation WIP. Discovery stays parse-only until its complete capability
gate passes. The acceptance PR396 changed only documentation. The synchronized
implementation below changes runtime/types/schema and adds governed controls;
release state and advertised capabilities remain unchanged.

## Motivation and independently verified evidence

[Protocol VI.3](../../spec/UW_PROTOCOL.md#vi3-institutionconfig-layering) requires
institution settings to apply to validation. [Format Appendix C.6](../../spec/UW_FORMAT_SPEC.md#c6--custom-validation-thresholds)
locates `.uw.institution.json` beside the record and shows the flat
`validation_overrides` carrier. Neither defines a selected-invalid-config refusal.
The [existing Issue354 decision packet](https://github.com/UWMD-OSP/UW-Markdown/issues/354#issuecomment-6261921830)
records independent observations, not an approved error contract.

At main033c76c3, the reference CLI reads only an explicit file and passes its
nested `thresholds` member, ignoring both the documented flat overrides and
automatic adjacency. Read/JSON errors warn and fall back. Its exported
`InstitutionConfig` type in `packages/uwmd-verify/src/types.ts` also describes
that nested shape rather than the documented wire carrier.

Two bounded, unintegrated checkpoints implement the three documented valid
keys: TS247d843458ccb4d34e94c551ffe5cc4db8614da5 and
Python593c562d378464350bf20fccaee52befca96d920. Independent review passed13
actual cross-runtime CLI controls: default behavior, nine strict below/equal/
above comparisons, explicit selection and actual-record-directory
versus current working directory. Original sources/configs were unchanged;
DSCR/LTV default error bands and caller maps were preserved.

Five malformed controls show a real unresolved difference. Python returns an
uncoded LOCAL development-unavailable error/exit1. TS returns ordinary
validation/exit0 under defaults or partial overrides. In particular:

```json
{"validation_overrides":{"dscr_warning_below":1.108,"ltv_warning_above":"bad"}}
```

On unchanged positive `conformance/documents/fixtures/02-full-multifamily.uwx.md`,
TS removes FV-04 using the valid DSCR member while ignoring the invalid LTV
member. Python refuses the operation. Neither observed boundary is accepted
authority. Automatic adjacent loading is new; its malformed behavior cannot be
justified as preservation of the old explicit-file loader.

Independent observation report SHA256:
`4983a3992d64f70ea10d6c0b42a6047964bd54fbede81e2fee7b13586edca0f6`.
Earlier authority/probe capture SHA256:
`b250c63c1338ae7578cc9cf79d50b270c9c2d7afa1cb27c8e6b44714b5f597a5`.
These are limited research observations. Required vectors below are implementation
conformance requirements, not claims of already executed refusals.

## Accepted contract

The owner accepted all requirements in this section at4a31eb3c. Synchronized
implementation remains required. This is a selected-config operation failure,
not an additional document validation finding or generic schema-error code.

### Selection and operation boundary

A filesystem validation adapter selects exactly one file:

1. If the caller explicitly supplies an institution-config path, use that path.
   The reference CLI's existing `--institution` option selects it. Resolve a
   relative explicit path from the invocation's working directory.
2. Otherwise select `.uw.institution.json` in the directory of the absolute,
   lexically resolved document path. Do not search the working directory,
   parents, frontmatter ids or another document's directory. Do not realpath
   the document through symlinks merely to choose a different sidecar directory.
3. An explicit path suppresses automatic discovery entirely. Do not merge two
   files or fall back to the adjacent file if the explicit one fails.

For example, from `/work`, `records/link.uwx.md` selects
`/work/records/.uw.institution.json` even if the document link targets
`/archive/deal.uwx.md`. `records/../deal.uwx.md` selects
`/work/.uw.institution.json`. This accepted directory rule is independent of
existing document-read semantics; it does not change whether/how the OS follows
a document link. Tests must distinguish invocation-path and physical-target
sidecars. The unintegrated Python Path.resolve-based discovery must be aligned
to this accepted lexical directory choice.

A missing automatically selected path is the sole absence/default branch.
Attempt the read; a genuine not-found outcome for that automatic path means no
configuration. Access denial, a directory in place of the file, a broken
symlink at the sidecar path, or any other read failure is not absence. An
explicit missing path is unreadable. If a path disappears after selection or
inspection, classify the actual read outcome; do not rely on a racy exists-only
check. Distinguishing a dangling link from no directory entry is an adapter
responsibility and is tested without prescribing an OS-specific API.

CLI argument and fatal input-source/representation/parse admission retain their
existing precedence. After those prerequisites and before document validation
predicates or financial funding checks, finish config preflight. Do not add new
document parse rules through this RFC. Once config preflight fails, no ordinary
ValidationResult, overall status, partitions, stage-readiness, coverage or
replacement-funding result is computed or presented for that operation.

Pure SOURCE/MODEL validation APIs remain I/O-free with respect to institution
files. `validateUWFile(input, thresholdOverrides?)` and Python's equivalent take
the caller's supplied nested threshold map; that parameter is not the sidecar
wire object. They do not discover files or acquire hidden sidecar authority.
A file adapter parses the selected wire object into that existing parameter.

### Bounded malformed domain and atomic application

The selected file MUST decode as strict UTF-8 and exactly one JSON value with
only JSON whitespace around it. A leading BOM, trailing non-whitespace, invalid
UTF-8, invalid JSON or duplicate object member names is malformed. Names are
compared after JSON escape decoding, without trimming or Unicode normalization.
Every decoded member name and string value, including opaque data, MUST have
well-formed Unicode scalar content: reject an escaped lone high/low surrogate;
a correctly paired escaped surrogate sequence is admitted. Do not normalize
strings or replace invalid code units. A Unicode-profile failure is malformed
without a pointer, at the same pre-shape stage as whole JSON admission.
The BOM, duplicate-name and decoded-Unicode rules are explicit accepted
profile choices, not inherited JSON MUSTs or reuse of document JCS admission.
[RFC8259 section4](https://www.rfc-editor.org/rfc/rfc8259.html#section-4)
recommends unique names; [section8.1](https://www.rfc-editor.org/rfc/rfc8259.html#section-8.1)
permits parsers to ignore a BOM. They do not themselves select this stricter
configuration profile. The owner accepted these stated choices at4a31eb3c.
The root MUST be an object, not null or an array.

The recognized carrier is an own `validation_overrides` member. Absence means
no override. If present it MUST be an object, not null or an array. Empty is
valid. Its three recognized optional own members MUST be finite binary64
numbers when present; null, booleans and strings are invalid, with no coercion:

| Wire member | Existing explicit API member |
|---|---|
| dscr_warning_below | dscr.warning_below |
| ltv_warning_above | ltv.warning_above |
| debt_yield_warning_below | debt_yield.warning_below |

This adds no numeric bounds, threshold defaults, rounding or comparisons.
Negative values, zero and finite fractional values are admitted as configuration
numbers; the existing validation comparison procedures remain unchanged.
A JSON number spelling which overflows binary64 is not an admitted recognized
threshold. No new safe-integer restriction is imposed.

A root own `thresholds` member is explicitly noncanonical and malformed,
including when a canonical carrier is also present. Do not choose between two
carriers or treat it as a nested wire alias. This does not change the existing
nested threshold-map parameter of pure APIs.

Other top-level data and other members of `validation_overrides` remain opaque:
this RFC does not allocate new validation for `institution_id`, workflow/render
preferences or an exhaustive vocabulary for every Format5.2 threshold. Do not
report an opaque member as applied. A similarly named nested lookalike is not
the root canonical carrier. The duplicate-name JSON rule still applies to every
object in the selected file. This scope is deliberately explicit; unknown-data
handling is not a claim of complete institution-policy support. In particular,
a lexically valid overflow number in opaque data (for example an unknown
`note_number:1e309`) does not trigger the recognized-leaf finite check and is
never applied or reported as a threshold. An adapter need not coerce that opaque
number into binary64 or reserialize the config. Original bytes stay unchanged.
An escaped lone surrogate remains malformed even in opaque data under the whole
Unicode rule above; paired scalars are valid. Neither rule authenticates a config
or makes it an Envelope, signature or receipt subject.

The adapter MUST admit the complete selected config before applying any
recognized override. One invalid recognized member refuses the whole operation;
no partial map is passed to validation. On success build fresh affected bands
from existing defaults, then replace only the named member. Existing DSCR/LTV
error limits and unrelated bands remain present. Do not mutate process-wide
defaults, the caller's model/map, the document or the selected config bytes.

### Exact refusal, precedence and field attribution

Allocate exactly these operation errors, both category `validate`:

| Code | Condition | Required message |
|---|---|---|
| VAL-INSTITUTION-CONFIG-UNREADABLE | Selected read fails, except genuine automatic absence | Selected institution config could not be read. |
| VAL-INSTITUTION-CONFIG-MALFORMED | Decoding/JSON/profile or recognized admission fails | Selected institution config is malformed. |

These codes do not enter ordinary errors/warnings/issues arrays, change their
registered severity system or allocate a META/FV fallback. Add operation-error
documentation/remediation without pretending they are document issue families.
`ProtocolError`'s existing category/shape remains unchanged. Synchronize its
pointer comment and the protocol-error schema's pointer description: for these
two codes the pointer is relative to the selected configuration input, not the
underwriting document. Existing other codes retain their own pointer authority.
No new pointer syntax or outer filename field is allocated.

Return exactly one primary config error:

1. Read failure wins before decode/profile checks.
2. Decode, whole JSON syntax, duplicate-name or Unicode-profile failure: malformed; omit pointer.
3. Nonobject root: malformed; omit pointer.
4. Own root `thresholds`: malformed; pointer `thresholds`.
5. Invalid canonical carrier: malformed; pointer `validation_overrides`.
6. Invalid recognized leaves: first in the fixed order dscr_warning_below,
   ltv_warning_above, debt_yield_warning_below; pointer is the exact
   `validation_overrides.<member>` path.

No document-field issue or lower-priority config error cascades. Opaque members
have no admission pass beyond the whole-JSON rules. A caller MAY receive optional
`cause`/`remediation` strings permitted by ProtocolError; do not add schema-forbidden
inner members, reinterpret pointer as a document field or expose config bytes
as part of the error. Optional diagnostic detail does not change the primary
code/message/pointer above.

### CLI transport

`validate <file> --json`, with an optional explicit config selector, MUST exit1
and write exactly one JSON object to stdout:

```json
{
  "error": {
    "category": "validate",
    "code": "VAL-INSTITUTION-CONFIG-MALFORMED",
    "message": "Selected institution config is malformed.",
    "pointer": "validation_overrides.ltv_warning_above"
  }
}
```

The outer object has only `error`; its value conforms to the existing
`protocol-error.schema.json`. Omit pointer for cases which have none. A trailing
newline is allowed. No `partial_validation_result`, structural result, clean
verdict or partial override output accompanies this refusal. Stderr may carry
diagnostics but cannot substitute for the structured stdout error. A described
selected-config failure is exit1, never internal-error exit2 or success exit0.
An actual unrelated implementation defect retains the existing exit2 boundary.

Without `--json`, the same refusal/code exits1; human diagnostics go to stderr
and stdout contains no validation-result claim. No new normative CLI selector
syntax is required beyond the existing optional reference-CLI flag.

Any existing aggregate adapter which invokes validation, including the
reference `verify` command's validation branch, must propagate this same typed
validation-operation failure and cannot report that branch as passed. Its
existing aggregate wrapper/other independent operations are not redesigned by
this RFC, and no new `verify --institution` flag is allocated.

### Receipt and authentication boundary

Receipt issuance presently validates with builtin defaults and records those
counts (`receipts.ts` validate/counts calls). Issuance/verification options have
no config parameter, and receipt CLI commands load no sidecar. Verification
checks count shape rather than recomputing the policy counts. Configured CLI
validation findings can therefore differ from builtin receipt counts.

This RFC MUST NOT silently make receipt issue/verify discover or refuse on an
adjacent config. It changes no receipt subject, policy identity/count binding,
signature requirement, recomputation, result-digest or verdict precedence. Any
extension of receipts to configured policy requires its own explicit governed
scope. Config errors are not additional document findings or receipt error counts.
The accepted authenticate-first receipt contract remains authority.

## Synchronized specification and type changes

Synchronize Format Appendix C.6, Protocol VI.3, II.6a transport
cross-references and XI operation-error documentation. Add a normative minimum
institution-config schema encoding the object/carrier/three-number rules and
forbidden root `thresholds`; whole-byte decoding, duplicate-name handling,
finite-binary64 admission and read failures also need runtime controls. The
schema must preserve opaque members and cannot assert extra numeric ranges.

Synchronize exported `InstitutionConfig` to the canonical wire object with an
optional flat carrier and opaque extra members. It must no longer advertise a
nested wire alias or confuse config data with pure `FinancialThresholds` API
parameters. No new public function is required; a shared internal adapter may
be used. Schema/index/protocol type changes ship together with implementation,
not in this docs-only acceptance. No generic runtime schema engine or new dependency is needed.

## Conformance impact and implementation gates

The existing111 portable validation cases, sources and frozen expectations
remain unchanged. The implementation adds29 paired Verifier/validate controls
under `conformance/institution-config/`, with actual subprocesses and native
filesystem/source/model assertions. Portable validation becomes140 cases; the
whole portable catalogue becomes393. These counts do not certify the Python
capability or eliminate applicable nonportable/platform proof requirements.

| Required controls | Required outcome |
|---|---|
| No automatic sidecar; unrelated cwd/parent sidecar | Existing defaults; no config error |
| Explicit absent; selected directory; denied read; dangling sidecar link | UNREADABLE, exit1, no result |
| Invalid UTF-8, BOM, bad JSON, trailing value, duplicate decoded name or lone surrogate | MALFORMED, no pointer |
| null/array/scalar root | MALFORMED, no pointer |
| Root thresholds, alone or beside valid canonical carrier | MALFORMED at thresholds |
| Canonical carrier null/array/scalar | MALFORMED at validation_overrides |
| Absent/empty carrier, opaque unrelated data including overflow spelling and paired Unicode | Defaults; no invented metadata error |
| Each recognized leaf: absent/finite/null/bool/string/overflow | Valid map or exact MALFORMED leaf pointer |
| Multiple invalid leaves, reversed JSON member order | Same fixed primary error, no partial application |
| One valid leaf plus invalid sibling | Whole operation refused, no FV/default result |
| Three documented keys below/equal/above stated comparison | Existing FV procedure and limits unchanged |
| Explicit relative/spaced path versus contradictory adjacent file | Exactly selected file, never merge/fallback |
| Different cwd, document/sidecar symlink locations, race injection | Exact selection/absence/unreadable rules |
| Valid configured operation followed by default operation | No process-global/default-band mutation |
| Pure SOURCE/MODEL call with sidecar present | No hidden I/O; supplied map/model authority unchanged |
| Document admission refusal plus malformed config; document validation issues plus malformed config | Existing fatal source precedence; otherwise config preflight before validation |
| Non-JSON CLI, aggregate validation branch and config-error JSON schema | Exit/stream/type boundary as above |
| Receipt issue/verify beside invalid config | No new sidecar dependency or subject/verdict/count semantics |

Permission/link/race controls must use real supported adapters or explicit read
failure injection with independently checked boundaries. Do not claim portable
permission behavior from an ineffective chmod on another platform. Tests never
rewrite the source/config under assessment. These named vectors are required implementation controls,
not claims of executed fixtures in this docs-only acceptance.

The owner accepted the final text at4a31eb3c on2026-10-19 after independent
semantic review. Scope, code uniqueness, selection/absence and precedence,
unknown-data and public-type boundaries, atomic application, receipt exclusion
and testable transport were reviewed. Reviewed-head CI39222835814 passed all17
ordinary jobs: https://github.com/UWMD-OSP/UW-Markdown/actions/runs/39222835814 .
Final administrative acceptance-head review and CI are recorded in PR396;
merge SHA and exact-main CI are recorded in NOW.md. Before runtime activation:
synchronized TS/Python/spec/schema/type/operation-error documentation, attributed
conformance controls, independent material-claim verification and green exact-head
and exact-main CI. Validation capability promotion remains a separate full gate.

## Reference implementation

Reconcile the held TS institution adapter/CLI tests and Python private helper
with this accepted contract. Implementation locations include:
`packages/uwmd-core/src/institution-config.ts`, `cli.ts`,
`packages/uwmd-verify/src/types.ts`, and independent Python's
`uwmd_institution.py` plus actual validation CLI wiring. The held TS partial
application and Python uncoded local refusal are evidence, not final behavior.
Add main-safe controls independently of the Python complete-validator WIP.
No model-generation, workflow, display or metric implementation work is included.

## Alternatives considered

- Warn and use defaults: rejected because the selected policy
  failed while the document appears successfully validated under another one.
- Apply only valid known siblings: rejected; produces undocumented partial policy.
- Fall back from explicit selection to adjacent discovery: rejected; changes
  caller authority and conceals a failed selected input.
- Put a META/FV issue into an otherwise ordinary result: rejected; config is an
  operation input, not a document block, and no validation actually used it.
- Nested/flat dual-carrier policy: rejected; adds an unnecessary second wire
  interpretation. Pure nested threshold-map parameters remain distinct.
- Hidden API file loading or receipt policy rebinding: rejected from this scope;
  neither follows from configuring a filesystem validation operation.

## Accepted decisions from owner review

| Question | Accepted exact disposition |
|---|---|
| Failure allocation | Two closed validate-category operation errors above, no document issue family |
| Selection/absence | One explicit path or adjacent lexical document path; only genuine automatic absence defaults |
| Malformed minimum | Strict UTF-8/whole JSON/Unicode scalars/unique names/object carrier/three finite leaves; forbidden root thresholds |
| Unknown data | Opaque extras retained as data, never claimed applied; no exhaustive new threshold vocabulary |
| Application and order | Atomic whole-config admission; explicit fixed primary-error precedence |
| APIs/receipts | Pure caller maps remain separate; no receipt config loading or identity/count changes |

The owner accepted all six dispositions above at4a31eb3c. No numerical
convention is unresolved or selected here. Synchronized implementation still
requires independent review and green exact-head/main CI. RFC0096 and
RFCs0085/0089/0092 retain their own ownership and acceptance states.

## Implementation disposition

The TypeScript private file adapter and CLI implement strict admission, atomic
three-key mapping, exact config errors and lexical selection. The existing
aggregate wrapper reports `validation: { error: ProtocolError }`, `ok: false`,
omits replacement-funding/stated-metric results for that refused branch, and
retains requested independent integrity/provenance operations. No new aggregate
flag or receipt config loading is introduced. Config preflight reports described
refusals at exit1 and unexpected adapter defects at exit2, with actual injected
error controls for standalone and aggregate calls. The existing global CLI catch
is unchanged: broader unrelated input-refusal classification is not altered by
this bounded adapter.

The independent main-safe Python module uses only the standard library. Its
numeric tokens preserve opaque overflow spellings without coercion; only recognized
leaves become finite binary64. It imports no developing validator. The separate
Issue354 adapter wires accepted preflight and error-only transport into the
unadvertised `validate` command; no standalone inspector or capability is added.
Both adapters attempt the read first, then distinguish genuine automatic absence
from dangling/present entries or inconclusive inspection errors. Pure callers'
nested maps and receipt subject/count/authentication contracts remain unchanged.

Attribution of the29 new paired controls:

| Controls | Accepted requirement |
|---|---|
|01–03|Automatic absence, explicit missing path and selected directory read outcomes|
|04–10|Strict UTF8/BOM/whole JSON, decoded duplicate names and Unicode scalar content, including opaque data|
|11–19|Root/carrier/leaf admission, forbidden-root and fixed-leaf precedence, finite binary64 and atomic sibling refusal|
|20–23|Empty/opaque data, opaque overflow and paired scalars, three exact warning mappings and spaced explicit paths|
|24–29|Automatic adjacency/malformed input, explicit suppression/no fallback, nested lookalike opacity and JSON whitespace|

Existing frozen minimal/full source bytes are reused; location-dependent controls
copy those bytes solely to isolate the lexical source directory. No original
record or expected result is repaired/rebaselined. The native runner additionally
checks the error-only outer object, ProtocolError schema, pointer presence/absence,
ordinary-result exclusion, exact exit and source/config preservation. Portable
cases reuse the existing comparator. Separate runtime/actual CLI controls assess
permission/link/race and internal failures, non-JSON/aggregate transport, caller
map isolation and receipt exclusion. PR evidence distinguishes executed proof
from pending exact-head/platform/complete-capability gates.

## Prior art

Existing Format Appendix C.6 and Protocol VI.3 supply the sidecar/application
boundary; Protocol II.6a and XI supply typed failure and transport. RFCs0090–0096
establish closed admission allocation and source/model authority without a
generic schema fallback. Their document-finding populations do not turn a
selected-config operation failure into a retained-physical metadata finding.