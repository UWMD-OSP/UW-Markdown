import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGapInstant, ValidationClockError } from './gap-instant.js';
import { checkDataQuality } from './validator.js';
import type { ParsedUWFile } from './types.js';
const controls = JSON.parse(readFileSync(new URL('../../../conformance/data-quality/0122-instants.json', import.meta.url), 'utf8')) as Array<{ input: unknown; milliseconds: number | null }>;
const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/section-gaps.schema.json', import.meta.url), 'utf8'));
const pattern = new RegExp(schema.properties.items.items.properties.last_checked.pattern);
describe('RFC 0122 instants', () => {
  it.each(controls)('admits exactly $input', ({ input, milliseconds }) => {
    expect(parseGapInstant(input)).toBe(milliseconds);
    if (typeof input === 'string') expect(pattern.test(input)).toBe(milliseconds !== null);
  });
  it.each(['', '2026-02-30', '2026-10-01T00:00'])('refuses invalid explicit clock %s even without gaps', now => {
    const parsed = { frontmatter: {}, sections: {} } as ParsedUWFile;
    expect(() => checkDataQuality(parsed, [], { now })).toThrow(ValidationClockError);
    try { checkDataQuality(parsed, [], { now }); } catch (e) { expect(e).toMatchObject({ category: 'validate', code: 'PROTO-VALIDATION-CLOCK' }); }
  });
});
