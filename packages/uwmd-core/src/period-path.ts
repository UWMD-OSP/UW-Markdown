import { getPathSegment, isBlockedSegment } from './parser.js';
import { PERIOD_SERIES } from './protocol.js';
import type { PeriodColumnSnapshot } from './protocol.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import { hasBlockRole, isBlockRole, resolveRoleBlock } from './block-roles.js';
import { parseExpression, periodReferencePath, type Expr } from './calc/parser.js';
import { CalcError } from './calc/errors.js';
import { parsePeriodSelector, periodKeyIdentity, periodKindMatches, scanPeriodSeries } from './periods.js';

export interface PeriodResolutionOptions {
  sectionVariants?: Readonly<Record<string, string>>;
}

export function periodSection(parsed: ParsedUWFile, section: string, options: PeriodResolutionOptions = {}): UWBlock | null {
  const entry = getPathSegment(parsed.sections, section) as UWBlock | Record<string, UWBlock> | undefined;
  if (!entry) return null;
  if (options.sectionVariants && Object.prototype.hasOwnProperty.call(options.sectionVariants, section)) {
    const variant = options.sectionVariants[section]!;
    const block = 'annotation' in entry ? (entry as UWBlock).annotation.variant === variant ? entry as UWBlock : null
      : getPathSegment(entry, variant) as UWBlock | undefined;
    if (!block || (hasBlockRole(block) && !isBlockRole(block.content['_role']))) {
      throw new CalcError('CALC-PERIOD-003', `Cannot select ${section} variant=${variant}.`);
    }
    return block;
  }
  const resolved = resolveRoleBlock(entry, section);
  if (resolved.state === 'unresolvable') throw new CalcError('CALC-PERIOD-003', `Cannot select ${section}: ${resolved.detail ?? 'ambiguous variants'}.`);
  return resolved.block;
}

export function periodPayload(block: UWBlock): unknown {
  return Object.prototype.hasOwnProperty.call(block.content, 'content') ? getPathSegment(block.content, 'content') : block.content;
}

export function periodReferenceContract(expr: Extract<Expr, { kind: 'period_path' }>) {
  const path = [expr.head, ...expr.series].join('.');
  // Segment equality matters: a quoted literal key containing a dot is not a registered series.
  const entry = PERIOD_SERIES.find(candidate => candidate.path === path
    && candidate.path.split('.').length === expr.series.length + 1);
  const key = parsePeriodSelector(expr.selector);
  if (!entry || !key) throw new CalcError('CALC-PERIOD-001', `Invalid period reference ${path}@${expr.selector}.`);
  return { entry, key, path };
}

export function resolvePeriodReference(parsed: ParsedUWFile, expr: Extract<Expr, { kind: 'period_path' }>, options: PeriodResolutionOptions = {}): unknown {
  const { entry, key, path } = periodReferenceContract(expr);
  if ([expr.head, ...expr.series, ...expr.segments].some(isBlockedSegment)) return null;
  const block = periodSection(parsed, expr.head, options);
  if (!block) return null;
  const payload = periodPayload(block);
  let series: unknown = payload;
  for (const segment of expr.series) series = getPathSegment(series, segment);
  if (series === null || series === undefined) return null;
  const scan = scanPeriodSeries(entry, series, payload);
  if (scan.duplicates.length) throw new CalcError('CALC-PERIOD-002', `Duplicate periods in ${path}: ${scan.duplicates.join(', ')}.`);
  if (scan.invalid.length) throw new CalcError('CALC-PERIOD-001', `Malformed periods in ${path}: ${scan.invalid.join(', ')}.`);
  if (!periodKindMatches(entry, key, payload)) return null;
  let value = scan.rows.get(periodKeyIdentity(key))?.value;
  for (const segment of expr.segments) value = getPathSegment(value, segment);
  return value ?? null;
}

/** Resolve one contextual reference; does not reserve @ in generic object paths. */
export function resolvePeriodPath(parsed: ParsedUWFile, path: string, options: PeriodResolutionOptions = {}): unknown {
  const expr = parseExpression(path);
  if (expr.kind !== 'period_path') throw new CalcError('CALC-PERIOD-001', 'Expected one period reference, not an expression.');
  return resolvePeriodReference(parsed, expr, options);
}


/** Project a complete selected series for contextual workbook binding (RFC 0043). */
export function resolvePeriodColumn(parsed: ParsedUWFile, reference: string, options: PeriodResolutionOptions = {}): PeriodColumnSnapshot {
  const expr = parseExpression(reference);
  if (expr.kind !== 'period_path') throw new CalcError('CALC-PERIOD-001', 'Expected a period reference.');
  const { entry, key, path } = periodReferenceContract(expr);
  const result: PeriodColumnSnapshot = { reference: periodReferencePath(expr), series_path: path,
    variant: null, selector_identity: periodKeyIdentity(key), rows: [] };
  const block = periodSection(parsed, expr.head, options);
  if (!block) return result;
  result.variant = block.annotation.variant ?? null;
  const payload = periodPayload(block);
  let series: unknown = payload;
  for (const segment of expr.series) series = getPathSegment(series, segment);
  const scan = scanPeriodSeries(entry, series, payload);
  if (scan.duplicates.length) throw new CalcError('CALC-PERIOD-002', `Duplicate periods in ${path}: ${scan.duplicates.join(', ')}.`);
  if (scan.invalid.length) throw new CalcError('CALC-PERIOD-001', `Malformed periods in ${path}: ${scan.invalid.join(', ')}.`);
  const blocked = [expr.head, ...expr.series, ...expr.segments].some(isBlockedSegment);
  result.rows = [...scan.rows].map(([identity, row]) => {
    let value: unknown = row.value;
    for (const segment of expr.segments) value = getPathSegment(value, segment);
    return { identity, value: blocked ? null : value ?? null };
  });
  return result;
}
