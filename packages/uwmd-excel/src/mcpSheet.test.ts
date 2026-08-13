// UW MCP sheet tests — contract content, round-trip through a real .xlsx, and
// the three-state verification that keeps "cannot tell" apart from "wrong".

import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { parseUWFile, toUWEnvelope, computeEnvelopeDigest } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import { MULTIFAMILY_LAYOUT } from './multifamily.js';
import { LAND_LAYOUT } from './land.js';
import {
  MCP_SHEET_NAME,
  MCP_SHEET_VERSION,
  buildWorkbookContract,
  readWorkbookContract,
  verifyWorkbookContract,
} from './mcpSheet.js';

const EXAMPLES = resolve(__dirname, '../../../examples');
const PARKVIEW = 'Parkview-Apts-Glendale-AZ.uwx.md';
const SUNDANCE = 'Sundance-Ranch-Land-Buckeye-AZ.uwx.md';

async function parse(file: string) {
  return parseUWFile(await readFile(resolve(EXAMPLES, file), 'utf8'));
}

async function roundTrip(file: string): Promise<ExcelJS.Workbook> {
  const wb = await toWorkbook(await parse(file));
  const buf = await wb.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buf as ArrayBuffer);
  return reloaded;
}

describe('buildWorkbookContract', () => {
  it('captures document identity, producer, and the source digest', async () => {
    const parsed = await parse(PARKVIEW);
    const contract = await buildWorkbookContract(parsed, MULTIFAMILY_LAYOUT);

    expect(contract.mcp_sheet_version).toBe(MCP_SHEET_VERSION);
    expect(contract.document.asset_class).toBe('multifamily');
    expect(contract.document.deal_id).toBe(parsed.frontmatter.deal_id);
    expect(contract.producer.pack_id).toBe(MULTIFAMILY_LAYOUT.pack.id);
    expect(contract.producer.pack_version).toBe(MULTIFAMILY_LAYOUT.pack.version);

    const expected = await computeEnvelopeDigest(toUWEnvelope(parsed));
    expect(contract.document.source_semantic_digest).toBe(expected);
    expect(contract.document.source_semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('publishes every pack metric in calc-engine source form, not Excel form', async () => {
    const contract = await buildWorkbookContract(await parse(PARKVIEW), MULTIFAMILY_LAYOUT);
    const ids = contract.metrics.map((m) => m.id).sort();
    const packIds = (MULTIFAMILY_LAYOUT.pack.calculations ?? []).map((c) => c.id).sort();
    expect(ids).toEqual(packIds);

    // The dictionary is what lets a reader understand the model, so it must
    // carry the calc source (dotted field paths), never the Excel translation
    // (named ranges). A '/' with dotted paths on both sides proves the former.
    const capRate = contract.metrics.find((m) => m.id === 'cap_rate')!;
    expect(capRate.formula).toContain('noi_model.net_operating_income');
    expect(capRate.formula).toContain('valuation.purchase_price');
  });

  it('lists sibling representations from the shared codec registry', async () => {
    const contract = await buildWorkbookContract(await parse(PARKVIEW), MULTIFAMILY_LAYOUT);
    const ids = contract.representations.map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('uw-json');
    for (const r of contract.representations) {
      expect(r.media_types.length).toBeGreaterThan(0);
      expect(r.representation_version).toBeTruthy();
    }
  });

  it('states the assurance boundary rather than implying the workbook is canonical', async () => {
    const contract = await buildWorkbookContract(await parse(PARKVIEW), MULTIFAMILY_LAYOUT);
    expect(contract.assurance.workbook_is).toBe('view');
    expect(contract.assurance.canonical_record).toContain('.uw.md');
    expect(contract.assurance.derived_metrics_are).toContain('pack-owned');
    expect(contract.assurance.inputs_apply_via).toContain('Tier-2');
    expect(contract.assurance.digest_proves).toContain('not input truth');
  });

  it('is stable across re-exports of an unchanged document', async () => {
    const parsed = await parse(PARKVIEW);
    const first = await buildWorkbookContract(parsed, MULTIFAMILY_LAYOUT);
    const second = await buildWorkbookContract(parsed, MULTIFAMILY_LAYOUT);
    // Stability is what makes staleness detectable at all — a digest that moved
    // on every export would make every workbook look stale.
    expect(second.document.source_semantic_digest).toBe(first.document.source_semantic_digest);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('handles land, whose pack omits the income metrics entirely', async () => {
    const contract = await buildWorkbookContract(await parse(SUNDANCE), LAND_LAYOUT);
    const ids = contract.metrics.map((m) => m.id);
    expect(ids).toContain('price_per_buildable_unit');
    expect(ids).not.toContain('cap_rate');
    expect(ids).not.toContain('dscr');
  });
});

describe('UW MCP sheet round-trip', () => {
  it('survives a real .xlsx write/read cycle', async () => {
    const wb = await roundTrip(PARKVIEW);
    expect(wb.getWorksheet(MCP_SHEET_NAME)).toBeTruthy();

    const contract = readWorkbookContract(wb);
    expect(contract).not.toBeNull();
    expect(contract!.document.asset_class).toBe('multifamily');
    expect(contract!.producer.pack_id).toBe(MULTIFAMILY_LAYOUT.pack.id);
    expect(contract!.metrics.length).toBe((MULTIFAMILY_LAYOUT.pack.calculations ?? []).length);
  });

  it('matches the contract built directly from the same document', async () => {
    const parsed = await parse(PARKVIEW);
    const direct = await buildWorkbookContract(parsed, MULTIFAMILY_LAYOUT);
    const viaWorkbook = readWorkbookContract(await roundTrip(PARKVIEW));
    expect(viaWorkbook).toEqual(direct);
  });

  it('returns null rather than throwing when the sheet is absent', async () => {
    const bare = new ExcelJS.Workbook();
    bare.addWorksheet('Underwriting');
    expect(readWorkbookContract(bare)).toBeNull();
  });

  it('returns null rather than throwing when the JSON cell is corrupt', async () => {
    const wb = await roundTrip(PARKVIEW);
    const sheet = wb.getWorksheet(MCP_SHEET_NAME)!;
    const ranges = wb.definedNames.getRanges('uw_mcp').ranges;
    const ref = ranges[0].slice(ranges[0].lastIndexOf('!') + 1);
    sheet.getCell(ref).value = '{ not json';
    expect(readWorkbookContract(wb)).toBeNull();
  });
});

describe('verifyWorkbookContract', () => {
  it('verifies a workbook against the document it came from', async () => {
    const parsed = await parse(PARKVIEW);
    const wb = await roundTrip(PARKVIEW);
    const verdict = await verifyWorkbookContract(wb, parsed, MULTIFAMILY_LAYOUT);
    expect(verdict.status).toBe('verified');
  });

  it('reports stale — not failed — when the source document has changed since export', async () => {
    const wb = await roundTrip(PARKVIEW);
    const raw = await readFile(resolve(EXAMPLES, PARKVIEW), 'utf8');
    expect(raw).toContain('"purchase_price": 7200000');
    const edited = parseUWFile(raw.replace('"purchase_price": 7200000', '"purchase_price": 7300000'));

    const verdict = await verifyWorkbookContract(wb, edited, MULTIFAMILY_LAYOUT);
    expect(verdict.status).toBe('stale');
    if (verdict.status === 'stale') {
      expect(verdict.expected_digest).not.toBe(verdict.contract.document.source_semantic_digest);
      expect(verdict.reason).toContain('changed');
    }
  });

  it('fails when the workbook was produced for a different asset class', async () => {
    const wb = await roundTrip(PARKVIEW);
    const verdict = await verifyWorkbookContract(wb, await parse(SUNDANCE), LAND_LAYOUT);
    expect(verdict.status).toBe('failed');
    if (verdict.status === 'failed') expect(verdict.reason).toContain('asset class');
  });

  it('reports stale when the producing pack version has moved on', async () => {
    const parsed = await parse(PARKVIEW);
    const wb = await roundTrip(PARKVIEW);
    const bumped = {
      ...MULTIFAMILY_LAYOUT,
      pack: { ...MULTIFAMILY_LAYOUT.pack, version: '99.0.0' },
    };
    const verdict = await verifyWorkbookContract(wb, parsed, bumped);
    // A pack bump can add or redefine metrics, so row geometry may differ.
    // That is staleness, not tampering.
    expect(verdict.status).toBe('stale');
  });

  it('reports unverifiable — not failed — for a workbook with no MCP sheet', async () => {
    const bare = new ExcelJS.Workbook();
    bare.addWorksheet('Underwriting');
    const verdict = await verifyWorkbookContract(bare, await parse(PARKVIEW), MULTIFAMILY_LAYOUT);
    // An older export is not evidence of tampering. Calling it a failure would
    // train users to ignore the result.
    expect(verdict.status).toBe('unverifiable');
    if (verdict.status === 'unverifiable') expect(verdict.reason).toContain(MCP_SHEET_NAME);
  });

  it('keeps every outcome distinguishable', async () => {
    const statuses = new Set<string>();
    const parsed = await parse(PARKVIEW);
    const wb = await roundTrip(PARKVIEW);
    statuses.add((await verifyWorkbookContract(wb, parsed, MULTIFAMILY_LAYOUT)).status);
    statuses.add((await verifyWorkbookContract(wb, await parse(SUNDANCE), LAND_LAYOUT)).status);
    statuses.add((await verifyWorkbookContract(new ExcelJS.Workbook(), parsed, MULTIFAMILY_LAYOUT)).status);
    expect(statuses).toEqual(new Set(['verified', 'failed', 'unverifiable']));
  });
});
