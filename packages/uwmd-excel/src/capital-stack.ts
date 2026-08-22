// Capital-stack sheet (RFC 0026, UW_FORMAT_SPEC §4.24).
//
// A document carrying a `capital_stack` section gets one additional sheet: one
// row per tranche (ordered by seniority), a native-SUM total-capitalization row,
// the property-level sizing inputs, and a sizing block that recomputes every
// stated figure as a LIVE Excel formula next to its stated value. The sheet is
// additive for every asset class — a document without the section produces
// exactly the workbook it produces today.
//
// Parity rule: each recomputed-figure formula mirrors `verifyCapitalStack`'s
// arithmetic over the same tranche cells, and the agree/disagree comparison
// ROUNDs both sides at the fn's quantum from CAPITAL_STACK_SIZING_DECIMALS —
// the same table the core verifier compares at, imported rather than copied, so
// the workbook and the verifier cannot quantize differently. A figure the
// verifier reports `unverifiable` (an input the document does not supply) is
// written as the literal text "unverifiable", never as a formula over blank
// cells — a blank SUMs as 0, which is exactly the misleading zero the verifier
// refuses to produce.
//
// Like the rest of the converter this is a view, not the record: the tranche
// terms are values, the derived cells are formulas, and the canonical document
// stays the .uw.md.

import type ExcelJS from 'exceljs';
import {
  getSection,
  recomputeSizing,
  capitalStackContext,
  isDebtTranche,
  CAPITAL_STACK_SIZING_DECIMALS,
} from '@uwmd/core';
import type {
  ParsedUWFile,
  CapitalStack,
  CapitalStackContext,
  Tranche,
  SizingFigure,
} from '@uwmd/core';
import { SUBTOTAL_RANGES } from './layout.js';
import { mixedUseName } from './mixed-use.js';

/** Sheet name. Stable — tests and downstream readers look it up by this string. */
export const CAPITAL_STACK_SHEET_NAME = 'Capital Stack';

/** Named range over the native SUM of tranche amounts (total capitalization). */
export const CAPITAL_STACK_TOTAL_RANGE = 'capital_stack_total';

/** Named ranges for the property-level sizing inputs on this sheet. */
export const CS_INPUT_RANGES = {
  noi: 'cs_noi',
  total_cost: 'cs_total_cost',
  total_value: 'cs_total_value',
} as const;

/** Per-tranche named ranges, keyed by the tranche's (unique) position. */
export function trancheRangeName(position: number, field: 'amount' | 'rate' | 'ds'): string {
  return `cs_t${position}_${field}`;
}

// Column assignments for the tranche table and the sizing block.
const COL = { amount: 'D', rate: 'E', amort: 'G', ds: 'H' } as const;
const SIZING_COL = { stated: 'D', recomputed: 'E', agrees: 'F' } as const;

const NUMBER_FORMATS = {
  currency: '$#,##0',
  percent: '0.00%',
  ratio: '0.00"x"',
  count: '#,##0',
} as const;

/** Coverage figures display as ratios; yields, LTC/LTV, and cost as percents. */
function sizingNumFmt(fn: SizingFigure['fn']): string {
  return fn === 'coverage' || fn === 'blended_coverage'
    ? NUMBER_FORMATS.ratio
    : NUMBER_FORMATS.percent;
}

function absRef(sheet: string, cell: string): string {
  const ref = cell.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2');
  return `'${sheet.replace(/'/g, "''")}'!${ref}`;
}

/**
 * The tranche's annual CASH debt service as a live formula over its own row —
 * mirroring `trancheAnnualDebtService` branch for branch. Returns a number for
 * the constant cases (PIK and common equity pay 0 cash) and null when the core
 * function is uncomputable (a debt/pref tranche with no rate), which the writer
 * renders as a blank cell.
 */
function debtServiceFormula(t: Tranche, row: number): string | number | null {
  if (t.accrual === 'accrued') return 0;
  if (t.class === 'common_equity') return 0;
  if (t.rate === null || t.rate === undefined) return null;
  const amt = `${COL.amount}${row}`;
  const rate = `${COL.rate}${row}`;
  if (t.class === 'preferred_equity') return `${amt}*${rate}`;

  const amort = t.amortization_months ?? 0;
  if (amort <= 0) return `${amt}*${rate}`; // interest-only / non-amortizing
  // rate 0 makes the annuity denominator collapse; the constant is straight-line.
  if (t.rate === 0) return `${amt}/${COL.amort}${row}*12`;
  return `${amt}*(${rate}/12)/(1-(1+${rate}/12)^(-${COL.amort}${row}))*12`;
}

/**
 * The recomputed-figure formula, mirroring `recomputeSizing` over the sheet's
 * tranche rows. Callers only invoke this for figures the core verifier can
 * evaluate, so the selector is known to resolve and every referenced cell is
 * known to be populated. `rowOf` maps a tranche (by sorted index) to its sheet
 * row; rows are sorted by position, so a `through` prefix is contiguous.
 */
function sizingFormula(
  fig: SizingFigure,
  sorted: readonly Tranche[],
  rowOf: (index: number) => number,
): string {
  const prefix = (through: number): number[] =>
    sorted.map((t, i) => (t.position <= through ? i : -1)).filter((i) => i >= 0);

  switch (fig.fn) {
    case 'coverage': {
      const i = sorted.findIndex((t) => t.id === fig.over);
      return `${CS_INPUT_RANGES.noi}/${trancheRangeName(sorted[i].position, 'ds')}`;
    }
    case 'blended_coverage': {
      const rows = prefix(fig.through as number).map(rowOf);
      return `${CS_INPUT_RANGES.noi}/SUM(${COL.ds}${rows[0]}:${COL.ds}${rows[rows.length - 1]})`;
    }
    case 'debt_yield_through': {
      const terms = prefix(fig.through as number)
        .filter((i) => isDebtTranche(sorted[i]))
        .map((i) => `${COL.amount}${rowOf(i)}`);
      return `${CS_INPUT_RANGES.noi}/(${terms.join('+')})`;
    }
    case 'ltc_through':
    case 'ltv_through': {
      const terms = prefix(fig.through as number)
        .filter((i) => isDebtTranche(sorted[i]))
        .map((i) => `${COL.amount}${rowOf(i)}`);
      const denom =
        fig.fn === 'ltc_through' ? CS_INPUT_RANGES.total_cost : CS_INPUT_RANGES.total_value;
      return `(${terms.length ? terms.join('+') : '0'})/${denom}`;
    }
    case 'weighted_cost': {
      const rated = sorted
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.rate !== null && t.rate !== undefined);
      const num = rated.map(({ i }) => `${COL.amount}${rowOf(i)}*${COL.rate}${rowOf(i)}`).join('+');
      const den = rated.map(({ i }) => `${COL.amount}${rowOf(i)}`).join('+');
      return `(${num})/(${den})`;
    }
  }
}

/** The parsed `capital_stack` section, or null when absent or shapeless. */
export function readCapitalStackSection(parsed: ParsedUWFile): CapitalStack | null {
  const block = getSection(parsed, 'capital_stack');
  if (!block) return null;
  const content = block.content as Partial<CapitalStack>;
  if (!Array.isArray(content.tranches) || content.tranches.length === 0) return null;
  return content as CapitalStack;
}

/**
 * Write the Capital Stack sheet. No-op (returns null) when the document has no
 * `capital_stack` section. The NOI input cell references the workbook's live
 * NOI named range when one exists — the single-statement `noi` or the
 * mixed-use consolidation cell — so editing the operating statement flows
 * through the sizing block; otherwise it holds the stored value.
 */
export function writeCapitalStackSheet(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
): ExcelJS.Worksheet | null {
  const stack = readCapitalStackSection(parsed);
  if (!stack) return null;

  const ctx: CapitalStackContext = capitalStackContext(parsed);
  const sorted = [...stack.tranches].sort((a, b) => a.position - b.position);

  const ws = wb.addWorksheet(CAPITAL_STACK_SHEET_NAME);
  ws.columns = [
    { width: 18 }, { width: 18 }, { width: 10 }, { width: 16 },
    { width: 10 }, { width: 10 }, { width: 11 }, { width: 20 },
  ];

  let row = 1;
  ws.getCell(`A${row}`).value = 'Capital Stack';
  ws.getCell(`A${row}`).font = { bold: true, size: 14 };
  ws.mergeCells(`A${row}:H${row}`);
  row += 2;

  const headers = ['Tranche', 'Class', 'Position', 'Amount', 'Rate', 'Accrual', 'Amort (mo)', 'Annual Debt Service'];
  for (const [i, h] of headers.entries()) {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
  }
  row++;

  const firstTrancheRow = row;
  const rowOf = (index: number): number => firstTrancheRow + index;

  for (const [i, t] of sorted.entries()) {
    const r = rowOf(i);
    ws.getCell(`A${r}`).value = t.id;
    ws.getCell(`B${r}`).value = t.class;
    ws.getCell(`C${r}`).value = t.position;

    const amount = ws.getCell(`${COL.amount}${r}`);
    amount.value = t.amount;
    amount.numFmt = NUMBER_FORMATS.currency;
    wb.definedNames.add(absRef(ws.name, `${COL.amount}${r}`), trancheRangeName(t.position, 'amount'));

    const rate = ws.getCell(`${COL.rate}${r}`);
    rate.value = t.rate ?? null;
    rate.numFmt = NUMBER_FORMATS.percent;
    wb.definedNames.add(absRef(ws.name, `${COL.rate}${r}`), trancheRangeName(t.position, 'rate'));

    ws.getCell(`F${r}`).value = t.accrual ?? '';
    ws.getCell(`${COL.amort}${r}`).value = t.amortization_months ?? null;

    const ds = ws.getCell(`${COL.ds}${r}`);
    const dsFormula = debtServiceFormula(t, r);
    ds.value =
      typeof dsFormula === 'string' ? { formula: dsFormula, result: undefined } : dsFormula;
    ds.numFmt = NUMBER_FORMATS.currency;
    wb.definedNames.add(absRef(ws.name, `${COL.ds}${r}`), trancheRangeName(t.position, 'ds'));
    row++;
  }
  const lastTrancheRow = row - 1;

  // Total capitalization — the native SUM range the RFC calls for, so an added
  // or removed tranche row keeps the total (and the name over it) well-defined.
  ws.getCell(`A${row}`).value = 'Total Capitalization';
  ws.getCell(`A${row}`).font = { bold: true };
  const total = ws.getCell(`${COL.amount}${row}`);
  total.value = {
    formula: `SUM(${COL.amount}${firstTrancheRow}:${COL.amount}${lastTrancheRow})`,
    result: undefined,
  };
  total.numFmt = NUMBER_FORMATS.currency;
  total.font = { bold: true };
  wb.definedNames.add(absRef(ws.name, `${COL.amount}${row}`), CAPITAL_STACK_TOTAL_RANGE);
  row += 2;

  // Property-level sizing inputs. NOI stays live when the workbook already
  // carries a NOI named range; cost and value are stored inputs.
  ws.getCell(`A${row}`).value = 'Sizing Inputs';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  const liveNoiName = [SUBTOTAL_RANGES.noi, mixedUseName('noi_model.net_operating_income')].find(
    (name) => wb.definedNames.getRanges(name).ranges.length > 0,
  );
  const inputs: Array<{ label: string; name: string; value: ExcelJS.CellValue }> = [
    {
      label: 'Net Operating Income',
      name: CS_INPUT_RANGES.noi,
      value: liveNoiName ? { formula: liveNoiName, result: undefined } : ctx.noi,
    },
    { label: 'Total Cost', name: CS_INPUT_RANGES.total_cost, value: ctx.total_cost ?? null },
    { label: 'Total Value', name: CS_INPUT_RANGES.total_value, value: ctx.total_value ?? null },
  ];
  for (const input of inputs) {
    ws.getCell(`A${row}`).value = input.label;
    const cell = ws.getCell(`B${row}`);
    cell.value = input.value;
    cell.numFmt = NUMBER_FORMATS.currency;
    wb.definedNames.add(absRef(ws.name, `B${row}`), input.name);
    row++;
  }
  row++;

  const sizing = stack.sizing ?? [];
  if (sizing.length === 0) return ws;

  ws.getCell(`A${row}`).value = 'Sizing (stated vs recomputed)';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:F${row}`);
  row++;

  for (const [i, h] of ['Figure', 'Function', 'Selector', 'Stated', 'Recomputed', 'Agrees'].entries()) {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
  }
  row++;

  const firstSizingRow = row;
  for (const fig of sizing) {
    ws.getCell(`A${row}`).value = fig.id;
    ws.getCell(`B${row}`).value = fig.fn;
    ws.getCell(`C${row}`).value =
      fig.over !== undefined ? fig.over : fig.through !== undefined ? `through ${fig.through}` : '';

    const stated = ws.getCell(`${SIZING_COL.stated}${row}`);
    stated.value = fig.value;
    stated.numFmt = sizingNumFmt(fig.fn);

    const recomputedCell = ws.getCell(`${SIZING_COL.recomputed}${row}`);
    const agreesCell = ws.getCell(`${SIZING_COL.agrees}${row}`);
    // Emit a live formula only when the verifier itself can evaluate the figure;
    // an unevaluable one is labeled, never approximated by a blank-referencing SUM.
    if (recomputeSizing(fig, sorted, ctx) === null) {
      recomputedCell.value = 'unverifiable';
      agreesCell.value = 'unverifiable';
    } else {
      recomputedCell.value = { formula: sizingFormula(fig, sorted, rowOf), result: undefined };
      recomputedCell.numFmt = sizingNumFmt(fig.fn);
      const dp = CAPITAL_STACK_SIZING_DECIMALS[fig.fn];
      agreesCell.value = {
        formula: `IF(ROUND(${SIZING_COL.stated}${row},${dp})=ROUND(${SIZING_COL.recomputed}${row},${dp}),"yes","no")`,
        result: undefined,
      };
    }
    row++;
  }
  const lastSizingRow = row - 1;
  row++;

  // The three-state verdict, live: any "no" → failed, else any "unverifiable" →
  // unverifiable, else verified — the same precedence as `verifyCapitalStack`.
  const agreesRange = `${SIZING_COL.agrees}${firstSizingRow}:${SIZING_COL.agrees}${lastSizingRow}`;
  ws.getCell(`A${row}`).value = 'Verdict';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  const verdict = ws.getCell(`B${row}`);
  verdict.value = {
    formula: `IF(COUNTIF(${agreesRange},"no")>0,"failed",IF(COUNTIF(${agreesRange},"unverifiable")>0,"unverifiable","verified"))`,
    result: undefined,
  };
  verdict.font = { bold: true, size: 12 };

  return ws;
}
