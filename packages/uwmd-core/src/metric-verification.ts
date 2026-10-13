// Stated-metric verification against the metric dictionary (RFC 0083 §2).
//
// A lender with only the standard: the reader, the safe-expression evaluator,
// the §VIII.5 quantizer and the normative metric dictionary
// (`spec/metrics/builtin.json`, shipped as `BUILTIN_METRIC_DICTIONARY`). No
// packs, defaults, cascade or prior results; nothing is inferred. Each numeric
// statement of a dictionary metric is recomputed from the document's own
// stated inputs and compared at its source precision (RFC 0079), giving one
// result per statement: `verified`, `failed`, or `unverifiable` with a reason.
//
// This promotes `conformance/metrics/verifier.mjs`, which now calls it; the
// semantics are that fixture's, unchanged. Browser-safe; performs no I/O.

import { evaluateDeclared } from './calc/evaluator.js';
import { parseExpression } from './calc/parser.js';
import { compareStatedMetric, getStatedDecimals } from './calc/stated-precision.js';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';
import { blockPayload } from './parser.js';
import type { MetricDictionary, MetricDictionaryCalculation, MetricDictionarySize } from './protocol.js';
import { resolveSectionBlock } from './section-resolution.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { readYamlScalar } from './yaml-scalar.js';

// ─── Public types ────────────────────────────────────────────────────────────

/** A dictionary entry a statement is checked against. */
export type StatedMetricDefinition = MetricDictionaryCalculation | MetricDictionarySize;

/** Why a statement could not be checked. Calc refusals carry their `CALC-*` code. */
export type StatedMetricUnverifiableReason =
  | 'missing_or_invalid_size'
  | 'missing_or_null_input'
  | 'nonfinite_or_nonnumeric_result'
  | 'no_numeric_statement'
  | 'evaluation_error'
  | (string & {});

/** The outcome of checking one numeric statement. */
export interface StatedMetricOutcome {
  state: 'verified' | 'failed' | 'unverifiable';
  /** The recomputed value at the comparison precision; null when unverifiable. */
  computed: number | null;
  /** The stated value as compared (quantized only when stated past `round_to`). */
  comparison?: number;
  /** Decimal places of the comparison: `min(max(stated, minimum), round_to)`. */
  comparison_decimals?: number;
  reason?: StatedMetricUnverifiableReason;
}

/** One numeric statement of a dictionary metric and its outcome. */
export interface StatedMetricEvidence extends StatedMetricOutcome {
  /** The dictionary metric id. */
  id: string;
  /** Where the document states it, e.g. `quick_metrics.dscr` or `valuation[base].cap_rate`. */
  path: string;
  stated: number;
  /** Decimal places of the stated source token, when the source carries one. */
  stated_decimals?: number;
}

/** Every numeric statement of the document's dictionary metrics, checked. */
export interface StatedMetricsReport {
  asset_class: string;
  counts: { verified: number; failed: number; unverifiable: number };
  evidence: StatedMetricEvidence[];
}

/** Where a document states metrics, beyond frontmatter `quick_metrics`. */
export interface StatedMetricBindings {
  /** Section roots at which a metric's canonical id is a statement of it. */
  output_sections: readonly string[];
  /** Further addresses (`section.path`) that state a metric, by metric id. */
  aliases?: Readonly<Record<string, readonly string[]>>;
}

export interface VerifyStatedMetricsOptions {
  /** The dictionary to verify against. Defaults to the builtin dictionary. */
  dictionary?: MetricDictionary;
  /** Where statements live. Defaults to the canonical id at the builtin output section roots. */
  bindings?: StatedMetricBindings;
  /**
   * Source decimals by unvaried address (`section.path`), for statements whose
   * numeric spelling the parsed document does not carry in `rawJson` (a view
   * built from UW Lite anchors, for example). Takes precedence over the source.
   */
  statedDecimals?: ReadonlyMap<string, number>;
}

/**
 * The output section roots searched by default: the sections where the
 * builtin examples state dictionary metrics under their canonical ids
 * (`conformance/metrics/statement-bindings.json`). No aliases by default;
 * the conformance aliases bind existing example fields only.
 */
const DEFAULT_BINDINGS: StatedMetricBindings = Object.freeze({
  output_sections: Object.freeze([
    'valuation', 'debt_structure', 'noi_model', 'rent_roll', 'property', 'components',
    'dc_capacity', 'dc_power', 'dc_revenue', 'mhc_sites', 'hotel_metrics', 'hotel_food_beverage',
  ]),
});

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Verify one stated value of one dictionary metric. Inputs are the document's
 * stated fields only; a missing or null input, a nonfinite result or a calc
 * refusal is `unverifiable`, never a default. `statedDecimals` is the source
 * precision of the statement (RFC 0079); omitting it for a rounded metric is a
 * caller error, reported as `CALC-TYPE-001`.
 */
export function verifyStatedMetric(
  metric: StatedMetricDefinition,
  parsed: ParsedUWFile,
  stated: unknown,
  sectionVariants?: Readonly<Record<string, string>>,
  statedDecimals?: number,
): StatedMetricOutcome {
  try {
    if (metric.null_semantics === 'finite_stated_number') {
      const block = resolveSectionBlock(parsed, 'property', { sectionVariants });
      const raw = block ? get(blockPayload(block), metric.path) : undefined;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return { state: 'unverifiable', reason: 'missing_or_invalid_size', computed: null };
      }
    }
    const value = evaluateDeclared(parseExpression(metric.formula), {
      parsed, prior_results: {}, locale: 'en-US', ...(sectionVariants ? { sectionVariants } : {}),
    }, metric.section_roles);
    if (value === null) return { state: 'unverifiable', reason: 'missing_or_null_input', computed: null };
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { state: 'unverifiable', reason: 'nonfinite_or_nonnumeric_result', computed: null };
    }
    if (typeof stated !== 'number' || !Number.isFinite(stated)) {
      return { state: 'unverifiable', reason: 'no_numeric_statement', computed: null };
    }
    return compareStatedMetric(value, stated, statedDecimals, metric);
  } catch (error) {
    const e = error as { proto?: { code?: string }; code?: string } | null;
    return { state: 'unverifiable', reason: e?.proto?.code ?? e?.code ?? 'evaluation_error', computed: null };
  }
}

/**
 * Check every numeric statement of the document's dictionary metrics:
 * frontmatter `quick_metrics`, each metric's canonical id at the bound output
 * section roots and its aliases, and the class's primary-size statements under
 * `property`. Every current block variant is checked separately, and a
 * statement is counted at each address, so agreeing and disagreeing copies
 * stay visible. Superseded blocks, prose and scenarios are not statements.
 */
export function verifyStatedMetrics(
  parsed: ParsedUWFile,
  options: VerifyStatedMetricsOptions = {},
): StatedMetricsReport {
  const dictionary = options.dictionary ?? BUILTIN_METRIC_DICTIONARY;
  const bindings = options.bindings ?? DEFAULT_BINDINGS;
  const precision = options.statedDecimals;
  const source = parsed.raw;
  const asset_class = parsed.frontmatter.asset_class;
  const statements: Array<{
    metric: StatedMetricDefinition;
    path: string;
    stated: number;
    statedDecimals: number | undefined;
    sectionVariants?: Record<string, string>;
  }> = [];

  for (const metric of dictionary.calculations.filter((m) => (m.asset_classes as readonly string[]).includes(asset_class))) {
    const quick = (parsed.frontmatter.quick_metrics as Record<string, unknown> | undefined)?.[metric.id];
    if (typeof quick === 'number') {
      statements.push({ metric, path: `quick_metrics.${metric.id}`, stated: quick, statedDecimals: quickMetricDecimals(source, metric.id, quick) });
    }
    const paths = [...bindings.output_sections.map((s) => `${s}.${metric.id}`), ...(bindings.aliases?.[metric.id] ?? [])];
    for (const path of new Set(paths)) {
      const [section, ...tail] = path.split('.') as [string, ...string[]];
      for (const [variant, block] of blocks(parsed.sections[section])) {
        const stated = get(blockPayload(block), tail.join('.'));
        if (typeof stated !== 'number') continue;
        statements.push({
          metric,
          path: `${section}${variant ? `[${variant}]` : ''}.${tail.join('.')}`,
          stated,
          statedDecimals: precision?.get(path) ?? jsonStatedDecimals(block, tail.join('.'), stated),
          ...(variant ? { sectionVariants: { [section]: variant } } : {}),
        });
      }
    }
  }
  for (const metric of dictionary.size_intensives.filter((m) => (m.asset_classes as readonly string[]).includes(asset_class))) {
    for (const [variant, block] of blocks(parsed.sections['property'])) {
      const stated = get(blockPayload(block), metric.path);
      if (typeof stated !== 'number') continue;
      statements.push({
        metric,
        path: `property${variant ? `[${variant}]` : ''}.${metric.path}`,
        stated,
        statedDecimals: precision?.get(`property.${metric.path}`) ?? jsonStatedDecimals(block, metric.path, stated),
        ...(variant ? { sectionVariants: { property: variant } } : {}),
      });
    }
  }

  const evidence: StatedMetricEvidence[] = statements.map(({ metric, path, stated, sectionVariants, statedDecimals }) => ({
    id: metric.id,
    path,
    stated,
    ...(statedDecimals !== undefined ? { stated_decimals: statedDecimals } : {}),
    ...verifyStatedMetric(metric, parsed, stated, sectionVariants, statedDecimals),
  }));
  const counts = { verified: 0, failed: 0, unverifiable: 0 };
  for (const item of evidence) counts[item.state]++;
  return { asset_class, counts, evidence };
}

// ─── Source precision ────────────────────────────────────────────────────────
// A parsed number has lost its spelling; RFC 0079 compares at the precision
// the source states, so these read the numeric tokens the source wrote.

/**
 * Every numeric token of a JSON text, keyed by its JSON-encoded path. The text
 * is validated by `JSON.parse` first; this walk records token spelling only.
 */
export function jsonNumericTokens(source: string): Map<string, string> {
  JSON.parse(source);
  const tokens = source.match(/"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/g) ?? [];
  const numbers = new Map<string, string>();
  let i = 0;
  function value(path: string[]): void {
    const token = tokens[i++];
    if (token === '{') {
      if (tokens[i] === '}') { i++; return; }
      do {
        const key = JSON.parse(tokens[i++] as string) as string; i++; // colon
        value([...path, key]);
      } while (tokens[i++] === ',');
    } else if (token === '[') {
      if (tokens[i] === ']') { i++; return; }
      let n = 0;
      do { value([...path, String(n++)]); } while (tokens[i++] === ',');
    } else if (token !== undefined && /^-?\d/.test(token)) {
      numbers.set(JSON.stringify(path), token);
    }
  }
  value([]);
  return numbers;
}

/** Source decimals of the statement at `path` in a block, when its token spells `stated`. */
export function jsonStatedDecimals(block: Pick<UWBlock, 'rawJson'>, path: string, stated: number): number | undefined {
  if (!block.rawJson) return undefined;
  const numbers = jsonNumericTokens(block.rawJson);
  // The bare block: the payload sits beside `_meta` (Format §2.4).
  const token = numbers.get(JSON.stringify(path.split('.')));
  return token !== undefined && Number(token) === stated ? getStatedDecimals(token) : undefined;
}

/** Source decimals of frontmatter `quick_metrics.<id>`, when its plain token spells `stated`. */
export function quickMetricDecimals(source: string, id: string, stated: number): number | undefined {
  const frontmatter = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(source)?.[1];
  if (!frontmatter) return undefined;
  let inQuick = false;
  let token: string | undefined;
  for (const line of frontmatter.split(/\r?\n/)) {
    if (/^quick_metrics\s*:/.test(line)) { inQuick = true; token = undefined; continue; }
    if (/^\S/.test(line) && !line.startsWith('#')) inQuick = false;
    if (!inQuick) continue;
    const match = /^\s+([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (match?.[1] !== id) continue;
    const scalar = readYamlScalar(match[2] as string);
    token = scalar.ok && !scalar.quoted ? scalar.text : undefined;
  }
  return token !== undefined && Number(token) === stated ? getStatedDecimals(token) : undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function get(object: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => (value as Record<string, unknown> | null | undefined)?.[segment], object);
}

function blocks(entry: UWBlock | Record<string, UWBlock> | undefined): Array<[string | undefined, UWBlock]> {
  if (!entry) return [];
  return (entry as UWBlock).annotation ? [[undefined, entry as UWBlock]] : Object.entries(entry as Record<string, UWBlock>);
}
