import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
const bin = fileURLToPath(new URL('../bin/uwmd-excel.mjs', import.meta.url));
const source = readFileSync(
  new URL(
    '../../../conformance/tier-3-calc-host/fixtures/period-01-year-order/deal.uwx.md',
    import.meta.url
  ),
  'utf8'
);
const run = (args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
describe('explicit custom-calculation CLI export', () => {
  it('writes canonical .uwx.md output with selector formulas and refuses reverse import', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uwmd-excel-period-'));
    try {
      const input = join(dir, 'period.uwx.md');
      writeFileSync(
        input,
        [
          source,
          '```json uw:section=custom_calculations source=manual v=1',
          JSON.stringify({
            id: 'period_total',
            label: 'Period total',
            formula: 'dcf.annual_cash_flows@Y3.noi * 2',
          }),
          '```',
          '',
        ].join('\n')
      );
      const result = run([input, '--calculations', 'period_total']);
      expect(result.status).toBe(0);
      const output = join(dir, 'period.xlsx');
      expect(existsSync(output)).toBe(true);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(output);
      expect(
        (wb.getWorksheet('Custom Calculations')!.getCell('C6').value as ExcelJS.CellFormulaValue)
          .formula
      ).toContain('MATCH("year:3"');
      const reverse = run(['--import', output]);
      expect(reverse.status).toBe(1);
      expect(reverse.stderr).toContain('export-only');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('requires an explicit ID list', () => {
    const result = run(['--calculations']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('requires comma-separated');
  });
  it('advertises the new option', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--calculations');
  });
});

describe('calculation context CLI export', () => {
  it('exports selected variant values and exact scalar overrides from a context file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uwmd-excel-context-'));
    try {
      const input = join(dir, 'period.uwx.md');
      const context = join(dir, 'context.json');
      const output = join(dir, 'period.xlsx');
      const raw = [source.replace('uw:section=dcf source=', 'uw:section=dcf variant=base source='),
        '```json uw:section=dcf variant=stress source=manual v=1',
        JSON.stringify({ _role: 'component', annual_cash_flows: [{ year: 3, noi: 900 }] }), '```',
        '```json uw:section=custom_calculations source=manual v=1',
        JSON.stringify({ id: 'total', formula: 'dcf.annual_cash_flows@Y3.noi + property.total_units' }), '```', ''].join('\n');
      writeFileSync(input, raw);
      writeFileSync(context, JSON.stringify({ sectionVariants: { dcf: 'stress' }, overrides: { 'property.total_units': 0 } }));
      const result = run([input, '--calculations', 'total', '--calc-context', context]);
      expect(result.status).toBe(0);
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(output);
      expect(wb.getWorksheet('Periods DCF')!.getCell('B6').value).toBe(900);
      expect(wb.getWorksheet('Calculation Inputs')!.getCell('B6').value).toBe(0);
      expect(readFileSync(input, 'utf8')).toBe(raw);
      const invalidOutput = join(dir, 'invalid.xlsx');
      writeFileSync(context, JSON.stringify({ overrides: { x: {} } }));
      const invalid = run([input, '--calculations', 'total', '--calc-context', context, '-o', invalidOutput]);
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain('CALC-TYPE-001');
      expect(existsSync(invalidOutput)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('refuses context without explicit calculations or a file path', () => {
    const noCalculations = run(['deal.uwx.md', '--calc-context', 'context.json']);
    expect(noCalculations.status).toBe(2);
    expect(noCalculations.stderr).toContain('requires --calculations');
    const noPath = run(['deal.uwx.md', '--calc-context']);
    expect(noPath.status).toBe(2);
    expect(noPath.stderr).toContain('requires a JSON file path');
  });
});
