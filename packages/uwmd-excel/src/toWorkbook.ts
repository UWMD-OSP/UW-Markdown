// Generic .uw.md → ExcelJS workbook converter.
//
// All asset-class-specific layout decisions (which inputs become named ranges,
// which formulas appear, how the operating statement is shaped) live in the
// per-asset-class layout module, selected by `frontmatter.asset_class` via the
// layout registry. This file is the engine.
//
// Calc-integrity rule: derived-metric formulas reference workbook-scope named
// ranges that resolve to the same values `evaluateCalc()` reads, so Excel and
// the calc engine produce identical numbers. Income deductions carry sign:-1 so
// `EGI = SUM(income lines)` foots to the stored effective_gross_income, and
// `NOI = EGI − total opex` foots to the stored net_operating_income.

import ExcelJS from 'exceljs';
import { deepGet, getSection, evaluateCalc, emitCalcExcelFormula } from '@uwmd/core';
import type { ParsedUWFile, CalcEvaluationContext, ModuleCalcDecl } from '@uwmd/core';
import {
  buildDerivedMetrics,
  excelFormatFor,
  SUBTOTAL_RANGES,
  type WorkbookLayout,
  type NamedInput,
  type DerivedMetric,
} from './layout.js';
import { buildMixedUseNamedRangeMap, mixedUseName } from './mixed-use.js';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';
import { buildWorkbookContract, writeMcpSheet } from './mcpSheet.js';

/** Thrown when no workbook layout is registered for the deal's asset class. */
export class UnsupportedAssetClassError extends Error {
  readonly asset_class: string;
  constructor(asset_class: string) {
    super(
      `No workbook layout for asset_class "${asset_class}". Supported: ${SUPPORTED_ASSET_CLASSES.join(', ')}.`,
    );
    this.name = 'UnsupportedAssetClassError';
    this.asset_class = asset_class;
  }
}

// Excel number formats keyed by the layout's `format` discriminator.
const NUMBER_FORMATS: Record<string, string> = {
  currency: '$#,##0',
  percent:  '0.00%',
  ratio:    '0.00"x"',
  count:    '#,##0',
};

function fmtFor(kind: string): string {
  return NUMBER_FORMATS[kind] ?? '#,##0';
}

function colLetter(col: number): string {
  let n = col;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function abs(sheet: string, row: number, col: number): string {
  const needsQuotes = /[^A-Za-z0-9_]/.test(sheet);
  const sheetRef = needsQuotes ? `'${sheet.replace(/'/g, "''")}'` : sheet;
  return `${sheetRef}!$${colLetter(col)}$${row}`;
}

function sectionContent(parsed: ParsedUWFile, sectionId: string): Record<string, unknown> {
  const block = getSection(parsed, sectionId);
  return (block?.content ?? {}) as Record<string, unknown>;
}

function readNumber(parsed: ParsedUWFile, sectionId: string, path: string): number | null {
  const v = deepGet(sectionContent(parsed, sectionId), path);
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

// ─── Sheet 1: Underwriting ───────────────────────────────────────────────────

/** Deal identity header (rows 1–5); callers add their content from row 7. */
function writeDealHeader(ws: ExcelJS.Worksheet, fm: ParsedUWFile['frontmatter']): void {
  ws.getCell('A1').value = fm.deal_name ?? fm.deal_id ?? '';
  ws.getCell('A1').font = { bold: true, size: 16 };
  ws.mergeCells('A1:B1');

  const addressLine = [fm.property_address, fm.city, fm.state, fm.zip]
    .filter((p) => typeof p === 'string' && p.length > 0)
    .join(', ');
  ws.getCell('A2').value = addressLine;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };
  ws.mergeCells('A2:B2');

  ws.getCell('A3').value = 'Asset Class';
  ws.getCell('B3').value = fm.asset_class ?? '';
  ws.getCell('A4').value = 'Status';
  ws.getCell('B4').value = fm.status ?? '';
  ws.getCell('A5').value = 'Recommendation';
  ws.getCell('B5').value = fm.recommendation ?? '';
}

function writeUnderwritingSheet(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
  derivedMetrics: readonly DerivedMetric[],
): void {
  const ws = wb.addWorksheet('Underwriting');
  ws.columns = [{ width: 32 }, { width: 22 }];

  writeDealHeader(ws, parsed.frontmatter);

  let row = 7;
  ws.getCell(`A${row}`).value = 'Inputs';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  for (const input of layout.namedInputs) {
    writeNamedInputRow(wb, ws, parsed, input, row);
    row++;
  }

  row++;
  ws.getCell(`A${row}`).value = 'Derived Metrics';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  for (const metric of derivedMetrics) {
    writeDerivedMetricRow(ws, metric, row);
    row++;
  }
}

function writeNamedInputRow(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  parsed: ParsedUWFile,
  input: NamedInput,
  row: number,
): void {
  ws.getCell(`A${row}`).value = input.label;
  const valueCell = ws.getCell(`B${row}`);
  valueCell.value = readNumber(parsed, input.source.section, input.source.path);
  valueCell.numFmt = fmtFor(input.format);
  wb.definedNames.add(abs(ws.name, row, 2), input.name);
}

function writeDerivedMetricRow(ws: ExcelJS.Worksheet, metric: DerivedMetric, row: number): void {
  ws.getCell(`A${row}`).value = metric.label;
  const valueCell = ws.getCell(`B${row}`);
  valueCell.value = { formula: metric.formula.replace(/^=/, ''), result: undefined };
  valueCell.numFmt = fmtFor(metric.format);
}

// ─── Sheet 2: Operating Statement ────────────────────────────────────────────

function writeOperatingStatementSheet(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
): void {
  const ws = wb.addWorksheet('Operating Statement');
  ws.columns = [{ width: 36 }, { width: 18 }];

  // Income block — deduction lines carry sign:-1 so the cell shows a negative
  // magnitude and the EGI SUM nets correctly.
  let row = 1;
  ws.getCell(`A${row}`).value = 'Income';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  const incomeFirst = row;
  for (const line of layout.incomeLines) {
    ws.getCell(`A${row}`).value = line.label;
    const valueCell = ws.getCell(`B${row}`);
    const raw = readNumber(parsed, 'noi_model', `income.${line.path}`);
    valueCell.value = raw === null ? null : raw * (line.sign ?? 1);
    valueCell.numFmt = fmtFor('currency');
    if (line.name) wb.definedNames.add(abs(ws.name, row, 2), line.name);
    row++;
  }
  const incomeLast = row - 1;

  const egiRow = row;
  ws.getCell(`A${egiRow}`).value = 'Effective Gross Income';
  ws.getCell(`A${egiRow}`).font = { bold: true };
  const egiCell = ws.getCell(`B${egiRow}`);
  egiCell.value = { formula: `SUM(B${incomeFirst}:B${incomeLast})`, result: undefined };
  egiCell.numFmt = fmtFor('currency');
  egiCell.font = { bold: true };
  wb.definedNames.add(abs(ws.name, egiRow, 2), SUBTOTAL_RANGES.egi);
  row += 2;

  // Expenses block
  ws.getCell(`A${row}`).value = 'Operating Expenses';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  const opexFirst = row;
  for (const line of layout.expenseLines) {
    ws.getCell(`A${row}`).value = line.label;
    const valueCell = ws.getCell(`B${row}`);
    valueCell.value = readNumber(parsed, 'noi_model', `expenses.${line.path}`);
    valueCell.numFmt = fmtFor('currency');
    if (line.name) wb.definedNames.add(abs(ws.name, row, 2), line.name);
    row++;
  }
  const opexLast = row - 1;

  const totalOpexRow = row;
  ws.getCell(`A${totalOpexRow}`).value = 'Total Operating Expenses';
  ws.getCell(`A${totalOpexRow}`).font = { bold: true };
  const totalOpexCell = ws.getCell(`B${totalOpexRow}`);
  totalOpexCell.value = { formula: `SUM(B${opexFirst}:B${opexLast})`, result: undefined };
  totalOpexCell.numFmt = fmtFor('currency');
  totalOpexCell.font = { bold: true };
  wb.definedNames.add(abs(ws.name, totalOpexRow, 2), SUBTOTAL_RANGES.opex);
  row += 2;

  const noiRow = row;
  ws.getCell(`A${noiRow}`).value = 'Net Operating Income';
  ws.getCell(`A${noiRow}`).font = { bold: true, size: 12 };
  const noiCell = ws.getCell(`B${noiRow}`);
  noiCell.value = { formula: `B${egiRow}-B${totalOpexRow}`, result: undefined };
  noiCell.numFmt = fmtFor('currency');
  noiCell.font = { bold: true, size: 12 };

  // The `noi` named range — referenced by every cap-rate / DSCR / debt-yield /
  // cash-on-cash formula on the Underwriting sheet.
  wb.definedNames.add(abs(ws.name, noiRow, 2), SUBTOTAL_RANGES.noi);
}

// ─── Sheet 3: Pipeline Log ───────────────────────────────────────────────────

function writePipelineLogSheet(wb: ExcelJS.Workbook, parsed: ParsedUWFile): void {
  const ws = wb.addWorksheet('Pipeline Log');
  ws.columns = [
    { header: 'Timestamp', width: 24 },
    { header: 'Actor',     width: 22 },
    { header: 'Source',    width: 22 },
    { header: 'Version',   width: 10 },
    { header: 'Stage',     width: 18 },
    { header: 'Action',    width: 40 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const block of parsed.pipeline_log) {
    const c = block.content as Record<string, unknown>;
    ws.addRow([
      block.meta.timestamp ?? '',
      block.meta.actor     ?? '',
      block.meta.source    ?? '',
      block.meta.version   ?? '',
      typeof c.stage  === 'string' ? c.stage  : '',
      typeof c.action === 'string' ? c.action : '',
    ]);
  }
}

// ─── Mixed-use: per-component statements + consolidation (RFC 0019) ───────────
//
// A mixed-use property has no single operating statement. Each present component
// carries its own subtotals in the `components` section, so the workbook emits
// one footing statement per component (EGI − opex = NOI) plus a consolidation
// block whose SUM of component NOIs is the property NOI — the §3a footing
// invariant, live in the sheet. Derived metrics are emitted per deal: a metric
// whose component is absent from the document, or whose intensive lacks the
// user-supplied allocation, evaluates to null and is simply not written, so the
// rows track the calc engine exactly (RFC 0019 §4).

const MIXED_USE_PROPERTY_INPUTS: ReadonlyArray<{ label: string; path: string }> = [
  { label: 'Purchase Price', path: 'valuation.purchase_price' },
  { label: 'Loan Amount', path: 'debt_structure.loan_amount' },
  { label: 'Annual Debt Service', path: 'debt_structure.annual_debt_service' },
  { label: 'Sponsor Equity', path: 'sources_uses.sources.equity_sponsor' },
];

function splitPath(path: string): { section: string; rest: string } {
  const dot = path.indexOf('.');
  return { section: path.slice(0, dot), rest: path.slice(dot + 1) };
}

function compNumber(comp: Record<string, unknown>, field: string): number | null {
  const v = comp[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Pack metrics that evaluate to a finite number for this specific deal. */
function buildMixedUseDerivedMetrics(
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
): DerivedMetric[] {
  const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };
  const namedRanges = buildMixedUseNamedRangeMap();
  const out: DerivedMetric[] = [];
  for (const decl of (layout.pack.calculations ?? []) as ModuleCalcDecl[]) {
    const r = evaluateCalc(decl, ctx);
    if (!r.ok || typeof r.value !== 'number' || !Number.isFinite(r.value)) continue;
    out.push({
      id: decl.id,
      label: decl.label,
      formula: `=${emitCalcExcelFormula(decl, { namedRanges })}`,
      format: excelFormatFor(decl.unit),
    });
  }
  return out;
}

function writeMixedUseUnderwritingSheet(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
  derivedMetrics: readonly DerivedMetric[],
): void {
  const ws = wb.addWorksheet('Underwriting');
  ws.columns = [{ width: 32 }, { width: 22 }];
  writeDealHeader(ws, parsed.frontmatter);

  let row = 7;
  ws.getCell(`A${row}`).value = 'Property Inputs';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  for (const input of MIXED_USE_PROPERTY_INPUTS) {
    const { section, rest } = splitPath(input.path);
    ws.getCell(`A${row}`).value = input.label;
    const cell = ws.getCell(`B${row}`);
    cell.value = readNumber(parsed, section, rest);
    cell.numFmt = fmtFor('currency');
    wb.definedNames.add(abs(ws.name, row, 2), mixedUseName(input.path));
    row++;
  }

  row++;
  ws.getCell(`A${row}`).value = 'Derived Metrics';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  for (const metric of derivedMetrics) {
    writeDerivedMetricRow(ws, metric, row);
    row++;
  }
}

function writeMixedUseOperatingStatement(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
): void {
  const ws = wb.addWorksheet('Operating Statement');
  ws.columns = [{ width: 36 }, { width: 18 }];
  const components = sectionContent(parsed, 'components');
  const specs = layout.mixedUse?.components ?? [];

  let row = 1;
  const noiNames: string[] = [];

  for (const spec of specs) {
    const comp = components[spec.componentClass];
    if (!comp || typeof comp !== 'object') continue; // absent use → no block
    const c = comp as Record<string, unknown>;
    const cls = spec.componentClass;

    ws.getCell(`A${row}`).value = spec.label;
    ws.getCell(`A${row}`).font = { bold: true, size: 12 };
    ws.mergeCells(`A${row}:B${row}`);
    row++;

    const egiRow = row;
    ws.getCell(`A${row}`).value = 'Effective Gross Income';
    const egiCell = ws.getCell(`B${row}`);
    egiCell.value = compNumber(c, 'effective_gross_income');
    egiCell.numFmt = fmtFor('currency');
    row++;

    const opexRow = row;
    ws.getCell(`A${row}`).value = '(Less) Operating Expenses';
    const opexCell = ws.getCell(`B${row}`);
    const opex = compNumber(c, 'operating_expenses');
    opexCell.value = opex === null ? null : -opex; // signed deduction, foots the SUM
    opexCell.numFmt = fmtFor('currency');
    row++;

    // NOI foots as a live formula; its named range is what the pack's NOI-share
    // and cap-rate formulas read, and what the consolidation SUM adds.
    const noiRow = row;
    ws.getCell(`A${row}`).value = 'Net Operating Income';
    ws.getCell(`A${row}`).font = { bold: true };
    const noiCell = ws.getCell(`B${row}`);
    noiCell.value = { formula: `SUM(B${egiRow}:B${opexRow})`, result: undefined };
    noiCell.numFmt = fmtFor('currency');
    noiCell.font = { bold: true };
    const noiName = mixedUseName(`components.${cls}.net_operating_income`);
    wb.definedNames.add(abs(ws.name, noiRow, 2), noiName);
    noiNames.push(noiName);
    row++;

    // Operating-business intermediate, surfaced per component, never blended.
    if (spec.intermediate) {
      const v = compNumber(c, spec.intermediate.field);
      if (v !== null) {
        ws.getCell(`A${row}`).value = spec.intermediate.label;
        const cell = ws.getCell(`B${row}`);
        cell.value = v;
        cell.numFmt = fmtFor('currency');
        wb.definedNames.add(
          abs(ws.name, row, 2),
          mixedUseName(`components.${cls}.${spec.intermediate.field}`),
        );
        row++;
      }
    }

    // Allocation and the intensive denominator gate the price-per metrics.
    const alloc = compNumber(c, 'allocation_pct');
    if (alloc !== null) {
      ws.getCell(`A${row}`).value = 'Allocation %';
      const cell = ws.getCell(`B${row}`);
      cell.value = alloc;
      cell.numFmt = fmtFor('percent');
      wb.definedNames.add(abs(ws.name, row, 2), mixedUseName(`components.${cls}.allocation_pct`));
      row++;
    }
    if (spec.denom) {
      const v = compNumber(c, spec.denom.field);
      if (v !== null) {
        ws.getCell(`A${row}`).value = spec.denom.label;
        const cell = ws.getCell(`B${row}`);
        cell.value = v;
        cell.numFmt = fmtFor('count');
        wb.definedNames.add(
          abs(ws.name, row, 2),
          mixedUseName(`components.${cls}.${spec.denom.field}`),
        );
        row++;
      }
    }

    row++; // blank spacer between component blocks
  }

  // Consolidation — the §3a foot: property NOI is the sum of component NOIs.
  ws.getCell(`A${row}`).value = 'Consolidated';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  ws.mergeCells(`A${row}:B${row}`);
  row++;

  ws.getCell(`A${row}`).value = 'Property Net Operating Income';
  ws.getCell(`A${row}`).font = { bold: true, size: 12 };
  const propNoi = ws.getCell(`B${row}`);
  propNoi.value = { formula: noiNames.join('+'), result: undefined };
  propNoi.numFmt = fmtFor('currency');
  propNoi.font = { bold: true, size: 12 };
  wb.definedNames.add(abs(ws.name, row, 2), mixedUseName('noi_model.net_operating_income'));
}

async function toMixedUseWorkbook(
  parsed: ParsedUWFile,
  layout: WorkbookLayout,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '@uwmd/excel';
  wb.created = new Date();

  const derivedMetrics = buildMixedUseDerivedMetrics(parsed, layout);
  writeMixedUseUnderwritingSheet(wb, parsed, derivedMetrics);
  writeMixedUseOperatingStatement(wb, parsed, layout);
  writePipelineLogSheet(wb, parsed);
  writeMcpSheet(wb, await buildWorkbookContract(parsed, layout));

  return wb;
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function toWorkbook(parsed: ParsedUWFile): Promise<ExcelJS.Workbook> {
  const assetClass = String(parsed.frontmatter.asset_class ?? '');
  const layout = getLayoutForAssetClass(assetClass);
  if (!layout) throw new UnsupportedAssetClassError(assetClass);

  // Mixed-use has a fundamentally different workbook shape (per-component
  // statements), so it takes its own builder rather than the single-statement
  // engine below.
  if (layout.mixedUse) return toMixedUseWorkbook(parsed, layout);

  const derivedMetrics = buildDerivedMetrics(layout);

  const wb = new ExcelJS.Workbook();
  wb.creator = '@uwmd/excel';
  wb.created = new Date();

  writeUnderwritingSheet(wb, parsed, layout, derivedMetrics);
  writeOperatingStatementSheet(wb, parsed, layout);
  writePipelineLogSheet(wb, parsed);
  // Last: the machine-readable contract (identity, producing pack, source
  // digest, metric dictionary, sibling representations, assurance boundary).
  writeMcpSheet(wb, await buildWorkbookContract(parsed, layout));

  return wb;
}
