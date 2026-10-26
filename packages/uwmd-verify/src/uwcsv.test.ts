import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { areEnvelopesEquivalent, fromUWEnvelope, toUWEnvelope } from './envelope.js';
import { validateUWFile } from './validator.js';
import { parseUWFile } from './parser.js';
import { sha256BytesHex } from './integrity.js';
import {
  decodeUWCSVBundle,
  decodeUWCSVZip,
  encodeUWCSVBundle,
  encodeUWCSVZip,
  flattenEnvelopeBlockValues,
  flattenUWSourceBlockValues,
  UWCSVError,
} from './uwcsv.js';

const source = readFileSync(
  resolve(process.cwd(), '..', '..', 'conformance', 'rfc-0089', 'fixtures', 'complete-current.uwx.md'),
  'utf8',
);
const envelope = toUWEnvelope(parseUWFile(source), {
  generatedAt: '2026-07-26T00:00:00.000Z',
  generator: '@uwmd/core-test',
});

describe('UW CSV Bundle 2.0', () => {
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
    expect(validateUWFile(fromUWEnvelope(decoded)).issues.filter(issue =>
      issue.code === 'META-01' && issue.message.includes('first member'))).toEqual([]);
  });

  it('preserves prototype-named content members while keeping metadata first', async () => {
    const extended = structuredClone(envelope);
    const block = extended.sections['valuation'] as { content: Record<string, unknown> };
    Object.defineProperty(block.content, '__proto__', {
      value: { csv_member: true }, enumerable: true, configurable: true,
    });
    const decoded = await decodeUWCSVBundle(await encodeUWCSVBundle(extended));
    const content = (decoded.sections['valuation'] as { content: Record<string, unknown> }).content;
    expect(Object.keys(content)[0]).toBe('_meta');
    expect(Object.hasOwn(content, '__proto__')).toBe(true);
    expect(content['__proto__']).toEqual({ csv_member: true });
    expect(Object.hasOwn(content, 'csv_member')).toBe(false);
    expect(Object.getPrototypeOf(content)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty('csv_member');
    expect(areEnvelopesEquivalent(decoded, extended)).toBe(true);
  });

  it('creates deterministic ZIP bytes and decodes them safely', async () => {
    const first = await encodeUWCSVZip(envelope);
    const second = await encodeUWCSVZip(envelope);
    expect(first).toEqual(second);
    const decoded = await decodeUWCSVZip(first);
    expect(areEnvelopesEquivalent(decoded, envelope)).toBe(true);
  });

  it.each([0, 6] as const)('checks BOM bytes in the original ZIP inventory before text decoding (%s)', async (level) => {
    const bundle = await encodeUWCSVBundle(envelope);
    const files = Object.fromEntries(Object.entries(bundle.files).map(([path, text]) => [path, strToU8(text)]));
    files['frontmatter.csv'] = new Uint8Array([239, 187, 191, ...files['frontmatter.csv']!]);
    await expect(decodeUWCSVZip(zipSync(files, { level }))).rejects.toThrow(/CSV_SIZE_MISMATCH/);
    const manifest = JSON.parse(bundle.files['manifest.json']!);
    const entry = manifest.files.find((file: { path: string }) => file.path === 'frontmatter.csv');
    entry.bytes = files['frontmatter.csv'].length;
    entry.sha256 = `sha256:${await sha256BytesHex(files['frontmatter.csv'])}`;
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    expect(areEnvelopesEquivalent(await decodeUWCSVZip(zipSync(files, { level })), envelope)).toBe(true);
    entry.sha256 = `sha256:${'0'.repeat(64)}`;
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    await expect(decodeUWCSVZip(zipSync(files, { level }))).rejects.toThrow(/CSV_HASH_MISMATCH/);
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
    const order = { annotation: 0, meta: 1, content: 2, 'block-extra': 3 } as const;
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

// Explicit received inputs preserve the normal review counterexamples.
describe('source admission and received descriptor precedence', () => {
  it('projects absent/null/mismatched metadata without carrier admission', () => {
    const packet = JSON.parse(readFileSync(resolve(process.cwd(), '../../conformance/rfc-0089/integration-controls/source-fact-cases.json'), 'utf8'));
    for (const item of packet.cases) {
      const parsed = parseUWFile(item.source);
      const model = toUWEnvelope(parsed);
      expect(() => flattenEnvelopeBlockValues(model)).toThrow();
      const rows = flattenUWSourceBlockValues(parsed);
      expect(rows).toContainEqual({block_ref: '/sections/property', scope: 'content', pointer: '/total_units', json_type: 'number', value_json: '1'});
      expect(rows.some(row => row.scope === 'meta')).toBe(item.meta_present);
      if (item.name === 'null') expect(rows.find(row => row.scope === 'meta')).toMatchObject({pointer: '', json_type: 'null', value_json: 'null'});
      if (item.name === 'mismatch') expect(rows.find(row => row.scope === 'meta' && row.pointer === '/section')?.value_json).toBe('"debt_structure"');
    }
  });
  it('refuses a forged singleton variant descriptor before current/stale semantic stamps', async () => {
    const packet = JSON.parse(readFileSync(resolve(process.cwd(), '../../conformance/rfc-0089/integration-controls/csv-descriptor-cases.json'), 'utf8'));
    for (const item of packet.cases) await expect(decodeUWCSVBundle({files: item.files})).rejects.toThrow(/CSV descriptor agreement/);
  });
});


describe('seeded CSV carrier adversarial properties', () => {
  it('retains quoted multiline Unicode values and number extremes through bundle and ZIP', async () => {
    await fc.assert(fc.asyncProperty(fc.fullUnicodeString({ maxLength: 24 }), fc.double({ noNaN: true, noDefaultInfinity: true }), async (text, number) => {
      const input = structuredClone(envelope);
      input['x_synthetic_fuzz'] = { ['key/"~,' + text]: [text, number, '\r\n"quoted",\n', null] };
      const original = JSON.stringify(input);
      const bundle = await encodeUWCSVBundle(input);
      expect(areEnvelopesEquivalent(await decodeUWCSVBundle(bundle), input)).toBe(true);
      expect(areEnvelopesEquivalent(await decodeUWCSVZip(await encodeUWCSVZip(input)), input)).toBe(true);
      expect(JSON.stringify(input)).toBe(original);
    }), { seed: 128011, numRuns: 45 });
  }, 30000);
  it('rejects byte truncations under the original manifest instead of refreshing hashes', async () => {
    const bundle = await encodeUWCSVBundle(envelope);
    const file = 'block_values.csv'; const original = bundle.files[file]!;
    await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: original.length - 1 }), async cut => {
      const truncated = { files: { ...bundle.files, [file]: original.slice(0, cut) } };
      await expect(decodeUWCSVBundle(truncated)).rejects.toBeInstanceOf(UWCSVError);
      expect(bundle.files[file]).toBe(original);
    }), { seed: 128012, numRuns: 70 });
  });
});
