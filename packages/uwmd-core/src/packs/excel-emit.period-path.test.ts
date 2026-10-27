// RFC 0041 contextual references and the Excel emitter (a starter product).
// The references themselves are @uwmd/verify's (period-path.test.ts there);
// this case moved here with the emitter (RFC 0083).
import { describe, expect, it } from 'vitest';
import { parseExpression, periodReferencePath, type PeriodExcelBinding } from '@uwmd/verify';
import { emitFromAst } from './excel-emit.js';

describe('RFC 0041 contextual references', () => {
  it('refuses Excel emission explicitly even if a caller offers a static named range', () => {
    const path = 'dcf.annual_cash_flows@Y3.noi';
    expect(() => emitFromAst(parseExpression(path), { namedRanges: new Map([[path, 'noi_y3']]) })).toThrowError(expect.objectContaining({ code: 'EXCEL-EMIT-PATH' }));
  });
});


describe('contextual workbook name boundaries', () => {
  const expression = parseExpression('dcf.annual_cash_flows@Y3.noi');
  if (expression.kind !== 'period_path') throw new Error('Synthetic control requires a period reference');
  const path = periodReferencePath(expression);
  it('emits missing, nonnumeric and identity guards for trusted override/series bindings', () => {
    const override = emitFromAst(expression, { namedRanges: new Map(), periodBindings: new Map<string, PeriodExcelBinding>([
      [path, { kind: 'override', value_range: 'QA_VALUE' }],
    ]) });
    expect(override).toContain('ISBLANK(QA_VALUE)');
    expect(override).toContain('NA()');
    expect(override).toContain('Non-numeric period value');
    const series = emitFromAst(expression, { namedRanges: new Map(), periodBindings: new Map<string, PeriodExcelBinding>([
      [path, { kind: 'series', keys_range: 'QA_KEYS', values_range: 'QA_VALUES', valid_range: 'QA_VALID' }],
    ]) });
    expect(series).toContain('QA_VALID<>1');
    expect(series).toContain('COUNTIF(QA_KEYS,');
    expect(series).toContain('MATCH(');
    expect(series).toContain('Non-numeric period value');
  });
  it('refuses cell addresses and formula text offered as workbook names', () => {
    for (const value_range of ['A1', 'R1C1', 'R', 'C', 'A1+1', 'bad name', 'x'.repeat(256)]) {
      expect(() => emitFromAst(expression, { namedRanges: new Map(), periodBindings: new Map<string, PeriodExcelBinding>([
        [path, { kind: 'override', value_range }],
      ]) })).toThrowError(expect.objectContaining({ code: 'EXCEL-EMIT-PATH' }));
    }
  });
});
