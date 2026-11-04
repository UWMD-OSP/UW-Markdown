// RFC 0131 is proposed, not implemented. Expected-failure assertions execute
// its acceptance gates against current code; green CI is not support evidence.
import { describe, expect, it } from 'vitest';
import { deriveOperatingStatement } from './opstatement.js';

const value = (input: Record<string, unknown>, path: string) =>
  deriveOperatingStatement(input).fields.find(field => field.path === path)?.value;

describe('RFC 0131 proposed acceptance gates', () => {
  it.fails('does not replace an authored aggregate-only expense subtotal with zero', () => {
    const input = { income: { gross_potential_rent: 120000, other_income: { total: 12000 } },
      expenses: { utilities: { total: 6000 }, total_operating_expenses: 30000 }, net_operating_income: 102000 };
    const before = structuredClone(input);
    const derived = deriveOperatingStatement(input);
    expect(input).toEqual(before);
    // Omitting a replacement field is sufficient to preserve the authored value.
    const replacements = Object.fromEntries(derived.fields.map(field => [field.path, field.value]));
    expect(replacements['expenses.total_operating_expenses'] ?? input.expenses.total_operating_expenses).toBe(30000);
  });

  it.fails('does not derive a numeric zero NOI from an entirely missing statement', () => {
    expect(value({}, 'net_operating_income')).toBeUndefined();
  });
});
