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

/**
 * Why a statement could not be checked. Calc refusals carry their `CALC-*` code.
 * `missing_stated_precision`: the document view carries no source token for the
 * statement (RFC 0079 compares at the stated precision) and the caller supplied
 * none.
 */
export type StatedMetricUnverifiableReason =
  | 'missing_or_invalid_size'
  | 'missing_or_null_input'
  | 'nonfinite_or_nonnumeric_result'
  | 'no_numeric_statement'
  | 'missing_stated_precision'
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
  /**
   * Where statements live. Defaults to the dictionary's `statement_bindings`
   * (RFC 0099), so every bound home of a metric is checked.
   */
  bindings?: StatedMetricBindings;
  /**
   * Source decimals by unvaried address (`section.path`, or
   * `quick_metrics.<id>`), for statements whose numeric spelling the parsed
   * document does not carry: a view built from UW Lite anchors, or a document
   * decoded from an envelope or another representation (`fromUWEnvelope`),
   * which has no `rawJson` or frontmatter source text. Takes precedence over
   * the source. A rounded statement with no precision from either is
   * `unverifiable` with reason `missing_stated_precision`.
   */
  statedDecimals?: ReadonlyMap<string, number>;
}

/**
 * The builtin dictionary's normative statement-binding registry (RFC 0099):
 * each metric's own id at the output section roots, plus its aliases. It is
 * closed; no binding is inferred from a field name. Module-level, not part of
 * the public surface.
 */
export const DEFAULT_STATED_METRIC_BINDINGS: StatedMetricBindings = BUILTIN_METRIC_DICTIONARY.statement_bindings;

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
  return checkStatement(metric, parsed, stated, sectionVariants, statedDecimals, 'caller_error');
}

/**
 * `missingPrecision` says what an absent `statedDecimals` means for a rounded
 * metric: a caller error at the comparison API (RFC 0079, `CALC-TYPE-001`), or
 * a document whose source tokens are unavailable (`missing_stated_precision`).
 */
function checkStatement(
  metric: StatedMetricDefinition,
  parsed: ParsedUWFile,
  stated: unknown,
  sectionVariants: Readonly<Record<string, string>> | undefined,
  statedDecimals: number | undefined,
  missingPrecision: 'caller_error' | 'unverifiable',
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
    if (statedDecimals === undefined && metric.round_to !== null && missingPrecision === 'unverifiable') {
      return { state: 'unverifiable', reason: 'missing_stated_precision', computed: null };
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
 *
 * Stated precision (RFC 0079) is read from the source: each block's `rawJson`
 * and the frontmatter text in `parsed.raw`. A document decoded from an
 * envelope or another representation has neither, so its rounded statements
 * are `unverifiable` (`missing_stated_precision`) unless the caller supplies
 * `options.statedDecimals` for them. Primary sizes compare raw and need none.
 */
export function verifyStatedMetrics(
  parsed: ParsedUWFile,
  options: VerifyStatedMetricsOptions = {},
): StatedMetricsReport {
  const dictionary = options.dictionary ?? BUILTIN_METRIC_DICTIONARY;
  // A dictionary carries its own registry (RFC 0099); a module dictionary without one
  // is checked at the builtin homes.
  const bindings = options.bindings ?? dictionary.statement_bindings ?? DEFAULT_STATED_METRIC_BINDINGS;
  const precision = options.statedDecimals;
  const source = parsed.raw;
  // Each block's source JSON is tokenized once, however many statements it holds.
  const tokens = new Map<UWBlock, Map<string, string> | null>();
  const blockDecimals = (block: UWBlock, path: string, stated: number): number | undefined => {
    if (!tokens.has(block)) tokens.set(block, readBlockTokens(block));
    const numbers = tokens.get(block);
    return numbers ? decimalsAt(numbers, path, stated) : undefined;
  };
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
      const path = `quick_metrics.${metric.id}`;
      statements.push({ metric, path, stated: quick, statedDecimals: precision?.get(path) ?? quickMetricDecimals(source, metric.id, quick) });
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
          statedDecimals: precision?.get(path) ?? blockDecimals(block, tail.join('.'), stated),
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
        statedDecimals: precision?.get(`property.${metric.path}`) ?? blockDecimals(block, metric.path, stated),
        ...(variant ? { sectionVariants: { property: variant } } : {}),
      });
    }
  }

  const evidence: StatedMetricEvidence[] = statements.map(({ metric, path, stated, sectionVariants, statedDecimals }) => ({
    id: metric.id,
    path,
    stated,
    ...(statedDecimals !== undefined ? { stated_decimals: statedDecimals } : {}),
    ...checkStatement(metric, parsed, stated, sectionVariants, statedDecimals, 'unverifiable'),
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
 * is validated by `JSON.parse` first, so invalid JSON throws its `SyntaxError`;
 * this walk records token spelling only. `jsonStatedDecimals` never throws.
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

/** A block's numeric source tokens; null when it has no source JSON or the JSON does not parse. */
function readBlockTokens(block: Pick<UWBlock, 'rawJson'>): Map<string, string> | null {
  if (!block.rawJson) return null;
  try {
    return jsonNumericTokens(block.rawJson);
  } catch {
    return null; // no readable source tokens: the statement has no stated precision
  }
}

function decimalsAt(numbers: Map<string, string>, path: string, stated: number): number | undefined {
  // The bare block: the payload sits beside `_meta` (Format §2.4).
  const token = numbers.get(JSON.stringify(path.split('.')));
  return token !== undefined && Number(token) === stated ? getStatedDecimals(token) : undefined;
}

/**
 * Source decimals of the statement at `path` in a block, when its token spells
 * `stated`. Undefined when the block has no source JSON or it does not parse.
 */
export function jsonStatedDecimals(block: Pick<UWBlock, 'rawJson'>, path: string, stated: number): number | undefined {
  const numbers = readBlockTokens(block);
  return numbers ? decimalsAt(numbers, path, stated) : undefined;
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
