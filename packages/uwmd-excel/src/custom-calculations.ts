// RFC 0043: explicit numeric custom calculations and identity-bound period inputs.
import type ExcelJS from 'exceljs';
import {
  parseExpression,
  evaluate,
  resolvePeriodColumn,
  emitCalcExcelFormula,
  ExcelEmitError,
  getExprDependencies,
} from '@uwmd/core';
import type {
  ParsedUWFile,
  CalcEvaluationContext,
  PeriodExcelBinding,
  PeriodColumnSnapshot,
  ModuleCalcDecl,
} from '@uwmd/core';

type Expr = ReturnType<typeof parseExpression>;
export interface ToWorkbookOptions {
  /** Explicit custom-calculation IDs; omission preserves the existing workbook. */
  calculations?: readonly string[];
  /** Applies only to additional calculations, never the original pack sheets. */
  calculationContext?: Pick<CalcEvaluationContext, 'sectionVariants' | 'overrides'>;
}
export const CUSTOM_CALCULATIONS_SHEET = 'Custom Calculations';
export const CUSTOM_INPUTS_SHEET = 'Calculation Inputs';
export const PERIOD_EXPORT_MARKER = 'uwmd_period_export_v1';
const PERIOD_SHEETS: Record<string, string> = {
  'dcf.annual_cash_flows': 'Periods DCF',
  'noi_model.projections': 'Periods NOI',
  'lease_up_schedule.schedule': 'Periods Lease Up',
  'cash_flow_series.series': 'Periods Cash Flow',
  'distribution_waterfall.stated_schedule': 'Periods Waterfall',
};
function refuse(message: string): never {
  throw new ExcelEmitError('EXCEL-EMIT-PATH', message);
}
function col(n: number): string {
  let out = '';
  while (n > 0) {
    n--;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}
function address(sheet: string, row: number, column: number): string {
  return `'${sheet.replace(/'/g, "''")}'!$${col(column)}$${row}`;
}
function range(sheet: string, first: number, last: number, column: number): string {
  return `${address(sheet, first, column)}:$${col(column)}$${last}`;
}
function numeric(ref: string): string {
  return `IF(ISBLANK(${ref}),NA(),IF(ISNUMBER(${ref}),${ref},VALUE("Non-numeric input")))`;
}
function putValue(cell: ExcelJS.Cell, value: unknown): void {
  if (value === null || value === undefined) cell.value = null;
  else if (typeof value === 'number' && Number.isFinite(value)) cell.value = value;
  else if (typeof value === 'string' || typeof value === 'boolean') cell.value = value;
  else cell.value = { error: '#VALUE!' };
  cell.numFmt = '#,##0.00####;[Red](#,##0.00####);0.00';
  cell.font = { name: 'Arial', size: 10, color: { argb: 'FF0000CC' } };
}
function title(ws: ExcelJS.Worksheet, text: string, source: string): void {
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 5, xSplit: 1 }];
  ws.getCell('A2').value = text;
  ws.getCell('A2').font = { name: 'Arial', size: 14, bold: true };
  const visibleColumns = ws.columns.filter((column) => !column.hidden);
  ws.mergeCells(3, 1, 3, visibleColumns.length);
  ws.getRow(3).height = Math.max(
    16,
    Math.ceil(
      source.length / (visibleColumns.reduce((sum, column) => sum + (column.width ?? 10), 0) * 0.9)
    ) * 16
  );
  ws.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
  ws.getCell('A3').value = source;
  ws.getCell('A3').font = { name: 'Arial', size: 10, italic: true };
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
}
function header(ws: ExcelJS.Worksheet, labels: string[]): void {
  ws.getRow(5).values = labels;
  ws.getRow(5).height = 25;
  ws.getRow(5).eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF243B53' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
}
function leaves(expr: Expr): Expr[] {
  switch (expr.kind) {
    case 'literal':
      if (typeof expr.value !== 'number' || !Number.isFinite(expr.value))
        refuse('Custom Excel calculations require finite numeric literals.');
      return [];
    case 'path':
    case 'ident':
    case 'period_path':
      return [expr];
    case 'unary':
      if (expr.op !== '-') refuse('Custom Excel calculations currently support unary minus only.');
      return leaves(expr.operand);
    case 'binary':
      if (!['+', '-', '*', '/'].includes(expr.op))
        refuse('Custom Excel calculations currently support +, -, *, / only.');
      return [...leaves(expr.left), ...leaves(expr.right)];
    default:
      refuse(
        'Function calls and conditionals need a separate numeric/null-parity contract for custom Excel export.'
      );
  }
}
interface PeriodGroup {
  snapshot: PeriodColumnSnapshot;
  columns: Map<string, { snapshot: PeriodColumnSnapshot; paths: string[] }>;
}

export function writeCustomCalculations(
  wb: ExcelJS.Workbook,
  parsed: ParsedUWFile,
  opts: ToWorkbookOptions
): void {
  if (!opts.calculations?.length) return;
  const requested = [...new Set(opts.calculations)];
  const declarations: Array<{ decl: ModuleCalcDecl; ast: Expr }> = [];
  for (const id of requested) {
    const matches = parsed.custom_calculations.filter(
      (block) => (block.content['id'] ?? block.content['calc_id']) === id
    );
    if (matches.length !== 1)
      refuse(`Custom calculation '${id}' must identify exactly one declaration.`);
    const content = matches[0]!.content;
    if (typeof content['formula'] !== 'string')
      refuse(`Custom calculation '${id}' has no formula.`);
    const ast = parseExpression(content['formula']);
    leaves(ast); // Refuse unsupported expression kinds before constructing sheets.
    declarations.push({
      ast,
      decl: {
        id,
        label: typeof content['label'] === 'string' ? content['label'] : id,
        formula: content['formula'],
        deterministic: true,
        ...(typeof content['unit'] === 'string' ? { unit: content['unit'] } : {}),
        ...(content['round_to'] !== undefined ? { round_to: content['round_to'] as number } : {}),
      },
    });
  }
  const output = wb.addWorksheet(CUSTOM_CALCULATIONS_SHEET);
  output.columns = [{ width: 24 }, { width: 26 }, { width: 20 }, { width: 10 }, { width: 75 }];
  title(
    output,
    'Custom calculations',
    `Source: ${parsed.frontmatter.deal_id ?? 'UW document'}. Additional calculations; standard pack sheets are unchanged.`
  );
  output.getCell('A4').value =
    '#N/A = missing input; #VALUE! = invalid input. These additional inputs are export-only.';
  header(output, ['Calculation', 'Label', 'Result', 'Unit', 'Source expression']);
  wb.definedNames.add(address(output.name, 2, 1), PERIOD_EXPORT_MARKER);

  let inputs: ExcelJS.Worksheet | undefined;
  let inputRow = 6;
  function input(path: string, value: unknown, source: string): { raw: string; guarded: string } {
    if (!inputs) {
      inputs = wb.addWorksheet(CUSTOM_INPUTS_SHEET);
      inputs.columns = [{ width: 70 }, { width: 24 }, { width: 24 }, { width: 24, hidden: true }];
      title(
        inputs,
        'Calculation inputs',
        'Source: stated document values or explicit caller overrides. Blue values are editable.'
      );
      header(inputs, ['Reference', 'Value', 'Origin', 'Numeric guard']);
    }
    const row = inputRow++;
    inputs.getCell(row, 1).value = path;
    putValue(inputs.getCell(row, 2), value);
    inputs.getCell(row, 3).value = source;
    inputs.getCell(row, 4).value = { formula: numeric(`B${row}`) };
    const raw = `uwc_raw_${row}`;
    const guarded = `uwc_value_${row}`;
    wb.definedNames.add(address(inputs.name, row, 2), raw);
    wb.definedNames.add(address(inputs.name, row, 4), guarded);
    return { raw, guarded };
  }
  const context: CalcEvaluationContext = {
    parsed,
    locale: 'en-US',
    prior_results: {},
    ...opts.calculationContext,
  };
  const namedRanges = new Map<string, string>();
  const ordinaryAsts = new Map<string, string>();
  const periodBindings = new Map<string, PeriodExcelBinding>();
  const groups = new Map<string, PeriodGroup>();
  for (const { ast } of declarations) {
    for (const leaf of leaves(ast)) {
      if (leaf.kind === 'period_path') {
        // Core owns canonical spelling (including single-quoted literal keys).
        const canonical = resolveCanonicalPath(leaf);
        if (periodBindings.has(canonical)) continue;
        if (context.overrides && Object.hasOwn(context.overrides, canonical)) {
          const bound = input(canonical, evaluate(leaf, context), 'Caller override');
          periodBindings.set(canonical, { kind: 'override', value_range: bound.raw });
          continue;
        }
        const snapshot = resolvePeriodColumn(parsed, canonical, context);
        const key = JSON.stringify([snapshot.series_path, snapshot.variant]);
        let group = groups.get(key);
        if (!group) {
          group = { snapshot, columns: new Map() };
          groups.set(key, group);
        }
        const field = JSON.stringify(leaf.segments);
        const column = group.columns.get(field);
        if (column) {
          if (!column.paths.includes(snapshot.reference)) column.paths.push(snapshot.reference);
        } else group.columns.set(field, { snapshot, paths: [snapshot.reference] });
      } else if (leaf.kind === 'path' || leaf.kind === 'ident') {
        const path = leaf.kind === 'ident' ? leaf.name : [leaf.head, ...leaf.segments].join('.');
        const shape = JSON.stringify(leaf);
        if (ordinaryAsts.has(path) && ordinaryAsts.get(path) !== shape)
          refuse(`Ambiguous ordinary path spelling '${path}'.`);
        if (namedRanges.has(path)) continue;
        ordinaryAsts.set(path, shape);
        const bound = input(
          path,
          evaluate(leaf, context),
          context.overrides && Object.hasOwn(context.overrides, path)
            ? 'Caller override'
            : 'Stated document'
        );
        namedRanges.set(path, bound.guarded);
      }
    }
  }
  let groupId = 0;
  for (const group of groups.values()) {
    groupId++;
    const snapshot = group.snapshot;
    const ws = wb.addWorksheet(PERIOD_SHEETS[snapshot.series_path]!);
    const columns = [...group.columns.values()];
    const guardColumn = columns.length + 2;
    const originalColumn = columns.length + 3;
    ws.getColumn(1).width = 27;
    columns.forEach((_, i) => {
      ws.getColumn(i + 2).width = 22;
    });
    ws.getColumn(guardColumn).width = 18;
    ws.getColumn(originalColumn).hidden = true;
    title(
      ws,
      snapshot.series_path,
      `Source variant: ${snapshot.variant ?? 'unqualified'}. Edit values; sort whole rows. Re-export to change the period set.`
    );
    ws.getCell('A4').value = 'Period identities';
    header(ws, [
      'Period identity',
      ...[...group.columns.keys()].map((key) =>
        JSON.parse(key)
          .map((s: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : JSON.stringify(s)))
          .join('.')
      ),
      'Identity valid',
      'Source identities',
    ]);
    const first = 6;
    const last = Math.max(first, first + snapshot.rows.length - 1);
    const keys = `uwp_keys_${groupId}`;
    const valid = `uwp_valid_${groupId}`;
    wb.definedNames.add(range(ws.name, first, last, 1), keys);
    wb.definedNames.add(address(ws.name, 4, 2), valid);
    const allowed = `$${col(originalColumn)}$${first}:$${col(originalColumn)}$${last}`;
    const guardRange = `${col(guardColumn)}${first}:${col(guardColumn)}${last}`;
    ws.getCell('B4').value = {
      formula: snapshot.rows.length
        ? `IF(SUM(${guardRange})=${snapshot.rows.length},1,0)`
        : `IF(COUNTA(A${first}:A${last})=0,1,0)`,
    };
    ws.getCell('B4').numFmt = '[=1]"Valid";[=0]"Invalid"';
    snapshot.rows.forEach((row, i) => {
      const rn = first + i;
      ws.getCell(rn, 1).value = row.identity;
      ws.getCell(rn, originalColumn).value = row.identity;
      ws.getCell(rn, guardColumn).value = {
        formula: `IF(AND(COUNTIF(${keys},A${rn})=1,SUMPRODUCT(--EXACT(A${rn},${allowed}))=1),1,0)`,
      };
      ws.getCell(rn, guardColumn).numFmt = '[=1]"Valid";[=0]"Invalid"';
    });
    columns.forEach((column, i) => {
      const byKey = new Map(column.snapshot.rows.map((row) => [row.identity, row.value]));
      if (
        byKey.size !== snapshot.rows.length ||
        snapshot.rows.some((row) => !byKey.has(row.identity))
      )
        refuse('Period source changed while constructing workbook bindings.');
      snapshot.rows.forEach((row, ri) =>
        putValue(ws.getCell(first + ri, i + 2), byKey.get(row.identity))
      );
      const values = `uwp_values_${groupId}_${i + 1}`;
      wb.definedNames.add(range(ws.name, first, last, i + 2), values);
      for (const path of column.paths)
        periodBindings.set(path, {
          kind: 'series',
          keys_range: keys,
          values_range: values,
          valid_range: valid,
        });
    });
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: last, column: guardColumn } };
    ws.addConditionalFormatting({
      ref: `A${first}:${col(guardColumn)}${last}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [`$${col(guardColumn)}${first}=0`],
          style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } } },
        },
      ],
    });
    ws.pageSetup.printArea = `A1:${col(guardColumn)}${last}`;
  }
  declarations.forEach(({ decl }, i) => {
    const row = i + 6;
    output.getCell(row, 1).value = decl.id;
    output.getCell(row, 2).value = decl.label;
    output.getCell(row, 3).value = {
      formula: emitCalcExcelFormula(decl, { namedRanges, periodBindings }),
    };
    output.getCell(row, 3).numFmt = '#,##0.00####;[Red](#,##0.00####);0.00';
    output.getCell(row, 4).value = decl.unit ?? '';
    output.getCell(row, 5).value = decl.formula;
    output.getCell(row, 5).alignment = { wrapText: true, vertical: 'top' };
    output.getRow(row).height = Math.max(18, Math.ceil(decl.formula.length / 65) * 14);
  });
  output.pageSetup.printArea = `A1:E${declarations.length + 5}`;
  wb.calcProperties.fullCalcOnLoad = true;
}

// Use the dependency extractor's canonical representation instead of treating
// quotes or a literal dotted leaf as ordinary nested traversal.
function resolveCanonicalPath(expr: Expr): string {
  return getExprDependencies(expr)[0]!;
}
