import { describe, expect, it } from 'vitest';
import {
  MAX_SENSITIVITY_AXIS,
  MAX_SENSITIVITY_CELLS,
  evaluateSensitivity,
  isSensitivityDecl,
  type SensitivityDecl,
} from './sensitivity.js';
import { evaluateCalc } from './index.js';
import type { CalcEvaluationContext } from '../protocol.js';
import type { ParsedUWFile, UWBlock } from '../types.js';

function block(sectionId: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: { section_id: sectionId, content },
    meta: {} as UWBlock['meta'],
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

const PARSED: ParsedUWFile = {
  frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
  sections: {
    noi_model: block('noi_model', { net_operating_income: 600_000 }),
    dcf: block('dcf', { exit_cap_rate: 0.06 }),
    debt_structure: block('debt_structure', { loan_amount: 7_500_000 }),
  },
  prose: {},
  pipeline_log: [],
  custom_calculations: [],
  custom_scenarios: [],
  extensions: {},
  superseded: {},
  raw: '',
};

const CTX: CalcEvaluationContext = { parsed: PARSED, prior_results: {}, locale: 'en-US' };

/** Value at exit cap `c` with NOI grown by `g`: 600,000 x (1+g) / c. */
const BASE: SensitivityDecl = {
  id: 'exit_value_sensitivity',
  label: 'Exit Value',
  base_formula: 'noi_model.net_operating_income * (1 + assumptions.rent_growth) / dcf.exit_cap_rate',
  row_axis: { variable: 'dcf.exit_cap_rate', values: [0.05, 0.06, 0.07] },
  col_axis: { variable: 'assumptions.rent_growth', values: [0.0, 0.02] },
  unit: '$',
  round_to: 2,
};

describe('overrides in the evaluator', () => {
  it('shadows a document value at the exact dotted path', () => {
    const result = evaluateCalc(
      { id: 'cap', label: 'cap', formula: 'dcf.exit_cap_rate', deterministic: true },
      { ...CTX, overrides: { 'dcf.exit_cap_rate': 0.09 } },
    );
    expect(result.value).toBe(0.09);
  });

  it('does not shadow siblings under the same head', () => {
    const result = evaluateCalc(
      { id: 'noi', label: 'noi', formula: 'noi_model.net_operating_income', deterministic: true },
      { ...CTX, overrides: { 'dcf.exit_cap_rate': 0.09 } },
    );
    expect(result.value).toBe(600_000);
  });

  it('lets an override be null, meaning "treat this as absent"', () => {
    // `undefined` means no override; `null` is a legitimate override value.
    // Collapsing the two would make it impossible to ask what a formula does
    // when an input goes missing.
    const result = evaluateCalc(
      { id: 'cap', label: 'cap', formula: 'dcf.exit_cap_rate * 2', deterministic: true },
      { ...CTX, overrides: { 'dcf.exit_cap_rate': null } },
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBeNull();
  });

  it('overrides a bare identifier too', () => {
    const result = evaluateCalc(
      { id: 'ac', label: 'ac', formula: 'asset_class', deterministic: true },
      { ...CTX, overrides: { asset_class: 'office' } },
    );
    expect(result.value).toBe('office');
  });
});

describe('evaluateSensitivity', () => {
  it('produces a grid whose shape matches the declared axes', () => {
    const result = evaluateSensitivity(BASE, CTX);
    expect(result.ok).toBe(true);
    expect(result.grid).toHaveLength(3);
    expect(result.grid?.every((row) => row.length === 2)).toBe(true);
  });

  it('computes each cell from both axis values', () => {
    const result = evaluateSensitivity(BASE, CTX);
    // row 0 (cap 5%), col 0 (growth 0%): 600,000 / 0.05
    expect(result.grid?.[0]?.[0]).toEqual({ ok: true, value: 12_000_000 });
    // row 2 (cap 7%), col 1 (growth 2%): 612,000 / 0.07
    expect(result.grid?.[2]?.[1]).toEqual({ ok: true, value: 8_742_857.14 });
  });

  it('does not mutate the document — the base value survives the sweep', () => {
    evaluateSensitivity(BASE, CTX);
    const after = evaluateCalc(
      { id: 'cap', label: 'cap', formula: 'dcf.exit_cap_rate', deterministic: true },
      CTX,
    );
    expect(after.value).toBe(0.06);
  });

  it('records a failing cell in place and keeps the rest of the grid', () => {
    // A table where one combination divides by zero is still a useful table;
    // failing the whole thing would hide the cells that worked.
    const withZero: SensitivityDecl = {
      ...BASE,
      row_axis: { variable: 'dcf.exit_cap_rate', values: [0.05, 0] },
    };
    const result = evaluateSensitivity(withZero, CTX);
    expect(result.ok).toBe(true);
    expect(result.failed_cells).toBe(2);
    expect(result.grid?.[0]?.[0]?.ok).toBe(true);
    const failed = result.grid?.[1]?.[0];
    expect(failed?.ok).toBe(false);
    expect(failed?.ok === false && failed.error.code).toBe('CALC-DIV-ZERO');
  });

  it('reports zero failed cells on a clean grid', () => {
    expect(evaluateSensitivity(BASE, CTX).failed_cells).toBe(0);
  });

  it('quantizes every cell to the declared round_to', () => {
    const result = evaluateSensitivity({ ...BASE, round_to: 0 }, CTX);
    expect(result.round_to).toBe(0);
    expect(result.grid?.[2]?.[1]).toEqual({ ok: true, value: 8_742_857 });
  });

  it('layers axis overrides on top of any the caller already supplied', () => {
    const result = evaluateSensitivity(BASE, {
      ...CTX,
      overrides: { 'noi_model.net_operating_income': 1_200_000 },
    });
    // 1,200,000 / 0.05 — the caller's override survives, the axes win on their
    // own paths.
    expect(result.grid?.[0]?.[0]).toEqual({ ok: true, value: 24_000_000 });
  });
});

describe('evaluateSensitivity — refusals', () => {
  const refuse = (decl: SensitivityDecl) => {
    const result = evaluateSensitivity(decl, CTX);
    expect(result.ok).toBe(false);
    return result.error?.code;
  };

  it('refuses an axis with fewer than two values', () => {
    // One value is not a sweep, and zero is not a table. Refusing beats a
    // degenerate 1xN grid every consumer then special-cases.
    expect(refuse({ ...BASE, row_axis: { variable: 'dcf.exit_cap_rate', values: [0.05] } })).toBe(
      'CALC-SENS-002',
    );
  });

  it('refuses a non-finite axis value', () => {
    expect(
      refuse({ ...BASE, col_axis: { variable: 'assumptions.rent_growth', values: [0, Number.NaN] } }),
    ).toBe('CALC-SENS-002');
  });

  it('refuses a missing axis variable', () => {
    expect(refuse({ ...BASE, row_axis: { variable: '', values: [1, 2] } })).toBe('CALC-SENS-001');
  });

  it('refuses two axes varying the same variable', () => {
    // The second override silently wins for every cell, producing a grid whose
    // rows are identical and whose reader cannot see why.
    expect(
      refuse({ ...BASE, col_axis: { variable: 'dcf.exit_cap_rate', values: [0.05, 0.06] } }),
    ).toBe('CALC-SENS-004');
  });

  it('refuses a grid over the cell limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(
      refuse({
        ...BASE,
        row_axis: { variable: 'dcf.exit_cap_rate', values: many },
        col_axis: { variable: 'assumptions.rent_growth', values: many },
      }),
    ).toBe('CALC-SENS-003');
    expect(20 * 20).toBeGreaterThan(MAX_SENSITIVITY_CELLS);
  });

  it('refuses a long single axis, so a 1xN strip is no cheaper than a square', () => {
    const many = Array.from({ length: MAX_SENSITIVITY_AXIS + 1 }, (_, i) => i + 1);
    expect(refuse({ ...BASE, row_axis: { variable: 'dcf.exit_cap_rate', values: many } })).toBe(
      'CALC-SENS-003',
    );
  });

  it('refuses an out-of-range round_to', () => {
    expect(refuse({ ...BASE, round_to: 99 })).toBe('CALC-SENS-005');
    expect(refuse({ ...BASE, round_to: 1.5 })).toBe('CALC-SENS-005');
  });

  it('carries a pointer on every refusal', () => {
    const result = evaluateSensitivity({ ...BASE, round_to: 99 }, CTX);
    expect(result.error?.pointer).toBe('round_to');
  });
});

describe('isSensitivityDecl', () => {
  it('recognizes a sensitivity declaration', () => {
    expect(isSensitivityDecl(BASE)).toBe(true);
  });

  it('does not mistake a scalar calc for one', () => {
    expect(isSensitivityDecl({ id: 'x', label: 'X', formula: '1', deterministic: true })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isSensitivityDecl(null)).toBe(false);
    expect(isSensitivityDecl('base_formula')).toBe(false);
  });
});
