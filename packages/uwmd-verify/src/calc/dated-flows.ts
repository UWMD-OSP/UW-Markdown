// Cash-flow metric declarations — protocol §VIII.9.4 (RFC 0034).
//
// The §VIII.7/§VIII.8 pattern, third instance: a JSON declaration reaches
// arithmetic the §VIII.1 grammar deliberately cannot express. A declaration
// names a `cash_flow_series` section (and variant), picks one closed metric,
// and gets back one quantized number in an ordinary CalcResult —
// `CalcResult.value` is not widened and no result carries a date.
//
// `CalcEvaluationContext.overrides` applies to rows: a caller may shadow
// `cash_flow_series.series[7].amount` to ask "what if the exit is $1M lower"
// without mutating the document — the same shadowing contract sensitivity
// sweeps use (§VIII.7). Overrides are keyed by the full dotted path exactly
// as written; only paths under the declaration's `series_path` are consulted.

import type { CalcEvaluationContext, CalcResult } from '../protocol.js';
import { getSectionVariant } from '../parser.js';
import {
  type CashFlowSeries,
  datedFlowsOf,
  xnpvOf,
  xirrOf,
} from '../cash-flow-series.js';
import { CalcError, calcError } from './errors.js';
import { quantizeDecimal, resolveRoundTo, MAX_ROUND_TO } from './quantize.js';

// ─── Declaration ─────────────────────────────────────────────────────────────

export const CASH_FLOW_METRICS = Object.freeze(['xirr', 'xnpv', 'moic', 'total_net'] as const);

export type CashFlowMetric = (typeof CASH_FLOW_METRICS)[number];

export interface CashFlowMetricDecl {
  id: string;
  label?: string;
  /** Section id of the series to read (normally `cash_flow_series`). */
  series_path: string;
  /** Variant to read; defaults to `base`, falling back to `default`. */
  variant?: string;
  metric: CashFlowMetric;
  /** Required for `xnpv`; a fraction (0.08, never 8). */
  rate?: number;
  unit?: string;
  round_to?: number;
}

/** The §VIII.9.4 unit defaults, by metric, when the declaration states none. */
const DEFAULT_UNIT_BY_METRIC: Readonly<Record<CashFlowMetric, string>> = Object.freeze({
  xirr: '%',
  xnpv: '$',
  moic: 'x',
  total_net: '$',
});

// ─── Override application ────────────────────────────────────────────────────

/** `series[3]` → ['series', 3]; plain names pass through. */
function pathSegments(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  for (const part of path.split('.')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)((?:\[\d+\])*)$/.exec(part);
    if (!m) return [part]; // opaque; will simply fail to resolve
    out.push(m[1]!);
    const idx = m[2]!;
    if (idx) {
      for (const n of idx.matchAll(/\[(\d+)\]/g)) out.push(Number(n[1]));
    }
  }
  return out;
}

/**
 * Clone the series and apply every override keyed under `series_path`. The
 * clone is total (JSON shapes only), so the parsed document is never written
 * — the §VIII.7 shadowing contract.
 */
function applyOverrides(
  series: CashFlowSeries,
  seriesPath: string,
  overrides: CalcEvaluationContext['overrides'],
): CashFlowSeries {
  if (!overrides) return series;
  const prefix = `${seriesPath}.`;
  const keys = Object.keys(overrides).filter((k) => k.startsWith(prefix));
  if (keys.length === 0) return series;

  const clone = JSON.parse(JSON.stringify(series)) as CashFlowSeries;
  for (const key of keys) {
    const segs = pathSegments(key.slice(prefix.length));
    let cursor: unknown = clone;
    for (let i = 0; i < segs.length - 1; i++) {
      const seg = segs[i]!;
      if (cursor === null || typeof cursor !== 'object') { cursor = undefined; break; }
      cursor = (cursor as Record<string | number, unknown>)[seg];
    }
    const last = segs[segs.length - 1]!;
    if (cursor !== null && typeof cursor === 'object') {
      (cursor as Record<string | number, unknown>)[last] = overrides[key] ?? null;
    }
  }
  return clone;
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

function declRefusal(id: string, message: string, pointer: string): CalcResult {
  return {
    calc_id: id,
    ok: false,
    value: null,
    error: calcError('CALC-CF-SERIES', message, pointer),
  };
}

/**
 * Evaluate one cash-flow metric declaration. Total: a malformed declaration
 * or an unresolvable series returns `ok: false` with `CALC-CF-SERIES` rather
 * than throwing, matching `evaluateCalc`; a §VIII.9 procedure refusal
 * (`CALC-XIRR-DIVERGE`, `CALC-TYPE-001`) is likewise carried in the result.
 */
export function evaluateCashFlowMetric(
  decl: CashFlowMetricDecl,
  ctx: CalcEvaluationContext,
): CalcResult {
  if (!CASH_FLOW_METRICS.includes(decl.metric)) {
    return declRefusal(decl.id, `Unknown metric ${JSON.stringify(decl.metric)}; expected one of ${CASH_FLOW_METRICS.join(', ')}.`, 'metric');
  }
  if (decl.metric === 'xnpv' && !(typeof decl.rate === 'number' && Number.isFinite(decl.rate))) {
    return declRefusal(decl.id, 'xnpv requires a finite `rate` fraction on the declaration.', 'rate');
  }
  if (decl.round_to !== undefined && (!Number.isInteger(decl.round_to) || decl.round_to < 0 || decl.round_to > MAX_ROUND_TO)) {
    return declRefusal(decl.id, `round_to must be an integer in [0, ${MAX_ROUND_TO}].`, 'round_to');
  }

  const variant = decl.variant ?? 'base';
  const block =
    getSectionVariant(ctx.parsed, decl.series_path, variant) ??
    (decl.variant === undefined ? getSectionVariant(ctx.parsed, decl.series_path, 'default') : undefined);
  if (!block) {
    return declRefusal(
      decl.id,
      `No ${JSON.stringify(decl.series_path)} section with variant ${JSON.stringify(variant)} in the document.`,
      'series_path',
    );
  }

  const series = applyOverrides(
    block.content as unknown as CashFlowSeries,
    decl.series_path,
    ctx.overrides,
  );
  const flows = datedFlowsOf(series);
  if (flows === null) {
    return declRefusal(
      decl.id,
      `The ${JSON.stringify(decl.series_path)} series is structurally invalid (CF-01/CF-02): empty, unordered, or carrying an invalid date, amount, or day_count.`,
      'series_path',
    );
  }

  const unit = decl.unit ?? DEFAULT_UNIT_BY_METRIC[decl.metric];
  const round_to = resolveRoundTo({
    unit,
    ...(decl.round_to !== undefined ? { round_to: decl.round_to } : {}),
  });

  try {
    let raw: number;
    switch (decl.metric) {
      case 'total_net':
        raw = flows.reduce((acc, f) => acc + f.amount, 0);
        break;
      case 'moic': {
        let inflows = 0;
        let outflows = 0;
        for (const f of flows) {
          if (f.amount >= 0) inflows += f.amount;
          else outflows += -f.amount;
        }
        if (outflows === 0) {
          return declRefusal(decl.id, 'moic is undefined on a series with no outflows.', 'metric');
        }
        raw = inflows / outflows;
        break;
      }
      case 'xnpv':
        raw = xnpvOf(flows, decl.rate!);
        break;
      case 'xirr':
        raw = xirrOf(flows);
        break;
    }
    return {
      calc_id: decl.id,
      ok: true,
      value: quantizeDecimal(raw, round_to),
      unit,
      round_to,
    };
  } catch (e) {
    if (e instanceof CalcError) {
      return { calc_id: decl.id, ok: false, value: null, error: e.proto };
    }
    throw e;
  }
}

/** Evaluate a batch in declaration order, one result per declaration. */
export function evaluateCashFlowMetrics(
  decls: readonly CashFlowMetricDecl[],
  ctx: CalcEvaluationContext,
): CalcResult[] {
  return decls.map((d) => evaluateCashFlowMetric(d, ctx));
}
