import { describe, expect, it } from 'vitest';
import { collector, numOrNull, roundByKind } from './derived.js';

describe('roundByKind', () => {
  it('rounds currency and counts to whole numbers', () => {
    expect(roundByKind(123.5, 'currency')).toBe(124);
    expect(roundByKind(12.4, 'count')).toBe(12);
  });

  it('uses the precision appropriate to rates and per-square-foot values', () => {
    expect(roundByKind(0.05519, 'rate')).toBe(0.0552);
    expect(roundByKind(18.456, 'psf')).toBe(18.46);
  });
});

describe('collector', () => {
  it('records rounded finite derived fields in insertion order', () => {
    const derived = collector();

    derived.add('totals.revenue', 'Revenue', 'currency', 100.5);
    derived.add('totals.margin', 'Margin', 'rate', 0.05519);

    expect(derived.fields).toEqual([
      { path: 'totals.revenue', label: 'Revenue', kind: 'currency', value: 101 },
      { path: 'totals.margin', label: 'Margin', kind: 'rate', value: 0.0552 },
    ]);
  });

  it('drops partial or invalid values instead of emitting unusable totals', () => {
    const derived = collector();

    derived.add('totals.missing', 'Missing', 'currency', null);
    derived.add('totals.nan', 'NaN', 'currency', Number.NaN);
    derived.add('totals.infinity', 'Infinity', 'currency', Number.POSITIVE_INFINITY);

    expect(derived.fields).toEqual([]);
  });
});

describe('numOrNull', () => {
  it('accepts only finite numeric inputs', () => {
    expect(numOrNull(0)).toBe(0);
    expect(numOrNull(-12.5)).toBe(-12.5);
    expect(numOrNull('12.5')).toBeNull();
    expect(numOrNull(Number.NaN)).toBeNull();
    expect(numOrNull(Number.NEGATIVE_INFINITY)).toBeNull();
    expect(numOrNull(null)).toBeNull();
  });
});
