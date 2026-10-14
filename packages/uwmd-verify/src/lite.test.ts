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

describe('percent normalization (RFC 0025)', () => {
  const parseRate = (display: string): number => {
    const parsed = parseUWLite(
      [
        '---',
        'uw_lite_version: 1.0',
        'deal_name: Rate',
        '---',
        `- Rate: ${display} <!-- uw:valuation.going_in_cap_rate -->`,
      ].join('\n'),
    );
    expect(parsed.issues).toEqual([]);
    return parsed.fields[0].value as number;
  };

  it('scales by moving the decimal point, not by dividing', () => {
    // The regression: `Number('5.51') / 100` is 0.055099999999999996, one ULP
    // off. `toBe` is the whole point here — `toBeCloseTo` would pass either way.
    expect(parseRate('5.51%')).toBe(0.0551);
    expect(parseRate('5.51%')).not.toBe(5.51 / 100);
  });

  it('agrees with the double a hand-authored UWX fraction produces', () => {
    // This equality is what makes a Lite-compiled rate and a UWX-authored rate
    // compare equal under semantic equivalence and under an RFC 0016 receipt.
    for (const [display, fraction] of [
      ['5.51%', '0.0551'],
      ['7.03%', '0.0703'],
      ['0.07%', '0.0007'],
      ['12.34%', '0.1234'],
    ] as const) {
      expect(parseRate(display)).toBe(Number(fraction));
    }
  });

  it('handles the shapes the grammar admits: signs, no point, bare fraction', () => {
    expect(parseRate('0%')).toBe(0);
    expect(parseRate('100%')).toBe(1);
    expect(parseRate('-1.50%')).toBe(-0.015);
    expect(parseRate('.5%')).toBe(0.005);
    expect(parseRate('6.2500%')).toBe(0.0625);
    // Fewer integer digits than the shift needs — the padding path.
    expect(parseRate('1.5%')).toBe(0.015);
  });

  it('leaves rates that already divide cleanly untouched', () => {
    // The reason no conformance baseline moved: every existing fixture rate
    // divides exactly, so the fix is invisible to them.
    for (const [display, expected] of [
      ['5.50%', 0.055],
      ['5.75%', 0.0575],
      ['6.25%', 0.0625],
      ['5.00%', 0.05],
    ] as const) {
      expect(parseRate(display)).toBe(expected);
      expect(parseRate(display)).toBe(Number(display.slice(0, -1)) / 100);
    }
  });
});

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
