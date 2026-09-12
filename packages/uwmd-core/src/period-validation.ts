import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';
import { PERIOD_SERIES } from './protocol.js';
import { getPathSegment } from './parser.js';
import { parseExpression, periodReferencePath } from './calc/parser.js';
import { getPeriodReferences } from './calc/dependencies.js';
import { parsePeriodSelector, periodKindMatches, scanPeriodSeries } from './periods.js';
import { periodPayload, periodSection } from './period-path.js';

/** Structural inspection covers every active variant, not only the selected statement. */
export function checkPeriodSeries(parsed: ParsedUWFile, issues: ValidationMessage[]): void {
  for (const entry of PERIOD_SERIES) {
    const [section, ...segments] = entry.path.split('.');
    const stored = parsed.sections[section!];
    if (!stored) continue;
    const blocks: UWBlock[] = 'annotation' in stored ? [stored as UWBlock] : Object.values(stored);
    for (const block of blocks) {
      const payload = periodPayload(block);
      let series: unknown = payload;
      for (const segment of segments) series = getPathSegment(series, segment);
      if (series === undefined || series === null) continue;
      const scan = scanPeriodSeries(entry, series, payload);
      const label = `${entry.path}${block.annotation.variant ? ` variant=${block.annotation.variant}` : ''}`;
      for (const position of scan.invalid) issues.push({
        code: 'PS-01', severity: 'warning', section: section!, field: segments.join('.'),
        message: `PS-01: ${label} has a malformed period or row at ${position}.`, value: position,
      });
      for (const identity of scan.duplicates) issues.push({
        code: 'PS-02', severity: 'error', section: section!, field: segments.join('.'),
        message: `PS-02: ${label} states duplicate period ${identity}.`, value: identity,
      });
    }
  }
  for (const section of ['custom_calculations', 'custom_scenarios'] as const) {
    for (const block of parsed[section]) {
      if (block.meta?.superseded || block.annotation.superseded === true) continue;
      inspectStaticReferences(block.content, section, parsed, issues, new Set<object>(), 0);
    }
  }
}

function inspectStaticReferences(value: unknown, section: string, parsed: ParsedUWFile, issues: ValidationMessage[], seen: Set<object>, depth: number): void {
  if (!value || typeof value !== 'object' || depth > 64 || seen.has(value)) return;
  seen.add(value);
  for (const [field, child] of Object.entries(value)) {
    if (field.startsWith('_')) continue;
    if ((field === 'formula' || field === 'base_formula') && typeof child === 'string') {
      let refs: ReturnType<typeof getPeriodReferences>;
      try { refs = getPeriodReferences(parseExpression(child)); } catch { continue; }
      for (const ref of refs) {
        const path = [ref.head, ...ref.series].join('.');
        const entry = PERIOD_SERIES.find(candidate => candidate.path === path);
        const key = parsePeriodSelector(ref.selector);
        if (!entry || !key) continue;
        let payload: unknown;
        try {
          const block = periodSection(parsed, ref.head);
          payload = block ? periodPayload(block) : undefined;
        } catch { continue; } // A static reference cannot choose an ambiguous runtime variant.
        if (!periodKindMatches(entry, key, payload)) issues.push({
          code: 'PS-03', severity: 'warning', section, field,
          message: `PS-03: ${periodReferencePath(ref)} uses a period kind incompatible with ${entry.path}.`,
        });
      }
    } else inspectStaticReferences(child, section, parsed, issues, seen, depth + 1);
  }
}
