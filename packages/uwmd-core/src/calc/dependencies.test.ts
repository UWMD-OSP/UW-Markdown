import { describe, expect, it } from 'vitest';
import { parseExpression } from './parser.js';
import { extractDependencyGraph, getExprDependencies } from './dependencies.js';
import { MULTIFAMILY_PACK } from '../packs/multifamily.js';
import { parseUWFile } from '../parser.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PARKVIEW = readFileSync(
  resolve(__dirname, '../../../../examples/Parkview-Apts-Glendale-AZ.uwx.md'),
  'utf-8',
);

describe('getExprDependencies', () => {
  it('returns dotted paths for path references', () => {
    const deps = getExprDependencies(parseExpression('noi_model.net_operating_income / valuation.purchase_price'));
    expect(deps.sort()).toEqual(['noi_model.net_operating_income', 'valuation.purchase_price']);
  });

  it('returns bare identifiers', () => {
    const deps = getExprDependencies(parseExpression('a + b * c'));
    expect(deps.sort()).toEqual(['a', 'b', 'c']);
  });

  it('descends into function calls without recording the function name', () => {
    const deps = getExprDependencies(parseExpression('round(rent_roll.gross_potential_rent, 2)'));
    expect(deps).toEqual(['rent_roll.gross_potential_rent']);
  });

  it('handles ternary / conditional expressions', () => {
    const deps = getExprDependencies(parseExpression("debt_structure.io_months > 0 ? rate_pct : 0.05"));
    expect(deps.sort()).toEqual(['debt_structure.io_months', 'rate_pct']);
  });

  it('deduplicates references appearing multiple times', () => {
    const deps = getExprDependencies(parseExpression('x + x * x'));
    expect(deps).toEqual(['x']);
  });
});

describe('extractDependencyGraph — multifamily pack', () => {
  const parsed = parseUWFile(PARKVIEW);
  const g = extractDependencyGraph(parsed, { packs: [MULTIFAMILY_PACK] });

  it('records every calc id', () => {
    expect(g.outputs.size).toBeGreaterThanOrEqual(8);
    expect([...g.outputs.keys()]).toEqual(
      expect.arrayContaining(['cap_rate', 'ltv', 'dscr', 'debt_yield', 'price_per_unit']),
    );
  });

  it('cap_rate depends on noi and purchase price', () => {
    expect(g.outputs.get('cap_rate')).toEqual(
      new Set(['noi_model.net_operating_income', 'valuation.purchase_price']),
    );
  });

  it('reverse map: noi feeds multiple calcs', () => {
    const consumers = g.inputs.get('noi_model.net_operating_income');
    expect(consumers).toBeDefined();
    expect(consumers!.has('cap_rate')).toBe(true);
    expect(consumers!.has('dscr')).toBe(true);
    expect(consumers!.has('debt_yield')).toBe(true);
  });

  it('records the original formula text', () => {
    expect(g.formulas.get('dscr')).toBe('noi_model.net_operating_income / debt_structure.annual_debt_service');
  });

  it('cash_on_cash picks up the deep equity_sponsor path', () => {
    const deps = g.outputs.get('cash_on_cash')!;
    expect(deps.has('sources_uses.sources.equity_sponsor')).toBe(true);
  });
});
