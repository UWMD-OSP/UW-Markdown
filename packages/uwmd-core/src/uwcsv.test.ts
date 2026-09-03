import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { areEnvelopesEquivalent, toUWEnvelope } from './envelope.js';
import { parseUWFile } from './parser.js';
import {
  decodeUWCSVBundle,
  decodeUWCSVZip,
  encodeUWCSVBundle,
  encodeUWCSVZip,
  flattenEnvelopeBlockValues,
  UWCSVError,
} from './uwcsv.js';

const source = readFileSync(
  resolve(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md'),
  'utf8',
);
const envelope = toUWEnvelope(parseUWFile(source), {
  generatedAt: '2026-07-26T00:00:00.000Z',
  generator: '@uwmd/core-test',
});

describe('UW CSV Bundle 1.0', () => {
  it('round-trips the complete envelope through normalized CSV tables', async () => {
    const bundle = await encodeUWCSVBundle(envelope);
    expect(Object.keys(bundle.files).sort()).toEqual([
      'block_values.csv',
      'blocks.csv',
      'document.csv',
      'frontmatter.csv',
      'manifest.json',
      'prose.csv',
      'views/deal_summary.csv',
      'views/debt.csv',
      'views/operating_statement.csv',
      'views/rent_roll.csv',
      'views/sources_uses.csv',
      'views/valuation.csv',
    ]);
    expect(bundle.files['document.csv']).toContain('\r\n');
    const decoded = await decodeUWCSVBundle(bundle);
    expect(areEnvelopesEquivalent(decoded, envelope)).toBe(true);
    expect(decoded.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('creates deterministic ZIP bytes and decodes them safely', async () => {
    const first = await encodeUWCSVZip(envelope);
    const second = await encodeUWCSVZip(envelope);
    expect(first).toEqual(second);
    const decoded = await decodeUWCSVZip(first);
    expect(areEnvelopesEquivalent(decoded, envelope)).toBe(true);
  });

  it('preserves arrays with more than ten entries and formula-looking prose', async () => {
    const custom = JSON.parse('{"__proto__":{"safe":true},"values":[]}') as Record<string, unknown>;
    custom.values = Array.from({ length: 15 }, (_, index) => ({ index }));
    const extended = {
      ...envelope,
      custom,
      frontmatter: { ...envelope.frontmatter, deal_name: '=not-a-formula' },
    };
    const bundle = await encodeUWCSVBundle(extended);
    const decoded = await decodeUWCSVBundle(bundle);
    expect(decoded.custom).toEqual(extended.custom);
    expect(Object.prototype).not.toHaveProperty('safe');
    expect(Object.prototype.hasOwnProperty.call(decoded.custom, '__proto__')).toBe(true);
    expect(decoded.frontmatter.deal_name).toBe('=not-a-formula');
    expect(bundle.files['views/deal_summary.csv']).toContain("'=not-a-formula");
  });

  it('rejects hash tampering, traversal paths, and decompression bombs', async () => {
    const bundle = await encodeUWCSVBundle(envelope);
    const tampered = {
      files: { ...bundle.files, 'frontmatter.csv': `${bundle.files['frontmatter.csv']}tampered` },
    };
    await expect(decodeUWCSVBundle(tampered)).rejects.toThrow(/CSV_SIZE_MISMATCH|CSV_HASH_MISMATCH/);

    const traversal = zipSync({ '../escape.txt': strToU8('no') });
    await expect(decodeUWCSVZip(traversal)).rejects.toThrow(/CSV_PATH_UNSAFE/);

    const bomb = zipSync({ 'manifest.json': new Uint8Array(2 * 1024 * 1024) });
    await expect(decodeUWCSVZip(bomb, { maxCompressionRatio: 2 })).rejects.toThrow(/CSV_ZIP_RATIO_LIMIT/);
  });

  it('enforces file limits before parsing payloads', async () => {
    await expect(
      decodeUWCSVBundle({ files: { 'manifest.json': '{}', 'extra.csv': '' } }, { maxFiles: 1 }),
    ).rejects.toThrow(UWCSVError);
  });
});

describe('flattenEnvelopeBlockValues', () => {
  it('returns exactly the rows encodeUWCSVBundle writes to block_values.csv', async () => {
    const rows = flattenEnvelopeBlockValues(envelope);
    const bundle = await encodeUWCSVBundle(envelope);
    const csvLines = (bundle.files['block_values.csv'] ?? '').split('\r\n').filter((line) => line !== '');
    expect(csvLines[0]).toBe('"block_ref","scope","pointer","json_type","value_json"');
    expect(csvLines.length - 1).toBe(rows.length);
    // Spot-check a scalar row survives verbatim in the CSV encoding.
    const scalar = rows.find((row) => row.scope === 'content' && row.json_type === 'number');
    expect(scalar).toBeDefined();
    expect(csvLines.some((line) => line.includes(`"${scalar?.pointer}"`))).toBe(true);
  });

  it('is deterministic and scope-ordered per block', () => {
    const first = flattenEnvelopeBlockValues(envelope);
    const second = flattenEnvelopeBlockValues(envelope);
    expect(second).toEqual(first);
    // Within one block_ref, annotation rows precede meta rows precede content rows.
    const order = { annotation: 0, meta: 1, content: 2 } as const;
    let prevRef = '';
    let prevScope = -1;
    for (const row of first) {
      if (row.block_ref !== prevRef) {
        prevRef = row.block_ref;
        prevScope = -1;
      }
      expect(order[row.scope]).toBeGreaterThanOrEqual(prevScope);
      prevScope = order[row.scope];
    }
  });

  it('separates _meta into the meta scope and keeps it out of content', () => {
    const rows = flattenEnvelopeBlockValues(envelope);
    expect(rows.some((row) => row.scope === 'meta')).toBe(true);
    expect(rows.some((row) => row.scope === 'content' && row.pointer.startsWith('/_meta'))).toBe(false);
  });
});
