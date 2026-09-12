import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { parseUWFile, resolvePeriodColumn, emitExcelFormula } from '@uwmd/core';
import type { UWBlock, PeriodExcelBinding } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import { fromWorkbook } from './fromWorkbook.js';

const source = readFileSync(
  new URL(
    '../../../conformance/tier-3-calc-host/fixtures/period-01-year-order/deal.uwx.md',
    import.meta.url
  ),
  'utf8'
);
const P = 'dcf.annual_cash_flows@Y3.noi';
function file(formulas: string[] = [P]) {
  const parsed = parseUWFile(source);
  const template = parsed.sections['dcf'] as UWBlock;
  parsed.custom_calculations = formulas.map((formula, i) => ({
    ...template,
    annotation: { section: 'custom_calculations' },
    content: { id: `custom_${i}`, label: `Custom ${i}`, formula, round_to: 6 },
  }));
  return parsed;
}
const options = (formulas: string[]) => ({ calculations: formulas.map((_, i) => `custom_${i}`) });
function formula(cell: ExcelJS.Cell): string {
  return (cell.value as ExcelJS.CellFormulaValue).formula;
}

describe('RFC 0043 contextual workbook export', () => {
  it('preserves default workbook shape and creates explicit calculation bindings only on request', async () => {
    const parsed = file();
    expect((await toWorkbook(parsed)).getWorksheet('Custom Calculations')).toBeUndefined();
    const wb = await toWorkbook(parsed, { calculations: ['custom_0'] });
    expect(wb.getWorksheet('Periods DCF')).toBeDefined();
    expect(formula(wb.getWorksheet('Custom Calculations')!.getCell('C6'))).toContain(
      'MATCH("year:3",uwp_keys_1,0)'
    );
    expect(formula(wb.getWorksheet('Custom Calculations')!.getCell('C6'))).toMatch(/^ROUND\(/);
    expect(wb.getWorksheet('Periods DCF')!.getCell('A6').value).toBe('year:3');
    expect(wb.getWorksheet('Periods DCF')!.getCell('B6').value).toBe(300);
    expect(wb.definedNames.getRanges('uwp_keys_1').ranges[0]).toContain('$A$6:$A$7');
    const copy = new ExcelJS.Workbook();
    await copy.xlsx.load(
      (await wb.xlsx.writeBuffer()) as unknown as Parameters<typeof copy.xlsx.load>[0]
    );
    expect(formula(copy.getWorksheet('Custom Calculations')!.getCell('C6'))).toContain('COUNTIF');
    expect(() => fromWorkbook(copy)).toThrowError(
      expect.objectContaining({ code: 'WORKBOOK-IMPORT-UNSUPPORTED-SHAPE' })
    );
  });

  it('exports all five series and reuses a column across selected periods', async () => {
    const formulas = [
      P,
      'dcf.annual_cash_flows@Y1.noi',
      'noi_model.projections@Y3.projected_noi',
      'lease_up_schedule.schedule@2028-Q1.noi',
      'cash_flow_series.series@2028-02-29.amount',
      'distribution_waterfall.stated_schedule@2028-02-29.lp_distribution',
    ];
    const wb = await toWorkbook(file(formulas), options(formulas));
    for (const name of [
      'Periods DCF',
      'Periods NOI',
      'Periods Lease Up',
      'Periods Cash Flow',
      'Periods Waterfall',
    ])
      expect(wb.getWorksheet(name)).toBeDefined();
    expect(wb.getWorksheet('Periods DCF')!.getRow(5).getCell(2).value).toBe('noi');
    expect(wb.getWorksheet('Periods DCF')!.getRow(5).getCell(3).value).toBe('Identity valid');
  });

  it('preserves full identity when rows move and refuses aliases that duplicate a keyed year', async () => {
    const parsed = file();
    const dcf = parsed.sections['dcf'] as UWBlock;
    (dcf.content['annual_cash_flows'] as unknown[]).reverse();
    const wb = await toWorkbook(parsed, { calculations: ['custom_0'] });
    expect(wb.getWorksheet('Periods DCF')!.getCell('A6').value).toBe('year:1');
    expect(formula(wb.getWorksheet('Custom Calculations')!.getCell('C6'))).toContain(
      'MATCH("year:3",uwp_keys_1,0)'
    );
    const keyFile = file(['noi_model.projections@Y3.amount']);
    (keyFile.sections['noi_model'] as UWBlock).content['projections'] = {
      year_3: { amount: 1 },
      year_03: { amount: 2 },
    };
    await expect(toWorkbook(keyFile, { calculations: ['custom_0'] })).rejects.toThrow(
      'CALC-PERIOD-002'
    );
  });

  it.each([{}, [{ year: 3 }, { year: 0 }], [{ year: 3 }, { year: 3 }]])(
    'refuses malformed or duplicate source periods',
    async (rows) => {
      const parsed = file();
      (parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] = rows;
      await expect(toWorkbook(parsed, { calculations: ['custom_0'] })).rejects.toThrow(
        /CALC-PERIOD-00[12]/
      );
    }
  );

  it('selects generic primary and explicit component variants', async () => {
    const parsed = file();
    const original = parsed.sections['dcf'] as UWBlock;
    const main = {
      ...original,
      annotation: { ...original.annotation, variant: 'main' },
      content: { _role: 'primary', annual_cash_flows: [{ year: 3, noi: 300 }] },
    };
    const retail = {
      ...original,
      annotation: { ...original.annotation, variant: 'retail' },
      content: { _role: 'component', annual_cash_flows: [{ year: 3, noi: 30 }] },
    };
    parsed.sections['dcf'] = { retail, main };
    expect(
      (await toWorkbook(parsed, { calculations: ['custom_0'] }))
        .getWorksheet('Periods DCF')!
        .getCell('B6').value
    ).toBe(300);
    expect(
      (
        await toWorkbook(parsed, {
          calculations: ['custom_0'],
          calculationContext: { sectionVariants: { dcf: 'retail' } },
        })
      )
        .getWorksheet('Periods DCF')!
        .getCell('B6').value
    ).toBe(30);
    await expect(
      toWorkbook(parsed, {
        calculations: ['custom_0'],
        calculationContext: { sectionVariants: { dcf: 'absent' } },
      })
    ).rejects.toThrow('CALC-PERIOD-003');
  });

  it('binds zero and null overrides without consulting invalid document series', async () => {
    for (const value of [0, null]) {
      const parsed = file();
      (parsed.sections['dcf'] as UWBlock).content['annual_cash_flows'] = [{ year: 3 }, { year: 3 }];
      const wb = await toWorkbook(parsed, {
        calculations: ['custom_0'],
        calculationContext: { overrides: { [P]: value } },
      });
      expect(wb.getWorksheet('Periods DCF')).toBeUndefined();
      expect(wb.getWorksheet('Calculation Inputs')!.getCell('B6').value).toBe(value);
      expect(formula(wb.getWorksheet('Custom Calculations')!.getCell('C6'))).toContain(
        'ISBLANK(uwc_raw_6)'
      );
    }
    const bad = 'dcf.unregistered@Y3.noi';
    await expect(
      toWorkbook(file([bad]), {
        calculations: ['custom_0'],
        calculationContext: { overrides: { [bad]: 0 } },
      })
    ).rejects.toThrow('CALC-PERIOD-001');
  });

  it('exports empty/missing series with a valid empty identity set and missing lookup guards', async () => {
    const parsed = file();
    delete parsed.sections['dcf'];
    const wb = await toWorkbook(parsed, { calculations: ['custom_0'] });
    expect(formula(wb.getWorksheet('Periods DCF')!.getCell('B4'))).toBe('IF(COUNTA(A6:A6)=0,1,0)');
    expect(formula(wb.getWorksheet('Custom Calculations')!.getCell('C6'))).toContain('=0,NA()');
  });

  it('keeps literal dotted and @ leaves separate from nested fields and preserves unrounded scalar inputs', async () => {
    const formulas = [
      "dcf.annual_cash_flows@Y3['tax.rate'] + dcf.annual_cash_flows@Y3.tax.rate",
      "dcf.annual_cash_flows@Y3['x@y'] + dcf.scalar",
    ];
    const parsed = file(formulas);
    const dcf = parsed.sections['dcf'] as UWBlock;
    dcf.content['annual_cash_flows'] = [
      { year: 3, 'tax.rate': 0.03, tax: { rate: 0.04 }, 'x@y': 7 },
    ];
    dcf.content['scalar'] = 0.1234567890123;
    const before = JSON.stringify(parsed);
    const wb = await toWorkbook(parsed, options(formulas));
    expect(wb.getWorksheet('Periods DCF')!.getCell('B6').value).toBe(0.03);
    expect(wb.getWorksheet('Periods DCF')!.getCell('C6').value).toBe(0.04);
    expect(wb.getWorksheet('Periods DCF')!.getCell('D6').value).toBe(7);
    expect(wb.getWorksheet('Calculation Inputs')!.getCell('B6').value).toBe(0.1234567890123);
    expect(JSON.stringify(parsed)).toBe(before);
  });

  it('supports absolute monthly keys and preserves nonnumeric values for explicit Excel errors', async () => {
    const parsed = file(['lease_up_schedule.schedule@2028-01.noi']);
    const block = (parsed.sections['lease_up_schedule'] as Record<string, UWBlock>)['base']!;
    block.content = {
      period_granularity: 'monthly',
      schedule: [{ period: '2028-01', noi: 'unknown' }],
    };
    const wb = await toWorkbook(parsed, { calculations: ['custom_0'] });
    expect(wb.getWorksheet('Periods Lease Up')!.getCell('A6').value).toBe('month:2028:1');
    expect(wb.getWorksheet('Periods Lease Up')!.getCell('B6').value).toBe('unknown');
    expect(formula(wb.getWorksheet('Custom Calculations')!.getCell('C6'))).toContain(
      'VALUE("Non-numeric period value")'
    );
  });

  it.each(['sum(dcf.annual_cash_flows@Y3.noi, 1)', '1 > 0', 'null', 'true', "'text'"])(
    'explicitly refuses unsupported custom expression %s',
    async (expr) => {
      await expect(toWorkbook(file([expr]), { calculations: ['custom_0'] })).rejects.toThrowError(
        expect.objectContaining({ code: 'EXCEL-EMIT-PATH' })
      );
    }
  );

  it('refuses missing and duplicate IDs and ambiguous ordinary path aliases', async () => {
    await expect(toWorkbook(file(), { calculations: ['absent'] })).rejects.toThrow('exactly one');
    const parsed = file();
    parsed.custom_calculations.push(parsed.custom_calculations[0]!);
    await expect(toWorkbook(parsed, { calculations: ['custom_0'] })).rejects.toThrow('exactly one');
    await expect(
      toWorkbook(file(["dcf['literal.dot'] + dcf.literal.dot"]), { calculations: ['custom_0'] })
    ).rejects.toThrow('Ambiguous ordinary path');
  });
});

describe('period column and trusted emitter contracts', () => {
  it('projects every row through safe literal traversal without quantization', () => {
    const parsed = file();
    (parsed.sections['dcf'] as UWBlock).content = {
      content: {
        annual_cash_flows: [
          { year: 3, 'tax.rate': 0.123456789 },
          { year: 1, 'tax.rate': null },
        ],
      },
    };
    expect(resolvePeriodColumn(parsed, "dcf.annual_cash_flows@Y3['tax.rate']")).toMatchObject({
      reference: "dcf.annual_cash_flows@Y3['tax.rate']",
      selector_identity: 'year:3',
      rows: [
        { identity: 'year:3', value: 0.123456789 },
        { identity: 'year:1', value: null },
      ],
    });
    expect(
      resolvePeriodColumn(parsed, 'dcf.annual_cash_flows@Y3.__proto__').rows.every(
        (row) => row.value === null
      )
    ).toBe(true);
  });
  it('refuses ordinary named-range substitution and invalid contextual names', () => {
    expect(() => emitExcelFormula(P, { namedRanges: new Map([[P, 'static_noi']]) })).toThrow(
      'contextual'
    );
    for (const value of ['A1', 'Sheet!A1', '1+2', 'bad name']) {
      const binding: PeriodExcelBinding = { kind: 'override', value_range: value };
      expect(() =>
        emitExcelFormula(P, { namedRanges: new Map(), periodBindings: new Map([[P, binding]]) })
      ).toThrow('workbook names');
    }
  });
});
