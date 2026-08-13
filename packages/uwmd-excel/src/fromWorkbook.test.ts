import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { parseUWFile } from '@uwmd/core';
import type { WorkbookLayout } from './layout.js';
import { fromWorkbook, WorkbookImportError } from './fromWorkbook.js';
import { toWorkbook } from './toWorkbook.js';
import { getLayoutForAssetClass } from './layouts.js';

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
    setPath(target, input.source.path, valueAt(source, input.source.path));
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
