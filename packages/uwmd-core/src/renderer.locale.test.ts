// The render refusal — the display half of the RFC 0001 locale negotiation
// surfaces, and RFC 0046 currency identity in display renders. The display-only
// boundary: an unregistered locale refuses display renders and nothing else —
// the file still parses, validates otherwise, and calcs. Moved from
// @uwmd/verify's validator.locale.test.ts with the renderer (RFC 0083).

import { describe, expect, it } from 'vitest';
import { parseUWFile, validateUWFile } from '@uwmd/verify';
import { render, InvalidCurrencyCodeError, UnsupportedLocaleError } from './renderer.js';

function doc(localeLine: string): string {
  return `---
uw_version: "3.0"
deal_id: TEST-LOC
deal_name: "Locale Deal"
created: "2026-09-01T00:00:00Z"
last_modified: "2026-09-01T00:00:00Z"
asset_class: office
${localeLine}
---

\`\`\`json uw:section=property source=manual ts=2026-09-01T00:00:00Z v=1
{ "rentable_square_feet": 42500, "year_built": 1998 }
\`\`\`
`;
}

function curIssues(content: string) {
  return validateUWFile(parseUWFile(content)).issues.filter((i) => i.code.startsWith('CUR-'));
}

describe('the display-only boundary', () => {
  const file = doc('locale: xx-XX');
  const parsed = parseUWFile(file);

  it('refuses chat and summary renders with UnsupportedLocaleError', () => {
    expect(() => render(parsed, { format: 'chat' })).toThrow(UnsupportedLocaleError);
    expect(() => render(parsed, { format: 'summary' })).toThrow(UnsupportedLocaleError);
  });

  it('still produces the machine renders — json and csv are not display', () => {
    expect(render(parsed, { format: 'json' }).content.length).toBeGreaterThan(0);
    expect(render(parsed, { format: 'csv' }).content.length).toBeGreaterThan(0);
  });
});

describe('CUR-01 and document currency identity', () => {
  it('keeps absent identity compatible and renders explicit identity across locales', () => {
    const legacy = render(parseUWFile(doc('status: draft').replace(
      'asset_class: office', 'asset_class: office\nquick_metrics:\n  purchase_price: 8200000',
    )), { format: 'summary' }).content;
    const explicit = render(parseUWFile(doc('locale: de-DE\ncurrency_code: MXN').replace(
      'asset_class: office', 'asset_class: office\nquick_metrics:\n  purchase_price: 8200000',
    )), { format: 'summary' }).content;
    expect(legacy).toContain('$8,200,000');
    expect(explicit).toContain('MXN 8.200.000');
    expect(curIssues(doc('currency_code: MXN'))).toEqual([]);
  });

  it('reports malformed identity and refuses display renders', () => {
    const file = doc('currency_code: usd');
    expect(curIssues(file).map((i) => i.code)).toEqual(['CUR-01']);
    expect(() => render(parseUWFile(file), { format: 'summary' })).toThrow(InvalidCurrencyCodeError);
  });
});

describe('locale-threaded display renders', () => {
  it('a de-DE file renders German separators in summary', () => {
    const file = doc('locale: de-DE').replace(
      'asset_class: office',
      'asset_class: office\nquick_metrics:\n  purchase_price: 8200000',
    );
    const out = render(parseUWFile(file), { format: 'summary' }).content;
    expect(out).toContain('8.200.000 €');
  });

  it('the same file under en-US renders the historical format', () => {
    const file = doc('status: draft').replace(
      'asset_class: office',
      'asset_class: office\nquick_metrics:\n  purchase_price: 8200000',
    );
    const out = render(parseUWFile(file), { format: 'summary' }).content;
    expect(out).toContain('$8,200,000');
  });

  it('csv output is byte-identical across locales', () => {
    const de = render(parseUWFile(doc('locale: de-DE')), { format: 'csv' }).content;
    const us = render(parseUWFile(doc('status: draft')), { format: 'csv' }).content;
    expect(de).toBe(us);
  });
});
