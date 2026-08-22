// Capital-stack sheet tests (RFC 0026) — one row per tranche with a native SUM
// total, live debt-service and sizing formulas that parity the core verifier at
// its own quantum, "unverifiable" rendered as text (never a blank-referencing
// formula), and the additive guarantee: no `capital_stack` section, no sheet.

import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  trancheAnnualDebtService,
  recomputeSizing,
  capitalStackContext,
  CAPITAL_STACK_SIZING_DECIMALS,
} from '@uwmd/core';
import type { ParsedUWFile, UWBlock, Tranche, SizingFigure, CapitalStack } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import {
  writeCapitalStackSheet,
  trancheRangeName,
  CAPITAL_STACK_SHEET_NAME,
  CAPITAL_STACK_TOTAL_RANGE,
  CS_INPUT_RANGES,
} from './capital-stack.js';

// ─── Synthetic document (same shape the core validator tests build) ──────────

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-22T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(sections: Record<string, UWBlock>): ParsedUWFile {
  return {
    frontmatter: {
      uw_version: '1.1', deal_id: 'cs_test', deal_name: 'CS Test', asset_class: 'multifamily',
    } as unknown as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

// Senior amortizes (exercising the annuity formula), mezz is IO, pref is
// cash-pay, common carries no rate. NOI 2M, cost 30M, value 32M.
const TRANCHES: readonly Tranche[] = [
  { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.06, amortization_months: 360, accrual: 'cash' },
  { id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000, rate: 0.1, amortization_months: 0, accrual: 'cash' },
  { id: 'pref', class: 'preferred_equity', position: 3, amount: 3_000_000, rate: 0.09, accrual: 'cash' },
  { id: 'common', class: 'common_equity', position: 4, amount: 2_000_000 },
];

const SIZING: readonly SizingFigure[] = [
  { id: 'senior_dscr', fn: 'coverage', over: 'senior', value: 1.39 },
  { id: 'combined_dscr', fn: 'blended_coverage', through: 3, value: 0.91 },
  { id: 'mezz_debt_yield', fn: 'debt_yield_through', through: 2, value: 0.08 },
  { id: 'ltc', fn: 'ltc_through', through: 2, value: 0.8333 },
  { id: 'ltv', fn: 'ltv_through', through: 2, value: 0.7813 },
  { id: 'wacc', fn: 'weighted_cost', over: '*', value: 0.0704 },
];

function fixture(opts: { valuation?: boolean; sizing?: readonly SizingFigure[] } = {}): ParsedUWFile {
  const sections: Record<string, UWBlock> = {
    noi_model: block('noi_model', {
      net_operating_income: 2_000_000,
      income: { effective_gross_income: 3_200_000 },
      expenses: { total_operating_expenses: 1_200_000 },
    }),
    sources_uses: block('sources_uses', { uses: { total: 30_000_000 } }),
    capital_stack: block('capital_stack', {
      tranches: TRANCHES.map((t) => ({ ...t })),
      sizing: (opts.sizing ?? SIZING).map((f) => ({ ...f })),
    }),
  };
  if (opts.valuation !== false) {
    sections.valuation = block('valuation', { underwritten_value: 32_000_000 });
  }
  return file(sections);
}

// ─── Workbook helpers ────────────────────────────────────────────────────────

async function roundTrip(parsed: ParsedUWFile): Promise<ExcelJS.Workbook> {
  const wb = await toWorkbook(parsed);
  const buf = await wb.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buf as ArrayBuffer);
  return reloaded;
}

function namedCell(wb: ExcelJS.Workbook, name: string): ExcelJS.Cell {
  const ranges = wb.definedNames.getRanges(name).ranges;
  expect(ranges.length, `named range ${name}`).toBe(1);
  const bang = ranges[0].lastIndexOf('!');
  let sheetName = ranges[0].slice(0, bang);
  if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
    sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
  }
  const ws = wb.getWorksheet(sheetName);
  expect(ws, `sheet for ${name}`).toBeTruthy();
  return (ws as ExcelJS.Worksheet).getCell(ranges[0].slice(bang + 1));
}

function formulaOf(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  return v && typeof v === 'object' && 'formula' in v && typeof v.formula === 'string'
    ? v.formula
    : null;
}

const rowOfCell = (cell: ExcelJS.Cell): number => Number(cell.row);

function quantize(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Evaluate a sheet formula in JS: SUM ranges expand against `cellValue`,
 * workbook names substitute from `names`, bare A1 refs substitute from
 * `cellValue`, and `^` becomes `**`. Throws (via the sanitization assertion)
 * if anything non-numeric survives — the same guard the parity tests use.
 */
function evalFormula(
  formula: string,
  names: Record<string, number>,
  cellValue: (ref: string) => number,
): number {
  let s = formula.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_m, c1, r1, _c2, r2) => {
    let total = 0;
    for (let r = Number(r1); r <= Number(r2); r++) total += cellValue(`${c1}${r}`);
    return `(${total})`;
  });
  for (const [name, value] of Object.entries(names)) {
    s = s.replace(new RegExp(`\\b${name}\\b`, 'g'), `(${value})`);
  }
  s = s.replace(/\b[A-Z]+\d+\b/g, (ref) => `(${cellValue(ref)})`);
  s = s.replace(/\^/g, '**');
  expect(/^[\d.+\-*/() e]+$/.test(s.replace(/\*\*/g, '*')), `sanitized: ${s}`).toBe(true);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${s});`)() as number;
}

/** The tranche table's raw cell values by A1 ref (amount/rate/amort are values). */
function trancheCellReader(ws: ExcelJS.Worksheet): (ref: string) => number {
  return (ref: string) => {
    const v = ws.getCell(ref).value;
    expect(typeof v, `cell ${ref} is a number`).toBe('number');
    return v as number;
  };
}

const sortedTranches = [...TRANCHES].sort((a, b) => a.position - b.position);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('writeCapitalStackSheet — additive boundary', () => {
  it('a document without a capital_stack section produces no sheet', async () => {
    const parsed = file({
      noi_model: block('noi_model', {
        net_operating_income: 2_000_000,
        income: { effective_gross_income: 3_200_000 },
        expenses: { total_operating_expenses: 1_200_000 },
      }),
    });
    const wb = await roundTrip(parsed);
    expect(wb.getWorksheet(CAPITAL_STACK_SHEET_NAME)).toBeUndefined();
    expect(wb.getWorksheet('Underwriting')).toBeTruthy();
    expect(wb.getWorksheet('Pipeline Log')).toBeTruthy();
  });

  it('a document with a stack gains the sheet without disturbing the others', async () => {
    const wb = await roundTrip(fixture());
    for (const sheet of ['Underwriting', 'Operating Statement', CAPITAL_STACK_SHEET_NAME, 'Pipeline Log', 'UW MCP']) {
      expect(wb.getWorksheet(sheet), sheet).toBeTruthy();
    }
  });
});

describe('tranche table', () => {
  it('writes one row per tranche in seniority order, with a native SUM total', async () => {
    const wb = await roundTrip(fixture());
    const rows = sortedTranches.map((t) => rowOfCell(namedCell(wb, trancheRangeName(t.position, 'amount'))));
    // sorted by position → strictly increasing, contiguous sheet rows
    for (let i = 1; i < rows.length; i++) expect(rows[i]).toBe(rows[i - 1] + 1);

    const ws = wb.getWorksheet(CAPITAL_STACK_SHEET_NAME) as ExcelJS.Worksheet;
    for (const [i, t] of sortedTranches.entries()) {
      expect(ws.getCell(`A${rows[i]}`).value).toBe(t.id);
      expect(ws.getCell(`D${rows[i]}`).value).toBe(t.amount);
    }

    const total = namedCell(wb, CAPITAL_STACK_TOTAL_RANGE);
    expect(formulaOf(total)).toBe(`SUM(D${rows[0]}:D${rows[rows.length - 1]})`);
  });

  it('every debt-service cell mirrors trancheAnnualDebtService (formula parity)', async () => {
    const wb = await roundTrip(fixture());
    const ws = wb.getWorksheet(CAPITAL_STACK_SHEET_NAME) as ExcelJS.Worksheet;
    const read = trancheCellReader(ws);

    for (const t of sortedTranches) {
      const cell = namedCell(wb, trancheRangeName(t.position, 'ds'));
      const expected = trancheAnnualDebtService(t);
      const formula = formulaOf(cell);
      if (formula === null) {
        // constant cases (PIK / common equity pay 0) or uncomputable (blank)
        expect(cell.value ?? null).toBe(expected === null ? null : expected);
        continue;
      }
      expect(evalFormula(formula, {}, read)).toBeCloseTo(expected as number, 6);
    }
  });

  it('a rate-less debt tranche gets a blank debt-service cell, not zero', async () => {
    const tranches: Tranche[] = [
      { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.06 },
      { id: 'tbd_mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000 },
    ];
    const parsed = file({
      capital_stack: block('capital_stack', { tranches }),
    });
    const wb = await roundTrip(parsed);
    const cell = namedCell(wb, trancheRangeName(2, 'ds'));
    expect(cell.value ?? null).toBeNull();
  });
});

describe('sizing block — Excel↔verifier parity at the verifier quantum', () => {
  it('every evaluable figure recomputes equal after quantizing at CAPITAL_STACK_SIZING_DECIMALS', async () => {
    const parsed = fixture();
    const wb = await roundTrip(parsed);
    const ws = wb.getWorksheet(CAPITAL_STACK_SHEET_NAME) as ExcelJS.Worksheet;
    const read = trancheCellReader(ws);
    const ctx = capitalStackContext(parsed);

    // Sheet-derived debt service per tranche (evaluated from the DS cells), so
    // sizing parity closes entirely over workbook-authored arithmetic.
    const names: Record<string, number> = {
      [CS_INPUT_RANGES.noi]: ctx.noi as number,
      [CS_INPUT_RANGES.total_cost]: ctx.total_cost as number,
      [CS_INPUT_RANGES.total_value]: ctx.total_value as number,
    };
    const dsByRef: Record<string, number> = {};
    for (const t of sortedTranches) {
      const cell = namedCell(wb, trancheRangeName(t.position, 'ds'));
      const formula = formulaOf(cell);
      const value = formula === null ? ((cell.value ?? null) as number | null) : evalFormula(formula, {}, read);
      expect(value, `ds for ${t.id}`).not.toBeNull();
      names[trancheRangeName(t.position, 'ds')] = value as number;
      dsByRef[`H${rowOfCell(cell)}`] = value as number;
    }
    const readWithDs = (ref: string): number => (ref in dsByRef ? dsByRef[ref] : read(ref));

    // Locate each figure's row by its id in column A.
    const rowById = new Map<string, number>();
    ws.eachRow((row, idx) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') rowById.set(v, idx);
    });

    let checked = 0;
    for (const fig of SIZING) {
      const r = rowById.get(fig.id);
      expect(r, `${fig.id} row`).toBeTruthy();
      const recomputedCell = ws.getCell(`E${r}`);
      const direct = recomputeSizing(fig, sortedTranches, ctx);
      expect(direct, `${fig.id} evaluable in fixture`).not.toBeNull();

      const formula = formulaOf(recomputedCell);
      expect(formula, `${fig.id} recomputed is a live formula`).not.toBeNull();
      const excelLike = evalFormula(formula as string, names, readWithDs);
      const dp = CAPITAL_STACK_SIZING_DECIMALS[fig.fn];
      // parity is exact at the quantum the verifier itself compares at
      expect(quantize(excelLike, dp), fig.id).toBe(quantize(direct as number, dp));

      // the agree comparison ROUNDs both sides at that same quantum
      const agreesFormula = formulaOf(ws.getCell(`F${r}`));
      expect(agreesFormula).toBe(`IF(ROUND(D${r},${dp})=ROUND(E${r},${dp}),"yes","no")`);
      checked++;
    }
    expect(checked).toBe(SIZING.length); // all six fns exercised
  });

  it('an unevaluable figure renders as "unverifiable" text, never a formula', async () => {
    // no valuation section → ltv_through has no denominator
    const parsed = fixture({ valuation: false });
    expect(recomputeSizing(SIZING[4], sortedTranches, capitalStackContext(parsed))).toBeNull();

    const wb = await roundTrip(parsed);
    const ws = wb.getWorksheet(CAPITAL_STACK_SHEET_NAME) as ExcelJS.Worksheet;
    let ltvRow = 0;
    ws.eachRow((row, idx) => {
      if (row.getCell(1).value === 'ltv') ltvRow = idx;
    });
    expect(ltvRow).toBeGreaterThan(0);
    expect(ws.getCell(`E${ltvRow}`).value).toBe('unverifiable');
    expect(ws.getCell(`F${ltvRow}`).value).toBe('unverifiable');
  });

  it('the verdict cell applies the verifier precedence: failed → unverifiable → verified', async () => {
    const wb = await roundTrip(fixture());
    const ws = wb.getWorksheet(CAPITAL_STACK_SHEET_NAME) as ExcelJS.Worksheet;
    let verdictRow = 0;
    ws.eachRow((row, idx) => {
      if (row.getCell(1).value === 'Verdict') verdictRow = idx;
    });
    expect(verdictRow).toBeGreaterThan(0);
    const formula = formulaOf(ws.getCell(`B${verdictRow}`)) ?? '';
    const first = verdictRow - 1 - SIZING.length;
    const range = `F${first}:F${verdictRow - 2}`;
    expect(formula).toBe(
      `IF(COUNTIF(${range},"no")>0,"failed",IF(COUNTIF(${range},"unverifiable")>0,"unverifiable","verified"))`,
    );
  });
});

describe('sizing inputs', () => {
  it('cs_noi stays live by referencing the workbook noi named range when present', async () => {
    const wb = await roundTrip(fixture());
    expect(formulaOf(namedCell(wb, CS_INPUT_RANGES.noi))).toBe('noi');
    expect(namedCell(wb, CS_INPUT_RANGES.total_cost).value).toBe(30_000_000);
    expect(namedCell(wb, CS_INPUT_RANGES.total_value).value).toBe(32_000_000);
  });

  it('falls back to the stored NOI value on a workbook with no noi named range', () => {
    const wb = new ExcelJS.Workbook();
    const ws = writeCapitalStackSheet(wb, fixture());
    expect(ws).toBeTruthy();
    const cell = namedCell(wb, CS_INPUT_RANGES.noi);
    expect(formulaOf(cell)).toBeNull();
    expect(cell.value).toBe(2_000_000);
  });

  it('writeCapitalStackSheet is a no-op without the section', () => {
    const wb = new ExcelJS.Workbook();
    expect(writeCapitalStackSheet(wb, file({}))).toBeNull();
    expect(wb.worksheets.length).toBe(0);
  });
});

describe('a stack with no sizing figures', () => {
  it('writes the tranche table and inputs, no sizing block, no verdict', async () => {
    const parsed = fixture({ sizing: [] });
    const wb = await roundTrip(parsed);
    const ws = wb.getWorksheet(CAPITAL_STACK_SHEET_NAME) as ExcelJS.Worksheet;
    expect(ws).toBeTruthy();
    const labels = new Set<string>();
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') labels.add(v);
    });
    expect(labels.has('Total Capitalization')).toBe(true);
    expect(labels.has('Sizing (stated vs recomputed)')).toBe(false);
    expect(labels.has('Verdict')).toBe(false);
  });
});

// The stack section type is exercised end to end; keep the cast honest.
const _typecheck: CapitalStack = { tranches: [...TRANCHES], sizing: [...SIZING] };
void _typecheck;
