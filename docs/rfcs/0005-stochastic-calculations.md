---
rfc: 0005
title: Stochastic calculations
status: implemented
author: jaredmaxey
created: 2026-04-26
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0005: Stochastic calculations

## Summary

[`ModuleCalcDecl.deterministic`](../../packages/uwmd-core/src/protocol.ts)
is currently a `boolean` that every v1 calc declaration must set to `true`
— `evaluateCalc` rejects non-deterministic calls. This RFC defines what
`deterministic: false` means: a stochastic calculation that produces a
**distribution**, not a single number. The protocol gains a small set of
sampling built-ins (`uniform`, `normal`, `triangular`, `monte_carlo`) and
a result shape that carries the distribution rather than collapsing to a
point estimate. Determinism is preserved by requiring every stochastic
calc to specify a seed, so two conforming hosts produce byte-identical
distributions.

## Motivation

CRE underwriting routinely reasons about ranges, not just point estimates:
"DSCR is 1.45 in the base case but ranges 1.20–1.65 across rate paths,"
"sponsor IRR is 14% expected with a 12%–17% 80% confidence band." Today
those numbers are either:

1. Computed in Excel or a sidecar tool and pasted into the `.uw.md` file as
   plain numbers — losing the model behind them.
2. Approximated as best/base/worst manual scenarios — which are easy to
   render but don't actually answer "what's the probability the deal
   underwrites at our minimum DSCR?"

The protocol needs a way to express "this metric is a distribution, here
is the model that produces it, here are the sampled values." Without
this, the format can't represent the way real underwriting actually
communicates uncertainty.

## Proposed change

### `ModuleCalcDecl` extension

```ts
export interface ModuleCalcDecl {
  // existing fields
  id: string;
  label: string;
  formula: string;
  unit?: string;
  deterministic: boolean;

  // new (when deterministic === false)
  stochastic?: {
    /** Number of samples to draw. */
    samples: number;            // 1..100_000
    /** Seed for the PRNG. Required so two hosts produce identical results. */
    seed: number;
    /** Summary statistics to extract from the sample distribution. */
    summarize: ('mean' | 'median' | 'p10' | 'p25' | 'p75' | 'p90' | 'min' | 'max' | 'stddev')[];
    /** Whether to return the raw samples in addition to the summary. */
    return_samples?: boolean;
  };
}
```

### New built-ins (Tier-3 calc grammar)

The safe-expression grammar in protocol §VIII.1 grows four sampling
functions, available **only** in calcs marked `deterministic: false`:

```
uniform(min, max)            → number drawn from U(min, max)
normal(mean, stddev)          → number drawn from N(mean, stddev²)
triangular(min, mode, max)    → number drawn from a triangular distribution
monte_carlo(expr, samples)    → array of `samples` independent evaluations of `expr`
```

The PRNG is a normative algorithm — recommend **PCG-XSL-RR-64** — so two
hosts seeded identically produce identical sample sequences. The seed and
algorithm together are the determinism contract.

### `CalcResult` extension

```ts
export interface CalcResult {
  // existing
  id: string;
  ok: boolean;
  value?: unknown;
  error?: CalcError;

  // new (only present when the calc was stochastic)
  distribution?: {
    samples?: number[];           // present iff return_samples = true
    summary: {
      mean?: number;
      median?: number;
      p10?: number; p25?: number; p75?: number; p90?: number;
      min?: number; max?: number;
      stddev?: number;
    };
    /** Echoed back from the calc decl so consumers know the run parameters. */
    sampled: { count: number; seed: number; algorithm: 'pcg-xsl-rr-64' };
  };
}
```

`value` carries the **mean** when the calc is stochastic and the consumer
requests a single number. The `distribution` field is the full surface.

### Render

`SectionViewModel` gains an optional renderer for distribution-typed
values (`distribution_band`). The reference renderer shows:
- Chat: `1.45 (12%-17% 80% CI)`
- Summary: a small inline histogram (markdown table or sparkline char)

### Library

- `evaluateCalc` accepts stochastic decls and returns the extended `CalcResult`.
- New PRNG module `packages/uwmd-core/src/calc/prng.ts` — PCG-XSL-RR-64 implementation, ~30 LOC, no deps.
- `BUILTIN_REMEDIATIONS` gains `CALC-STOCH-SEED-001` (missing seed), `CALC-STOCH-LIMIT-001` (samples > 100,000).

## Compatibility analysis

- **Existing `.uw.md` files** — no breakage. No file currently uses `deterministic: false`.
- **Tier-1/2 readers** — unaffected (they don't evaluate calcs).
- **Tier-3 calc hosts** — must update to recognize the `stochastic` field. Hosts that don't update encounter `deterministic: false` and continue to error per current behavior — backwards compatible from their perspective.
- **Modules** — gain a new optional field. Existing module manifests load unchanged.
- **`ImplementationManifest.capabilities`** — gains `calc-stochastic`. Hosts that support stochastic calcs declare it; hosts that don't continue to declare only `calc-deterministic` and reject `deterministic: false` calcs as before.

No deprecation path — additive.

## Conformance impact

New fixtures in `conformance/tier-3-calc-host/fixtures/`:
- `stochastic-uniform/` — calc `revpar_range = uniform(50, 150)` with `samples: 1000, seed: 42`. Expected mean ≈ 100, p10 ≈ 60, p90 ≈ 140 within tolerance of the seeded distribution.
- `stochastic-monte-carlo-dscr/` — calc that sweeps `noi` and `annual_debt_service` independently and computes the DSCR distribution. Expected: byte-exact match for `summary.median` given the seed.
- `stochastic-determinism/` — same calc evaluated twice with the same seed; expected outputs identical.
- `stochastic-different-seeds/` — same calc, two different seeds; expected outputs differ.
- `stochastic-missing-seed/` — calc with `deterministic: false` but no seed; expected `CALC-STOCH-SEED-001`.

Conformance tests for the PRNG itself: a known seed produces a known
sequence of 16 outputs (the test vector for PCG-XSL-RR-64).

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/calc/prng.ts` (new) — PCG-XSL-RR-64.
  - `packages/uwmd-core/src/calc/builtins.ts` — `uniform`, `normal`, `triangular`, `monte_carlo`.
  - `packages/uwmd-core/src/calc/evaluator.ts` — recognize `stochastic` decls, drive sampling.
  - `packages/uwmd-core/src/calc/parser.ts` — allow sampling built-ins only inside stochastic decls.
  - `packages/uwmd-core/src/protocol.ts` — extend `ModuleCalcDecl`, `CalcResult`.
  - `packages/uwmd-core/src/format.ts` — `formatDistribution` helper.
  - `spec/UW_PROTOCOL_v1.md` §VIII — sampling section.
  - `spec/schemas/calc-result.schema.json` — additive `distribution`.
- **API surface:** types above; no new public functions beyond what `evaluateCalc` already exposes.
- **Test plan:** PRNG test vectors, sampling distribution-shape tests (mean/variance within tolerance), determinism tests (same seed → same output), the conformance fixtures above.

## Implementation notes (deviations from the proposal)

Shipped 2026-08-27 as protocol §VIII.8, on the override mechanism RFC
0007 added the same day. Four substantive departures, one of them a
correctness finding the proposal would have shipped without.

**1. A declaration, not built-ins.** The proposal adds `uniform()`,
`normal()`, `triangular()`, and `monte_carlo(expr, n)` to the §VIII.1
grammar. Three separate problems, any one disqualifying:

- Every builtin here is a pure `(CalcValue[]) => CalcValue`. A sampling
  builtin carries PRNG state, so it is not a function of its arguments —
  and "the calc engine is pure" is what makes a formula auditable.
- `monte_carlo(expr, n)` needs a *lazy* argument, but the evaluator
  evaluates arguments eagerly. Making it lazy means a special-cased
  builtin or a string executed as a program.
- A call whose legality depends on the enclosing declaration's
  `deterministic` flag is a context-sensitive grammar, checked in a
  parser that is deliberately context-free.

So inputs are declared in JSON and each draw is an ordinary evaluation
with `overrides` (§VIII.7.2). The grammar and the built-ins are
untouched. This is the RFC's rejected alternative #3 ("decouple sampling
from the calc grammar"), and the rejection was reasonable when it was
written — the override mechanism did not exist yet. With it, decoupling
is *less* machinery than a grammar extension, not more.

**2. `normal` is not bit-exact across platforms, and the spec now says
so.** This is the finding, and it is not in the RFC.

The RFC's determinism argument is "specify the PRNG and two hosts
produce identical distributions". That is necessary and not sufficient.
IEEE 754 exactly specifies `+ − × ÷` and `sqrt`; it does **not** specify
`log`, `exp`, `sin`, or `cos`. Both textbook normal samplers depend on
unspecified functions — Box-Muller on `log` and `cos`, Marsaglia polar
on `log` — so identical seeds would still yield samples that agree to
fifteen digits and disagree in the sixteenth. The seed would be
reproducible and the numbers would not.

Every distribution is therefore sampled by inverse CDF: `uniform`
(arithmetic only) and `triangular` (arithmetic and `sqrt`) are
**exact**, and `normal` uses Acklam's rational approximation whose
central 95% is exact and whose tails still need `log`. Conformance
compares the first two exactly and the third at a stated tolerance.
This also settles the RFC's unresolved question about fixture
comparison, and settles it better than the proposed blanket `rel: 1e-9`:
naming which distributions are exact is more useful than a tolerance
that hides the difference.

**3. Percentiles are nearest-rank, never interpolated.** Not specified
in the RFC. A percentile is thus an observed sample and is exactly
reproducible whenever the samples are; interpolating between neighbours
adds an arithmetic step two hosts can round differently, for a number
nobody reads to that precision.

**4. The distribution never travels through `CalcResult`.** The RFC
extends `CalcResult` with a `distribution` field and has `value` carry
"the mean when the consumer requests a single number". `CalcResult.value`
is pinned by RFC 0016 receipts, rendered by the CLI, and emitted from by
Excel; a `value` that silently means "the mean of a distribution" in
some rows is exactly the kind of overload that produces a wrong number
in a credit memo. `StochasticResult` is its own type, matching how RFC
0007 handled the same pressure.

Smaller decisions worth recording: input **order** is part of the
contract (one stream, drawn in declared order) because the alternative
hides the keying rule; drawing one variable twice is refused, since the
later draw silently wins while the earlier still consumes the stream;
a failed draw is excluded from the summary rather than folded in as
zero; `stddev` is the sample (`n−1`) form, because reporting `0` for a
single draw claims a certainty the run does not have.

### Verification gap: the PCG test vector is self-generated

`prng.ts` implements PCG-XSL-RR-128/64 from the published algorithm, and
the test vector in `prng.test.ts` and `conformance/stochastic/` was
generated **by that implementation**. It proves self-consistency across
runs and platforms. It does **not** prove agreement with the reference C
implementation at pcg-random.org, which nobody has diffed against.

The check is cheap and has not been done. Until it is, an implementer
porting this to another language should port the TypeScript, not write
pcg64 from the paper and assume the two agree. This should be closed
before the RFC is accepted rather than after — the steps are written up
in [`docs/handoff/HUMAN-verify-pcg64-vector.md`](../../docs/handoff/HUMAN-verify-pcg64-vector.md).

### Deferred

The **"Range types and napkin mode"** section — substituting stochastic
calcs for `refinement.ts`'s interval arithmetic — is not implemented.
The RFC says an implementation *MAY* substitute, so nothing is
promised-and-missing, and the substitution rewires VOI ranking (variance
reduction instead of interval width) which deserves its own change
rather than riding along. The `triangular` distribution is shipped
specifically so the existing `low`/`central`/`high` default tables can
feed it when that work happens.

**Render** (`distribution_band` view models, inline histograms) is also
deferred; `StochasticResult` gives a renderer everything it needs.

## Alternatives considered

1. **Use an existing PRNG library (`seedrandom`).** Rejected — protocol must specify the algorithm normatively; pulling a library means tracking its version as part of the determinism contract. Vendoring 30 lines is cleaner.

2. **Closed-form distributions only (no sampling).** A calc would declare `distribution: normal(mean, stddev)` and consumers compute analytically. Rejected — works for primitive distributions but not for compound expressions like "DSCR distribution given NOI normal and rate uniform." Sampling handles arbitrary compositions.

3. **Decouple sampling from the calc grammar — use a separate "model" surface.** A `.uw.md` file would carry both `calculations` (deterministic) and `models` (stochastic). Rejected as more complexity than needed; `deterministic: false` is the smaller change.

4. **Punt to host-defined extensions.** Let modules implement their own stochastic calcs without protocol support. Rejected — defeats the whole determinism goal. Two modules would compute the same conceptual distribution differently.

5. **Inline samples in the file.** Calc result includes the full sample array as a section content. Rejected — `samples: 100_000` makes files unreadable. The `return_samples: false` default and summary-only output is the right tradeoff; consumers who need the full samples can re-run the calc.

## Range types and "napkin mode" (subsection)

The Phase 5 refinement engine added in v1.1 (see
[`packages/uwmd-core/src/refinement.ts`](../../packages/uwmd-core/src/refinement.ts))
ranks gaps by their effect on output ranges, but evaluates those
ranges via interval arithmetic — propagating `low`/`central`/`high`
through the calc graph as three independent scalar evaluations. That
approximation is correct under the monotonicity assumption and
deliberately cheap, but it leaks information that proper distributions
would preserve (joint distributions across coupled inputs collapse
to worst-case brackets).

This RFC's stochastic mechanism is the principled successor: when
"napkin mode" outputs are needed at scope or screening stage, an
implementation MAY substitute a stochastic calc for the interval
approximation. Concretely:

- Each provisional input contributes a distribution rather than a
  range. The asset-class default tables in
  [`packages/uwmd-core/src/defaults.ts`](../../packages/uwmd-core/src/defaults.ts)
  carry `low/central/high`; under this RFC, an adopter MAY interpret
  those as the parameters of a triangular distribution
  (`triangular(low, central, high)`) without a spec change.
- The output for each calc becomes the `distribution` shape defined
  above. The refinement engine's `range_today` collapses to
  `{ p10, p90 }` of the sampled distribution, which is tighter and
  more meaningful than the worst-case interval bracket.
- VOI ranking remains valid; collapsing a gap reduces the
  distribution's variance, and the engine ranks by variance
  reduction instead of interval width.

Two practical constraints:

1. **Determinism**: the refinement engine MUST seed the PRNG
   deterministically from the file's `deal_id` plus the calc id, so
   that `uwmd refine` produces the same ranking on every run for the
   same inputs.
2. **Performance**: scope-stage refinement runs interactively
   (sub-second). Sample budget should default to 1,000 per calc per
   ranking pass — adequate for stable VOI ordering but not for
   publishable distribution summaries. A separate `--samples` flag on
   `uwmd refine` lets adopters trade speed for tightness.

The interval-arithmetic implementation in v1.1 is documented as the
"v1.1 approximation"; this RFC is its principled v2 form. No
back-compat break: the `RankedGap` shape remains the same
(`prior_range`, `affected_outputs`, `total_voi`), but the values
become tighter.

## Unresolved questions

- **Sample budget.** A host loading 50 stochastic calcs with `samples: 100_000` each evaluates 5M expressions. Recommend a global host limit (`max_total_samples`) reported in `ImplementationManifest.limits`. Default proposal: 1M.
- **Distribution comparison in fixtures.** Comparing distributions byte-exactly requires the seed to produce identical sample sequences across hosts — that's exactly what the PRNG specification gives us, but small floating-point variance in the math operations on samples could still cause divergence. Recommend: tier-3 stochastic fixtures use exact equality for integer-valued summaries (counts, percentiles in integer multiples) and `tolerance: { rel: 1e-9 }` for continuous summaries.
- **Correlation between random variables.** The above design draws each `uniform` / `normal` independently. Real underwriting often has correlated inputs (cap rates and rates are correlated). Defer to a follow-up RFC; for now, modules can construct correlated draws explicitly via Cholesky decomposition expressed in the existing math built-ins.
- **Bayesian inference.** Out of scope. This RFC handles forward sampling only. Calibration / posterior inference is a separate project.

## Prior art

- **PCG random number generators** ([pcg-random.org](https://www.pcg-random.org)) — small, fast, statistically excellent. Test vectors published; verifiable across implementations.
- **Stan and PyMC** — standard libraries for probabilistic programming. Far more capable than this proposal; we want a much smaller surface.
- **Excel `RAND()` and Monte Carlo add-ins** — the exact use case adopters are coming from. Our model is "Excel's @RISK but determinism-preserving."
- **JSON Schema's `enum` for output modes** — we follow the same pattern with `summarize: ('mean' | 'median' | …)`.
