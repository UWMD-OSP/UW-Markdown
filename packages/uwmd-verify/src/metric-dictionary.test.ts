import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';

const SPEC = fileURLToPath(new URL('../../../spec/metrics/builtin.json', import.meta.url));

describe('BUILTIN_METRIC_DICTIONARY (RFC 0083 §1)', () => {
  it('is spec/metrics/builtin.json, member for member and in order', () => {
    // Regenerate with `npm run gen-metric-dictionary` when this fails.
    const spec = JSON.parse(readFileSync(SPEC, 'utf8')) as unknown;
    expect(BUILTIN_METRIC_DICTIONARY).toStrictEqual(spec);
    expect(JSON.stringify(BUILTIN_METRIC_DICTIONARY)).toBe(JSON.stringify(spec));
  });

  it('is deeply frozen, so no caller can change the definitions', () => {
    expect(Object.isFrozen(BUILTIN_METRIC_DICTIONARY)).toBe(true);
    expect(Object.isFrozen(BUILTIN_METRIC_DICTIONARY.calculations)).toBe(true);
    const first = BUILTIN_METRIC_DICTIONARY.calculations[0]!;
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.asset_classes)).toBe(true);
    expect(Object.isFrozen(first.section_roles)).toBe(true);
    expect(Object.isFrozen(BUILTIN_METRIC_DICTIONARY.size_intensives[0]!.secondary)).toBe(true);
  });
});
