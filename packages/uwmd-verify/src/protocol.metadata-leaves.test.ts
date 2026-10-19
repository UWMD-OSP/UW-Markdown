import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';

const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8'));
const timestamp = schema.$defs.UWMeta.properties.provenance.properties.timestamp;
const rfc = readFileSync(new URL('../../../docs/rfcs/0094-present-invalid-metadata-leaves.md', import.meta.url), 'utf8');
const vectors = rfc.split(/\r?\n/).flatMap(line => {
  const row = /^\| ([^|]+) \| `(.*)` \| (admit|META-04) \|$/.exec(line);
  return row ? [{ name: row[1]!, value: JSON.parse(row[2]!), valid: row[3] === 'admit' }] : [];
});

// Test the declared schema with formats enabled and disabled. The exact pattern
// must supply the accepted domain even when the consumer treats format as annotation.
for (const formats of [false, true]) {
  const ajv = new Ajv2020({ strict: false, validateFormats: formats });
  if (formats) addFormats.default(ajv);
  const validate = ajv.compile(timestamp);
  describe(`RFC0094 schema T1B (format assertions ${formats})`, () => {
    it('matches all60 independently reviewed positive/negative RFC controls', () => {
      expect(vectors).toHaveLength(60);
      expect(vectors.filter(v => v.valid)).toHaveLength(11);
      for (const vector of vectors) expect(validate(vector.value), vector.name).toBe(vector.valid);
    });
    it('has exact Gregorian boundaries throughout four century cycles', () => {
      for (const start of [0, 1600, 2000, 9600]) {
        for (let year = start; year < start + 400; year++) {
          const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
          const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          const y = String(year).padStart(4, '0');
          for (let month = 1; month <= 12; month++) {
            const prefix = `${y}-${String(month).padStart(2, '0')}-`;
            expect(validate(`${prefix}${days[month - 1]}T23:59:59.0001Z`)).toBe(true);
            expect(validate(`${prefix}${days[month - 1]! + 1}T00:00:00Z`)).toBe(false);
          }
        }
      }
    });
  });
}

it('registers the accepted closed META04 without broadening prior codes', () => {
  expect(BUILTIN_REMEDIATIONS.filter(r => r.code === 'META-04')).toHaveLength(1);
  const row = BUILTIN_REMEDIATIONS.find(r => r.code === 'META-04')!;
  expect(row.severity).toBe('error');
  expect(row.description).toContain('confidence');
  expect(row.description).toContain('revision');
  expect(row.description).toContain('timestamp');
  for (const code of ['META-01', 'META-02', 'META-03']) expect(BUILTIN_REMEDIATIONS.find(r => r.code === code)).toBeDefined();
});
