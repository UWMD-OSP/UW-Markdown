// Workbook import â€” recover the user-editable inputs from a workbook emitted by
// toWorkbook(). The result deliberately contains section fragments rather than
// UW Markdown: callers apply those fragments through the Tier-2 editor, which
// keeps source bytes and host-owned _meta intact.

import type ExcelJS from 'exceljs';
import { PERIOD_EXPORT_MARKER } from './custom-calculations.js';
import type { WorkbookLayout } from './layout.js';
import { SUBTOTAL_RANGES } from './layout.js';
import { getLayoutForAssetClass } from './layouts.js';
import { MIXED_USE_PROPERTY_PATHS, mixedUseName } from './mixed-use.js';
import { readWorkbookContract } from './mcpSheet.js';
import type { WorkbookContract } from './mcpSheet.js';

export class WorkbookImportError extends Error {
  readonly code:
    | 'WORKBOOK-IMPORT-ASSET-CLASS'
    | 'WORKBOOK-IMPORT-NAMED-RANGE'
    | 'WORKBOOK-IMPORT-SUBTOTAL'
    | 'WORKBOOK-IMPORT-PACK-MISMATCH'
    | 'WORKBOOK-IMPORT-UNSUPPORTED-SHAPE';

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
  /**
   * The layout that was used. Read from the UW MCP sheet when present, and
   * only from the positional Underwriting!B3 cell as a fallback.
   */
  asset_class: string;
  /**
   * Identity and provenance of the source record, when the workbook carries a
   * UW MCP sheet. `null` for workbooks predating it or produced elsewhere —
   * the import still succeeds, but the caller cannot check staleness.
   */
  contract: WorkbookContract | null;
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

function scalarTextOrNull(cell: ExcelJS.Cell, description: string): string | null {
  const value = cell.value;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  throw new WorkbookImportError(
    'WORKBOOK-IMPORT-NAMED-RANGE',
    `${description} must resolve to text or a blank cell.`,
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

function hasName(wb: ExcelJS.Workbook, name: string): boolean {
  return wb.definedNames.getRanges(name).ranges.length > 0;
}

function negatedOrNull(value: number | null): number | null {
  if (value === null) return null;
  return Object.is(-value, -0) ? 0 : -value;
}

/**
 * Mixed-use (RFC 0019, §4.23): the property inputs on the Underwriting sheet and,
 * for each component the workbook carries, its stated EGI and operating expenses
 * plus any intermediate, allocation and intensive denominator. NOIs are
 * formula-derived and never imported; the footing formulas must be unaltered.
 */
function fromMixedUseWorkbook(wb: ExcelJS.Workbook, layout: WorkbookLayout): Record<string, Record<string, unknown>> {
  const sections: Record<string, Record<string, unknown>> = {};
  for (const path of MIXED_USE_PROPERTY_PATHS) {
    if (path === 'noi_model.net_operating_income') continue; // the consolidation SUM
    const dot = path.indexOf('.');
    const name = mixedUseName(path);
    setPath(sectionFor(sections, path.slice(0, dot)), path.slice(dot + 1), scalarNumberOrNull(namedCell(wb, name), name));
  }

  const sheet = wb.getWorksheet('Operating Statement');
  const noiNames: string[] = [];
  for (const spec of layout.mixedUse?.components ?? []) {
    const cls = spec.componentClass;
    const noiName = mixedUseName(`components.${cls}.net_operating_income`);
    if (!hasName(wb, noiName)) continue; // an absent use has no block
    const egi = namedCell(wb, mixedUseName(`components.${cls}.effective_gross_income`));
    const opex = namedCell(wb, mixedUseName(`components.${cls}.operating_expenses`));
    const noi = namedCell(wb, noiName);
    if (formulaAt(noi) !== `SUM(${egi.address}:${opex.address})` || (sheet && noi.worksheet !== sheet)) {
      throw new WorkbookImportError('WORKBOOK-IMPORT-SUBTOTAL',
        `Workbook subtotal "${spec.label} Net Operating Income" has been altered.`);
    }
    noiNames.push(noiName);

    const component: Record<string, unknown> = {
      effective_gross_income: scalarNumberOrNull(egi, `${spec.label} Effective Gross Income`),
      operating_expenses: negatedOrNull(scalarNumberOrNull(opex, `${spec.label} Operating Expenses`)),
    };
    const optional = [
      ...(spec.intermediate ? [spec.intermediate.field] : []),
      'allocation_pct',
      ...(spec.denom ? [spec.denom.field] : []),
    ];
    for (const field of optional) {
      const name = mixedUseName(`components.${cls}.${field}`);
      if (hasName(wb, name)) component[field] = scalarNumberOrNull(namedCell(wb, name), name);
    }
    sectionFor(sections, 'components')[cls] = component;
  }

  const consolidated = namedCell(wb, mixedUseName('noi_model.net_operating_income'));
  if (formulaAt(consolidated) !== noiNames.join('+')) {
    throw new WorkbookImportError('WORKBOOK-IMPORT-SUBTOTAL',
      'Workbook subtotal "Property Net Operating Income" has been altered.');
  }
  return sections;
}

/**
 * Recover editable field fragments from a workbook produced by toWorkbook().
 * Formula-derived values are never imported, so a cached workbook calculation
 * cannot overwrite the pack-owned calc-engine result.
 */
export function fromWorkbook(wb: ExcelJS.Workbook): WorkbookImport {
  if (wb.definedNames.getRanges(PERIOD_EXPORT_MARKER).ranges.length) {
    throw new WorkbookImportError('WORKBOOK-IMPORT-UNSUPPORTED-SHAPE',
      'Additional custom/period inputs are export-only. Edit the source document and re-export; reverse import would discard those edits.');
  }

  // Prefer the UW MCP sheet: a stable keyed location that survives layout
  // changes. Underwriting!B3 is positional and sits next to a human label, so
  // it is only a fallback for workbooks predating the contract.
  const contract = readWorkbookContract(wb);
  const declared = wb.getWorksheet('Underwriting')?.getCell('B3').value;

  // When both carry an asset class they must agree. A disagreement means one of
  // them was edited and the other was not, so the workbook is internally
  // inconsistent and neither value can be trusted.
  if (contract && typeof declared === 'string' && declared !== contract.document.asset_class) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-ASSET-CLASS',
      `Workbook is inconsistent: the UW MCP sheet says "${contract.document.asset_class}" but Underwriting!B3 says "${declared}".`,
    );
  }

  const assetClass = contract?.document.asset_class ?? declared;
  if (typeof assetClass !== 'string' || !getLayoutForAssetClass(assetClass)) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-ASSET-CLASS',
      'Workbook has no supported asset class in its UW MCP sheet or Underwriting!B3.',
    );
  }
  const layout = getLayoutForAssetClass(assetClass)!;

  // Row geometry below is derived from the CURRENT layout, and a different pack
  // may declare a different metric set. Reading an old workbook at new offsets
  // would silently import the wrong cells, so refuse rather than guess.
  if (contract && contract.producer.pack_id !== layout.pack.id) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-PACK-MISMATCH',
      `Workbook was produced by pack "${contract.producer.pack_id}" but the registered pack for ${assetClass} is "${layout.pack.id}".`,
    );
  }

  // Mixed-use emits per-component statements (RFC 0019), not one operating
  // statement, so it reads its own named inputs (#411).
  if (layout.mixedUse) return { asset_class: assetClass, contract: contract ?? null, sections: fromMixedUseWorkbook(wb, layout) };

  assertSubtotalRows(wb, layout);

  const sections: Record<string, Record<string, unknown>> = {};
  for (const input of layout.namedInputs) {
    const section = sectionFor(sections, input.source.section);
    const cell = namedCell(wb, input.name);
    setPath(section, input.source.path,
      input.format === 'text' ? scalarTextOrNull(cell, input.name) : scalarNumberOrNull(cell, input.name));
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

  return { asset_class: assetClass, contract: contract ?? null, sections };
}
