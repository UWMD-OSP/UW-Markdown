import { describe, expect, it, vi } from 'vitest';

// These tests exercise built executables, stdout/stderr and exit codes.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
import { readFileSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess as spawnCli } from '../../../test/cli.mjs';
import ExcelJS from 'exceljs';
import { evaluate, generateBlankUWFile, parseExpression, parseUWFile } from '@uwmd/core';
import type { AssetClass } from '@uwmd/core';
import { SUPPORTED_ASSET_CLASSES } from './layouts.js';
const bin = fileURLToPath(new URL('../bin/uwmd-excel.mjs', import.meta.url));
const source = readFileSync(
  new URL(
    '../../../conformance/calc/fixtures/period-01-year-order/deal.uwx.md',
    import.meta.url
  ),
  'utf8'
);
const run = (args: string[]) => spawnCli(process.execPath, [bin, ...args], { encoding: 'utf8' });
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
      const result = await run([input, '--calculations', 'period_total']);
      expect(result.status).toBe(0);
      const output = join(dir, 'period.xlsx');
      expect(existsSync(output)).toBe(true);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(output);
      expect(
        (wb.getWorksheet('Custom Calculations')!.getCell('C6').value as ExcelJS.CellFormulaValue)
          .formula
      ).toContain('MATCH("year:3"');
      const reverse = await run(['--import', output]);
      expect(reverse.status).toBe(1);
      expect(reverse.stderr).toContain('export-only');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('requires an explicit ID list', async () => {
    const result = await run(['--calculations']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('requires comma-separated');
  });
  it('advertises the new option', async () => {
    const result = await run(['--help']);
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
      const result = await run([input, '--calculations', 'total', '--calc-context', context]);
      expect(result.status).toBe(0);
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(output);
      expect(wb.getWorksheet('Periods DCF')!.getCell('B6').value).toBe(900);
      expect(wb.getWorksheet('Calculation Inputs')!.getCell('B6').value).toBe(0);
      expect(readFileSync(input, 'utf8')).toBe(raw);
      const invalidOutput = join(dir, 'invalid.xlsx');
      writeFileSync(context, JSON.stringify({ overrides: { x: {} } }));
      const invalid = await run([input, '--calculations', 'total', '--calc-context', context, '-o', invalidOutput]);
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain('CALC-TYPE-001');
      expect(existsSync(invalidOutput)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('refuses context without explicit calculations or a file path', async () => {
    const noCalculations = await run(['deal.uwx.md', '--calc-context', 'context.json']);
    expect(noCalculations.status).toBe(2);
    expect(noCalculations.stderr).toContain('requires --calculations');
    const noPath = await run(['deal.uwx.md', '--calc-context']);
    expect(noPath.status).toBe(2);
    expect(noPath.stderr).toContain('requires a JSON file path');
  });
});

// #484: the converter imports every workbook it exports from an init record
// (all twelve classes) and from a totals-only noi_model record.
describe('export then --import round trip (#484)', () => {
  function leaves(value: unknown, prefix: string, out: Array<[string, unknown]> = []): Array<[string, unknown]> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, out);
    } else out.push([prefix, value]);
    return out;
  }
  async function roundTrip(text: string): Promise<string[]> {
    const dir = mkdtempSync(join(tmpdir(), 'uwmd-excel-roundtrip-'));
    try {
      const input = join(dir, 'deal.uwx.md');
      const output = join(dir, 'deal.xlsx');
      writeFileSync(input, text);
      const exported = await run([input, '-o', output]);
      expect(exported.status, exported.stderr).toBe(0);
      const imported = await run(['--import', output]);
      expect(imported.status, imported.stderr).toBe(0);
      const sections = (JSON.parse(imported.stdout) as { sections: Record<string, Record<string, unknown>> }).sections;
      const parsed = parseUWFile(text);
      const paths: string[] = [];
      // The imported fragment equals the source record on every path the
      // workbook carries, read the way the calc engine reads it (absent is null).
      for (const [section, fragment] of Object.entries(sections)) {
        for (const [path, value] of leaves(fragment, '')) {
          const source = evaluate(parseExpression(`${section}.${path}`), { parsed, prior_results: {}, locale: 'en-US' });
          expect(value, `${section}.${path}`).toEqual(source ?? null);
          paths.push(`${section}.${path}`);
        }
      }
      return paths;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  for (const assetClass of SUPPORTED_ASSET_CLASSES) {
    it(`imports the workbook exported from a ${assetClass} init record`, async () => {
      const paths = await roundTrip(generateBlankUWFile({ assetClass: assetClass as AssetClass }));
      expect(paths.length).toBeGreaterThan(0);
    });
  }

  it('imports the workbook exported from a totals-only noi_model record', async () => {
    const text = generateBlankUWFile({ assetClass: 'office' }).replace(
      /(```json uw:section=noi_model[^\n]*\n)([\s\S]*?)(\n```)/,
      (_, open: string, body: string, close: string) => `${open}${JSON.stringify({
        _meta: (JSON.parse(body) as Record<string, unknown>)._meta,
        income: { effective_gross_income: 100000 },
        expenses: { total_operating_expenses: 40000 },
        net_operating_income: 60000,
      }, null, 2)}${close}`,
    );
    expect(text).toContain('"effective_gross_income": 100000');
    const paths = await roundTrip(text);
    expect(paths).toEqual(expect.arrayContaining([
      'noi_model.income.effective_gross_income',
      'noi_model.expenses.total_operating_expenses',
    ]));
  });
});
