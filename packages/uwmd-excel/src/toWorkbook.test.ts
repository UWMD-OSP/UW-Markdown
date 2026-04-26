// Round-trip test: parse Parkview → toWorkbook → re-read buffer with exceljs.
//
// Verifies the calc-integrity contract end-to-end:
//   1. Every NAMED_INPUTS cell holds the numeric value from the corresponding
//      .uw.md section, accessible via the workbook-scope named range.
//   2. Every DERIVED_METRICS cell carries the expected formula string. Formulas
//      are not evaluated by exceljs on write — Excel computes them on open —
//      but the formula text itself is the contract: same expression as
//      MULTIFAMILY_STARTER_PACK in @uwmd/core, just spelled in Excel syntax.
//   3. The Operating Statement sheet has the income/expense line values, the
//      EGI sub-total formula, the total-opex sub-total formula, and the NOI
//      formula. The `noi` named range points at the NOI cell.

import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { parseUWFile } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import {
  NAMED_INPUTS,
  DERIVED_METRICS,
  INCOME_LINES,
  EXPENSE_LINES,
} from './multifamily.js';

const PARKVIEW = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uw.md');

async function buildParkviewWorkbook(): Promise<ExcelJS.Workbook> {
  const raw = await readFile(PARKVIEW, 'utf8');
  const parsed = parseUWFile(raw);
  const wb = await toWorkbook(parsed);
  // Round-trip through xlsx serialization so we exercise the same code path
  // the CLI produces.
  const buf = await wb.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buf as ArrayBuffer);
  return reloaded;
}

function cellAt(wb: ExcelJS.Workbook, address: string): ExcelJS.Cell {
  // address like "Underwriting!$B$8" — split into sheet + cell.
  const [sheetName, ref] = address.split('!');
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`worksheet not found: ${sheetName}`);
  return ws.getCell(ref);
}

describe('toWorkbook (multifamily)', () => {
  it('writes every named input as a named range with the source value', async () => {
    const wb = await buildParkviewWorkbook();
    const raw = await readFile(PARKVIEW, 'utf8');
    const parsed = parseUWFile(raw);

    for (const input of NAMED_INPUTS) {
      const ranges = wb.definedNames.getRanges(input.name);
      expect(ranges.ranges.length, `named range "${input.name}" should exist`).toBeGreaterThan(0);

      const address = ranges.ranges[0];
      const cell = cellAt(wb, address);
      const expected = (() => {
        const sec = parsed.sections[input.source.section];
        if (!sec || Array.isArray(sec)) return undefined;
        // deepGet via dot-path
        const parts = input.source.path.split('.');
        let cur: unknown = (sec as { content: Record<string, unknown> }).content;
        for (const p of parts) {
          if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p];
          else cur = undefined;
        }
        return typeof cur === 'number' ? cur : null;
      })();

      expect(cell.value, `${input.name} value`).toBe(expected);
    }
  });

  it('writes every derived metric as the expected Excel formula', async () => {
    const wb = await buildParkviewWorkbook();
    const ws = wb.getWorksheet('Underwriting');
    expect(ws).toBeTruthy();

    // The Underwriting sheet is laid out by writeUnderwritingSheet — find each
    // metric by label in column A so we don't depend on absolute row numbers.
    const labelToRow = new Map<string, number>();
    ws!.eachRow((row, idx) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') labelToRow.set(v, idx);
    });

    for (const m of DERIVED_METRICS) {
      const row = labelToRow.get(m.label);
      expect(row, `${m.label} should appear in column A`).toBeTruthy();
      const cell = ws!.getCell(`B${row}`);
      const v = cell.value;
      expect(v && typeof v === 'object' && 'formula' in v, `${m.label} should be a formula`).toBe(true);
      const formula = (v as { formula: string }).formula;
      // multifamily.ts formulas have a leading "="; the cell stores them stripped.
      expect(`=${formula}`).toBe(m.formula);
    }
  });

  it('writes the operating-statement line items, sub-totals, and NOI named range', async () => {
    const wb = await buildParkviewWorkbook();
    const raw = await readFile(PARKVIEW, 'utf8');
    const parsed = parseUWFile(raw);
    const ws = wb.getWorksheet('Operating Statement');
    expect(ws).toBeTruthy();

    const noi = parsed.sections['noi_model'] as { content: Record<string, unknown> };
    const income = (noi.content as { income: Record<string, { value: number }> }).income;
    const expenses = (noi.content as { expenses: Record<string, { value: number }> }).expenses;

    const labelToRow = new Map<string, number>();
    ws!.eachRow((row, idx) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') labelToRow.set(v, idx);
    });

    for (const line of INCOME_LINES) {
      const row = labelToRow.get(line.label);
      expect(row, `${line.label} row`).toBeTruthy();
      const expected = income[line.path.split('.')[0]]?.value ?? null;
      expect(ws!.getCell(`B${row}`).value).toBe(expected);
    }
    for (const line of EXPENSE_LINES) {
      const row = labelToRow.get(line.label);
      expect(row, `${line.label} row`).toBeTruthy();
      const expected = expenses[line.path.split('.')[0]]?.value ?? null;
      expect(ws!.getCell(`B${row}`).value).toBe(expected);
    }

    // Sub-totals are formulas, not literals.
    const egiCell = ws!.getCell(`B${labelToRow.get('Effective Gross Income')}`);
    expect(egiCell.value && typeof egiCell.value === 'object' && 'formula' in egiCell.value).toBe(true);

    const opexCell = ws!.getCell(`B${labelToRow.get('Total Operating Expenses')}`);
    expect(opexCell.value && typeof opexCell.value === 'object' && 'formula' in opexCell.value).toBe(true);

    const noiCell = ws!.getCell(`B${labelToRow.get('Net Operating Income')}`);
    expect(noiCell.value && typeof noiCell.value === 'object' && 'formula' in noiCell.value).toBe(true);

    // The `noi` named range must point at the NOI cell.
    const noiRanges = wb.definedNames.getRanges('noi');
    expect(noiRanges.ranges.length).toBeGreaterThan(0);
    expect(noiRanges.ranges[0]).toContain("'Operating Statement'");
    expect(noiRanges.ranges[0]).toContain(`$${labelToRow.get('Net Operating Income')}`);
  });

  it('writes a Pipeline Log sheet with one row per pipeline_log entry', async () => {
    const wb = await buildParkviewWorkbook();
    const raw = await readFile(PARKVIEW, 'utf8');
    const parsed = parseUWFile(raw);
    const ws = wb.getWorksheet('Pipeline Log');
    expect(ws).toBeTruthy();
    // 1 header row + N data rows.
    expect(ws!.rowCount).toBe(1 + parsed.pipeline_log.length);
  });
});
