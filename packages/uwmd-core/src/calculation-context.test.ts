import { describe, it, expect } from 'vitest';
import { parseCalculationContext } from './calculation-context.js';

describe('calculation context transport', () => {
  it('preserves exact paths, variants, zeros, nulls and other JSON scalars', () => {
    const input = JSON.parse('{"sectionVariants":{"dcf":"retail"},"overrides":{"dcf.annual_cash_flows@Y3.noi":0,"property.total_units":null,"label":"x","flag":false,"__proto__":17}}');
    const output = parseCalculationContext(input);
    expect(output).toEqual(input);
    expect(Object.getPrototypeOf(output.overrides)).toBeNull();
    expect(output.overrides!['__proto__']).toBe(17);
    expect(output.overrides).not.toBe(input.overrides);
  });
  it('accepts empty contexts and null-prototype JSON objects', () => {
    expect(parseCalculationContext({})).toEqual({});
    expect(parseCalculationContext(Object.create(null))).toEqual({});
    expect(parseCalculationContext({ overrides: {}, sectionVariants: {} })).toEqual({ overrides: {}, sectionVariants: {} });
  });
  it.each([null, [], 3, 'x', Object.create({ overrides: {} }), { locale: 'en-US' }, { overrides: null },
    { overrides: [] }, { overrides: { x: [] } }, { overrides: { x: {} } }, { overrides: { x: Infinity } },
    { overrides: { x: undefined } }, { overrides: { ' ': 0 } }, { sectionVariants: [] },
    { sectionVariants: { dcf: '' } }, { sectionVariants: { dcf: 3 } }, { sectionVariants: { typo: 'base' } }])(
    'refuses invalid transport %j', value => {
      expect(() => parseCalculationContext(value)).toThrow('CALC-TYPE-001');
    });
});
