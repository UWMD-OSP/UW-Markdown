# Raw JSON admission boundary (unapproved RFC0089 research)

This study isolates one remaining representation/authentication boundary: raw
JSON can contain repeated decoded member names even though a JSON Schema
validator receives an already constructed object. A last-member-wins parser can
erase the earlier occurrence before model validation, JCS or signature checking.
The question concerns raw representation admission, not a new financial formula,
receipt verdict, metadata shape or authentication-source policy.

The original two `codec-study` model JSON files and CSV manifests are inputs.
No original helper, model, CSV, ZIP, proof, specification, schema or production
file changes. The model JSON Node path explicitly composes ordinary `JSON.parse`
with the preserved `validate`; it is not an existing exported public decoder.
The CSV path executes the actual preserved Node `decodeCsv` and Python
`decode_csv`. There is no new ZIP execution claim in this study.

## Exact observations

36 vectors compare preserved paths with a separate strict research boundary:

| Path | Accepted | Refused |
|---|---:|---:|
| Preserved Python duplicate-aware loader/codec |12|24|
| Node ordinary JSON.parse/model validation or existing CSV reader |33|3|
| Python strict boundary profile |12|24|
| Separately authored Node strict boundary adapter |12|24|

The21 historical differences are recorded, not normalized away. Twenty are
actual model/manifest duplicate mutations; the other is a minimal syntax-only
escaped-name alias. Identical repeated values still refuse under the strict
profile. Conflicting earlier values and escaped aliases such as `"a"` versus
`"\u0061"` cannot be silently discarded. Nested annotation/manifest-inventory
members receive the same treatment.

The28 actual carrier cases are two models x two carriers x seven spellings:
original, escaped **unique** name, identical/conflicting duplicates, escaped
conflicting duplicate, nested identical duplicate and nested escaped conflict.
Every spelling has the same last-member-wins object as its frozen input, asserted
independently before execution. The original/escaped-unique cases preserve
accepted semantics; five duplicate cases per template demonstrate the gap.
Eight minimal JSON controls separately cover no Unicode normalization,
case-sensitive names, escaped delimiters, numeric spellings, trailing syntax
and nonfinite binary64 refusal. They do not establish additional UWMD field or
unsafe-key admission rules.

## Authentication consequence and limits

Real Node Ed25519 uses the previous study's openly known test seed, not a secret
or production trust anchor. It signs two **synthetic candidate document
artifacts** over the complete candidate subject. Under the preserved Node paths,
all28 carrier cases reconstruct the same model/preimage/digest, so the original
raw research signature verifies28/28. Under the strict boundary, the eight valid
spellings verify; twenty duplicate carriers refuse before a crypto verification
call. Exact artifacts, signing-payload hashes, signatures, full model hashes,
subject digests and call counts are frozen. Python independently confirms all
strict accepted canonical values and complete model hashes/digests; it does not
independently implement Ed25519 here.

This is **not** a cryptographic signature break: the signed model has not
changed. It proves that model equality and valid cryptographic bytes do not
prove unambiguous raw representation admission. Nor does it exercise current
public document-signature verification, V.13 source admission, receipt issuance,
financial recomputation or a new-regime signature/receipt state machine. These
synthetic models retain the earlier lab's partial metadata and no source proof.
No new RCP/INT code, receipt rule, metadata gate or legacy compatibility path is
proposed or activated by this executable study.

## Recommended candidate rule, not acceptance

For the proposed new representation, detect duplicate **decoded** JSON names
before constructing each object, including nested/unknown members and the CSV
manifest. Refuse rather than select first/last, sort or deduplicate a received
ambiguous carrier. An escaped unique name remains valid; Unicode normalization
is never applied. Schema validation of the resulting object is a separate step.

[RFC8259 section4](https://www.rfc-editor.org/rfc/rfc8259.html#section-4)
explains the interoperability risk of repeated names.
[RFC8785 section3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1)
requires unique names in adapted JCS data, but a plain object cannot recover raw
occurrences erased before canonicalization. The exact new-regime transport and
manifest admission text must therefore be explicit; this does not assert a
retrospective universal error rule for every current JSON API or parsed artifact.
Current Envelope1, CSV1, signatures and receipt input/error contracts stay intact.

## Reproduce without rewriting evidence

```sh
python -B experiments/envelope-0089/json-boundary/cross_runtime.py
python -B -m unittest discover -s experiments/envelope-0089/json-boundary -p test_cross_runtime.py -v
```

The cross-runtime replay compares every historical and strict behavior field,
artifact, source/dependency identity and raw bytes under the exact two measured
profiles below. It retains every actual run in a new TEMP directory, including
observer stdin/stdout/stderr, process status, execution binary hash, result and
failure diagnostics. `--out` selects another **new** disposable directory; an
existing directory refuses. Runtime/OpenSSL metadata remains recorded separately.
No install/build, production activation or full suite runs in this harness.

The original `capture.py` remains byte-identical: its default replay is the
stronger exact Node24 same-runtime check, and `--create` refuses existing evidence.
Original raw UTF8 stdin is retained as deterministic gzip mtime0; original
stdout/stderr and all original observation/source hashes remain unchanged.

The executed checkpoint is `13bc90fa`; Windows Python3.12.3 and Node24.14.1 are
recorded alongside their OpenSSL versions. `evidence/observations.json` SHA256 is
`94cb67dc98c2e9a5a9018ce33c0fce421af31474836bd4eabe3651b0bd6bca27`.
It pins all research helper/JCS/parser-bundle bytes and each actual consumed
model/CSV file. Node stdout SHA256 is
`6a250e84fb74c607534c3b2655e4194f12d225b9240f77f4a98428f4847feba9`;
stderr is empty. Codec/auth/namespace evidence remains byte-identical.

The strict Node adapter is bounded to <=1MiB UTF8 encoding and depth<64 and
reuses preserved JCS Unicode/number semantics. It is a research JSON grammar
adapter, not a hardened general parser or proposed public package API. This36
case study does not prove all JSON grammar/resource/security behavior, complete
schema/domain admission, cross-platform parity, a whole source projector or
accepted new-regime issuance. Those implementation and synchronization gates
remain open; RFC0089 remains draft with unallocated labels and no release.

## Exact runtime diagnostic correction

The first required Linux Node20.20.2 replay failed its behavior comparison.
A separately downloaded official Node20.20.2 Windows runtime reproduced exactly
two differences versus the frozen Node24.14.1 run. The integrator independently
reproduced the same Node20 stdout SHA. Both differences are the **native JSON
parser's historical syntax-only `error_message`**, not strict-profile errors:

| Vector / original row | Node24.14.1 | Node20.20.2 |
|---|---|---|
| `syntax-only/json-data/trailing-input` /32 | `Unexpected non-whitespace character after JSON at position 2 (line 1 column 3)` | `Unexpected non-whitespace character after JSON at position 2` |
| `syntax-only/json-data/trailing-comma` /33 | `Expected double-quoted property name in JSON at position 7 (line 1 column 8)` | `Expected double-quoted property name in JSON at position 7` |

`cross_runtime.py` permits only these exact pairs at the pinned case/carrier/
vector/input SHA256 and `SyntaxError`, false acceptance, crypto-call0 events.
All other fields and errors remain exact. Unknown runtime versions, other error
text, changed acceptance, class, calls, values, subjects, signatures, cases,
source/dependency maps, stdin or stderr fail closed. The Node20 expected stdout
is derived from the original bytes with exactly these two unique byte-string
replacements; every other stdout byte must match. There is no general
`error_message` exclusion, wildcard source waiver or overwritten expectation.

The new `node20-reference/actual.json` retains the complete executed original
collector output at source checkpoint944eaa86, SHA256
`d4ea6feb037ba421b78497781f1227de53517d3dd8eb77139741f3009a46b83e`.
Its stdout SHA256 is
`58f53a3aeb0b9f03c53372aaf0a1a81cd1dd670a8517e0f9818902b2a18d281e`;
stderr and stdin match the original. Source/dependency hashes and every other
behavior field are byte-equivalent. Its reference binary is official Windows
Node20.20.2/OpenSSL3.0.19; the URL/archive/executable hashes are preserved in
`runtime-provenance.json`. This binary was isolated in TEMP, not installed or
added as a dependency. The first tool-isolated TEMP comparison did not persist;
the focused run was repeated once into host TEMP to preserve this reference,
with the same stdout hash. No source/algorithm/observed answer changed.

Four focused control methods cover both measured profiles, the actual reference,
and refusal of material, arbitrary-message, source, dependency, raw-stream,
wrong-profile and unknown-runtime mutants. Actual36-vector cross-runtime runs
passed under both Windows Node24 and the verified isolated Node20, with complete
streams retained. Linux final CI evidence is recorded by the integrator; these
local runs alone make no additional Linux or general JSON conformance claim.
