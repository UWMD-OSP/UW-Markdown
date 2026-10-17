# RFC 0089 independent codec study (unapproved)

This supplements the original preserved lab. It is research evidence for the
draft tagged representation, not a production codec, accepted schema, Reader or
Verifier conformance claim, allocation of version labels, or authentication.
The owner has approved a pre-5.0 clean break; this study adds no historical
reader, shim, dual hash or automatic migration. Existing V.13 source admission
and draft RFC 0085 history authority are unchanged.

## Concrete coverage

[inputs.py](inputs.py) specifies two complete synthetic expected models before
encoding. Every model contains ten blocks across all six block collections:
builtin singleton and variant entries, three append-only arrays, tagged
single/nullable-variant extensions, and explicit ordered history. Complete outer
block extras, empty containers, absent members, explicit nulls, ordinary payload
members named `content`, metadata, prose and unknown Envelope members survive.
An absent variant identity and literal `default` remain distinct. This is the
proposed mixed-identity rule, not approval of its Format or portable projection.

[codec.py](codec.py) emits CSV directories and actual deterministic ZIP bytes,
plus a total escaped-string XML candidate. It also reconstructs both transports.
[independent.mjs](independent.mjs) separately implements CSV/typed-pointer,
ZIP/local-central/CRC and XML-tree reconstruction in Node. It imports no Python
or production codec; it uses the installed `fast-xml-parser` for XML syntax,
while Python uses its standard-library ElementTree and zipfile. Node's JCS
reconstruction is independently written with ECMAScript serialization and UTF16
ordering. The Python writer/reader retains the previous lab's JCS/typed-row
primitives; the two Python generations are not claimed independent of each other.

[fixtures/manifest.json](fixtures/manifest.json) pins 21 new artifacts: two
complete models, exact JCS subjects, lexical XML, ZIP archives and six-file CSV
directories. Both decoders compare complete decoded values to the frozen model
before separately checking its received semantic digest. Node also verifies all
59 original case-artifact hashes and their preserved matrix. The original lab
and all existing artifact bytes remain unchanged.

The fourth `block-extra` scope is explicitly a proposed **new mapping**, never
a scope admitted under CSV1. Each block has an explicit object root for that
scope, including when empty; reserved `annotation`/`content`/`prose` overlap
refuses. Both typed pointer trees and exact block descriptors must agree.

The XML candidate uses the unallocated namespace
`urn:uwmd:unaccepted:rfc0089:json-lexical`. Its root is a typed `uw:value`
containing the complete model; objects contain `uw:member` with `name-json`,
arrays contain `uw:value`, and `type` names the scalar/container kind. Every
string and member name carries one canonical ASCII JSON-string lexical token.
Non-ASCII UTF16 units and DEL use lowercase `\uhhhh`; valid supplementary
characters use paired escapes. XML entity escaping is a distinct transport
layer. Decoding requires canonical lexical equality, valid Unicode, unique
decoded names and exact attributes/types. NUL, U+FFFE, U+FFFF, CR/LF/TAB, quotes,
backslashes and emoji round-trip without replacement or normalization. JCS
subject text is computed from restored values, not the lexical XML spelling.

The ZIP study uses a deliberately bounded canonical STORE profile: six exact
sorted payload files, fixed 1980 timestamp/Unix regular-file mode, no comments,
extra fields, encryption, data descriptors, ZIP64 or deflate, and a 1MiB cap.
The independent reader checks local/central agreement, contiguous offsets,
version/flag/method/size/path metadata, CRC32 and inventory SHA256 before model
reconstruction. These are experiment limits, not newly selected standard ZIP
limits or proof about every transport accepted by the future bundle mapping.

The independent source control reads the **original** mixed-null/default and
ordered-history source files. It matches every physical ordinal, exact nullable
identity, current/history state and source-body SHA against their frozen plans.
This neither fixes existing parsed/default-key projection nor establishes a
complete source scanner; quoted annotations, general routing and unmarked
current-revision collisions remain outside this two-source control.

## Exact focused evidence and reproduction

[evidence/observations.json](evidence/observations.json) pins the executed commit
and tree, all helper/test hashes, frozen manifest, runtime, commands/exits and
raw stdout/stderr hashes. [evidence/dependencies.json](evidence/dependencies.json)
records the cached XML parser version/entry identity and lockfile hash; it is
not a full package-integrity attestation. The Node24.14.1/Python3.12.3 Windows
AMD64 run passes five Python methods and five Node tests, plus the read-only
21-artifact check. No full suite or cross-platform execution is claimed.

```sh
python -B experiments/envelope-0089/codec-study/capture.py --check
python -B experiments/envelope-0089/codec-study/freeze.py --check
python -B -m unittest discover -s experiments/envelope-0089/codec-study -p test_codec.py -v
node --test experiments/envelope-0089/codec-study/independent.test.mjs
```

Default capture/freezer operation is read-only. First-creation options refuse
existing output directories. A temporary first log collector failed displaying
successful Node Unicode output through cp1252 and wrote no proof file; the
corrected collector retains raw streams without encoding-dependent display.
No frozen answer was altered to clear that failure.

Refusal controls mutate disposable transport copies and refresh only their
inventory, so an unrelated checksum failure cannot hide an inner scope,
identity, pointer, duplicate, reserved-overlap or semantic-digest test. XML
mutations cover changed values, noncanonical escape aliases, invalid surrogate,
unknown type/namespace and DTD. ZIP mutations cover encryption, method, path,
symlink mode, version/size sentinel, local/central CRC and trailing bytes.

## Independent review correction: actual ZIP bytes before UTF-8 decoding

Independent integration review found a material experimental-reader bug: the
original fatal UTF-8 TextDecoder still stripped an initial BOM by default.
`decodeZip` then hashed re-encoded text rather than the original ZIP payload.
A Python-generated archive with valid CRC/size metadata and a BOM prepended to
`document.csv` passed despite retaining the original byte-size/SHA inventory.
Its unchanged decoded model/subject did not establish transport-byte integrity.
The original five-test observations remain preserved as that earlier result;
they do not prove this previously untested refusal.

The correction preserves BOM code points (`ignoreBOM: true`) and verifies every
manifest inventory size/SHA against **raw ZIP payload bytes before decoding**.
Strict UTF-8 remains fatal; no malformed-text replacement or sanitization occurs.
A sixth Node control independently uses Python zipfile to create the valid-CRC,
valid-size BOM archive with the original manifest, then requires raw inventory
refusal. The corresponding directory-string carrier also refuses its changed
inventory. All original21 fixture/artifact bytes remain untouched.

[evidence/bom-correction/observations.json](evidence/bom-correction/observations.json)
records six passing Node tests and the21-artifact byte check, exact raw logs,
executed correction commit/tree, and complete old/current helper identity maps.
Only `independent.mjs`, its tests and the evidence verifier change identity.
The original observation bytes remain pinned at SHA-256
`7cb1732d1ffd87ea561ae472334c32c2f7c83bea70d278fd07fc891b7af33c23`.
Default `capture.py --check` verifies historical helpers from their exact Git
blobs and the current helpers against the explicit correction map, with no hash
wildcards or rewritten expectations. It requires the recorded history to be
available; it never executes the historical decoder or treats old acceptance
as current proof. The unchanged Python codec unit tests were not rerun.
The first-creation correction option refuses existing outputs.

## What remains unproved and unapproved

These are two synthetic models with a bounded validator, not exhaustive schema
admission or corpus coverage. Empty history slots and empty builtin variant maps
still refuse locally; their complete future carrier is unresolved, not a proposed
ban. Complete builtin/schema domain, JSON duplicate-member admission, arbitrary
source syntax/routing, complete numeric-token coverage, deflate/ZIP64 policy,
independent cross-platform runs, new-regime receipts/signatures and HTTP/MCP
bindings are not established. The Node XML reader uses the emitted fixed `uw`
prefix profile; general namespace-prefix alias admission is not demonstrated. No real cryptographic, financial or provenance
completeness evidence is inferred from a codec round-trip.

The exact D1 wrapper, mixed nullable identity/public portable projection, XML
choice, full CSV shape/domain and version/subject labels still require owner
approval and synchronized normative text/schema/fixtures. This study makes the
block-extra and total lexical XML options concrete; it accepts neither design.
The reserved UWMD5.0 tag/publication needs separate owner launch approval.
