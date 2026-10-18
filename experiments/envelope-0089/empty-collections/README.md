# RFC0089 empty-container carrier proof (unapproved)

This closes one bounded decision-readiness gap: explicit empty builtin variant
maps and empty history slots in the proposed new CSV mapping and actual ZIP
carrier. It adds no production/schema/Envelope1/CSV1/digest/receipt/version change,
source reconstruction, authority claim or compatibility shim. E_NEXT/C_NEXT/B_NEXT
remain unallocated labels. RFC0089 and provenance RFC0085 remain draft.

The concrete proposal appends `empty_collections_json` to `document.csv`. Its
canonical JSON array contains closed `{path,kind}` entries sorted by exact
RFC6901 pointer in UTF16 order. Only `/sections/<escaped-id>` with object kind
and `/superseded/<escaped-id>` with array kind are admitted. Restore these slots
before final model/descriptor/subject checks. Required outer empty collections
already have fixed shapes; nested empty objects/arrays use normal typed rows.
No placeholder block, inferred actor or historical/current selection is invented.

Three frozen models distinguish an absent slot from an explicit empty one and
retain a mixed complete ten-block model from the previous study, including all
block extras, tagged null/default identities and ordered history. Escaped `/` and
`~` names have exact identities. Both the complete model and received subject are
checked after CSV and real deterministic STORE ZIP reconstruction. The copied
mixed model retains the prior lab's partial metadata; equality is not full Format
validation or source admission. There are28
new artifacts, separate from the unchanged prior21/60 and seven-model real-crypto
observations. This is codec equality, not authenticated or complete source.

The Python and Node implementations are explicit derived extensions of their
respective preserved `codec-study` implementations. Node retains its separately
authored CSV/typed-pointer/ZIP/JCS reconstruction and imports no Python code or
production verifier; the Python generations share earlier typed-row/JCS code.
This is not a claim of three independently authored implementations. Node uses
built-ins only here; Python uses its standard library and existing independent
Python JCS. All executed code dependencies are pinned in the evidence closure.

Five Python methods and four Node tests pass locally on Windows/Node24/Python3.12.
Twelve per-decoder carrier mutations refresh transport inventory before checking
closed members, kind/location, duplicate/order, pointer escaping and nonempty
block overlap. Python also passes those mutations through actual ZIP; Node
independently reconstructs the three frozen ZIP archives. An omitted declaration
cannot retain the original subject. The Python BOM control creates valid ZIP
CRC/sizes but preserves the original inventory and is refused. The Node ZIP
reader retains the prior raw-byte inventory fix; this study claims no additional
independent BOM mutation execution. Limits remain the prior canonical STORE
profile, not newly selected standard resource/compression limits.

Initial Node refusal assertions demanded TypeError even where an inherited
identity guard correctly threw AssertionError. Only the test was corrected to
require each exact inner refusal message. No model, carrier or frozen result was
altered. Initial Biome invocation used an unexpanded Windows wildcard; its
corrected directory invocation then found one template-literal style issue,
fixed before committed execution. Git transport attributes preserve actual CRLF
CSV bytes (initial staging normalization was corrected without changing files).

## Reproduce without overwriting evidence

```sh
python -B experiments/envelope-0089/empty-collections/check.py
python -B experiments/envelope-0089/empty-collections/freeze.py --check
python -B -m unittest discover -s experiments/envelope-0089/empty-collections -p test_empty.py -v
node --test experiments/envelope-0089/empty-collections/independent.test.mjs
```

The freezer defaults to read-only comparison and its first-creation mode refuses
existing fixtures. `evidence/observations.json` records actual executed commit/
tree, accepted afcc main ancestry, complete code/input/spec hashes and exact raw
streams. No full suite or cross-platform run is claimed. The old decision-proof
scripts remain pinned to their original b2 source closure and correctly refuse
a fresh afcc verifier; those frozen bytes were not relabeled as current evidence.
Current-main authentication reconciliation is a separate research checkpoint.

The owner selected the tagged representation/minimum, total JSON-lexical XML
mapping and complete semantic subject under unchanged V.13/Receipt5.5 on2026-10-17.
This experiment makes carrier capacity executable; it does not establish model
admission. Under the unchanged builtin shape, empty `sections[id]:{}` is a
negative admission control despite its successful carrier round-trip; empty
outer collections and explicit history arrays remain admitted. The subsequent
[model-admission checkpoint](../model-admission/README.md) pins that distinction.
Complete current domain/source/transport/platform and actual supported-subject
receipt evidence remain gates before final RFC acceptance or activation.
No public launch or UWMD5.0 publication is authorized here.
