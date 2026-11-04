// Regression gates for accepted RFC 0133 input-hash validation and conversion.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUWFile, parsedPhysicalBlocks } from './parser.js';
import { toUWEnvelope } from './envelope.js';
import { stringifyUWXml } from './uwxml.js';
import { encodeUWCSVBundle } from './uwcsv.js';
import { stringifyUWJson } from './uwjson.js';
import { validateUWFile } from './validator.js';

const source = readFileSync(new URL('../../../docs/downloads/tutorials/quickstart.uwx.md', import.meta.url), 'utf8');
function sourceWithHash(input_hash: unknown) {
  const parsed = parseUWFile(source);
  const block = parsedPhysicalBlocks(parsed).find(item => item.annotation.section === 'rent_roll')!;
  const meta = block.content._meta as { integrity?: Record<string, unknown> };
  meta.integrity = { ...meta.integrity, input_hash };
  return parseUWFile(source.replace(block.rawJson, JSON.stringify(block.content)));
}

describe('RFC 0133 INT-16 validation and conversion', () => {
  it('retains an admitted fresh source as the positive carrier control', () => {
    expect(() => stringifyUWJson(parseUWFile(source))).not.toThrow();
  });
  it.each([null, '', `sha256:${'a'.repeat(64)}`])('keeps the existing admitted hash value %j', hash => {
    expect(() => stringifyUWJson(sourceWithHash(hash))).not.toThrow();
  });
  for (const hash of ['sha256:abcd', `sha256:${'A'.repeat(64)}`, 123, false, 0, {}, [], '\n', `sha256:${'a'.repeat(64)}\n`]) {
    it(`reports malformed input hash ${JSON.stringify(hash)} as an error`, () => {
      expect(validateUWFile(sourceWithHash(hash)).issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'INT-16', severity: 'error', field: '_meta.integrity.input_hash' }),
      ]));
    });
    it(`preserves the same INT-16 code on conversion for ${JSON.stringify(hash)}`, () => {
      expect(() => stringifyUWJson(sourceWithHash(hash))).toThrow(expect.objectContaining({ code: 'INT-16' }));
    });
  }
});


describe('INT-16 complete populations and representation errors', () => {
  it.each(['property', 'pipeline_log', 'custom_calculations', 'custom_scenarios', 'x_hash'])('preserves the code through all carriers for %s', async section => {
    const base = sourceWithHash('sha256:abcd');
    const original = parsedPhysicalBlocks(base).find(b => b.annotation.section === 'rent_roll')!;
    const content = structuredClone(original.content);
    (content._meta as { section: string }).section = section;
    const raw = `---\nuw_version: "3.0"\ndeal_id: HASH-TEST\ndeal_name: Hash test\n---\n\n\`\`\`json uw:section=${section}\n${JSON.stringify(content)}\n\`\`\`\n`;
    const parsed = parseUWFile(raw);
    const before = JSON.stringify(parsed);
    expect(validateUWFile(raw).issues.filter(i => i.code === 'INT-16')).toEqual([
      expect.objectContaining({ severity: 'error', section, field: '_meta.integrity.input_hash' }),
    ]);
    expect(validateUWFile(parsed).issues.filter(i => i.code === 'INT-16')).toHaveLength(1);
    const envelope = toUWEnvelope(parsed);
    expect(() => stringifyUWJson(parsed)).toThrow(expect.objectContaining({ code: 'INT-16' }));
    await expect(stringifyUWXml(envelope)).rejects.toMatchObject({ code: 'INT-16' });
    await expect(encodeUWCSVBundle(envelope)).rejects.toMatchObject({ code: 'INT-16' });
    expect(JSON.stringify(parsed)).toBe(before);
  });

  it('keeps superseded and variant findings distinct, in physical order', () => {
    const original = parsedPhysicalBlocks(sourceWithHash('sha256:abcd')).find(b => b.annotation.section === 'rent_roll')!;
    const block = (variant: string, superseded = false): string => {
      const content = structuredClone(original.content);
      const meta = content._meta as { section: string; lifecycle: { superseded: boolean } };
      meta.section = 'property'; meta.lifecycle.superseded = superseded;
      return `\`\`\`json uw:section=property variant=${variant}${superseded ? ' superseded=true' : ''}\n${JSON.stringify(content)}\n\`\`\`\n`;
    };
    const raw = `---\nuw_version: "3.0"\ndeal_id: HASH-ORDER\ndeal_name: Hash order\n---\n${block('prior', true)}${block('base')}${block('upside')}`;
    const parsed = parseUWFile(raw);
    const findings = validateUWFile(parsed).issues.filter(i => i.code === 'INT-16');
    expect(findings).toHaveLength(3);
    for (const [i, variant] of ['prior', 'base', 'upside'].entries()) expect(findings[i]!.message).toContain(`variant ${variant}`);
    expect(() => stringifyUWJson(parsed)).toThrow(expect.objectContaining({ code: 'INT-16' }));
  });

  it('reads current MODEL content instead of stale raw source', () => {
    const parsed = sourceWithHash(null);
    const block = parsedPhysicalBlocks(parsed).find(b => b.annotation.section === 'rent_roll')!;
    (block.content._meta as { integrity: { input_hash: unknown } }).integrity.input_hash = 0;
    expect(validateUWFile(parsed).issues.filter(i => i.code === 'INT-16')).toHaveLength(1);
    expect(validateUWFile(parsed.raw).issues.filter(i => i.code === 'INT-16')).toHaveLength(0);
  });
});


describe('INT-16 complete-pass ordering', () => {
  it('follows metadata admission and precedes actor findings', () => {
    const parsed = sourceWithHash('sha256:abcd');
    const block = parsedPhysicalBlocks(parsed).find(item => item.annotation.section === 'rent_roll')!;
    const meta = block.content._meta as { quality: Record<string, unknown>; provenance: Record<string, unknown> };
    meta.quality.flags = 0;
    meta.provenance.source = 'bad_actor';
    meta.provenance.resolution = 'market_data_accepted';
    const codes = validateUWFile(parsed).issues.map(issue => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['META-05', 'META-06', 'INT-16', 'SRC-01']));
    expect(codes.indexOf('META-06')).toBeLessThan(codes.indexOf('INT-16'));
    expect(codes.indexOf('INT-16')).toBeLessThan(codes.indexOf('SRC-01'));
  });
});
