import { describe, expect, it } from 'vitest';
import { emitCalcExcelFormula, emitExcelFormula, ExcelEmitError } from './excel-emit.js';

// Names every plain object inherits from Object.prototype (or that address it).
const INHERITED = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'] as const;
const opts = { namedRanges: new Map([['noi', 'NOI']]) };

const refusalCode = (emit: () => string): string | undefined => {
  try {
    emit();
  } catch (error) {
    if (error instanceof ExcelEmitError) return error.code;
    throw error;
  }
  return undefined;
};

describe('Excel emitter maps own builtin entries only', () => {
  it('still maps a builtin', () => {
    expect(emitExcelFormula('abs(noi)', opts)).toBe('ABS(NOI)');
  });

  it.each(INHERITED)('refuses function %s with EXCEL-EMIT-FN', (name) => {
    expect(refusalCode(() => emitExcelFormula(`${name}(noi)`, opts))).toBe('EXCEL-EMIT-FN');
    expect(refusalCode(() => emitCalcExcelFormula({ formula: `${name}(noi)` }, opts))).toBe('EXCEL-EMIT-FN');
    expect(refusalCode(() => emitCalcExcelFormula({ formula: `1 + ${name}(noi)` }, opts))).toBe('EXCEL-EMIT-FN');
  });

  it.each(INHERITED)('rounds a declaration with unit %s at the global default', (unit) => {
    expect(emitCalcExcelFormula({ formula: '1.23456789', unit }, opts)).toBe('ROUND(1.23456789,6)');
  });
});
