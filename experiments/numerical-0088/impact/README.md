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
