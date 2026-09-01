// LOC-01 + the render refusal — the RFC 0001 locale negotiation surfaces.
// The display-only boundary: an unregistered locale refuses display renders
// and nothing else — the file still parses, validates otherwise, and calcs.

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { render, UnsupportedLocaleError } from './renderer.js';
import { SUPPORTED_LOCALES } from './protocol.js';

function doc(localeLine: string): string {
  return `---
uw_version: "1.1"
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

function locIssues(content: string) {
  return validateUWFile(parseUWFile(content)).issues.filter((i) => i.code.startsWith('LOC-'));
}

describe('LOC-01', () => {
  it('stays silent when locale is absent (= en-US)', () => {
    expect(locIssues(doc('status: draft'))).toEqual([]);
  });

  it('stays silent for every registered locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(locIssues(doc(`locale: ${locale}`)), locale).toEqual([]);
    }
  });

  it('errors on an unregistered tag', () => {
    const issues = locIssues(doc('locale: xx-XX'));
    expect(issues.map((i) => i.code)).toEqual(['LOC-01']);
    expect(issues[0]!.severity).toBe('error');
  });
});

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
