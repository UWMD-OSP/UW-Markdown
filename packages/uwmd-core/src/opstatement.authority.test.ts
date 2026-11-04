import { describe, expect, it } from 'vitest';
import { deriveOperatingStatement } from './opstatement.js';

const value = (input: Record<string, unknown>, path: string) =>
  deriveOperatingStatement(input).fields.find(field => field.path === path)?.value;

describe('RFC 0131 accepted authority and completeness', () => {
  it('does not replace an authored aggregate-only expense subtotal with zero', () => {
    const input = { income: { gross_potential_rent: 120000, other_income: { total: 12000 } },
      expenses: { utilities: { total: 6000 }, total_operating_expenses: 30000 }, net_operating_income: 102000 };
    const before = structuredClone(input);
    const derived = deriveOperatingStatement(input);
    expect(input).toEqual(before);
    // Omitting a replacement field is sufficient to preserve the authored value.
    const replacements = Object.fromEntries(derived.fields.map(field => [field.path, field.value]));
    expect(replacements['expenses.total_operating_expenses'] ?? input.expenses.total_operating_expenses).toBe(30000);
  });

  it('does not derive a numeric zero NOI from an entirely missing statement', () => {
    expect(value({}, 'net_operating_income')).toBeUndefined();
  });
});

const other = { laundry: 1, parking: 0, pet_fees: 2, late_fees: 3, storage: 0, utility_reimbursements: 0, cable_internet: 0, vending: 0, lease_termination_fees: 0, insurance_proceeds: 0, other: 0 };
it('requires every declared member, including explicit zero, before deriving a subtotal', () => {
  expect(value({ income: { other_income: other } }, 'income.other_income.total')).toBe(6);
  for (const absent of [undefined, null, '0', Number.NaN]) {
    const result = deriveOperatingStatement({ income: { other_income: { ...other, other: absent } } });
    expect(result.fields.find(field => field.path === 'income.other_income.total')).toBeUndefined();
    expect(result.unavailable['income.other_income.total']).toBe('incomplete_detail');
  }
});
it('compares signed reporting ties at whole dollars and preserves authored precision', () => {
  const derive = (stated: number, computed: number) => deriveOperatingStatement({ income: { other_income: { ...other, laundry: computed, pet_fees: 0, late_fees: 0, total: stated } } });
  expect(derive(-100.49, -100.5).diagnostics).toContainEqual({ path: 'income.other_income.total', reason: 'aggregate_mismatch', stated: -100.49, computed: -100.5 });
  expect(derive(-100.51, -100.5).diagnostics).toEqual([]);
  expect(value({ income: { other_income: { total: 0 } } }, 'income.other_income.total')).toBe(0);
});
it('propagates missing prerequisites without polluting another statement', () => {
  const sparse = deriveOperatingStatement({ income: { effective_gross_income: 100 } });
  expect(sparse.unavailable.net_operating_income).toBe('incomplete_detail');
  expect(value({ income: { effective_gross_income: 100 }, expenses: { total_operating_expenses: 30 } }, 'net_operating_income')).toBe(70);
});

it('does not mistake a shortened other-income template for its full Format declaration', () => {
  const result = deriveOperatingStatement({ income: { other_income: { laundry: 1, pet_fees: 2, late_fees: 3, other: 0 } } });
  expect(result.fields.find(f => f.path === 'income.other_income.total')).toBeUndefined();
  expect(result.unavailable['income.other_income.total']).toBe('incomplete_detail');
});
