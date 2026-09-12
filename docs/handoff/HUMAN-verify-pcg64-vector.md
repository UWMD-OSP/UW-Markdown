# PCG64 verification — completed

**Status:** completed 2026-09-12. No human action remains.
**Original request:** independently verify the PCG64 implementation (2026-08-27).

NumPy 1.26.4's compiled PCG64 matches 11 seeds, 11,264 raw draws and 176 doubles
under the upstream default stream and srandom initialization. The seed-42 vector
and all stochastic outputs are unchanged. RFC 0005 is already implemented; its
independent-verification gap is now closed.

See the [verification record](../reviews/2026-09-12-pcg64-reference.md) for source
provenance, seed mapping, coverage and limits. Reproduce with:

```bash
python scripts/verify-pcg64-reference.py
```

The optional script requires NumPy 1.26.4; normal Vitest tests use the committed
oracle without Python or network access. The upstream fixed-stream API is
pcg64s_srandom_r, while generic pcg64_srandom_r takes initseq, not the increment.
That distinction replaces the ambiguous seeding instruction in the old handoff.

Any future mismatch needs a reviewed contract decision before changing PRNG
outputs or stochastic baselines. This completed record does not authorize such
a change or request a compiler installation.
