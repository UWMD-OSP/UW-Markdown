import { describe, expect, it } from 'vitest';
import { getPackForAssetClass } from './builtin-packs/index.js';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';
import { parseUWFile, UWMDParseError } from './parser.js';
import { RULE_SETS, getRuleSet, ruleSetFor } from './rule-sets.js';
import { DEFAULT_THRESHOLDS, SUPPORTED_FORMAT_VERSIONS } from './types.js';
import type { ParsedUWFile } from './types.js';

const SOURCE = [
  '---',
  'uw_version: "3.0"',
  'deal_id: "uw_2026_rulesets"',
  'deal_name: "Rule sets"',
  'created: "2026-10-21T00:00:00Z"',
  'last_modified: "2026-10-21T00:00:00Z"',
  'asset_class: multifamily',
  '---',
  '',
].join('\n');

describe('verification rule sets (RFC 0111)', () => {
  it('keeps exactly the supported Format versions, each naming itself', () => {
    expect(Object.keys(RULE_SETS)).toEqual([...SUPPORTED_FORMAT_VERSIONS]);
    for (const [version, ruleSet] of Object.entries(RULE_SETS)) expect(ruleSet.format_version).toBe(version);
  });

  it('points Format 3.0 at the existing tables rather than copies', () => {
    const ruleSet = getRuleSet('3.0');
    expect(ruleSet?.thresholds).toBe(DEFAULT_THRESHOLDS);
    expect(ruleSet?.metric_dictionary).toBe(BUILTIN_METRIC_DICTIONARY);
    expect(ruleSet?.packFor('office')).toBe(getPackForAssetClass('office'));
  });

  it('names no rule set for any other declaration', () => {
    for (const declared of ['3.1', '2.0', '3', 3, undefined, null, 'toString', '__proto__']) {
      expect(getRuleSet(declared)).toBeUndefined();
    }
  });

  it('selects by the declared uw_version of a parsed record', () => {
    expect(ruleSetFor(parseUWFile(SOURCE)).format_version).toBe('3.0');
  });

  it('refuses a model declaring an unkept version with the parser’s code and message', () => {
    const parsed = parseUWFile(SOURCE);
    for (const declared of ['3.1', undefined, 3]) {
      const model = { ...parsed, frontmatter: { ...parsed.frontmatter, uw_version: declared } } as unknown as ParsedUWFile;
      let thrown: unknown;
      try { ruleSetFor(model); } catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(UWMDParseError);
      expect((thrown as UWMDParseError).code).toBe('UNSUPPORTED_FORMAT_VERSION');
      let parseError: unknown;
      try { parseUWFile(SOURCE.replace('uw_version: "3.0"', declared === undefined ? '' : `uw_version: ${typeof declared === 'string' ? `"${declared}"` : declared}`)); } catch (error) { parseError = error; }
      expect((thrown as Error).message).toBe((parseError as Error).message);
    }
  });
});
