// Workbook import â€” recover the user-editable inputs from a workbook emitted by
// toWorkbook(). The result deliberately contains section fragments rather than
// UW Markdown: callers apply those fragments through the Tier-2 editor, which
// keeps source bytes and host-owned _meta intact.

import type ExcelJS from 'exceljs';
import type { WorkbookLayout } from './layout.js';
import { SUBTOTAL_RANGES } from './layout.js';
import { getLayoutForAssetClass } from './layouts.js';

export class WorkbookImportError extends Error {
  readonly code: 'WORKBOOK-IMPORT-ASSET-CLASS' | 'WORKBOOK-IMPORT-NAMED-RANGE' | 'WORKBOOK-IMPORT-SUBTOTAL';

  constructor(
    code: WorkbookImportError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'WorkbookImportError';
    this.code = code;
  }
}

export interface WorkbookImport {
  /** The layout selected from Underwriting!B3. */
  asset_class: string;
  /**
   * Partial section content suitable for a Tier-2 section edit. _meta and
   * formula-derived totals are intentionally absent.
   */
  sections: Record<string, Record<string, unknown>>;
}

function scalarNumberOrNull(cell: ExcelJS.Cell, description: string): number | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new WorkbookImportError(
    'WORKBOOK-IMPORT-NAMED-RANGE',
    `${description} must resolve to a finite number or blank cell.`,
  );
}

function formulaAt(cell: ExcelJS.Cell): string | null {
  const value = cell.value;
  if (value && typeof value === 'object' && 'formula' in value && typeof value.formula === 'string') {
    return value.formula;
  }
  return null;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    let next = current[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      next = {};
      current[segment] = next;
    }
    current = next as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

function sectionFor(
  sections: Record<string, Record<string, unknown>>,
  sectionId: string,
): Record<string, unknown> {
  let section = sections[sectionId];
  if (!section) {
    section = {};
    sections[sectionId] = section;
  }
  return section;
}

function cellAt(wb: ExcelJS.Workbook, address: string): ExcelJS.Cell | null {
  const bang = address.lastIndexOf('!');
  if (bang < 0) return null;
  let sheetName = address.slice(0, bang);
  const reference = address.slice(bang + 1);
  if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
    sheetName = sheetName.slice(1, -1).replace(/''/g, "'");
  }
  const sheet = wb.getWorksheet(sheetName);
  return sheet ? sheet.getCell(reference) : null;
}

function namedCell(wb: ExcelJS.Workbook, name: string): ExcelJS.Cell {
  const ranges = wb.definedNames.getRanges(name).ranges;
  if (ranges.length !== 1) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-NAMED-RANGE',
      `Workbook is missing the required named range "${name}".`,
    );
  }
  const cell = cellAt(wb, ranges[0]);
  if (!cell) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-NAMED-RANGE',
      `Workbook named range "${name}" does not resolve to a worksheet cell.`,
    );
  }
  return cell;
}

function assertSubtotalRows(wb: ExcelJS.Workbook, layout: WorkbookLayout): void {
  const sheet = wb.getWorksheet('Operating Statement');
  if (!sheet) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-SUBTOTAL',
      'Workbook is missing the Operating Statement sheet.',
    );
  }

  const incomeFirst = 2;
  const incomeLast = incomeFirst + layout.incomeLines.length - 1;
  const egiRow = incomeLast + 1;
  const expenseFirst = egiRow + 3;
  const expenseLast = expenseFirst + layout.expenseLines.length - 1;
  const opexRow = expenseLast + 1;
  const noiRow = opexRow + 2;
  const subtotals = [
    { label: 'Effective Gross Income', row: egiRow, formula: `SUM(B${incomeFirst}:B${incomeLast})`, name: SUBTOTAL_RANGES.egi },
    { label: 'Total Operating Expenses', row: opexRow, formula: `SUM(B${expenseFirst}:B${expenseLast})`, name: SUBTOTAL_RANGES.opex },
    { label: 'Net Operating Income', row: noiRow, formula: `B${egiRow}-B${opexRow}`, name: SUBTOTAL_RANGES.noi },
  ];

  for (const subtotal of subtotals) {
    const label = sheet.getCell(`A${subtotal.row}`).value;
    const formula = formulaAt(sheet.getCell(`B${subtotal.row}`));
    if (label !== subtotal.label || formula !== subtotal.formula) {
      throw new WorkbookImportError(
        'WORKBOOK-IMPORT-SUBTOTAL',
        `Workbook subtotal "${subtotal.label}" has been altered.`,
      );
    }
    const rangeCell = namedCell(wb, subtotal.name);
    if (rangeCell !== sheet.getCell(`B${subtotal.row}`)) {
      throw new WorkbookImportError(
        'WORKBOOK-IMPORT-SUBTOTAL',
        `Workbook subtotal named range "${subtotal.name}" does not point to ${subtotal.label}.`,
      );
    }
  }
}

/**
 * Recover editable field fragments from a workbook produced by toWorkbook().
 * Formula-derived values are never imported, so a cached workbook calculation
 * cannot overwrite the pack-owned calc-engine result.
 */
export function fromWorkbook(wb: ExcelJS.Workbook): WorkbookImport {
  const underwriting = wb.getWorksheet('Underwriting');
  const assetClass = underwriting?.getCell('B3').value;
  if (typeof assetClass !== 'string' || !getLayoutForAssetClass(assetClass)) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-ASSET-CLASS',
      'Workbook has no supported asset class in Underwriting!B3.',
    );
  }
  const layout = getLayoutForAssetClass(assetClass)!;
  assertSubtotalRows(wb, layout);

  const sections: Record<string, Record<string, unknown>> = {};
  for (const input of layout.namedInputs) {
    const section = sectionFor(sections, input.source.section);
    setPath(section, input.source.path, scalarNumberOrNull(namedCell(wb, input.name), input.name));
  }

  const operatingStatement = wb.getWorksheet('Operating Statement')!;
  let incomeRow = 2;
  for (const line of layout.incomeLines) {
    const section = sectionFor(sections, 'noi_model');
    const value = scalarNumberOrNull(operatingStatement.getCell(`B${incomeRow}`), line.label);
    const restored = value === null ? null : value * (line.sign ?? 1);
    setPath(section, `income.${line.path}`, Object.is(restored, -0) ? 0 : restored);
    incomeRow++;
  }

  const egiRow = incomeRow;
  let expenseRow = egiRow + 3;
  for (const line of layout.expenseLines) {
    const section = sectionFor(sections, 'noi_model');
    setPath(section, `expenses.${line.path}`, scalarNumberOrNull(operatingStatement.getCell(`B${expenseRow}`), line.label));
    expenseRow++;
  }

  return { asset_class: assetClass, sections };
}
