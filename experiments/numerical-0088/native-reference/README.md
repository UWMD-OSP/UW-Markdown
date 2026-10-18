# Independent native reference for the isolated RFC 0088 candidate

This is research, not a production implementation or RFC acceptance. It compiles
seven computational bodies from the eight byte-pinned Netlib sources retained in
`../pinned-fdlibm/upstream/`. The upstream Sun notices remain unchanged. Source
hashes must match before any compilation. No source, schema, fixture, package or
release state is changed; build products live in a system temporary directory.

`compare.py --cc gcc --output <directory>` compares every frozen input with the
separately written JavaScript port. It records exact compiler/platform/flags,
source/input identities, adapter substitutions, complete raw outputs and their
hash. `--sanitize` enables undefined-behavior instrumentation. Failed compilation,
execution, incomplete output, identity/order mismatch or a differing finite word,
infinity sign or zero sign fails the comparison. Arithmetic NaNs compare by
class; their payload/sign is not a promised portable result. No host pow/log/exp,
sqrt or scalbn is used for the reference: symbols bind to the retained closure.

The operand stream contains exceptional combinations, all seven helpers,
subnormal/exponent boundaries, previous integer experiments, deterministic
SHA-256-derived words and the independently certified mathematical controls.
`freeze-inputs.py --check` verifies fixed input bytes; it does not regenerate
answers or select normative expectations. Exact inputs are frozen independently
of any host transcendental output. The complete general-domain guarantee is not
proved by this finite stream.

## Explicit C adapter and compiler scope

A compiler must support the recorded strict binary64 flags. The driver checks
32-bit two's-complement words, little-endian binary64, `FLT_EVAL_METHOD == 0`,
round-to-nearest-even and gradual underflow. Failed environmental checks abort
research collection, never become financial refusals.

Historical C is not itself a portable specification. `compare.py` makes temporary
copies and defines selected word sites independently of JavaScript syntax:

- Signed left shifts use unsigned modulo-2^32 shifts with an explicit signed
  conversion; negative arithmetic right shifts use explicit sign extension.
- The square-root subnormal splice at count 32 contributes zero. This is a
  proposed defined interpretation, replacing an undefined historical C shift;
  masked x86/JavaScript shift counts are not used as authority.
- Remaining signed integer addition/subtraction wraps under `-fwrapv`; unsigned
  operations retain C modulo arithmetic. Alias optimizations are disabled for
  the historical high/low lvalues. Floating contraction, fast math and builtin
  substitutions are disabled. Native source constants are the pinned decimals;
  the JavaScript constants are independently rationally rounded exact words.

The substitutions are enumerated and fail if an expected site is absent. The
native execution is compiler-scoped corroboration of this defined candidate,
not proof of arbitrary C behavior or an independent mathematical accuracy oracle.
GCC/Clang and x64/arm64 evidence must be read with those exact limits.

## Accuracy, domains and resources

Raw internal IEEE infinities/NaNs remain representable. This reference does not
apply a blanket finite-intermediate refusal, wrap public functions, normalize
cashflows, repair IRR or change quantization. Native and JavaScript agreement
establishes procedure agreement only. The separate exact-rational certificates
measure accuracy and retain disagreements with correctly rounded mathematical
answers. No correct-rounding guarantee is inferred from fdlibm's name.

Per-call work is statically bounded by the candidate's documented branch/loop
contract. Process timeouts protect the research runner; they are not part of the
numerical result or a proposed machine-dependent refusal rule.
