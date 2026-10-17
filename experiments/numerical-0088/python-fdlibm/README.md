# Independent Python pinned-fdlibm research candidate

UNACCEPTED. This stdlib-only adaptation reads the pinned C procedure, not JS
implementation code or host-transcendental outputs. It is an isolated research
kernel, never imported by production Python, financial packages or conformance.
It does not accept RFC 0088 or select a new accuracy/domain/error contract.

`kernel.py` implements all seven raw helpers, including integral, negative and
fractional pow. Independent Python structure separates negative-base parity,
pow's split log2, and pow's residual exponential/scaling phases. Standalone log
and exp remain their distinct C algorithms; pow never substitutes exp(y*log(x)).
The exact common constant-word table is shared input evidence, not an independent
constant derivation. Its frozen SHA and all eight primary upstream hashes are
pinned in `evidence-inputs.json`. Sun permissions are retained in kernel.py and
the unchanged upstream copies. No JS runtime or third-party dependency is used.

Word extraction uses struct's explicit big-endian binary64 encoding. Python's
unbounded integers are reduced explicitly at signed32/unsigned32 assignment and
overflow sites. pow phase integers are range-bounded before shifts/conversion;
scalbn k+n wraps modulo 2^32, including its source recovery branch. sqrt retains
both restoring-digit loops, explicit unsigned carries/borrows, and the count32
transfer-as-zero interpretation. Left shifting negative words means low32 bits,
right shifting signed words is arithmetic, and unsigned count32 returns zero.
No Python shift-count masking or C pointer aliasing is inherited.

Every floating arithmetic operator is a separate Python binary64 operation;
association follows the C expressions, with no FMA or algebraic stabilization.
`divide` maps Python's zero-division exception to raw IEEE NaN/signed infinity.
No host pow/log/exp/sqrt/fabs/copysign/scalbn or arbitrary-precision real evaluator
is used by the kernel. Input/output NaNs are compared by class; NaN payloads,
exception flags and alternate rounding modes are not portable guarantees.
This requires nearest/even binary64 basic arithmetic and gradual underflow; it
is not a software emulation of arbitrary Python float platforms.

Resource control is scalar and deterministic: pow/log/exp/scalbn/fabs/copysign
have bounded branch graphs; sqrt has at most two transfer bodies, twenty
leading-bit search bodies, 22 high-digit and 32 low-digit bodies (76 total),
plus bounded rounding. pow can invoke sqrt once, or scalbn once, not recursion.
No input-selected precision escalation, external calls or timing-based refusal.
The raw API expects decoded binary64 Python floats and signed32 scalbn integers.
`run.py` provides the existing raw JSONL word protocol. Invalid records fail as
harness errors, not synthetic numerical answers. JSONL stream length is caller
controlled; the scalar bound does not bound a whole unbounded input stream.

`wrappers.py` separately models the current public boundary over decoded floats:
null/type/arity handling; log <=0 and sqrt <0 domain checks; only pow/exp refuse
nonfinite results. Raw internal infinities remain usable (e.g. a later division
can return finite zero). This adapter neither implements the complete Python
calc evaluator nor changes its supported capabilities or manifest.

Focused commands (existing expected evidence is read-only):

```sh
python -B -m unittest discover -s experiments/numerical-0088/python-fdlibm -p "test_*.py" -v
python -B experiments/numerical-0088/python-fdlibm/check_evidence.py
python -B experiments/numerical-0088/python-fdlibm/run.py < inputs.jsonl
```

The evidence checker reads the existing 4204 frozen operands and three archived
native-C output streams, plus 178 independent mathematical certificates. It
records finite/signed-zero/infinity words separately from NaN classes, and keeps
mathematical disagreements visible. A new optional --output path is opened
exclusively: existing files cannot be overwritten. No baseline generation mode.

Execution results, exact runtime and true remaining gaps will be added after the
first focused comparisons. Finite source reproduction does not prove every
branch, whole-domain accuracy, universal correct rounding, independent financial
solver/quantizer/receipt conformance, Python Reader/Verifier conformance, browser
or spreadsheet parity. No old corpus or nine-platform job is rerun by this lab.
