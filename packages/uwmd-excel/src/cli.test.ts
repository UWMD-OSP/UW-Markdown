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
