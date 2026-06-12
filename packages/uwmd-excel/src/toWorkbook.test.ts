// Workbook conversion + calc-integrity tests across all supported asset classes.
//
// The headline contract: every derived-metric formula in the workbook, when
// evaluated against the workbook's own named-range values, equals what
// `evaluateCalc()` produces against the same .uw.md — to 6 decimals. This is the
// Excel↔evaluator parity invariant. The operating statement is also checked to
// FOOT: signed income lines sum to the stored EGI, expense lines sum to the
// stored opex, and EGI − opex equals the stored NOI. (An earlier version summed
// income without signs, double-counting vacancy; that test only checked formula
// text, not results, so it missed the bug. This one computes results.)

import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { parseUWFile, evaluateCalc, emitExcelFormula } from '@uwmd/core';
import type { CalcEvaluationContext } from '@uwmd/core';
import { toWorkbook, UnsupportedAssetClassError } from './toWorkbook.js';
import { buildNamedRangeMap, SUBTOTAL_RANGES } from './layout.js';
import type { WorkbookLayout } from './layout.js';
import { MULTIFAMILY_LAYOUT } from './multifamily.js';
import { OFFICE_LAYOUT } from './office.js';
import { RETAIL_LAYOUT } from './retail.js';
import { INDUSTRIAL_LAYOUT } from './industrial.js';
import { SELF_STORAGE_LAYOUT } from './self-storage.js';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';

const EXAMPLES = resolve(__dirname, '../../../examples');

const CASES: ReadonlyArray<{ file: string; layout: WorkbookLayout }> = [
  { file: 'Parkview-Apts-Glendale-AZ.uw.md', layout: MULTIFAMILY_LAYOUT },
  { file: 'Riverside-Office-Phoenix-AZ.uw.md', layout: OFFICE_LAYOUT },
  { file: 'Cactus-Crossing-Retail-Mesa-AZ.uw.md', layout: RETAIL_LAYOUT },
  { file: 'Ironwood-Logistics-Industrial-Tolleson-AZ.uw.md', layout: INDUSTRIAL_LAYOUT },
  { file: 'Sonoran-Self-Storage-Peoria-AZ.uw.md', layout: SELF_STORAGE_LAYOUT },
];

async function roundTrip(file: string): Promise<ExcelJS.Workbook> {
  const raw = await readFile(resolve(EXAMPLES, file), 'utf8');
  const parsed = parseUWFile(raw);
  const wb = await toWorkbook(parsed);
  const buf = await wb.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buf as ArrayBuffer);
  return reloaded;
}

function cellAt(wb: ExcelJS.Workbook, address: string): ExcelJS.Cell | null {
  const bang = address.lastIndexOf('!');
  if (bang < 0) return null;
  let sheetName = address.slice(0, bang);
  const ref = address.slice(bang + 1);
  if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
    sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
  }
  const ws = wb.getWorksheet(sheetName);
  return ws ? ws.getCell(ref) : null;
}

function namedNumber(wb: ExcelJS.Workbook, name: string): number | null {
  const ranges = wb.definedNames.getRanges(name);
  if (!ranges.ranges.length) return null;
  const cell = cellAt(wb, ranges.ranges[0]);
  const v = cell?.value;
  return typeof v === 'number' ? v : null;
}

function rowByLabel(ws: ExcelJS.Worksheet): Map<string, number> {
  const m = new Map<string, number>();
  ws.eachRow((row, idx) => {
    const v = row.getCell(1).value;
    if (typeof v === 'string') m.set(v, idx);
  });
  return m;
}

describe('layout registry', () => {
  it('supports the registered workbook-layout classes', () => {
    expect([...SUPPORTED_ASSET_CLASSES].sort()).toEqual([
      'industrial',
      'multifamily',
      'office',
      'retail',
      'self_storage',
    ]);
  });

  it('returns null for an unregistered class', () => {
    expect(getLayoutForAssetClass('hospitality')).toBeNull();
  });

  it('toWorkbook throws UnsupportedAssetClassError for an unregistered class', async () => {
    const parsed = parseUWFile(
      ['---', 'uw_version: "1.1"', 'deal_id: "x"', 'deal_name: "X"', 'asset_class: "hospitality"', '---', '# X'].join('\n'),
    );
    await expect(toWorkbook(parsed)).rejects.toBeInstanceOf(UnsupportedAssetClassError);
  });
});

for (const { file, layout } of CASES) {
  describe(`toWorkbook — ${layout.assetClass} (${file})`, () => {
    it('writes every named input as a named range holding the stored value', async () => {
      const wb = await roundTrip(file);
      const raw = await readFile(resolve(EXAMPLES, file), 'utf8');
      const parsed = parseUWFile(raw);

      for (const input of layout.namedInputs) {
        const sec = parsed.sections[input.source.section] as { content: Record<string, unknown> };
        let cur: unknown = sec?.content;
        for (const p of input.source.path.split('.')) {
          cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
        }
        const expected = typeof cur === 'number' ? cur : null;
        expect(namedNumber(wb, input.name), `${input.name}`).toBe(expected);
      }
    });

    it('operating statement foots: signed income → EGI, expenses → opex, EGI − opex → NOI', async () => {
      const wb = await roundTrip(file);
      const raw = await readFile(resolve(EXAMPLES, file), 'utf8');
      const parsed = parseUWFile(raw);
      const noi = (parsed.sections['noi_model'] as { content: Record<string, unknown> }).content;
      const income = noi['income'] as Record<string, number>;
      const expenses = noi['expenses'] as Record<string, number>;
      const storedEGI = income['effective_gross_income'];
      const storedOpex = expenses['total_operating_expenses'];
      const storedNOI = noi['net_operating_income'] as number;

      const ws = wb.getWorksheet('Operating Statement')!;
      const labelToRow = rowByLabel(ws);

      // income line cells (already signed by the engine) sum to stored EGI
      let incomeSum = 0;
      for (const line of layout.incomeLines) {
        const row = labelToRow.get(line.label);
        expect(row, `${line.label} row`).toBeTruthy();
        const v = ws.getCell(`B${row}`).value;
        expect(typeof v).toBe('number');
        incomeSum += v as number;
      }
      expect(incomeSum).toBeCloseTo(storedEGI, 6);

      let opexSum = 0;
      for (const line of layout.expenseLines) {
        const row = labelToRow.get(line.label);
        expect(row, `${line.label} row`).toBeTruthy();
        const v = ws.getCell(`B${row}`).value;
        expect(typeof v).toBe('number');
        opexSum += v as number;
      }
      expect(opexSum).toBeCloseTo(storedOpex, 6);

      // the footing invariant the converter relies on for parity
      expect(storedEGI - storedOpex).toBeCloseTo(storedNOI, 6);
    });

    it('every derived metric matches evaluateCalc (Excel↔evaluator parity to 6 decimals)', async () => {
      const wb = await roundTrip(file);
      const raw = await readFile(resolve(EXAMPLES, file), 'utf8');
      const parsed = parseUWFile(raw);
      const noi = (parsed.sections['noi_model'] as { content: Record<string, unknown> }).content;
      const income = noi['income'] as Record<string, number>;
      const expenses = noi['expenses'] as Record<string, number>;

      // values keyed by named-range name: inputs read from the workbook,
      // subtotals from the (footing) stored values.
      const values: Record<string, number> = {};
      for (const input of layout.namedInputs) {
        const n = namedNumber(wb, input.name);
        expect(n, `${input.name} resolved`).not.toBeNull();
        values[input.name] = n as number;
      }
      for (const line of layout.incomeLines) {
        if (line.name) {
          const n = namedNumber(wb, line.name);
          expect(n, `${line.name} resolved`).not.toBeNull();
          values[line.name] = n as number;
        }
      }
      values[SUBTOTAL_RANGES.egi] = income['effective_gross_income'];
      values[SUBTOTAL_RANGES.opex] = expenses['total_operating_expenses'];
      values[SUBTOTAL_RANGES.noi] = noi['net_operating_income'] as number;

      const map = buildNamedRangeMap(layout);
      const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

      for (const decl of layout.pack.calculations ?? []) {
        const direct = evaluateCalc(decl, ctx);
        expect(direct.ok, `${decl.id} evaluateCalc`).toBe(true);

        let formula = emitExcelFormula(decl.formula, { namedRanges: map });
        for (const name of Object.keys(values)) {
          formula = formula.replace(new RegExp(`\\b${name}\\b`, 'g'), String(values[name]));
        }
        expect(/^[\d.+\-*/() ]+$/.test(formula), `${decl.id} sanitized: ${formula}`).toBe(true);
        // eslint-disable-next-line no-new-func
        const excelLike = new Function(`return (${formula});`)() as number;
        expect(excelLike, `${decl.id}`).toBeCloseTo(direct.value as number, 6);
      }
    });

    it('writes a Pipeline Log sheet with one row per pipeline_log entry', async () => {
      const wb = await roundTrip(file);
      const raw = await readFile(resolve(EXAMPLES, file), 'utf8');
      const parsed = parseUWFile(raw);
      const ws = wb.getWorksheet('Pipeline Log')!;
      expect(ws.rowCount).toBe(1 + parsed.pipeline_log.length);
    });
  });
}
