# Independent PCG64 verification — 2026-09-12

**Result: matched.** The existing TypeScript PCG64 output agrees with an
independent compiled NumPy 1.26.4 implementation when both use the upstream
default stream and UWMD's specified srandom sequence. No algorithm, seed mapping,
numeric tolerance, stochastic result or conformance baseline changed.

## Evidence

- Upstream C source: [imneme/pcg-c, revision 83252d9](https://github.com/imneme/pcg-c/blob/83252d9c23df9c82ecb42210afed61a7b42402d7/include/pcg_variants.h).
  Header SHA-256: `d0fad6e1818868e565299859da9539073d63ea0c18101974f863b2abffdd546d`.
- Independent executable oracle: installed **NumPy 1.26.4**, `numpy.random.PCG64`,
  using its compiled implementation. Its [versioned C source](https://github.com/numpy/numpy/blob/v1.26.4/numpy/random/src/pcg64/pcg64.h)
  exposes the same XSL-RR-128/64 output family.
- [Oracle JSON](../../packages/uwmd-core/src/calc/fixtures/pcg64-reference.json)
  records 16 raw outputs and doubles per seed, plus a SHA-256 digest of 1,024 raw
  outputs per seed. Decimal uint64 strings are joined with LF, including final LF.
- [Regression tests](../../packages/uwmd-core/src/calc/prng.test.ts) compare the
  TypeScript implementation with those independently generated values and digests.

Seeds: 0, 1, 42, 43, 2^53−1, 2^64−1, 2^127, 2^128−1, 2^128, 2^128+42 and −1.
The last three exercise the public constructor's uint128 normalization; they do
not expand the accepted seed range of a stochastic declaration.
Total comparison: **11,264 raw draws and 176 exact doubles**.

## Matching the stream and seeding

NumPy's `PCG64(42)` uses NumPy SeedSequence and is not UWMD's seed-42 convention.
The verifier sets state to zero and the increment to the upstream two-word
constant `(6364136223846793005 << 64) | 1442695040888963407`. It then uses NumPy's
compiled generator to step, adds the seed modulo 2^128, and steps again.
Only then does it collect outputs. Double checks use NumPy Generator.random,
independently exercising UWMD's top-53-bit conversion.

The upstream fixed-stream API is `pcg64s_srandom_r` / `pcg64s_random_r`
(`pcg_oneseq_128_*`). Generic `pcg64_srandom_r` instead accepts an initseq and
forms its increment as `(initseq << 1) | 1`; passing the increment as initseq
would compare a different stream. This corrects the old handoff's ambiguity.

## Reproduce

Use an isolated Python environment with NumPy 1.26.4 available, then run:

```bash
python scripts/verify-pcg64-reference.py
npm exec --workspace @uwmd/core -- vitest run src/calc/prng.test.ts src/calc/stochastic.test.ts
```

The Python command compares fresh oracle output with the committed JSON and
fails on any discrepancy. `--write` regenerates the fixture for explicit review;
ordinary tests never regenerate it and require neither NumPy nor network access.
The verifier does not import or execute the TypeScript PRNG to create expectations.

## Scope and limits

This closes the independent-implementation comparison gap. The upstream C header
was inspected, not compiled locally; NumPy's compiled implementation supplied the
independent executable. This is not a statistical proof of randomness or a proof
for every seed. It does not change the separate, documented cross-platform libm
limits of the normal inverse-CDF sampler.
