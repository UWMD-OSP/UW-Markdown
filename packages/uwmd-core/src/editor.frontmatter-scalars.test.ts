// Frontmatter YAML scalars (Format Appendix D) through the writers: the
// Tier-2 editor and the init scaffold (starter products), read back by
// @uwmd/verify's parser. Moved from parser.test.ts with the writers (RFC 0083).
import { describe, expect, it } from 'vitest';
import { parseUWFile, stringifyUWX, toUWJson, UWMDParseError } from '@uwmd/verify';
import { applyEdit } from './editor.js';
import { generateBlankUWFile } from './init.js';

describe('frontmatter YAML scalars (Format Appendix D)', () => {
  const base = generateBlankUWFile({ dealId: 'uw_2026_YAML', dealName: 'Yaml Probe' });
  const AWKWARD = ['He said "hi"', 'C:\\deals', "O'Brien", 'two\nlines', 'tab\there', 'Café 🏢 \u2028'];

  it.each(AWKWARD)('reads back what the Tier-2 editor writes: %j', (value) => {
    const r = applyEdit(base, parseUWFile(base), { kind: 'frontmatter_set', path: 'deal_name', value }, {
      actor: 'user',
      source: 'manual',
    });
    expect(r.ok).toBe(true);
    expect(parseUWFile(r.content!).frontmatter.deal_name).toBe(value);
  });

  it.each(AWKWARD)('reads back what UW JSON -> UWX writes: %j', (value) => {
    const envelope = toUWJson(parseUWFile(base));
    envelope.frontmatter.deal_name = value;
    expect(parseUWFile(stringifyUWX(envelope)).frontmatter.deal_name).toBe(value);
  });

  it('treats a key whose only inline content is a comment as opening a block', () => {
    const doc = base
      .replace('flags: []', 'flags: # raised by screening\n  - high_vacancy # first flag\n  - "rate \\"cap\\""')
      .replace('quick_metrics:', 'quick_metrics: # stated at screening');
    const fm = parseUWFile(doc).frontmatter as Record<string, unknown>;
    expect(fm.flags).toEqual(['high_vacancy', 'rate "cap"']);
    expect(fm.quick_metrics).toMatchObject({ purchase_price: null, dscr: null });
  });

  it('reads quoted indicators as content and still refuses them unquoted', () => {
    const quoted = base.replace(/^deal_name: .*$/m, `deal_name: 'Smith: &Co *x !y'`);
    expect(parseUWFile(quoted).frontmatter.deal_name).toBe('Smith: &Co *x !y');
    const unquoted = base.replace(/^deal_name: .*$/m, 'deal_name: &a Smith');
    expect(() => parseUWFile(unquoted)).toThrow(UWMDParseError);
  });
});
