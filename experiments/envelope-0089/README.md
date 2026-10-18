# RFC 0089 candidate preimages (unaccepted)

**Owner-selected direction,2026-10-17:** D1/D2/D2b, total ASCII JSON-lexical
XML, complete CSV carriers and complete supported subject under unchanged V.13/
Receipt5.5 are selected for further work; RFC0089 stays draft pending evidence
and synchronized contracts. The new [model-admission checkpoint](model-admission/README.md)
checks complete schema/semantic boundaries without activating a runtime. Existing
codec/projection/crypto studies remain bounded evidence, not final acceptance.

**Current work scope, owner rule2026-10-17:** prelaunch compatibility,
reissuance/migration plans and artifact-retention inventories are retired.
Do not run or maintain those portions of the original prototype. Existing files
are unmaintained research, not acceptance gates. Current lawful-domain fidelity,
portable projection, strict Unicode admission and complete-subject authentication
remain in scope. The supported current contract does not gain a legacy fallback.


**Later bounded codec evidence:** [codec-study/README.md](codec-study/README.md)
adds independent Python/Node decoding of complete block-extra CSV, actual ZIP
and total escaped-lexical XML. Its two frozen models/21 artifacts and measured
limits supplement the historical experiments below; no original prototype,
artifact, version or live conformance expectation is rewritten.

These five frozen subjects support the documentation-only
[draft RFC](../../docs/rfcs/0089-lossless-extension-envelope.md). They are not
live conformance fixtures, a codec, a proposed version allocation or evidence of
owner acceptance. `E_NEXT` is a design token and is unsupported by every current
Envelope reader. Existing Envelope1 schemas, runtime and expectations are unchanged.

`candidate-preimages.json` records complete semantic values, exact canonical UTF-8
text (no BOM or final newline in the hashed text) and SHA-256. Top-level volatile
fields are absent; no payload, provenance or annotation is omitted. All data is
synthetic. The baseline pins the contract inspected, not an executable producer
for candidate values. No current UWMD code produced the candidate projection.

| Subject | SHA-256 (without `sha256:` prefix) | Isolated observation |
|---|---|---|
| `historical-empty` | `f5beb1161b4b5fd740de62e696f4250d378341faf670df22b375bb96ac94eb1b` | Existing1.0 no-extension semantic value. |
| `candidate-empty` | `2e6b1d662d193a3e8e0db57cf58e2316baff0513867974151013e8a4d3da6c03` | Only the Envelope stamp changes; the complete-source identity changes. |
| `candidate-single` | `2da09d70a50e2224427d889b22c6d74cb2cd577f9c35812406c95e8e62660d03` | One complete block explicitly named `default`, single mode. |
| `candidate-one-peer` | `9c06f2272c1b3ee7a3d3d79666507fe0a9be6432686df35a5a41c85af3957a79` | Exactly the same block, explicit variants mode; different model identity. |
| `candidate-mixed` | `618f1ab9e45b9db190beaa91415700d14ca68040748d459db3d3fb886aa9ce6a` | Null and literal `default` retain distinct annotation identities and payloads. Its source admission is prospective. |

The numeric/string domain is deliberately small: ASCII keys and strings, null,
booleans, empty containers and integer1. Thus ordinary compact JSON serializers
with recursively sorted keys produce the JCS bytes for these values. This is
**not** a general JCS implementation or a claim about arbitrary binary64 numbers,
UTF16 ordering, Unicode normalization, source routing, XML/CSV or signatures.
The production JCS and financial kernels are neither invoked nor changed.

Run from the repository root. Python independently reconstructs sorted JSON from
each semantic value, compares the frozen text and checks SHA-256:

```python
import hashlib, json
from pathlib import Path
path = Path("experiments/envelope-0089/candidate-preimages.json")
vectors = json.loads(path.read_text(encoding="utf-8"))["vectors"]
for v in vectors:
    text = json.dumps(v["semantic_value"], sort_keys=True,
                      separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    assert text == v["canonical_utf8"], v["name"]
    assert "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest() == v["sha256"]
print("5/5 frozen candidate preimages agree (bounded Python check)")
```

Node independently reconstructs a recursively sorted object tree, compares the
text and hashes it. It does not hash a string supplied by Python without checking
the corresponding semantic value:

```javascript
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const { vectors } = JSON.parse(readFileSync(
  'experiments/envelope-0089/candidate-preimages.json', 'utf8'));
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
}
for (const v of vectors) {
  const text = JSON.stringify(sorted(v.semantic_value));
  assert.equal(text, v.canonical_utf8, v.name);
  assert.equal('sha256:' + createHash('sha256').update(text, 'utf8').digest('hex'), v.sha256);
}
assert.equal(vectors.length, 5);
console.log('5/5 frozen candidate preimages agree (independent Node check)');
```

The original preimage file intentionally contains no decoder/validator. The
subsequent isolated prototype below tests a candidate mapping for review;
production validation, source collection and codecs still require acceptance. Changing the design or replacing `E_NEXT` with
an approved literal produces new design evidence; it never relabels these frozen
subjects or rewrites historical receipt/signature/plan expectations.


## Current Envelope1 admission proof (separate from candidate design)

[`current-contract-check.mjs`](current-contract-check.mjs) uses the repository's
**unchanged** checked-in Envelope1 and block schemas through installed Ajv2020,
then calls the existing public verified-JSON decoder and semantic hash helpers.
It implements no candidate decoder, custom schema or new compatibility rule.
[`current-contract-evidence.json`](current-contract-evidence.json) freezes the
first measured result: Node24.14.1 / Ajv8.20.0 / ajv-formats3.0.1, Windows AMD64.
The ten controls and five low-level hash comparisons pass. No other platform,
XML/CSV decoding, document signature or receipt execution is claimed here.

| Disposable test input | Unchanged schema | Existing verified-JSON boundary |
|---|---|---|
| Frozen historical empty1.0, no received stamp | Admitted shape | `JSON_DIGEST_MISSING` |
| Same value, its frozen correct digest | Admitted shape | Accepted |
| Same value, wrong well-formed digest | Admitted shape | `JSON_DIGEST_MISMATCH` |
| Frozen candidate empty, correct candidate digest | Reject only `/envelope_version` constant | `ENVELOPE_UNSUPPORTED_VERSION`, before digest comparison |
| Tagged single / one-peer / mixed candidate, E_NEXT stamp | Reject version and missing legacy block members | `ENVELOPE_UNSUPPORTED_VERSION` precedes shape/digest |
| The same three tagged entries in copies relabelled1.0, wrong received digest retained | Reject missing `/extensions/x_review` block `annotation` and `content` | `ENVELOPE_INVALID_BLOCK`, before digest comparison |

The last rows are intentional malformed negative controls in private copies,
not conversion, a valid migration or permission to relabel an issued artifact.
The unchanged schema allows unknown members: `mode` and `blocks` are not themselves
prohibited names. These particular candidate wrappers fail because an Envelope1
extension **entry itself** lacks its required block `annotation` and `content`.
Do not generalize this proof into a ban on those keys inside legal payloads.
Ajv reports all schema failures; the runtime's ordered guards report the first
existing decoder error. These are decoder errors, not new Protocol INT/RCP
verdicts. Receipt/document-signature artifact precedence is separately specified
in the RFC and is not exercised by these JSON-only controls.

Current `canonicalizeUWEnvelope` / `computeEnvelopeDigest` operate on the supplied
value without running Envelope version/shape admission. All five candidate texts
and hashes agree with those low-level helpers, including unsupported E_NEXT
values. That is a distinct serialization/hash boundary, **not** evidence that
Envelope1 or its verified JSON decoder admits the candidate. Do not use raw hash
agreement to bypass schema/version/shape refusal.

Run from this repository root, supplying an **already installed and built**
checkout of the same source contract. It may be this checkout if dependencies
and build outputs already exist; the experiment never installs, builds or copies
a runtime. In PowerShell, for the measured integration checkout:

```powershell
node experiments/envelope-0089/current-contract-check.mjs 'C:\Users\jared\.codex\worktrees\parser-362-resume\UW Markdown'
```

The supplied root anchors `createRequire` at its `package.json`; Ajv and formats
resolve from that existing runtime, while all schema and evidence inputs load
from the experiment's own checkout. The runner requires matching source bytes
for envelope/JSON/canonicalization/hash modules, verifies exported current version
constants and records schema/source/built-module hashes. All local schema refs
are registered; remote resolution is forbidden. It compares exact schema
paths/keywords and decoder codes, checks that inputs are not mutated, and emits
JSON to stdout only. It never rewrites frozen evidence or any source. A missing
runtime/dependency, changed contract or unexpected layer fails explicitly; there
is no substitute validator or automatic dependency setup. Built hashes identify
the measured module files; they are not a compiler-reproducibility attestation
or a hash of the complete transitive runtime closure.


## Complete candidate codec artifacts and explicit reissuance examples

**UNACCEPTED design evidence.** The new prototype implements illustrative candidate
JSON, XML typed-tree and normalized CSV-directory encode/decode, not an approved
UWMD codec, production validator, live fixture suite or discovery capability.
`E_NEXT`, `C_NEXT`, `B_NEXT` and `urn:uwmd:unaccepted:rfc0089` are lab tokens. No
actual Envelope, canonicalization, bundle or XML namespace version is allocated.
The first five preimages and the old-contract proof above remain unchanged.

[codec-examples/matrix.json](codec-examples/matrix.json) inventories 60 frozen files
(115,483 bytes): five complete examples, not XML ellipses or descriptor-only CSV.
Every case includes `document.uw.json`, `document.uw.xml`, exact no-final-LF
`subject.jcs`, a digest, and all six CSV directory files (`manifest.json`,
`document.csv`, `frontmatter.csv`, `blocks.csv`, `block_values.csv`, `prose.csv`).
CSV text is UTF8, quote-all, CRLF; typed scalar cells contain canonical JSON.
Local `.gitattributes` disables EOL conversion only for the digest-pinned example
artifacts, so checkout cannot silently invalidate their byte inventories.
The matrix hashes all59 case artifacts; the matrix does not hash itself.

| Case directory | Current entry | Source / history / unknown-value control |
|---|---|---|
| [single](codec-examples/single/document.uw.json) | One `single` block, authored variant `default`, no role | Complete original structured source and explicit proposed reissuance plan. |
| [one-peer](codec-examples/one-peer/document.uw.json) | `variants` with one exact `default` record | Existing primary role activates candidate source mode; no collapse to single. |
| [mixed-null-default](codec-examples/mixed-null-default/document.uw.json) | Null identity followed by literal `default` | Null means absent annotation; literal label remains authored. Its source admission is prospective, not accepted. |
| [ordered-history](codec-examples/ordered-history/document.uw.json) | Named base/detail peers plus two historical blocks | Revisions1/2 retain source order and full content; current base is revision3. No authentication-domain expansion. |
| [direct-model-unknown](codec-examples/direct-model-unknown/document.uw.json) | Direct `single` model | Unknown Envelope member and annotation survive all model codecs. This prototype refuses Markdown emission rather than inventing a carrier. |

All blocks retain a nested unknown metadata member and unknown payload containing
`a/~b` keys, `member`/`item`, null, absent versus present-null controls, empty
object/array/string, a fractional JSON scalar, CR/LF/tab, `<&>`, quotes, emoji and
BMP Unicode. The ordinary member named `content` is payload, not a wrapper.
Prose, `_notes`, `_overrides`, complete `_meta` and exact annotations are preserved.
No financial value is inferred or calculated. Full values decoded from JSON,
XML and CSV must equal the independently frozen JSON model before digest equality
is checked; checking a raw hash alone would not establish fidelity.

### Exact experimental algorithm and boundaries

- [`candidate_codec.py`](candidate_codec.py) validates the closed tagged wrappers,
  exact nullable identity/annotation agreement, section agreement, active/history
  placement, duplicate identities and canonical null-first/UTF16 peer order. It
  does not sort, deduplicate, normalize or select a peer while decoding a received
  model. It verifies the received subject after those candidate structural checks.
  All other legal payload and unknown top-level values in its domain are retained.
  Numeric tokens in JSON/XML/CSV decode as finite binary64, consistently with
  the existing JSON/JCS model; arbitrary-precision caller integers that are not
  exactly binary64-representable refuse rather than being silently rounded.
  A focused `4430000000000000` word control pins the case where JCS fixed-form
  decimal text differs from the exact integer represented by that word. This
  retains semantic number identity, not original number spelling (the original
  source bytes remain archived). It changes no financial procedure/quantizer.
- JSON rejects duplicate decoded members. XML uses typed object/array/scalar
  elements and escaped member names, retains array order, rejects duplicates,
  undeclared types/attributes, DTD/entities and mixed scalar children. Structural
  whitespace is exactly XML S (TAB/LF/CR/SPACE), never a broad Unicode trim; literal CR
  is emitted as a numeric reference to avoid XML line-ending normalization. The
  XML namespace token is deliberately experimental, not a proposed allocation.
- CSV flattens complete frontmatter and each annotation/meta/content scope, with
  strict RFC6901 escaping, explicit container rows and typed scalar JSON. It
  restores `_meta` exactly once, preserves prose separately, reconstructs explicit
  modes and canonical ordinals, and checks the received descriptors against exact
  reconstructed pointers/identities. Current extension descriptors carry exact nullable identity. Historical
  descriptors retain CSV1's null **non-selection placeholder** and history ordinal;
  the authored historical label remains in the complete annotation rows. No
  equality rule treats that placeholder as a replacement for history identity.
  Inventory hash/size/file-set checks precede typed reconstruction; received semantic digest is checked last. Tests that
  exercise inner refusals recompute only disposable transport inventories, so a
  trivial outer checksum error does not hide the intended control.
- [`source_examples.py`](source_examples.py) uses the unchanged retained Reader
  scanner, **not its default-key parse projection**, for a narrow proposed D2
  projection. Four complete `original.uwx.md` files reproduce their frozen models;
  source accounting binds every physical example block to an exact source-body
  hash, nullable identity and current/history state. Existing ECMAScript trim and
  CRLF/CR normalization retain U+0085 prose; Python-wide Unicode strip is not used.
  It does not guess a peer.
  Reversing both mixed-source peers preserves the same candidate model/subject.
- Directly authored one-peer variants without a role round-trip through all three
  model codecs; Markdown emission refuses when reprojection would change mode.
  The existing ParsedUWFile/portable projection is not fixed by this experiment:
  the prospective mixed fixture retains two physical source blocks but aliases
  them through `default` in that old projection. Any lawful mixed-identity decision
  must address that public wire/type contract as well as Envelope/codecs.

This is a **validation subset**, not a complete future normative validator. It
supports empty builtin collections and extension/history blocks with the existing
annotation/content/optional-prose shape. Nonempty builtin collections, unknown
Envelope-block-extra members, empty history slots, unsupported source annotation
spellings and unmarked overwritten source revisions explicitly refuse in this
prototype. Those limits are **not proposed bans**. A complete implementation must
preserve every legal member in its supported mapping or refuse explicitly; it
must not silently strip those values or advertise this subset as full fidelity.
No ZIP archive, HTTP/MCP version negotiation, full schema validation, signature,
receipt, financial verification, release or production migration is implemented.

**XML expressiveness is a separate visible limit.** Legal JSON can contain NUL
in a string or member name; XML1 cannot directly carry it. Focused controls retain
those values through candidate JSON and CSV and require explicit XML refusal.
This is not a new global restriction on legal JSON or extension payloads. To
promise such values across XML, a governed mapping option could add a versioned
escaped JSON-string lexical form for both value text **and member names** (for
example an explicitly tagged encoding attribute/name-json field). Current XML1
would refuse those new attributes; namespace/codec-version accounting and exact
escaping/canonicalization rules need owner design approval. A fallback that drops
the character, sanitizes a key or silently emits a different subject is excluded.

### Retired prelaunch work

The source reissuance plans, historical-subject inventories and old-regime replay
instructions below are not current requirements. No migration or recovery work is
scheduled. Use the focused current-domain studies for representation/portable and
authentication questions; these experiments do not activate a contract.

### Focused reproduction and measured results

```sh
python -B experiments/envelope-0089/freeze_codec_examples.py --check
python -B -m unittest discover -s experiments/envelope-0089 -p test_candidate_codec.py -v
node --test experiments/envelope-0089/codec-subjects.test.mjs
```

Generation without `--check` is first-creation-only and refuses to overwrite an
existing example directory. The checker/tests do not regenerate frozen files.
The prototype reuses the existing independent Python JCS primitive; it does not
replace or test a new financial kernel. Node separately reconstructs JCS text
using UTF16 key ordering and ECMAScript primitive serialization from all five
frozen models, checks their exact subject bytes/digests and all59 artifact hashes.
This is independent subject verification, not a second independent XML/CSV codec.

Measured on Python3.12.3 / Node24.14.1, Windows AMD64: twenty focused Python
methods and two Node tests pass, covering all five complete cross-codec cases,
identity/mode/history/unknown values, immutable source accounting, descriptor/
manifest/digest corruption, duplicate/order/type/version refusals, Unicode/
escaped pointers, XML representability, direct-model/source conversion refusal
and missing-original migration refusal. Only these new focused checks ran; no
old proof, broad audit, production suite or live conformance baseline was rerun.

## Independent Astra review intake and priority-one reproductions

[astra-review-external.txt](astra-review-external.txt) preserves the attached
report exactly (17,559 bytes; SHA-256
`60c4469f95d1317d469362b159dd9be7f1ca37740dad89aaaac6fd5b04d9614d`).
It is external, unapproved review evidence. Its recommendations and assertions
are not instructions, owner approval or verified authority. The independent
observations below are pinned to main `3eee0fbab3f5682dc345804782994dc22d321fae`;
source/schema hashes must match before the installed build is used.

[astra-review-evidence.json](astra-review-evidence.json) preserves complete
focused inputs, observations, original receipt fields, canonical texts, exact
UTF-16 units/UTF-8 bytes, digests, CSV directory files and production ZIP decode
outcomes. The experimental five-example/60-artifact set is unchanged.

| External claim | Independent classification and observed boundary |
| --- | --- |
| Extension projection loses named current peers and explicit history | **Verified.** The four physical blocks reduce to the last `detail/~` extension and zero history entries. Changing discarded current `base` or historical revision 1 changes the raw source hash but leaves receipt subject `sha256:c61aab6e0e01847675479c2cd20ac203fca6eac63ef4b8bf43891992de13cfec` unchanged. A synthetic constant-control receipt still verifies against both altered sources. This isolates source commitment, not financial coverage. |
| Python and document authentication behave differently | **Verified.** Current Python retains both current labels and two explicit historical blocks, then refuses an unavailable Envelope 1.0 digest. V.13 refuses these sources with INT-15. Neither is proof that the ordinary receipt projection committed to the discarded content. |
| Unpaired surrogates reach current JCS/verified JSON | **Verified for both string values and member names.** D800, D801, DC00 and valid replacement character FFFD have distinct UTF-16 canonical texts but identical UTF-8 replacement bytes/digests in each tested location. The verified JSON boundary admits them. Python rejects invalid surrogates. Valid paired surrogate controls remain distinct. This is invalid-input replacement before hashing, not a SHA-256 collision. |
| Schema-legal block extras fail production CSV fidelity | **Verified.** An additional block member is accepted by the unchanged Envelope schema and verified JSON boundary. Both directory and actual ZIP round-trips fail with CSV_DIGEST_MISMATCH. The no-extra control succeeds, including retained unknown top-level and payload members. No new CSV scope is introduced. |

Eight additional source-selection controls distinguish explicit history, current
selection and physical retention. When an extension's historical block comes
last, TypeScript retains that historical block as the current extension; putting
current last retains current. In both orders its extension history is empty.
For ordinary sections TypeScript retains the higher revision and retains the
first on equal revisions, adding the other physical block to its archive.
Python retains the last non-superseded source block. These are observations,
not authority to replace accepted Format §2.7 wording or choose a history
policy. The same-identity disagreement requires separate reconciliation.

RFC 8785 §3.2.2.2 explicitly includes object property names and requires invalid
Unicode such as lone surrogates to cause an error; §3.2.4 then encodes the
canonical text as UTF-8. Valid strings remain unchanged: sanitizing invalid
strings to FFFD is not the proposed correction. See the independently consulted
[primary RFC](https://www.rfc-editor.org/rfc/rfc8785.txt).

### Unapplied bounded JCS correction

[proposed-jcs-unicode.patch](proposed-jcs-unicode.patch) prepares a shared
`serializeString` guard and unit regressions against the pinned source. It
rejects unpaired high/low surrogates with TypeError, including keys, while
retaining valid pairs, FFFD, NUL escaping, UTF-16 ordering and non-normalized
Unicode. It has **not** been applied to production. The accompanying source/test
text files exist only to execute that exact proposal in memory.

[astra-jcs-baseline.json](astra-jcs-baseline.json) and
[astra-jcs-proposed.json](astra-jcs-proposed.json) record 24 invalid-string
controls and three valid-string controls in each isolated process. Under the
proposal, unchanged old invalid-Unicode receipts change from verified to
unverifiable/RCP-09. Corresponding document artifacts change from a supplied
accepting-stub result to failed/INT-15 before backend execution. Unsupported
subject versions still produce INT-14 first. Existing receipt/source bytes are
untouched. Placeholder signatures and recording stubs are not cryptographic
authentication. Valid controls retain exactly the same canonical bytes.

[astra-jcs-unit-evidence.json](astra-jcs-unit-evidence.json) records execution of
all 16 exact prepared unit tests through a small Node assert matcher adapter.
This is not a Vitest runner invocation. The existing 20 Python methods, two Node
methods, five frozen subjects/60 codec artifacts and ten current-contract
controls plus five hash comparisons also pass; their outputs are retained in
[astra-existing-controls.json](astra-existing-controls.json). No full suite or
complete interoperability claim follows from these bounded checks.

The smallest separate implementation candidate is the prepared JCS admission
guard, with public error-boundary and historical invalid-subject consequences
reviewed before activation. Source-loss safety could be addressed by a separate
source-accounting/refusal correction, but that would not implement lawful
extension-map preservation. Full routing/type/projection correction belongs to
the governed representation decision; historical digest scope cannot be
silently rewritten. CSV may safely diagnose/refuse unsupported extras, but a
lossless carrier for every schema-legal block extra requires an approved mapping
amendment. Do not invent a new scope under CSV 1.0, narrow the schema silently,
select a peer or claim old digests authenticate content they omitted.

### Reproduce without overwriting frozen evidence

Use an already installed, fresh build of the pinned source. Defaults compare
material observations with the frozen evidence; `--output` writes only to a new
path and refuses overwriting. Runtime/provenance metadata is separate from the
material comparison. The original report path is optional.

```powershell
node experiments/envelope-0089/astra-review-check.mjs "C:\path\to\built-repo" experiments/envelope-0089/astra-review-external.txt
node experiments/envelope-0089/astra-jcs-guard-check.mjs "C:\path\to\built-repo" baseline
$env:ASTRA_REPO_ROOT="C:\path\to\built-repo"
node --experimental-loader ./experiments/envelope-0089/astra-jcs-loader.mjs experiments/envelope-0089/astra-jcs-guard-check.mjs "C:\path\to\built-repo" proposed
node --experimental-loader ./experiments/envelope-0089/astra-jcs-loader.mjs experiments/envelope-0089/astra-jcs-unit-check.mjs "C:\path\to\built-repo"
python experiments/envelope-0089/verify-astra-evidence.py
```

The loader changes only one returned module string in an isolated process; it
never edits source or dist. Root owns RFC/review integration, actual PRs,
acceptance, versions and release decisions. Existing Envelope 1.0, receipt rules,
conformance fixtures and the 5.0 launch reservation remain unchanged.


### Integrator replay corrections: initial evidence remains archived

Independent integration replay found two harness defects before publication:
the main probe still wrote its default output despite declaring an unused
output option, and the baseline guard compared fresh volatile generated_at values.
The initial source/Unicode transport also let Python's Windows stdin code page
decode UTF-8 as cp1252. Lone-surrogate ASCII escapes still refused, but valid
Unicode and source bytes were altered before reaching Python; those original
same-source/valid-Unicode observations are not valid cross-implementation proof.

The original worker evidence bytes remain in
[astra-review-evidence-initial-transport.json](astra-review-evidence-initial-transport.json),
explicitly superseded for the Python transport observations. The corrected probe
strictly decodes UTF-8, checks every Python source SHA against the exact original
and compares valid replacement/supplementary canonical bytes independently.
Corrected observations retain all three reported defect outcomes. The initial
integrator replay output is retained separately in the integration record; it
was never a green checkpoint. No live fixture or expected contract changed.

Default replays now compare detached JSON data against the frozen observations;
host null prototypes are not serialized evidence. Only runtime/provenance metadata
is excluded from that comparison. Original volatile timestamps are explicit replay
inputs, preserving exact CSV transport files, inventories and ZIP bytes; no semantic
value is masked or regenerated to excuse a mismatch. --output writes only a new
path and refuses overwriting. The integrator reran production probes, baseline and
isolated proposal controls, and unit adapters successfully after these repairs.
