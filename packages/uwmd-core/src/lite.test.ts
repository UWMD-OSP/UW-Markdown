import { describe, expect, it } from 'vitest';
import {
  canonicalizeUWLiteFinancial,
  parseUWLite,
  renderCanonicalUWLite,
  UWLiteError,
} from './lite.js';

const SOURCE = [
  '---',
  'uw_lite_version: 1.0',
  'deal_name: Parkview',
  '---',
  '# Acquisition',
  '',
  '- Purchase price: $12,500,000 <!-- uw:acquisition.purchase_price -->',
  '- Going-in cap rate: 5.5% <!-- uw:valuation.going_in_cap_rate scenario=base -->',
  '',
  'This narrative is preserved.',
].join('\n');

describe('parseUWLite', () => {
  it('parses anchored typed fields and preserves source nodes', () => {
    const parsed = parseUWLite(SOURCE);
    expect(parsed.issues).toEqual([]);
    expect(parsed.fields).toHaveLength(2);
    expect(parsed.fields[0]).toMatchObject({
      path: 'acquisition.purchase_price',
      value: 12_500_000,
      unit: 'USD',
      range: { line: 7 },
    });
    expect(parsed.fields[1]).toMatchObject({
      value: 0.055,
      unit: 'fraction',
      scenario: 'base',
    });
    expect(parsed.nodes.some((node) => node.kind === 'prose')).toBe(true);
  });

  it('reports duplicate financial identities instead of guessing', () => {
    const duplicate = `${SOURCE}\n- Price again: $1 <!-- uw:acquisition.purchase_price -->`;
    expect(parseUWLite(duplicate).issues).toContainEqual(
      expect.objectContaining({ code: 'LITE_FIELD_DUPLICATE', severity: 'error' }),
    );
  });

  it('rejects reserved frontmatter keys rather than assigning them', () => {
    const source = SOURCE.replace('deal_name: Parkview', 'deal_name: Parkview\n__proto__: polluted');
    const parsed = parseUWLite(source);
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({ code: 'LITE_FRONTMATTER_KEY_RESERVED', severity: 'error' }),
    );
    expect(Object.hasOwn(parsed.frontmatter, '__proto__')).toBe(false);
  });

  it('rejects reserved field attributes', () => {
    const source = `${SOURCE}\n- Price: $1 <!-- uw:acquisition.other constructor=x -->`;
    expect(parseUWLite(source).issues).toContainEqual(
      expect.objectContaining({ code: 'LITE_ATTRIBUTE_KEY_RESERVED', severity: 'error' }),
    );
  });

  it('preserves malformed anchored lines as opaque content', () => {
    const malformed = `${SOURCE}\nPurchase price $1 <!-- uw:acquisition.price -->`;
    const parsed = parseUWLite(malformed);
    expect(parsed.issues).toContainEqual(expect.objectContaining({ code: 'LITE_FIELD_SYNTAX' }));
    expect(parsed.nodes.at(-1)?.kind).toBe('opaque');
  });
});

describe('UW Lite financial canonicalization', () => {
  it('ignores labels, order, and supported display formatting', () => {
    const alternate = [
      '---',
      'uw_lite_version: 1.0',
      '---',
      '- Cap: 5.50% <!-- uw:valuation.going_in_cap_rate scenario=base -->',
      '- Price: $12500000 <!-- uw:acquisition.purchase_price -->',
    ].join('\n');
    expect(canonicalizeUWLiteFinancial(parseUWLite(SOURCE))).toBe(
      canonicalizeUWLiteFinancial(parseUWLite(alternate)),
    );
  });

  it('changes when a financial value changes', () => {
    const changed = SOURCE.replace('$12,500,000', '$12,600,000');
    expect(canonicalizeUWLiteFinancial(parseUWLite(changed))).not.toBe(
      canonicalizeUWLiteFinancial(parseUWLite(SOURCE)),
    );
  });

  it('round-trips through the canonical renderer', () => {
    const parsed = parseUWLite(SOURCE);
    expect(canonicalizeUWLiteFinancial(parseUWLite(renderCanonicalUWLite(parsed)))).toBe(
      canonicalizeUWLiteFinancial(parsed),
    );
  });

  it('refuses to canonicalize ambiguous/error documents', () => {
    const invalid = parseUWLite(SOURCE.replace('uw_lite_version: 1.0', 'uw_lite_version: 2.0'));
    expect(() => canonicalizeUWLiteFinancial(invalid)).toThrow(UWLiteError);
  });
});
