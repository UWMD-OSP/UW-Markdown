# Accepted RFC0088 activation proof

This gate calls built production APIs directly. It does not load the experimental
source-transform hook, relocate receipt code, replace a function, or compare with
host pow/log/exp. Build this checkout first; do not share another checkout's dist.

```sh
python -B -m unittest discover -s experiments/numerical-0088/activation -p "test_*.py" -v
python -B experiments/numerical-0088/activation/capture.py --output NEW_OUTPUT_DIRECTORY
```

The collector checks five existing frozen artifact archives, then reruns their
independent Python procedures and compares actual direct production boundaries:

| Boundary | Fixed scope |
| --- | --- |
| Capital stack, waterfall, normal, recovery, stochastic | 44 cases including one 64-sample seeded run |
| Periodic/deterministic financial graphs | 19 cases and 8 final quantizer controls |
| Dated flows | 48 cases across all three accepted day counts |
| NPER | 14 cases, including intermediate nonfinite results and final refusal |
| PMT/PV/FV cancellation | 36 cases; unchanged ordered graph, no stability rearrangement |
| Receipt precedence | 22 scenarios in four Node test groups, with real disposable Ed25519 signatures |

Original archives and historical source maps remain unchanged. Archive byte/hash
checks are not claims that historical production code is current. Fresh Python
outputs must match those frozen reference graphs/certificates (NaN class only),
and fresh production raw words/refusals/reporting must match the independent
procedure. Only independent Python trajectories are traced; production internal
operation order is not instrumented by this gate. Existing routing/source tests
and raw-kernel/native research address different obligations.

The receipt controls call only public issueReceipt/verifyReceipt. A deliberately
changed synthetic pack declaration forces actual typed recomputation refusal;
it is not a claim that one published pack version admits two definitions.
Invalid signatures and missing backends return before recomputation. A validated
signature followed by typed refusal returns RCP-03 with the existing empty
recomputed array, including when engine metadata differs. Finite mismatches keep
the separate RCP-07 attribution behavior. Full signed receipts, signing payloads,
results, backend counts and public test SPKI are saved in the output.

Every output/log is hashed; the manifest records checkout/tree, actual runtime,
command exits and source/input/compiled identities before and after execution,
including the conformance sources actually read by boundary controls. It checks
all14 new fixture-origin hashes and the independent reference identities, and
refuses a checkout HEAD change during the proof.
A pre-existing output directory or injected NODE_OPTIONS/RESEARCH_* environment
is refused. No output or expectation is overwritten. Raw NaN bits are retained
in artifacts; portable comparisons normalize only their payload/sign.

`conformance-origins.json` records independently derived expected values and
inputs for 14 new portable calc cases. They cover integer/fractional/negative
power, raw-subnormal preservation through ordered scaling, exp/log, public
nonfinite refusal, internal NPV Infinity with a finite final zero, NPV NaN refusal,
and unchanged zero/tiny/endpoint/no-bracket IRR behavior. Scientific numeric
operands are transported as numeric frontmatter fields because scientific
notation is outside the existing expression lexer. Old expectations are untouched.
The current receipt CLI fixture transport cannot supply a pack/backend, so the
22 receipt scenarios are direct API gates, not additional portable CLI cases.

Ordinary Linux Node20/22 and Windows Node20 CI runs this direct gate after build.
The separate numerical research workflow, including named LibreOffice capture,
is unchanged. Local focused checks do not assert that future CI has run, universal
correct rounding, full Python financial conformance, or general spreadsheet parity.
