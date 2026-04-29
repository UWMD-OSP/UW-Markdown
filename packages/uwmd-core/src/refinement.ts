// Refinement engine — Protocol §X.4
//
// Ranks gaps by value-of-information (VOI). The intuition:
//
//   • Every calc reads a set of input field paths.
//   • If a path resolves via the cascade at step ≥ asset_class_default, it's
//     a "gap" — we don't actually know the value, we're using a published
//     range.
//   • The width of each output's range today is driven by the union of all
//     such gaps. Collapse one gap (i.e. the user gives us a real value) and
//     each affected output's range tightens.
//   • The marginal VOI of a gap is the total range-width reduction it would
//     produce across the outputs it touches.
//
// Method: perturbation with interval arithmetic. For each gap, evaluate every
// affected output at the gap's {low, central, high} while all other gaps stay
// at their low/high to bracket the worst case. Assumes outputs are monotonic
// in each input (true for all eight multifamily metrics). Diagnostics flag
// non-monotonic ASTs.

import type { ParsedUWFile, DealStage } from './types.js';
import type { ModuleManifest } from './protocol.js';
import { MULTIFAMILY_PACK } from './packs/multifamily.js';
import { extractDependencyGraph } from './calc/dependencies.js';
import type { Expr } from './calc/parser.js';
import { parseExpression } from './calc/parser.js';
import { resolveValue, type CascadeContext, type ResolvedValue } from './cascade.js';

// ─── Public types ────────────────────────────────────────────────────────────

export interface OutputSensitivity {
  output_id: string;
  range_today: { low: number; high: number };
  range_if_known: { low: number; high: number };
  /** Reduction in output range width when this gap collapses to central. */
  voi: number;
}

export interface RankedGap {
  field_path: string;
  current_value: ResolvedValue;
  prior_range: { low: number; central: number; high: number };
  affected_outputs: OutputSensitivity[];
  /** Sum of |voi| across affected outputs, normalized by output magnitude. */
  total_voi: number;
  blocks_stage?: DealStage;
  question_template?: string;
}

export interface RankGapsOptions {
  /** Calc ids to focus on. Default: all calcs in the supplied packs. */
  targets?: string[];
  /** Only 'perturbation' is implemented in v1. Monte Carlo is RFC 0005 territory. */
  method?: 'perturbation';
  /** How many top results to return. Default: 10. */
  top?: number;
  /** Calc packs to consider. Default: [MULTIFAMILY_PACK]. */
  packs?: ModuleManifest[];
  /** Cascade context (investor profile, market data, etc.). */
  cascadeContext?: CascadeContext;
}

export interface NonMonotonicWarning {
  output_id: string;
  reason: string;
}

export interface RankGapsResult {
  by_voi: RankedGap[];
  /** Non-numeric / completeness gaps that don't move output ranges but
   *  may still block a stage. (Empty in v1; placeholder for the L0b loop.) */
  by_stage_blocking: { field_path: string; reason: string }[];
  diagnostics: {
    graph_size: number;
    resolved: number;
    perturbations: number;
    non_monotonic: NonMonotonicWarning[];
  };
}

// ─── Question template registry ─────────────────────────────────────────────

const QUESTION_TEMPLATES: Record<string, string> = {
  'noi_model.expense_ratio': "What's your assumed operating expense ratio (expenses ÷ EGI)?",
  'rent_roll.vacancy_pct': 'What vacancy rate are you underwriting?',
  'noi_model.rent_growth_pct_y1': "What's your year-1 rent growth assumption?",
  'noi_model.management_fee_pct': "What's your assumed management fee (% of EGI)?",
  'noi_model.replacement_reserve_per_unit_y1': 'What replacement reserve per unit are you using in year 1?',
  'debt_structure.rate_pct': "What's the indicative loan rate?",
  'debt_structure.amortization_months': 'What amortization schedule do you assume (in months)?',
  'debt_structure.io_months': 'How many months of interest-only do you expect?',
  'debt_structure.ltv_pct': "What LTV are you targeting?",
  'valuation.exit_cap_rate_pct': "What's the assumed exit cap rate?",
  'sources_uses.closing_costs_pct': "What closing-cost percentage are you budgeting?",
};

// ─── Mini interpreter (numeric only) ────────────────────────────────────────
// Evaluates a parsed Expr against a Map<path | ident, number> assignment.
// Used by the perturbation loop. Returns NaN for any unsupported subexpr —
// the caller treats NaN as "skip this output for this gap."

function evalNumeric(expr: Expr, env: Map<string, number>): number {
  switch (expr.kind) {
    case 'literal':
      return typeof expr.value === 'number' ? expr.value : Number.NaN;
    case 'ident':
      return env.has(expr.name) ? env.get(expr.name)! : Number.NaN;
    case 'path': {
      const k = [expr.head, ...expr.segments].join('.');
      return env.has(k) ? env.get(k)! : Number.NaN;
    }
    case 'unary': {
      const v = evalNumeric(expr.operand, env);
      return expr.op === '-' ? -v : Number.NaN;
    }
    case 'binary': {
      const l = evalNumeric(expr.left, env);
      const r = evalNumeric(expr.right, env);
      switch (expr.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? Number.NaN : l / r;
        case '%': return l % r;
        default: return Number.NaN;
      }
    }
    case 'cond':
    case 'call':
      return Number.NaN;
  }
}

// AST contains a non-monotonic op (mod, comparison, conditional, function call)?
function isMonotonic(expr: Expr): boolean {
  switch (expr.kind) {
    case 'literal':
    case 'ident':
    case 'path':
      return true;
    case 'unary':
      return isMonotonic(expr.operand);
    case 'binary':
      if (expr.op === '%') return false;
      return isMonotonic(expr.left) && isMonotonic(expr.right);
    case 'cond':
    case 'call':
      return false;
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────

export function rankGaps(parsed: ParsedUWFile, opts: RankGapsOptions = {}): RankGapsResult {
  const packs = opts.packs ?? [MULTIFAMILY_PACK];
  const top = opts.top ?? 10;
  const cascadeCtx = opts.cascadeContext ?? {};

  const graph = extractDependencyGraph(parsed, { packs });
  const targets = (opts.targets && opts.targets.length > 0)
    ? opts.targets.filter(id => graph.outputs.has(id))
    : [...graph.outputs.keys()];

  // Identify gaps: every input that resolves via cascade step ≥ asset_class_default.
  // Also note the cascade resolution for every input (used for central evaluations).
  const allInputs = new Set<string>();
  for (const id of targets) {
    const deps = graph.outputs.get(id);
    if (!deps) continue;
    for (const d of deps) allInputs.add(d);
  }

  const resolutions = new Map<string, ResolvedValue>();
  const gaps: { path: string; range: { low: number; central: number; high: number } }[] = [];
  for (const path of allInputs) {
    const r = resolveValue(path, parsed, cascadeCtx);
    resolutions.set(path, r);
    const isGap =
      r.step === 'asset_class_default' ||
      r.step === 'global_default' ||
      r.step === 'system_default';
    if (isGap && r.range) {
      gaps.push({ path, range: r.range });
    }
  }

  // Pre-build target ASTs once.
  const targetAsts = new Map<string, Expr>();
  const nonMonotonic: NonMonotonicWarning[] = [];
  for (const id of targets) {
    const formula = graph.formulas.get(id);
    if (!formula) continue;
    let ast: Expr;
    try { ast = parseExpression(formula); } catch { continue; }
    targetAsts.set(id, ast);
    if (!isMonotonic(ast)) {
      nonMonotonic.push({ output_id: id, reason: 'AST contains non-monotonic op (mod / call / cond)' });
    }
  }

  // Build the "all-low" and "all-high" environments for the worst-case bracket.
  // For inputs that aren't gaps, take the resolved central as both low and high.
  function makeEnv(perGapAssignment: Map<string, number>, fallbackPick: 'low' | 'high'): Map<string, number> {
    const env = new Map<string, number>();
    for (const path of allInputs) {
      const r = resolutions.get(path)!;
      const numeric = typeof r.value === 'number' ? r.value : Number.NaN;
      const range = r.range;
      let v: number;
      if (perGapAssignment.has(path)) {
        v = perGapAssignment.get(path)!;
      } else if (range) {
        v = fallbackPick === 'low' ? range.low : range.high;
      } else {
        v = numeric;
      }
      env.set(path, v);
    }
    return env;
  }

  let perturbationCount = 0;

  // Today's range per output (no gap fixed; all gaps swing freely).
  const todayRange = new Map<string, { low: number; high: number }>();
  {
    const envLow = makeEnv(new Map(), 'low');
    const envHigh = makeEnv(new Map(), 'high');
    for (const id of targets) {
      const ast = targetAsts.get(id);
      if (!ast) continue;
      const a = evalNumeric(ast, envLow);
      const b = evalNumeric(ast, envHigh);
      perturbationCount += 2;
      if (Number.isFinite(a) && Number.isFinite(b)) {
        todayRange.set(id, { low: Math.min(a, b), high: Math.max(a, b) });
      }
    }
  }

  // Per-gap ranking.
  const ranked: RankedGap[] = [];
  for (const gap of gaps) {
    const consumers = graph.inputs.get(gap.path);
    if (!consumers || consumers.size === 0) continue;
    const affectedOutputs: OutputSensitivity[] = [];
    let totalVoi = 0;

    // Output range when THIS gap collapses to central.
    const fixed = new Map<string, number>([[gap.path, gap.range.central]]);
    const envCollapsedLow = makeEnv(fixed, 'low');
    const envCollapsedHigh = makeEnv(fixed, 'high');

    for (const outputId of consumers) {
      if (!targets.includes(outputId)) continue;
      const ast = targetAsts.get(outputId);
      if (!ast) continue;
      const today = todayRange.get(outputId);
      if (!today) continue;
      const a = evalNumeric(ast, envCollapsedLow);
      const b = evalNumeric(ast, envCollapsedHigh);
      perturbationCount += 2;
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const collapsed = { low: Math.min(a, b), high: Math.max(a, b) };
      const reduction = (today.high - today.low) - (collapsed.high - collapsed.low);
      // Normalize by output magnitude so calc ids on different scales compose.
      const scale = Math.max(Math.abs(today.high), Math.abs(today.low), 1e-9);
      affectedOutputs.push({
        output_id: outputId,
        range_today: today,
        range_if_known: collapsed,
        voi: reduction,
      });
      totalVoi += reduction / scale;
    }

    if (affectedOutputs.length === 0) continue;
    ranked.push({
      field_path: gap.path,
      current_value: resolutions.get(gap.path)!,
      prior_range: gap.range,
      affected_outputs: affectedOutputs,
      total_voi: totalVoi,
      question_template: QUESTION_TEMPLATES[gap.path],
    });
  }

  ranked.sort((a, b) => b.total_voi - a.total_voi);

  return {
    by_voi: ranked.slice(0, top),
    by_stage_blocking: [],
    diagnostics: {
      graph_size: graph.outputs.size,
      resolved: resolutions.size,
      perturbations: perturbationCount,
      non_monotonic: nonMonotonic,
    },
  };
}
