// RFC 0111: validation runs under the rule set the record's declared Format
// version names, and the result says which (D5).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUWFile, UWMDParseError } from './parser.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile } from './types.js';

const PARKVIEW = readFileSync(resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');

describe('validateUWFile — rule set (RFC 0111)', () => {
  it('names the rule set it applied, from source and from a model', () => {
    expect(validateUWFile(PARKVIEW).rule_set).toBe('3.0');
    expect(validateUWFile(parseUWFile(PARKVIEW)).rule_set).toBe('3.0');
  });

  it('refuses a model whose declared version names no kept rule set, never falling back', () => {
    const parsed = parseUWFile(PARKVIEW);
    for (const declared of ['3.1', '2.0', undefined]) {
      const model = { ...parsed, frontmatter: { ...parsed.frontmatter, uw_version: declared } } as unknown as ParsedUWFile;
      expect(() => validateUWFile(model)).toThrow(UWMDParseError);
      expect(() => validateUWFile(model)).toThrow(/UNSUPPORTED_FORMAT_VERSION/);
    }
  });

  it('refuses source declaring another version at parse, as before', () => {
    expect(() => validateUWFile(PARKVIEW.replace('uw_version: "3.0"', 'uw_version: "3.1"'))).toThrow(/UNSUPPORTED_FORMAT_VERSION/);
  });
});
