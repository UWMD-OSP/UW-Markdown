# Human action required: verify the PCG64 test vector

**Status:** open
**Created:** 2026-08-27
**Blocks:** acceptance of [RFC 0005](../rfcs/0005-stochastic-calculations.md)
**Owner:** project owner

## What is unverified

[`packages/uwmd-core/src/calc/prng.ts`](../../packages/uwmd-core/src/calc/prng.ts)
implements **PCG-XSL-RR-128/64** (`pcg64`) from the published algorithm. It is
normative: protocol §VIII.8.2 names it, and the seed plus the algorithm are the
entire determinism contract for stochastic calculations.

The test vector that pins it —

```
seed 42 → 2915081201720324186, 13533757442135995717,
          13172715927431628928, 13789878565430171748
```

— appears in `prng.test.ts` and in `conformance/stochastic/`. **It was generated
by this implementation.** It proves the implementation is self-consistent across
runs and platforms. It does **not** prove the implementation agrees with
O'Neill's reference C code at [pcg-random.org](https://www.pcg-random.org).

If our seeding or output permutation differs from the reference, every number
this project produces is still perfectly deterministic and reproducible — and
still disagrees with every other correct pcg64. The failure mode is silent, and
no test in this repo can catch it, because every test compares us to ourselves.

## What needs doing

Run the reference implementation and diff four numbers.

```bash
git clone https://github.com/imneme/pcg-c
cd pcg-c && make
```

Then a short C program against `pcg64_srandom_r` / `pcg64_random_r` with seed
`42` and the default stream increment, printing the first four `uint64` outputs.
Compare to the vector above.

Equivalent cross-checks, if easier: NumPy's `PCG64` bit generator, or Rust's
`rand_pcg::Pcg64`. Both need care about **seeding convention** — that is the
most likely place to diverge, and the one that matters. Our constructor is:

```
state = 0
state = state * MULT + INC
state = state + seed
state = state * MULT + INC
```

## Then

**If they match:** delete the `VERIFICATION GAP` block at the top of `prng.ts`,
drop the caveat in the RFC's "Verification gap" section and the CHANGELOG's
"Known gap" entry, and reword the `prng.test.ts` case that currently says the
vector is self-generated.

**If they do not match:** the algorithm is wrong, not the vector. Fix `prng.ts`,
regenerate the conformance baselines with
`npm run conformance -- --tier=stochastic --update`, and note the correction in
the CHANGELOG — a change to the PRNG changes every stochastic result, so it must
land before anyone depends on the current numbers.

## Why this is not automated

It needs either network access to fetch the reference implementation or a local
C toolchain plus a comparison harness, neither of which belongs in this repo's
test suite. It is a one-time check whose result is a fact about the outside
world, not a property of this codebase.
