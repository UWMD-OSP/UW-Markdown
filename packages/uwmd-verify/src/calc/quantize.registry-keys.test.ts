import { describe, expect, it } from 'vitest';
import { parseUWFile } from '../parser.js';
import type { CalcEvaluationContext } from '../protocol.js';
import { evaluateCalc } from './index.js';
import { DEFAULT_ROUND_TO, resolveRoundTo } from './quantize.js';

// Names every plain object inherits from Object.prototype (or that address it).
const INHERITED = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'] as const;

const ctx: CalcEvaluationContext = {
  parsed: parseUWFile(['---', 'uw_version: "3.0"', 'asset_class: multifamily', '---', ''].join('\n')),
  prior_results: {},
  locale: 'en-US',
};

describe('resolveRoundTo reads listed unit defaults only', () => {
  it('still applies a listed unit default', () => {
    expect(resolveRoundTo({ unit: '$' })).toBe(2);
  });

  it.each(INHERITED)('falls back to the global default for unit %s', (unit) => {
    expect(DEFAULT_ROUND_TO).toBe(6);
    expect(resolveRoundTo({ unit })).toBe(DEFAULT_ROUND_TO);
  });

  it.each(INHERITED)('evaluates a calculation with unit %s at the global default', (unit) => {
    const result = evaluateCalc({ id: 'x', label: 'x', deterministic: true, formula: '1.23456789', unit }, ctx);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1.234568);
  });
});
