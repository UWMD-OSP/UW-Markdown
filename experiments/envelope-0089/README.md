# RFC 0089 candidate preimages (unaccepted)

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

### Migration behavior: new issuance, no historical rewrite

The four `reissuance-plan.json` files are executable **proposed plans**, not
receipts, signatures or proof of historical authentication. They retain the exact
original raw SHA256, complete physical source accounting, new subject digest and
unassigned canonicalization token. They issue no cryptographic or financial
artifact. Original source/old issued artifact bytes remain untouched.

| Available evidence | Proposed clean-break outcome |
|---|---|
| Complete attributable original source, named/singleton cases | After owner approval, parse the original source under the approved routing, retain all legal content/history, project E_NEXT once and issue a new representation under C_NEXT. Archive the original identity separately. |
| Complete original mixed null/default source | Block implementation until the mixed-admission and ParsedUWFile/Protocol decisions are approved; do not use the current default-key projection to migrate. |
| Only a demonstrably complete attributable archive | A reviewed reconstruction may be a source for **new issuance** if it proves every relevant value, identity, mode, prose and history. The prototype does not implement/archive-certify this route; it requires review, not trust in a digest alone. |
| Only a lossy Envelope1 export missing a legal peer/history, incomplete archive, or only an old digest/signature/receipt | **Blocked:** missing values/attribution cannot be recovered by changing a version or recalculating a hash. Obtain original source or a complete attributable archive. Never select/merge/fabricate peers. |
| Complete source whose repeated/superseded extensions remain outside V.13's guarded domain | Ordinary candidate encoding may succeed; document signing/authentication still refuses. A codec correction is not permission to issue a document signature over an ineligible source. |
| Existing receipt/signature or whole-source binding plan | Retain its exact old bytes/subject as evidence. If a new artifact is required, separately authorize and issue it under the accepted new subject rules; recompute required receipt verification and independently review a new plan. Old whole-source plans are stale, never silently rehashed into verified plans. |

`reissue_from_source(None)` explicitly refuses with the local prototype reason
`ORIGINAL_SOURCE_OR_COMPLETE_ATTRIBUTABLE_ARCHIVE_REQUIRED`. It neither constructs
an alleged recovered source nor uses an old receipt/signature to supply missing
content. Existing block hashes/signatures and V.12 row commitments remain separate
subjects; an outer-container change does not silently reinterpret them. No legacy
reader shim, old/new dual hash, fallback evaluator, automatic receipt refresh or
historical expected-value rewrite is introduced. Version/release placement and
public5.0 remain owner-controlled; no actual version is chosen.

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
