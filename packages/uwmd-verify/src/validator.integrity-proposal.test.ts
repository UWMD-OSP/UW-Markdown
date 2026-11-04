// RFC 0133 proposes INT-16; it is not registered or implemented by this PR.
// Real expected-failure gates pin the proposal without claiming it shipped.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseUWFile, parsedPhysicalBlocks } from './parser.js';
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

describe('RFC 0133 proposed INT-16 acceptance gates', () => {
  it('retains an admitted fresh source as the positive carrier control', () => {
    expect(() => stringifyUWJson(parseUWFile(source))).not.toThrow();
  });
  it.each([null, '', `sha256:${'a'.repeat(64)}`])('keeps the existing admitted hash value %j', hash => {
    expect(() => stringifyUWJson(sourceWithHash(hash))).not.toThrow();
  });
  for (const hash of ['sha256:abcd', `sha256:${'A'.repeat(64)}`, 123, `sha256:${'a'.repeat(64)}\n`]) {
    it.fails(`reports malformed input hash ${JSON.stringify(hash)} as an error`, () => {
      expect(validateUWFile(sourceWithHash(hash)).issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'INT-16', severity: 'error', field: '_meta.integrity.input_hash' }),
      ]));
    });
    it.fails(`preserves the same INT-16 code on conversion for ${JSON.stringify(hash)}`, () => {
      expect(() => stringifyUWJson(sourceWithHash(hash))).toThrow(expect.objectContaining({ code: 'INT-16' }));
    });
  }
});
