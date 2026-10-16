# RFC 0088 experimental binary64 word adapter

This isolated research infrastructure implements a proposed bit-operation model
for the [pinned candidate helper graph](../../../docs/reviews/2026-10-15-fdlibm-closure-356.md).
It is not imported by any UWMD package, conformance driver or financial kernel.
No numerical procedure is selected, and no financial expected answer changes.
No dependency installation, Node invocation from Python, or runtime math oracle
is used.

The JS implementation uses DataView with explicit big-endian access. The Python
implementation separately uses struct and integer arithmetic. Both implement
the table below and check the same hand-specified vectors independently; neither
implementation generates the other's expected answers. Vectors include familiar
exact binary64 identities and decimal spellings of finite boundary encodings.
Those decimal controls test conversion too; they are not powers/logarithms or a
correct-rounding proof for a numerical kernel.

| Primitive | Experimental meaning |
|---|---|
| split / join | Interpret finite binary64 as high and low unsigned 32-bit words, independent of machine endianness; preserve every finite encoding including negative zero and subnormals. |
| replaceHigh / replaceLow | Replace exactly the specified word, retaining the other. Python names use underscores. |
| u32 | Integer modulo 2^32, returning a canonical nonnegative integer; input must be an exact integer in the shared safe-integer range. |
| i32 | Interpret a canonical word as two's-complement signed32; values with bit31 set subtract 2^32. |
| and32 / or32 / xor32 / not32 | Bitwise masks/combinations/complement of canonical words, returning canonical unsigned words even when bit31 is set. |
| shl32 / shr32 | Shift by an integer count in 0..32, discarding shifted-out bits; logical right shift zero-fills. Count0 is identity; count32 returns zero. |
| sar32 | Signed interpretation followed by sign-extending right shift, returned as an unsigned word. Count32 returns all-zero or all-one according to the sign bit. |
| add32 / sub32 | Operands are canonical words. Return wrapped word plus a separate unsigned carry or borrow bit, independently of signed interpretation. |

All word operands other than u32's normalization input must already be canonical
integers in 0..2^32-1. Booleans, fractional integers, nonfinite values, shift counts
outside 0..32 and unsafe normalization inputs are refused. Python split accepts
a float; JS split accepts its number type. Nonfinite encodings are explicitly
outside this experiment, avoiding any NaN payload preservation or UWMD admission
claim. Exceptions are local research errors, not new public protocol codes.

The count32 behavior deliberately differs from JS's masked native shift count.
It is an explicit experimental definition, not a statement that historical C
undefined shifts have this meaning. The pinned square-root spelling
`low >> (32-i)` must use an explicit whole-word operation when i=0. Every later
kernel translation must identify such sites and prove its intended bit graph;
passing adapter tests alone cannot certify that translation. Carry and borrow
controls also compose low-word rollover into a high-word update, as required by
multiword algorithms, without introducing floating arithmetic.

Run independently from the repository root:

```sh
node --test experiments/numerical-0088/bit-adapter/binary64.test.mjs
python -B -m unittest discover -s experiments/numerical-0088/bit-adapter -p "test_*.py" -v
```

The vectors are fixed source bytes, never regenerated from a candidate runtime.
Their SHA-256 is recorded in the validation evidence after tests. These runs
establish this proposed adapter's finite bit-pattern and integer cases only.
They establish neither cross-platform runtime coverage nor Reader/Verifier,
transcendental, financial, receipt or spreadsheet conformance. Resource and
accuracy measurement of a complete kernel remain separate RFC 0088 work.

## Validation evidence

On 2026-10-15 (America/Phoenix), Node 24.14.1 and Python 3.12.3 on Windows AMD64
passed six JS tests and six independent Python test methods using the commands
above. The unchanged Python numeric seed separately passed all nine methods.
The vector-file SHA-256 over exact LF source bytes is:

```text
6aff401a898d55397a781cde5f3b8e261e2d389fdd6d12f136d1d3962e8ce69c
```

Repository index/spec-reference tests and index/code guards passed. Documentation
built successfully; lint passed with the pre-existing HomePage.vue unused-variable
warning. The first lint run identified test-only global NaN/Infinity spellings;
using the Number namespace corrected those without changing vectors or semantics.
No claim is made for untested runtimes/platforms or a complete financial kernel.
