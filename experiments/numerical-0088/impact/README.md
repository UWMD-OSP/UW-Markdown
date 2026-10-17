# Isolated RFC 0088 impact measurement

This lab instruments the existing conformance runner in memory. It does not
modify source, built files, schemas, fixtures, expectations, versions or release
states. It is neither RFC acceptance nor production activation.

Run with an existing fresh workspace build (no dependency installation):

```powershell
node experiments/numerical-0088/impact/measure.mjs --repo-root "C:\path\to\built-repo" --candidate "C:\path\to\pinned-fdlibm\kernel.mjs" --output "C:\path\to\impact-manifest.json"
```

The collector requires the reviewed 1,089-case inventory, runs baseline then
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

[observed-impact.json](observed-impact.json) records one completed baseline and
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
