// Stochastic calculations (protocol §VIII.8, RFC 0005).
//
// CRE underwriting reasons about ranges: "DSCR is 1.45 base case but 1.20-1.65
// across rate paths". Today those numbers are computed in Excel and pasted in
// as plain values, losing the model behind them, or approximated as
// best/base/worst — which renders nicely and cannot answer "what is the
// probability this underwrites above our minimum DSCR?"
//
// **A declaration, like sensitivity, and for the same reason.** RFC 0005
// proposed `uniform()`, `normal()`, `triangular()`, and `monte_carlo(expr, n)`
// as grammar built-ins. Three problems, any one of which is disqualifying:
//
//   1. Every builtin in this engine is a pure `(CalcValue[]) => CalcValue`. A
//      sampling builtin needs PRNG state, so it is not a function of its
//      arguments — and "the calc engine is pure" is what makes a formula
//      auditable.
//   2. `monte_carlo(expr, n)` takes an *expression*, but the evaluator
//      evaluates arguments eagerly. Making it lazy means either a special-cased
//      builtin or a string argument executed as a program.
//   3. The grammar would have to admit a call whose legality depends on the
//      enclosing declaration's `deterministic` flag — a context-sensitive
//      grammar, checked in a parser that is deliberately context-free.
//
// So the inputs are declared in JSON and each sample is an ordinary evaluation
// with `overrides` (§VIII.7.2) — the mechanism sensitivity tables already use.
// The grammar and the builtins are untouched, and `monte_carlo` is not a
// function but the shape of the whole declaration.
//
// **Determinism is the entire point.** A stochastic calc that two hosts
// evaluate differently is not a model, it is a rumor. The seed plus the
// normative PRNG (§VIII.8.2) plus a normative percentile rule (§VIII.8.3) is
// what makes the distribution reproducible.

import { evaluateCalc } from './index.js';
import type { CalcErrorCode } from './errors.js';
import { MAX_ROUND_TO, resolveRoundTo } from './quantize.js';
import { PRNG_ALGORITHM, Pcg64, sampleNormal, sampleTriangular, sampleUniform } from './prng.js';
import type { CalcEvaluationContext, ProtocolError } from '../protocol.js';

/** Hard ceiling on draws for one declaration. RFC 0005's proposed bound. */
export const MAX_STOCHASTIC_SAMPLES = 100_000;
/** Minimum that produces a summary worth reporting. */
export const MIN_STOCHASTIC_SAMPLES = 2;

export type DistributionSpec =
  | { kind: 'uniform'; min: number; max: number }
  | { kind: 'normal'; mean: number; stddev: number }
  | { kind: 'triangular'; min: number; mode: number; max: number };

export interface StochasticInput {
  /** The dotted path this input replaces, exactly as an expression writes it. */
  variable: string;
  distribution: DistributionSpec;
}

export type SummaryStat =
  | 'mean'
  | 'median'
  | 'p10'
  | 'p25'
  | 'p75'
  | 'p90'
  | 'min'
  | 'max'
  | 'stddev';

export const SUMMARY_STATS: readonly SummaryStat[] = Object.freeze([
  'mean', 'median', 'p10', 'p25', 'p75', 'p90', 'min', 'max', 'stddev',
]);

export interface StochasticDecl {
  id: string;
  label: string;
  /** An ordinary §VIII.1 safe expression. */
  base_formula: string;
  /**
   * Inputs to draw. **Order is part of the contract**: one PRNG stream feeds
   * them in declared order, so reordering the list changes every sample. That
   * is a real constraint and the alternative — a stream per input — makes a
   * declaration's output depend on a hidden per-input keying rule instead.
   */
  inputs: StochasticInput[];
  samples: number;
  /** Required. A stochastic calc without one is not reproducible. */
  seed: number;
  summarize: SummaryStat[];
  /** Off by default; 100,000 samples inline would make a document unreadable. */
  return_samples?: boolean;
  unit?: string;
  round_to?: number;
}

export interface StochasticSummary {
  mean?: number | null;
  median?: number | null;
  p10?: number | null;
  p25?: number | null;
  p75?: number | null;
  p90?: number | null;
  min?: number | null;
  max?: number | null;
  stddev?: number | null;
}

export interface StochasticResult {
  calc_id: string;
  ok: boolean;
  error?: ProtocolError;
  summary?: StochasticSummary;
  /** Present only when `return_samples` was set. */
  samples?: number[];
  /** Run parameters, echoed so a reader can tell what produced the numbers. */
  sampled?: { count: number; seed: number; algorithm: typeof PRNG_ALGORITHM };
  /**
   * Draws whose formula did not evaluate to a number. Excluded from the
   * summary rather than counted as zero — a rate path that divides by zero
   * says nothing about the distribution, and folding it in as 0 would drag
   * every statistic toward it.
   */
  failed_samples?: number;
  unit?: string;
  round_to?: number;
}

function declError(
  id: string,
  code: CalcErrorCode,
  message: string,
  pointer: string,
): StochasticResult {
  return { calc_id: id, ok: false, error: { category: 'calc', code, message, pointer } };
}

/**
 * Evaluate a stochastic declaration into a distribution summary.
 *
 * Total: a malformed declaration returns `ok: false` with a typed error rather
 * than throwing, matching `evaluateCalc` and `evaluateSensitivity`.
 */
export function evaluateStochastic(
  decl: StochasticDecl,
  ctx: CalcEvaluationContext,
): StochasticResult {
  const problem = checkDecl(decl);
  if (problem) return problem;

  const roundTo = resolveRoundTo({
    ...(decl.unit !== undefined ? { unit: decl.unit } : {}),
    ...(decl.round_to !== undefined ? { round_to: decl.round_to } : {}),
  });

  const rng = new Pcg64(decl.seed);
  const values: number[] = [];
  let failed = 0;

  for (let i = 0; i < decl.samples; i++) {
    const overrides: Record<string, number> = {};
    // One stream, drawn in declared input order — see `StochasticDecl.inputs`.
    for (const input of decl.inputs) {
      overrides[input.variable] = draw(rng.nextDouble(), input.distribution);
    }

    const result = evaluateCalc(
      {
        id: decl.id,
        label: decl.label,
        formula: decl.base_formula,
        deterministic: true,
        ...(decl.unit !== undefined ? { unit: decl.unit } : {}),
        round_to: roundTo,
      },
      { ...ctx, overrides: { ...ctx.overrides, ...overrides } },
    );

    if (result.ok && typeof result.value === 'number' && Number.isFinite(result.value)) {
      values.push(result.value);
    } else {
      failed++;
    }
  }

  return {
    calc_id: decl.id,
    ok: true,
    summary: summarize(values, decl.summarize),
    ...(decl.return_samples ? { samples: values } : {}),
    sampled: { count: decl.samples, seed: decl.seed, algorithm: PRNG_ALGORITHM },
    failed_samples: failed,
    ...(decl.unit !== undefined ? { unit: decl.unit } : {}),
    round_to: roundTo,
  };
}

function draw(u: number, spec: DistributionSpec): number {
  switch (spec.kind) {
    case 'uniform':
      return sampleUniform(u, spec.min, spec.max);
    case 'normal':
      // Clamped away from the open interval's endpoints: `nextDouble` can
      // return exactly 0, and the inverse CDF is unbounded there.
      return sampleNormal(u === 0 ? Number.MIN_VALUE : u, spec.mean, spec.stddev);
    case 'triangular':
      return sampleTriangular(u, spec.min, spec.mode, spec.max);
  }
}

/**
 * Summary statistics.
 *
 * **Percentiles use nearest-rank, not interpolation** (§VIII.8.3). A percentile
 * is therefore an actual observed sample, which makes it exactly reproducible
 * whenever the samples are; interpolating between two neighbours introduces an
 * arithmetic step whose result two hosts can round differently, for a number
 * nobody reads to that precision anyway.
 */
function summarize(values: number[], wanted: readonly SummaryStat[]): StochasticSummary {
  const summary: StochasticSummary = {};
  // Every requested key is present even with no data, set to null. An absent
  // key would be indistinguishable from one the declaration never asked for.
  if (values.length === 0) {
    for (const stat of wanted) summary[stat] = null;
    return summary;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const at = (fraction: number): number => sorted[Math.max(0, Math.ceil(fraction * n) - 1)] as number;

  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;

  for (const stat of wanted) {
    switch (stat) {
      case 'mean':
        summary.mean = mean;
        break;
      case 'median':
        summary.median = at(0.5);
        break;
      case 'p10':
        summary.p10 = at(0.1);
        break;
      case 'p25':
        summary.p25 = at(0.25);
        break;
      case 'p75':
        summary.p75 = at(0.75);
        break;
      case 'p90':
        summary.p90 = at(0.9);
        break;
      case 'min':
        summary.min = sorted[0] as number;
        break;
      case 'max':
        summary.max = sorted[n - 1] as number;
        break;
      case 'stddev': {
        if (n < 2) {
          summary.stddev = null;
          break;
        }
        // Sample standard deviation (n-1). A single draw has no spread, and
        // reporting 0 would claim certainty the run does not have.
        let acc = 0;
        for (const v of values) acc += (v - mean) * (v - mean);
        summary.stddev = Math.sqrt(acc / (n - 1));
        break;
      }
    }
  }
  return summary;
}

function checkDecl(decl: StochasticDecl): StochasticResult | null {
  if (!Number.isInteger(decl.seed)) {
    // The one refusal that is about reproducibility rather than shape: without
    // a seed the calc produces a different answer every run, which is the exact
    // opposite of what this format is for.
    return declError(
      decl.id,
      'CALC-STOCH-001',
      'seed is required and must be an integer; a stochastic calc without one is not reproducible.',
      'seed',
    );
  }
  if (
    !Number.isInteger(decl.samples) ||
    decl.samples < MIN_STOCHASTIC_SAMPLES ||
    decl.samples > MAX_STOCHASTIC_SAMPLES
  ) {
    return declError(
      decl.id,
      'CALC-STOCH-002',
      `samples must be an integer in [${MIN_STOCHASTIC_SAMPLES}, ${MAX_STOCHASTIC_SAMPLES}].`,
      'samples',
    );
  }
  if (!Array.isArray(decl.inputs) || decl.inputs.length === 0) {
    // With no random inputs every draw is the same number, and the "summary" is
    // a point estimate wearing a distribution's clothes.
    return declError(decl.id, 'CALC-STOCH-005', 'inputs must list at least one random variable.', 'inputs');
  }

  const seenVariables = new Set<string>();
  for (const [idx, input] of decl.inputs.entries()) {
    const pointer = `inputs[${idx}]`;
    if (!input || typeof input.variable !== 'string' || input.variable.length === 0) {
      return declError(decl.id, 'CALC-STOCH-003', `${pointer}.variable must be a non-empty path.`, `${pointer}.variable`);
    }
    if (seenVariables.has(input.variable)) {
      // The later draw silently wins for every sample, and the earlier one is
      // still consuming the stream — so the distribution is wrong in a way no
      // output reveals.
      return declError(decl.id, 'CALC-STOCH-003', `${pointer}.variable '${input.variable}' is drawn more than once.`, `${pointer}.variable`);
    }
    seenVariables.add(input.variable);

    const bad = checkDistribution(input.distribution);
    if (bad) return declError(decl.id, 'CALC-STOCH-003', `${pointer}.distribution: ${bad}`, `${pointer}.distribution`);
  }

  if (!Array.isArray(decl.summarize) || decl.summarize.length === 0) {
    return declError(decl.id, 'CALC-STOCH-004', 'summarize must name at least one statistic.', 'summarize');
  }
  for (const stat of decl.summarize) {
    if (!SUMMARY_STATS.includes(stat)) {
      return declError(
        decl.id,
        'CALC-STOCH-004',
        `Unknown summary statistic '${stat}'; expected one of ${SUMMARY_STATS.join(', ')}.`,
        'summarize',
      );
    }
  }

  if (
    decl.round_to !== undefined &&
    (!Number.isInteger(decl.round_to) || decl.round_to < 0 || decl.round_to > MAX_ROUND_TO)
  ) {
    return declError(decl.id, 'CALC-STOCH-006', `round_to must be an integer in [0, ${MAX_ROUND_TO}].`, 'round_to');
  }

  return null;
}

function checkDistribution(spec: DistributionSpec | undefined): string | null {
  if (!spec || typeof spec !== 'object') return 'missing.';
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  switch (spec.kind) {
    case 'uniform':
      if (!finite(spec.min) || !finite(spec.max)) return 'uniform needs finite min and max.';
      if (spec.min >= spec.max) return 'uniform needs min < max.';
      return null;
    case 'normal':
      if (!finite(spec.mean) || !finite(spec.stddev)) return 'normal needs finite mean and stddev.';
      if (spec.stddev <= 0) return 'normal needs stddev > 0.';
      return null;
    case 'triangular':
      if (!finite(spec.min) || !finite(spec.mode) || !finite(spec.max)) {
        return 'triangular needs finite min, mode and max.';
      }
      if (!(spec.min <= spec.mode && spec.mode <= spec.max) || spec.min >= spec.max) {
        return 'triangular needs min <= mode <= max and min < max.';
      }
      return null;
    default:
      return `unknown distribution kind '${(spec as { kind: string }).kind}'.`;
  }
}

/**
 * Narrow an unknown declaration, for hosts reading `custom_calculations`.
 *
 * Structural, like `isSensitivityDecl`: a block carrying `inputs` and `seed`
 * alongside `base_formula` is a stochastic declaration.
 */
export function isStochasticDecl(value: unknown): value is StochasticDecl {
  return (
    typeof value === 'object' &&
    value !== null &&
    'base_formula' in value &&
    'inputs' in value &&
    'seed' in value
  );
}
