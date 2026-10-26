import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { evaluate, generateBlankUWFile, parseExpression, parseUWFile } from '@uwmd/core';
import type { AssetClass, DealStage } from '@uwmd/core';
import type { WorkbookLayout } from './layout.js';
import { SUBTOTAL_STATUS } from './layout.js';
import { fromWorkbook, WorkbookImportError } from './fromWorkbook.js';
import { toWorkbook } from './toWorkbook.js';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';

const EXAMPLES = resolve(__dirname, '../../../examples');

const CASES = [
  'Parkview-Apts-Glendale-AZ.uwx.md',
  'Riverside-Office-Phoenix-AZ.uwx.md',
  'Cactus-Crossing-Retail-Mesa-AZ.uwx.md',
  'Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md',
  'Sonoran-Self-Storage-Peoria-AZ.uwx.md',
  'Saguaro-Select-Hotel-Tempe-AZ.uwx.md',
  'Ocotillo-Senior-Living-Chandler-AZ.uwx.md',
  'Mill-Ave-Commons-Student-Tempe-AZ.uwx.md',
  'Sundance-Ranch-Land-Buckeye-AZ.uwx.md',
] as const;

function valueAt(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (value, segment) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined),
    source,
  );
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

function expectedSections(parsed: ReturnType<typeof parseUWFile>, layout: WorkbookLayout): Record<string, Record<string, unknown>> {
  const sections: Record<string, Record<string, unknown>> = {};
  for (const input of layout.namedInputs) {
    const target = sectionFor(sections, input.source.section);
    const source = parsed.sections[input.source.section]?.content as Record<string, unknown>;
    // The corrected generic cash-on-cash input is selected by stated year,
    // while the import still returns the layout's ordinary editable fragment.
    const value = input.name === 'levered_cash_flow_y1'
      ? (source?.['annual_cash_flows'] as Record<string, unknown>[] | undefined)?.find((row) => row['year'] === 1)?.['net_cash_flow_levered']
      : valueAt(source, input.source.path);
    // Editable blank cells import as null, including absent optional equity/Y1 inputs.
    setPath(target, input.source.path, value ?? null);
  }
  const noi = parsed.sections.noi_model!.content as Record<string, unknown>;
  const noiTarget = sectionFor(sections, 'noi_model');
  for (const line of layout.incomeLines) {
    setPath(noiTarget, `income.${line.path}`, valueAt(noi, `income.${line.path}`));
  }
  for (const line of layout.expenseLines) {
    setPath(noiTarget, `expenses.${line.path}`, valueAt(noi, `expenses.${line.path}`));
  }
  return sections;
}

async function workbookFor(file: string): Promise<{ wb: ExcelJS.Workbook; parsed: ReturnType<typeof parseUWFile>; layout: WorkbookLayout }> {
  const raw = await readFile(resolve(EXAMPLES, file), 'utf8');
  const parsed = parseUWFile(raw);
  const layout = getLayoutForAssetClass(String(parsed.frontmatter.asset_class));
  if (!layout) {
    throw new WorkbookImportError(
      'WORKBOOK-IMPORT-ASSET-CLASS',
      `Missing layout for ${file}`,
    );
  }
  const generated = await toWorkbook(parsed);
  const buf = await generated.xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  return { wb, parsed, layout };
}

describe('fromWorkbook', () => {
  for (const file of CASES) {
    it(`round-trips editable section fragments for ${file}`, async () => {
      const { wb, parsed, layout } = await workbookFor(file);
      const imported = fromWorkbook(wb);
      expect(imported.asset_class).toBe(layout.assetClass);
      expect(imported.sections).toEqual(expectedSections(parsed, layout));
      // Every workbook this converter writes carries a UW MCP sheet, so the
      // import surfaces the source identity it was produced from.
      expect(imported.contract?.producer.pack_id).toBe(layout.pack.id);
      expect(imported.contract?.document.asset_class).toBe(layout.assetClass);
    });
  }

  it('discards formula-derived metrics even when a cached cell is altered', async () => {
    const { wb, parsed, layout } = await workbookFor(CASES[0]);
    const derivedMetricStart = 10 + layout.namedInputs.length;
    wb.getWorksheet('Underwriting')!.getCell(`B${derivedMetricStart}`).value = 999_999_999;

    const imported = fromWorkbook(wb);
    expect(imported.sections).toEqual(expectedSections(parsed, layout));
    expect(JSON.stringify(imported)).not.toContain('999999999');
    expect(imported.sections.noi_model).not.toHaveProperty('net_operating_income');
    expect(imported.sections.noi_model).not.toHaveProperty('_meta');
  });

  it('rejects a workbook whose declared asset class disagrees with its contract', async () => {
    const { wb } = await workbookFor(CASES[0]);
    wb.getWorksheet('Underwriting')!.getCell('B3').value = 'unknown_class';

    // The UW MCP sheet still says multifamily. One of the two was edited and
    // the other was not, so neither can be trusted.
    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({
      code: 'WORKBOOK-IMPORT-ASSET-CLASS',
    }));
  });

  it('rejects a contract-less workbook with an unknown asset class', async () => {
    const { wb } = await workbookFor(CASES[0]);
    wb.removeWorksheet(wb.getWorksheet('UW MCP')!.id);
    wb.getWorksheet('Underwriting')!.getCell('B3').value = 'unknown_class';

    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({
      code: 'WORKBOOK-IMPORT-ASSET-CLASS',
    }));
  });

  it('rejects a workbook missing a required named range', async () => {
    const { wb, layout } = await workbookFor(CASES[0]);
    const name = layout.namedInputs[0].name;
    const range = wb.definedNames.getRanges(name).ranges[0];
    wb.definedNames.remove(range, name);

    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({
      code: 'WORKBOOK-IMPORT-NAMED-RANGE',
    }));
  });

  it('rejects a workbook with a tampered subtotal formula', async () => {
    const { wb, layout } = await workbookFor(CASES[0]);
    const egiRow = 2 + layout.incomeLines.length;
    wb.getWorksheet('Operating Statement')!.getCell(`B${egiRow}`).value = { formula: '1+1' };

    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({
      code: 'WORKBOOK-IMPORT-SUBTOTAL',
    }));
  });
});

describe('fromWorkbook — mixed_use per-component statements (#411)', () => {
  const FILE = 'Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md';
  async function exported(): Promise<{ wb: ExcelJS.Workbook; components: Record<string, Record<string, unknown>> }> {
    const parsed = parseUWFile(await readFile(resolve(EXAMPLES, FILE), 'utf8'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await toWorkbook(parsed)).xlsx.writeBuffer());
    const block = parsed.sections.components as { content: Record<string, Record<string, unknown>> };
    return { wb, components: block.content };
  }

  const basisSource = (basis: string) => '---\nuw_version: "3.0"\nasset_class: mixed_use\ncurrency_code: USD\n---\n\n```json uw:section=debt_structure\n' + JSON.stringify({ ltv_basis: basis }) + '\n```\n';
  const named = (wb: ExcelJS.Workbook, name: string) => {
    const range = wb.definedNames.getRanges(name).ranges[0]!;
    const [sheet, reference] = range.split('!');
    return wb.getWorksheet(sheet!.replace(/^'|'$/g, ''))!.getCell(reference!.replace(/\$/g, ''));
  };

  it.each(['purchase-price', 'underwritten-value', 'total-project-cost'])('round-trips the authored LTV basis %s (#561)', async basis => {
    const { wb } = await exportedFrom(basisSource(basis));
    const imported = fromWorkbook(wb);
    expect(imported.sections.debt_structure!.ltv_basis).toBe(basis);
    expect(imported.sections.debt_structure!.ltv).toBeUndefined();
  });

  it.each([null, ''])('keeps a blank LTV basis as null: %s', async value => {
    const { wb } = await exportedFrom(basisSource('purchase-price'));
    named(wb, 'debt_structure_ltv_basis').value = value;
    expect(fromWorkbook(wb).sections.debt_structure!.ltv_basis).toBeNull();
  });

  it.each([123, false, { formula: '"purchase-price"', result: 'purchase-price' }])('refuses a non-text LTV basis cell: %j', async value => {
    const { wb } = await exportedFrom(basisSource('purchase-price'));
    named(wb, 'debt_structure_ltv_basis').value = value;
    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({ code: 'WORKBOOK-IMPORT-NAMED-RANGE' }));
  });

  it('keeps numeric inputs strict beside the text basis', async () => {
    const { wb } = await exportedFrom(basisSource('purchase-price'));
    named(wb, 'debt_structure_loan_amount').value = '1000';
    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({ code: 'WORKBOOK-IMPORT-NAMED-RANGE' }));
  });

  it('recovers each component\'s stated inputs, and never a formula-derived NOI', async () => {
    const { wb, components } = await exported();
    const imported = fromWorkbook(wb);
    expect(imported.asset_class).toBe('mixed_use');
    const got = imported.sections.components as Record<string, Record<string, unknown>>;
    expect(Object.keys(got).sort()).toEqual(['hospitality', 'multifamily', 'retail']);
    for (const [cls, comp] of Object.entries(got)) {
      expect(comp.net_operating_income, cls).toBeUndefined();
      for (const [field, value] of Object.entries(comp)) expect(value, `${cls}.${field}`).toBe(components[cls]![field]);
    }
    expect(got.hospitality!.gross_operating_profit).toBe(1400000);
    expect(imported.sections.valuation).toEqual({ purchase_price: 40000000, underwritten_value: 40000000 });
  });

  it('refuses a workbook whose component NOI footing was altered', async () => {
    const { wb } = await exported();
    const range = wb.definedNames.getRanges('components_retail_net_operating_income').ranges[0]!;
    const [, ref] = range.split('!');
    wb.getWorksheet('Operating Statement')!.getCell(ref!.replace(/\$/g, '')).value = 500000;
    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({ code: 'WORKBOOK-IMPORT-SUBTOTAL' }));
  });

  it('refuses a workbook whose consolidated NOI was altered', async () => {
    const { wb } = await exported();
    const range = wb.definedNames.getRanges('noi_model_net_operating_income').ranges[0]!;
    const [, ref] = range.split('!');
    wb.getWorksheet('Operating Statement')!.getCell(ref!.replace(/\$/g, '')).value = { formula: 'components_retail_net_operating_income', result: undefined };
    expect(() => fromWorkbook(wb)).toThrow(WorkbookImportError);
  });
});

// ─── #484: import accepts every subtotal form the exporter writes ────────────
//
// toWorkbook() writes a statement subtotal as a live formula, as the stated
// source subtotal retained as an editable input (a totals-only record), or as
// #N/A when the source subtotal is absent. An unedited workbook in any of those
// forms imports; a subtotal changed to anything the exporter does not write
// refuses.

const STAGES: readonly DealStage[] = [
  'scope', 'screening', 'term_sheet', 'full_underwrite', 'credit_approval', 'closing', 'monitoring',
];

/** Replace the payload of a record's single noi_model block, keeping its _meta. */
function withNoiModel(text: string, payload: Record<string, unknown>): string {
  const match = /(```json uw:section=noi_model[^\n]*\n)([\s\S]*?)(\n```)/.exec(text);
  if (!match) throw new Error('no noi_model block');
  const meta = (JSON.parse(match[2]!) as Record<string, unknown>)._meta;
  return text.replace(match[0], `${match[1]}${JSON.stringify({ _meta: meta, ...payload }, null, 2)}${match[3]}`);
}

const TOTALS_ONLY = {
  income: { effective_gross_income: 100000 },
  expenses: { total_operating_expenses: 40000 },
  net_operating_income: 60000,
};

async function exportedFrom(text: string): Promise<{ wb: ExcelJS.Workbook; parsed: ReturnType<typeof parseUWFile> }> {
  const parsed = parseUWFile(text);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await (await toWorkbook(parsed)).xlsx.writeBuffer() as ArrayBuffer);
  return { wb, parsed };
}

function leaves(value: unknown, prefix: string, out: Array<[string, unknown]>): Array<[string, unknown]> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, out);
  } else out.push([prefix, value]);
  return out;
}

/**
 * Every imported leaf equals the source record's value at that path, read the
 * way the calc engine reads it (absent is null). Returns the compared paths.
 */
function expectImportMatchesSource(
  imported: Record<string, Record<string, unknown>>,
  parsed: ReturnType<typeof parseUWFile>,
): string[] {
  const paths: string[] = [];
  for (const [section, fragment] of Object.entries(imported)) {
    for (const [path, value] of leaves(fragment, '', [])) {
      const source = evaluate(parseExpression(`${section}.${path}`), { parsed, prior_results: {}, locale: 'en-US' });
      expect(value, `${section}.${path}`).toEqual(source ?? null);
      paths.push(`${section}.${path}`);
    }
  }
  return paths;
}

function subtotalCell(wb: ExcelJS.Workbook, name: string): ExcelJS.Cell {
  const [, ref] = wb.definedNames.getRanges(name).ranges[0]!.split('!');
  return wb.getWorksheet('Operating Statement')!.getCell(ref!.replace(/\$/g, ''));
}

describe('fromWorkbook — exporter subtotal forms (#484)', () => {
  for (const assetClass of SUPPORTED_ASSET_CLASSES) {
    it(`imports every unedited ${assetClass} init workbook, at every deal stage`, async () => {
      for (const dealStage of STAGES) {
        const text = generateBlankUWFile({ assetClass: assetClass as AssetClass, dealStage });
        const { wb, parsed } = await exportedFrom(text);
        const imported = fromWorkbook(wb);
        expect(imported.asset_class, dealStage).toBe(assetClass);
        expect(expectImportMatchesSource(imported.sections, parsed).length, dealStage).toBeGreaterThan(0);
      }
    });
  }

  it('imports a totals-only record and carries its retained subtotals back', async () => {
    const text = withNoiModel(generateBlankUWFile({ assetClass: 'office' }), TOTALS_ONLY);
    const { wb, parsed } = await exportedFrom(text);
    expect(subtotalCell(wb, 'effective_gross_income').value).toBe(100000);
    expect(subtotalCell(wb, 'noi').value).toMatchObject({ formula: expect.any(String) });
    const imported = fromWorkbook(wb);
    const paths = expectImportMatchesSource(imported.sections, parsed);
    expect(paths).toEqual(expect.arrayContaining([
      'noi_model.income.effective_gross_income',
      'noi_model.expenses.total_operating_expenses',
    ]));
    // NOI is the live EGI - OpEx formula over the retained inputs: formula-derived, never imported.
    expect(imported.sections.noi_model).not.toHaveProperty('net_operating_income');
  });

  it('imports an edited retained subtotal, which the workbook documents as editable', async () => {
    const { wb } = await exportedFrom(withNoiModel(generateBlankUWFile({ assetClass: 'office' }), TOTALS_ONLY));
    subtotalCell(wb, 'effective_gross_income').value = 125000;
    const income = fromWorkbook(wb).sections.noi_model!.income as Record<string, unknown>;
    expect(income.effective_gross_income).toBe(125000);
  });

  const refuses = (wb: ExcelJS.Workbook) =>
    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({ code: 'WORKBOOK-IMPORT-SUBTOTAL' }));

  it('refuses a value typed over a live subtotal formula', async () => {
    const { wb } = await workbookFor(CASES[0]);
    subtotalCell(wb, 'effective_gross_income').value = 1_000_000;
    refuses(wb);
  });

  it('refuses a value typed over a missing-subtotal #N/A', async () => {
    const { wb } = await exportedFrom(generateBlankUWFile({ assetClass: 'office' }));
    expect(subtotalCell(wb, 'noi').value).toEqual({ error: '#N/A' });
    subtotalCell(wb, 'noi').value = 60000;
    refuses(wb);
  });

  it('refuses a formula written over a retained subtotal', async () => {
    const { wb } = await exportedFrom(withNoiModel(generateBlankUWFile({ assetClass: 'office' }), TOTALS_ONLY));
    // Even the exact live SUM the exporter writes for a record with detail: this
    // record's form for the row is the retained input, marked in column C.
    subtotalCell(wb, 'total_operating_expenses').value = { formula: 'SUM(B7:B12)', result: undefined } as ExcelJS.CellFormulaValue;
    refuses(wb);
  });

  it('refuses a non-formula subtotal without the status text the exporter writes beside it', async () => {
    const { wb } = await exportedFrom(withNoiModel(generateBlankUWFile({ assetClass: 'office' }), TOTALS_ONLY));
    const cell = subtotalCell(wb, 'effective_gross_income');
    expect(cell.worksheet.getCell(cell.row, 3).value).toBe(SUBTOTAL_STATUS.retained);
    cell.worksheet.getCell(cell.row, 3).value = null;
    refuses(wb);

    const missing = await exportedFrom(generateBlankUWFile({ assetClass: 'office' }));
    const na = subtotalCell(missing.wb, 'effective_gross_income');
    expect(na.worksheet.getCell(na.row, 3).value).toBe(SUBTOTAL_STATUS.missing);
    na.worksheet.getCell(na.row, 3).value = SUBTOTAL_STATUS.retained;
    refuses(missing.wb);
  });

  it('refuses a formula over a mixed-use consolidated NOI that has no component to consolidate', async () => {
    const { wb } = await exportedFrom(generateBlankUWFile({ assetClass: 'mixed_use' }));
    const cell = subtotalCell(wb, 'noi_model_net_operating_income');
    expect(cell.value).toEqual({ error: '#N/A' });
    cell.value = { formula: '0', result: undefined } as ExcelJS.CellFormulaValue;
    expect(() => fromWorkbook(wb)).toThrow(expect.objectContaining({ code: 'WORKBOOK-IMPORT-SUBTOTAL' }));
  });
});
