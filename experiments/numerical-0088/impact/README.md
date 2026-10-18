# Isolated RFC 0088 impact measurement

This lab instruments the existing conformance runner in memory. It does not
modify source, built files, schemas, fixtures, expectations, versions or release
states. It is neither RFC acceptance nor production activation.

Run with an existing fresh workspace build (no dependency installation):

```powershell
node experiments/numerical-0088/impact/measure.mjs --repo-root "C:\path\to\built-repo" --candidate "C:\path\to\pinned-fdlibm\kernel.mjs" --output "C:\path\to\impact-manifest.json"
```

The current collector requires the reviewed 1,106-case inventory, runs baseline then
candidate without selection or update flags, and requires a green instrumented
baseline, every indexed result and exactly one observation event per case.
Captured getters are lexically visible local bindings at the existing `record`
callsite, including helper parameters. A case with no visible actual binding is
explicitly incomplete. Even nonempty captures do not prove all internal values:
assertion closures and batch computations can hide values. The manifest never
claims whole-result compatibility from status equality.

The ESM hook replaces floating powers and `Math.log`/`Math.exp` in package dist
modules. BigInt powers are excluded; `Math.sqrt`, public builtin guards,
financial operation order, IRR branch/tolerance rules and reporting quantizers
remain unchanged. Both measurement modes use the same instrumentation. Every
loaded package module records original/transformed hashes and replacement
locations. The raw candidate can retain IEEE nonfinite intermediates; existing
public calculation/refusal boundaries still decide final outcomes.

Each numeric snapshot includes its exact binary64 word, with explicit nonfinite
and signed-zero representation. Primitive events are a separate global trace;
the collector does not invent case attribution. If input-dependent traces
change shape, ordinal primitive comparison is explicitly unavailable.

The manifest includes protected input hashes, candidate closure hashes, runtime
identity, all indexed cases, observed numeric/state changes, receipt subject
observation limits and hashes of complete scratch logs. It preserves those logs
in the reported system temporary directory. Keep that evidence alongside any
frozen manifest; the JSON summary alone is not all raw measurement evidence.

## Frozen local observation

[observed-impact.json](observed-impact.json), with its hash-bound
[cases](observed-impact.cases.jsonl) and [primitive changes](observed-impact.primitives.jsonl),
records one completed baseline and
candidate measurement on Node 24.14.1 / V8 13.6.233.17-node.44, Windows x64,
against the fresh existing build identified in the manifest. The candidate's
complete closure and all protected source/build inputs are hashed there.

- Both runs: 1,089 indexed assertions passed, none failed or updated; one
  captured record event per case.
- 14,145 raw primitive observations in each run, aligned by site and input words.
  There were 671 raw-word changes: one periodic IRR power, 668 dated IRR powers
  and two dated NPV powers. No captured reported numeric or result-state change
  was observed. The frozen fixture expectations were not rewritten.
- Six source-string differences are preserved in full and explicitly classified
  as timestamp-only: five starter editor cases and one capability-token editor
  case. Exact full-string equality follows removal of only `last_modified`,
  annotation `ts` and metadata `timestamp`; no numeric or integrity-hash field
  was removed to obtain that classification.
- Only 10 of the 20 eligible floating numerical sites were exercised by this
  corpus run, despite every eligible numerical module loading. The unexercised
  sites are listed explicitly; independent consumer vectors remain required.
- 108 cases have no visible actual binding at the record callsite. The other
  captures also do not claim every internal value. Zero status changes is
  therefore not a proof of exact universal compatibility.
- Sixteen of the 18 receipt cases captured complete receipt fields (directly or
  through the helper's serialized receipt). Their observed subject/results
  digests and stated results were equal across runs. The two refusal cases
  produced no receipt. This does not authenticate a new signature, cover every
  historical receipt, or resolve the success-to-refusal compatibility question.

Complete events, transformation inventories, stdout and stderr are preserved as
mtime-zero, filename-free gzip archives under [evidence/](evidence/). The manifest
records compressed and uncompressed hashes. The first attempt stopped at module
parsing before executing any case because an injected import displaced the
runner hashbang; that failure's streams are retained separately. The corrected
attempt is the completed measurement, not an additional conformance baseline.

To freeze a newly generated measurement without executing it again:

```powershell
python experiments/numerical-0088/impact/freeze-evidence.py <manifest-path>
```

The freezer is a postprocessing step; retain its initial manifest until freezing
finishes. It factors identical transformations once, attaches relative archive
references and classifies the strictly limited timestamp differences. It does
not change expectations or computed evidence.

After measurement, lint-only fixes split variable declarations and changed string
concatenations to equivalent templates. The frozen manifest retains the exact
pre-style harness commit and file hashes that actually executed. Those style
changes did not trigger another full measurement.

Verify all archived streams and the frozen case/primitive inventories:

```powershell
python experiments/numerical-0088/impact/verify-evidence.py
```

The frozen JSON header references compact JSON Lines shards to keep each JSON
artifact below the repository lint size limit. Reconstructing the two arrays
from those shards preserves every original row and typed value exactly.

## Focused financial and historical receipt study

[financial-evidence/manifest.json](financial-evidence/manifest.json) complements
the indexed corpus measurement with 48 builtin/public calculation cases, five
starter debt derivations and 24 candidate verifications of receipts issued by
the baseline process. It reaches all ten numerical sites absent from the corpus
trace. These observations are not new normative expectations.

```powershell
python experiments/numerical-0088/impact/financial-measure.py --repo-root "C:\path\to\built-repo" --candidate "C:\path\to\pinned-fdlibm\kernel.mjs" --output-dir "C:\path\to\financial-evidence"
python experiments/numerical-0088/impact/verify-financial-evidence.py
```

The ordinary, zero, tiny, negative and fractional-period cases use the unchanged
production builtins and `evaluateCalc`, with independent default-six and
explicit-twelve reporting boundaries. Internal infinities are retained and
examined through the existing public refusal rules. The periodic IRR cases use
the unchanged solver, including the all-zero and tiny-positive flows. The source
frontmatter carries the large final cash flow explicitly because the expression
grammar does not admit scientific-notation literals.

Two real compatibility counterexamples are preserved:

| Control | Baseline | Candidate | Receipt consequence |
| --- | --- | --- | --- |
| `pow(1.2,31)`, `round_to:12` | `284.851576559724` | `284.851576559723` | Same-engine disagreement fails with RCP-03; differing engine with an available accepting stub yields RCP-07 plus the disagreement. |
| Same power, default six places | `284.851577` | `284.851577` | Verified when unsigned or the supplied stub accepts, even with a different engine marker. |
| `irr(-1, 19 zero flows, last_flow)`, `last_flow=6.727499949325601e20` | `10` | `CALC-IRR-DIVERGE` | New issuance refuses `RCP_COMPUTATION_FAILED`. Existing receipt verification returns failed/RCP-03 before supplied signature-backend execution or engine attribution. |

For the endpoint refusal, both accepting and rejecting signature stubs remain
uncalled. A missing backend still returns RCP-08 first. For the finite power
case an invoked rejecting stub returns RCP-01 before result disagreement. Full
old/new receipt fields, original source, subject/results digests, complete
signing payloads, hashes and backend-call evidence are retained. Research engine
markers change no package version, and the placeholder signature/stub provides
no cryptographic authentication. Original receipt/source inputs are unchanged.

The first focused attempt used a calculation fixture containing no structured
UWX fence; receipt issuance correctly refused SOURCE_CONTENT_MISMATCH. Its
complete evidence remains under `initial-source-refusal/` and is explicitly not
a successful historical-receipt study. The corrected study uses an existing
valid receipt fixture plus the explicit research frontmatter input.

A green existing corpus did not cover these selected counterexamples. The
focused results demonstrate changed reported values and changed refusals; they
do not authorize rewriting historical subjects, results, signatures or receipt
verdict rules. The compatibility decision remains separate from this evidence.

## Current-corpus capture revision (2026-10-17)

The previous108 missing cells were a prefix-filter limitation, not evidence that
those cases computed nothing. Existing raw events already contain parsed/rendered
views, resolver results, schema/loader booleans and aggregate test controls under
other names. The current selector explicitly names those outputs, excludes TDZ
and function handles, records every selected binding name, and retains false,0
and null as actual results. Inputs/expected fixtures alone do not qualify. A
boolean/aggregate observation still is not a complete internal numerical result.

A fresh1106-case run against the current built tree is required; do not reuse the
1089-case pass count as current proof. Output goes to current-evidence/ rather
than replacing the earlier measured checkpoint. This is current numerical-impact
evidence, not prelaunch compatibility or artifact-preservation work. No assertion,
fixture expectation or production behavior changes.

The first current capture had1106/1106 passing assertions in each mode but still
11 missing result views. Five were additional initialized resolver/stack aliases;
six came from a status-only standalone forwarding closure declared before actual
locals. The collector now captures those six emit callsites in their caller
scope and forwards once, rather than counting the pass status as an actual result.
That first run is not the final complete-observation checkpoint.
