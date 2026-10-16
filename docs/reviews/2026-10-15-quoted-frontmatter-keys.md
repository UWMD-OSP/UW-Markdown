# Quoted frontmatter key fidelity — Issue #354 follow-up

Status: **Verified implementation defect**, reference Reader/parser and guarded
document-signing projection. Baseline: main
`50bf4c13206560848c5bb9b045f4532ad3cd8633`. This is separate from draft RFC
0088's numerical decisions and from the unresolved bare non-string YAML key
question. No new financial convention or validation obligation is proposed.

## Existing authority and reproduction

[Format Appendix D](../../spec/UW_FORMAT_SPEC.md#appendix-d--yaml-subset-frontmatter)
supports quoted scalars and simple mapping keys and preserves their YAML 1.2
meaning. [Protocol II.1 and XII](../../spec/UW_PROTOCOL.md) require structured
frontmatter and unknown-field preservation. Protocol V.13.2's guarded document
projection must account for decoded source members and refuse duplicate/unsafe
members; it must not authenticate a different field identity introduced by a
parser mistake.

The following are minimal parser controls, not complete underwriting records:

```yaml
---
uw_version: "3.0"
"custom_label": kept
"a:b": kept
pipeline_state:
  "L0": complete
---
```

Running the existing compiled `parseUWFile` on separate controls returned:

| Source entry | Actual old parsed member | Required string-key meaning |
| --- | --- | --- |
| `"custom_label": kept` | `"\"custom_label\"": "kept"` | `"custom_label": "kept"` |
| `'custom_label': kept` | `"'custom_label'": "kept"` | `"custom_label": "kept"` |
| `"a:b": kept` | `"\"a": "b\": kept"` | `"a:b": "kept"` |
| nested `"L0": complete` | `"\"L0\"": "complete"` | `"L0": "complete"` |

The implementation split at the first colon and trimmed the raw key without
decoding it. This changed field identity, mislocated values, and gave source
accounting callbacks incorrect member paths. Root independently reproduced the
old outputs through the public compiled parser. The expected string meanings
follow the existing YAML contract; no AI-derived financial answers are involved.

## Bounded correction and regression controls

The parser now locates the mapping separator outside a quoted key, decodes the
key using its existing YAML scalar helper, and applies existing blocked-segment
and signing-guard checks to that decoded identity. It also distinguishes a colon
inside a plain key from its whitespace/EOL-delimited separator. Generic bare-key
coercion policy is unchanged. Original source bytes are not rewritten.

Controls include top/nested quoted keys, embedded colons, escapes, empty and
hash-leading string keys, equivalent quoted/unquoted semantic subjects, decoded
duplicate aliases and unsafe names. Existing guards remain strict. New tests
exercise the old defect before the fix: **14 failures / 107 passes** in the two
initial targeted suites.

Independent integration review found an intermediate pre-pass regression:
quoted sequence items such as `- "a: &anchor"` were mistakenly treated as mapping
entries and refused. That unpublished regression produced **4 failures / 53
passes** in its review controls. The corrected pre-pass preserves sequence and
comment masking and rejects actual anchors/flow constructs. Adjacent block
mapping values such as `"key":value` refuse; this follows the existing block
mapping grammar, also explicit in [YAML 1.2.2 §8.2.2](https://yaml.org/spec/1.2.2/#822-block-mappings).
These failures describe different development checkpoints, not current failures
or changes to normative expected outputs.

Final worker verification on the corrected source: verifier build and test
typecheck pass; **217 tests / 5 targeted files** and **2,623 tests / 92 verifier
files** pass; lint passes with the existing unrelated warning; whitespace checks
pass. Coordinator gates and exact-head remote CI are recorded in the PR. Earlier
local subprocess failures remain failed; no independent Excel recalculation or
full Python Verifier claim follows from this work.

Coordinator verification on the corrected tree (Linux, Node v24.21.0): full
workspace build and test typecheck pass; `npm test` **fails**, with **4,023
passes and 180 failures** across workspaces. The verifier portion passes all
2,623 tests. Direct `node scripts/run-conformance.mjs` passes **1,089 / 1,089**
with zero updated expectations. The `npm run conformance` wrapper remains
**failed** at its subprocess-dependent target test (0 passes / 1 failure), so
the direct result is not reported as a successful wrapper gate. Lint, schema
compilation, indexes, codes, versions and lockfile guards pass. Documentation
build initially fails because cached VitePress dependencies are absent; after
linking the existing cached documentation dependencies it passes in 17.14s.
No dependency manifest or lockfile changes are made.

## Compatibility and release impact

This is a source-interpretation defect with demonstrated interoperability and
authentication consequences, not a changed metric formula. Correct input-field
interpretation can affect downstream consumers of previously misdecoded fields.
Ordinary unquoted string-key semantics and existing conformance expectations
remain intact. The source, block payloads, provenance, signatures and historical
receipts are never silently rewritten or re-signed.

Previously misdecoded quoted-key records may yield a different, now-correct
semantic document-signing subject. Such old tool-issued subjects need explicit
compatibility assessment; passing existing unquoted fixtures is not proof that
every affected historical artifact reproduces. No automatic historical fallback
or receipt-policy change is introduced.

Any future publication containing this `@uwmd/verify` change must reconcile its
engine version, exact dependent pins, and applicable receipt/signature evidence
through wiki 11. This PR assigns no version and changes no release record or
receipt baseline. Recommend addressing the defect before the next applicable
interim publication and the coordinated public launch, with compatibility review;
no private deal failure or frequency estimate is claimed.

The independent Python work remains main-based and explicitly partial. Bare
numeric/boolean/null YAML keys and their JSON projection require their own
existing Issue #354 clarification; this correction concerns string keys and does
not settle that question. RFCs 0085–0088 remain drafts. No 5.0 preparation or
publication is authorized.
