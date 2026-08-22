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
import {
  parseUWFile,
  evaluateCalc,
  emitExcelFormula,
  quantizeDecimal,
  resolveRoundTo,
} from '@uwmd/core';
import type { CalcEvaluationContext } from '@uwmd/core';
import { toWorkbook, UnsupportedAssetClassError } from './toWorkbook.js';
import { buildNamedRangeMap, SUBTOTAL_RANGES } from './layout.js';
import type { WorkbookLayout } from './layout.js';
import { MULTIFAMILY_LAYOUT } from './multifamily.js';
import { OFFICE_LAYOUT } from './office.js';
import { RETAIL_LAYOUT } from './retail.js';
import { INDUSTRIAL_LAYOUT } from './industrial.js';
import { SELF_STORAGE_LAYOUT } from './self-storage.js';
import { HOSPITALITY_LAYOUT } from './hospitality.js';
import { SENIOR_HOUSING_LAYOUT } from './senior-housing.js';
import { STUDENT_HOUSING_LAYOUT } from './student-housing.js';
import { LAND_LAYOUT } from './land.js';
import {
  MIXED_USE_LAYOUT,
  MIXED_USE_COMPONENT_SPECS,
  buildMixedUseNamedRangeMap,
  mixedUseName,
} from './mixed-use.js';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';

/**
 * A deliberately synthetic asset class that is not — and must never become — a
 * member of the `AssetClass` union, so the "no layout for this class" tests stay
 * valid once every real class ships a workbook layout.
 */
const UNREGISTERED_CLASS = '__unregistered_test_class__';

const EXAMPLES = resolve(__dirname, '../../../examples');

const CASES: ReadonlyArray<{ file: string; layout: WorkbookLayout }> = [
  { file: 'Parkview-Apts-Glendale-AZ.uwx.md', layout: MULTIFAMILY_LAYOUT },
  // The RFC 0026 worked example: a multifamily deal financed by a four-layer
  // stack. It runs the standard multifamily suite here; its Capital Stack
  // sheet is asserted separately below.
  { file: 'Agave-Court-Apts-Scottsdale-AZ.uwx.md', layout: MULTIFAMILY_LAYOUT },
  { file: 'Riverside-Office-Phoenix-AZ.uwx.md', layout: OFFICE_LAYOUT },
  { file: 'Cactus-Crossing-Retail-Mesa-AZ.uwx.md', layout: RETAIL_LAYOUT },
  { file: 'Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md', layout: INDUSTRIAL_LAYOUT },
  { file: 'Sonoran-Self-Storage-Peoria-AZ.uwx.md', layout: SELF_STORAGE_LAYOUT },
  { file: 'Saguaro-Select-Hotel-Tempe-AZ.uwx.md', layout: HOSPITALITY_LAYOUT },
  { file: 'Ocotillo-Senior-Living-Chandler-AZ.uwx.md', layout: SENIOR_HOUSING_LAYOUT },
  { file: 'Mill-Ave-Commons-Student-Tempe-AZ.uwx.md', layout: STUDENT_HOUSING_LAYOUT },
  { file: 'Sundance-Ranch-Land-Buckeye-AZ.uwx.md', layout: LAND_LAYOUT },
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
      'hospitality',
      'industrial',
      'land',
      'mixed_use',
      'multifamily',
      'office',
      'retail',
      'self_storage',
      'senior_housing',
      'student_housing',
    ]);
  });

  it('returns null for an unregistered class', () => {
    expect(getLayoutForAssetClass(UNREGISTERED_CLASS)).toBeNull();
  });

  it('toWorkbook throws UnsupportedAssetClassError for an unregistered class', async () => {
    const parsed = parseUWFile(
      [
        '---',
        'uw_version: "1.1"',
        'deal_id: "x"',
        'deal_name: "X"',
        `asset_class: "${UNREGISTERED_CLASS}"`,
        '---',
        '# X',
      ].join('\n'),
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

    it('every derived metric matches evaluateCalc exactly (Excel↔evaluator parity)', async () => {
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
        // Excel's cell holds ROUND(expr, round_to) because the emitter wraps it
        // (§VIII.5), so the simulated result is quantized the same way. Parity is
        // then *exact* rather than approximate: one identical rounding rule on
        // both sides, which is the whole point of having a quantization boundary.
        const excelCell = quantizeDecimal(excelLike, resolveRoundTo(decl));
        expect(excelCell, decl.id).toBe(direct.value as number);
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

// ─── Capital stack (RFC 0026) — the worked example gains the sheet ───────────
//
// The sheet's formula-level behavior is covered by capital-stack.test.ts; this
// asserts the example deal actually carries it (and that its stack-less peers
// do not), so the worked example cannot drift away from the feature it exists
// to demonstrate.

describe('toWorkbook — capital stack on the worked example', () => {
  it('the RFC 0026 example workbook carries a Capital Stack sheet with a verified-shape verdict', async () => {
    const wb = await roundTrip('Agave-Court-Apts-Scottsdale-AZ.uwx.md');
    const ws = wb.getWorksheet('Capital Stack');
    expect(ws).toBeTruthy();
    const labels = new Map<string, number>();
    ws!.eachRow((row, idx) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') labels.set(v, idx);
    });
    // one row per tranche, the SUM total, and the live verdict
    for (const label of ['senior', 'mezz', 'pref', 'common', 'Total Capitalization', 'Verdict']) {
      expect(labels.has(label), label).toBe(true);
    }
  });

  it('a stack-less example produces no Capital Stack sheet', async () => {
    const wb = await roundTrip('Parkview-Apts-Glendale-AZ.uwx.md');
    expect(wb.getWorksheet('Capital Stack')).toBeUndefined();
  });
});

// ─── Mixed-use (RFC 0019) ────────────────────────────────────────────────────
//
// Mixed-use has a different workbook shape — per-component operating statements
// plus a consolidation block — so it is not part of the single-statement CASES
// loop above. It gets its own parity/footing suite here. The excel suite gains
// these tests (RFC 0019 test plan: the count must rise by ≥4); if a mixed-use
// metric were silently skipped, the present-metric parity test would still hold
// it to `evaluateCalc`, and the absent-metric test would catch an emitted row.

const MIXED_USE_FILE = 'Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md';

/** Read a dotted field path out of a parsed file's sections, or null. */
function sectionPathNumber(parsed: ReturnType<typeof parseUWFile>, path: string): number | null {
  const dot = path.indexOf('.');
  const section = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  const sec = parsed.sections[section] as { content?: Record<string, unknown> } | undefined;
  let cur: unknown = sec?.content;
  for (const p of rest.split('.')) {
    cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[p] : undefined;
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
}

function presentComponents(parsed: ReturnType<typeof parseUWFile>): typeof MIXED_USE_COMPONENT_SPECS {
  const comps = (parsed.sections['components'] as { content?: Record<string, unknown> } | undefined)
    ?.content ?? {};
  return MIXED_USE_COMPONENT_SPECS.filter((s) => comps[s.componentClass] != null);
}

describe(`toWorkbook — mixed_use (${MIXED_USE_FILE})`, () => {
  const MIXED_USE_PROPERTY_PATHS = [
    'valuation.purchase_price',
    'debt_structure.loan_amount',
    'debt_structure.annual_debt_service',
    'sources_uses.sources.equity_sponsor',
  ];

  it('registers a mixed-use layout carrying the component spec', () => {
    const layout = getLayoutForAssetClass('mixed_use');
    expect(layout).toBe(MIXED_USE_LAYOUT);
    expect(layout?.mixedUse?.components.length).toBeGreaterThanOrEqual(8);
  });

  it('writes each property input as a named range holding the stored value', async () => {
    const wb = await roundTrip(MIXED_USE_FILE);
    const parsed = parseUWFile(await readFile(resolve(EXAMPLES, MIXED_USE_FILE), 'utf8'));
    for (const path of MIXED_USE_PROPERTY_PATHS) {
      const name = mixedUseName(path);
      expect(namedNumber(wb, name), name).toBe(sectionPathNumber(parsed, path));
    }
  });

  it('per-component statements foot and component NOIs sum to the property NOI (§3a)', async () => {
    const parsed = parseUWFile(await readFile(resolve(EXAMPLES, MIXED_USE_FILE), 'utf8'));
    const present = presentComponents(parsed);
    expect(present.length).toBeGreaterThanOrEqual(2);

    let noiSum = 0;
    for (const spec of present) {
      const base = `components.${spec.componentClass}`;
      const egi = sectionPathNumber(parsed, `${base}.effective_gross_income`);
      const opex = sectionPathNumber(parsed, `${base}.operating_expenses`);
      const noi = sectionPathNumber(parsed, `${base}.net_operating_income`);
      expect(egi, `${spec.componentClass} EGI`).not.toBeNull();
      expect(opex, `${spec.componentClass} opex`).not.toBeNull();
      expect(noi, `${spec.componentClass} NOI`).not.toBeNull();
      // the component statement foots: EGI − opex = NOI
      expect((egi as number) - (opex as number)).toBeCloseTo(noi as number, 6);
      noiSum += noi as number;
    }
    // the §3a property foot
    expect(noiSum).toBeCloseTo(
      sectionPathNumber(parsed, 'noi_model.net_operating_income') as number,
      6,
    );
  });

  it('the consolidation cell sums exactly the present components as a live formula', async () => {
    const wb = await roundTrip(MIXED_USE_FILE);
    const parsed = parseUWFile(await readFile(resolve(EXAMPLES, MIXED_USE_FILE), 'utf8'));
    const propName = mixedUseName('noi_model.net_operating_income');
    const ranges = wb.definedNames.getRanges(propName);
    expect(ranges.ranges.length, 'property NOI named range exists').toBe(1);
    const cell = cellAt(wb, ranges.ranges[0]);
    const formula = (cell?.value as { formula?: string } | undefined)?.formula ?? '';
    // one term per present component NOI named range, added together
    const expectedTerms = presentComponents(parsed)
      .map((s) => mixedUseName(`components.${s.componentClass}.net_operating_income`))
      .join('+');
    expect(formula).toBe(expectedTerms);
  });

  it('every emitted derived metric matches evaluateCalc exactly (Excel↔evaluator parity)', async () => {
    const wb = await roundTrip(MIXED_USE_FILE);
    const parsed = parseUWFile(await readFile(resolve(EXAMPLES, MIXED_USE_FILE), 'utf8'));
    const map = buildMixedUseNamedRangeMap();
    const ctx: CalcEvaluationContext = { parsed, prior_results: {}, locale: 'en-US' };

    // Every path a mixed-use formula can read, keyed by its workbook-scope name.
    // Property inputs are read back from the workbook (proving the cells hold the
    // right values); component + property-NOI subtotals come from the (footing)
    // stored document, exactly as the single-statement parity test does.
    const values: Record<string, number> = {};
    for (const [path, name] of map) {
      const v =
        path === 'valuation.purchase_price' ||
        path === 'debt_structure.loan_amount' ||
        path === 'debt_structure.annual_debt_service' ||
        path === 'sources_uses.sources.equity_sponsor'
          ? namedNumber(wb, name)
          : sectionPathNumber(parsed, path);
      if (v !== null) values[name] = v;
    }

    const underwriting = wb.getWorksheet('Underwriting')!;
    const labelToRow = rowByLabel(underwriting);
    let checked = 0;

    for (const decl of MIXED_USE_LAYOUT.pack.calculations ?? []) {
      const direct = evaluateCalc(decl, ctx);
      expect(direct.ok, `${decl.id} evaluateCalc`).toBe(true);

      if (direct.value === null) {
        // absent component / un-allocated intensive → no row emitted
        expect(labelToRow.has(decl.label), `${decl.id} should be omitted`).toBe(false);
        continue;
      }

      // present metric → the workbook has its row, and its formula parities
      expect(labelToRow.has(decl.label), `${decl.id} should be emitted`).toBe(true);
      let formula = emitExcelFormula(decl.formula, { namedRanges: map });
      for (const name of Object.keys(values)) {
        formula = formula.replace(new RegExp(`\\b${name}\\b`, 'g'), String(values[name]));
      }
      expect(/^[\d.+\-*/() ]+$/.test(formula), `${decl.id} sanitized: ${formula}`).toBe(true);
      // eslint-disable-next-line no-new-func
      const excelLike = new Function(`return (${formula});`)() as number;
      const excelCell = quantizeDecimal(excelLike, resolveRoundTo(decl));
      expect(excelCell, decl.id).toBe(direct.value as number);
      checked++;
    }
    // guard against a vacuous pass: the fixture must exercise real metrics
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it('omits derived-metric rows for absent component classes', async () => {
    const wb = await roundTrip(MIXED_USE_FILE);
    const underwriting = wb.getWorksheet('Underwriting')!;
    const labels = new Set([...rowByLabel(underwriting).keys()]);
    // office/industrial/self-storage/senior/student are absent from the fixture
    for (const label of [
      'Office NOI Share',
      'Industrial NOI Share',
      'Self-Storage NOI Share',
      'Senior Housing NOI Share',
      'Student Housing NOI Share',
      'Senior Housing Total Labor Expense',
    ]) {
      expect(labels.has(label), label).toBe(false);
    }
  });

  it('writes a Pipeline Log sheet with one row per pipeline_log entry', async () => {
    const wb = await roundTrip(MIXED_USE_FILE);
    const parsed = parseUWFile(await readFile(resolve(EXAMPLES, MIXED_USE_FILE), 'utf8'));
    const ws = wb.getWorksheet('Pipeline Log')!;
    expect(ws.rowCount).toBe(1 + parsed.pipeline_log.length);
  });
});
