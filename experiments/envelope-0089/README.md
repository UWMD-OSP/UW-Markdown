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

The file intentionally includes no experimental decoder/validator. Candidate
validation, source collection and cross-codec tests require an accepted design
before production implementation. Changing the design or replacing `E_NEXT` with
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
