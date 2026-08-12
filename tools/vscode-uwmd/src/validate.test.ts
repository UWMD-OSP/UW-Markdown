// Representation-aware analysis.
//
// The regression that motivated this module: a UW Lite `.uw.md` file used to be
// fed to the STRUCTURED parser, which found no fenced sections and therefore
// reported nothing at all — a clean bill of health for a document nothing had
// parsed. The first test here is the guard against that ever coming back.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeDocument } from './validate.js';

const fixture = (p: string) => readFileSync(resolve(__dirname, '../../../', p), 'utf8');

const LITE = () => fixture('conformance/lite/fixtures/02-full-deal-summary.uw.md');
const UWX = () => fixture('conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md');

describe('representation dispatch', () => {
  it('identifies a Lite document by content', () => {
    expect(analyzeDocument(LITE(), 'deal.uw.md').representation).toBe('uw-lite-markdown');
  });

  it('identifies a structured document by content', () => {
    expect(analyzeDocument(UWX(), 'deal.uwx.md').representation).toBe('uwx-markdown');
  });

  it('recognises structured content still on the legacy .uw.md extension', () => {
    const result = analyzeDocument(UWX(), 'legacy-deal.uw.md');
    expect(result.representation).toBe('uwx-markdown');
    // Guidance, not a defect.
    const legacy = result.diagnostics.filter((d) => d.code === 'SOURCE_LEGACY_EXTENSION');
    expect(legacy).toHaveLength(1);
    expect(legacy[0]?.severity).toBe('info');
    expect(legacy[0]?.message).toMatch(/\.uwx\.md/);
  });

  it('reports an error rather than guessing when the content is unidentifiable', () => {
    const result = analyzeDocument('just some prose', 'notes.txt');
    expect(result.representation).toBeNull();
    expect(result.diagnostics[0]?.severity).toBe('error');
  });
});

describe('UW Lite analysis', () => {
  it('does NOT silently pass a Lite file — the regression this module exists for', () => {
    // A Lite document with a broken anchor. Under the old extension-driven
    // behaviour the structured parser found zero sections and reported clean.
    const broken = LITE().replace('<!-- uw:debt.loan_amount -->', '<!-- uw: -->');
    expect(broken).not.toBe(LITE());

    const result = analyzeDocument(broken, 'deal.uw.md');
    expect(result.representation).toBe('uw-lite-markdown');
    expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });

  it('reports a clean Lite document as clean', () => {
    const result = analyzeDocument(LITE(), 'deal.uw.md');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('points a parse error at the offending line, not line 1', () => {
    const source = LITE();
    const brokenLine = source.split('\n').findIndex((l) => l.includes('uw:debt.loan_amount'));
    expect(brokenLine).toBeGreaterThan(0);
    const broken = source.replace('<!-- uw:debt.loan_amount -->', '<!-- uw: -->');

    const result = analyzeDocument(broken, 'deal.uw.md');
    const error = result.diagnostics.find((d) => d.severity === 'error');
    expect(error).toBeDefined();
    expect(error?.line).toBe(brokenLine); // 0-based, so equal to the array index
  });

  it('surfaces bridge errors for a document that parses but will not compile', () => {
    const compileFixture = fixture('conformance/lite/compile/04-field-unknown.uw.md');
    const result = analyzeDocument(compileFixture, 'deal.uw.md');
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes.some((c) => c.startsWith('LITE_COMPILE_'))).toBe(true);
  });

  // Financial thresholds are intentionally absent for Lite: the validator's FV
  // family reads `frontmatter.quick_metrics`, which the deal-summary bridge
  // never populates. Pinning it so the day the bridge starts carrying derived
  // metrics, this test fails and someone revisits the decision deliberately.
  it('does not surface financial thresholds for Lite, even on a ruinous DSCR', () => {
    const stressed = LITE().replace('$1,289,000', '$2,900,000'); // DSCR ~0.57
    expect(stressed).not.toBe(LITE());
    const codes = analyzeDocument(stressed, 'deal.uw.md').diagnostics.map((d) => d.code);
    expect(codes.filter((c) => c.startsWith('FV-'))).toEqual([]);
  });
});

describe('UWX analysis', () => {
  it('validates a structured document', () => {
    const result = analyzeDocument(UWX(), 'deal.uwx.md');
    expect(result.representation).toBe('uwx-markdown');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('anchors each section finding to that section fence line', () => {
    const source = UWX();
    const lines = source.split('\n');
    const result = analyzeDocument(source, 'deal.uwx.md');

    const located = result.diagnostics.filter((d) => d.line > 0);
    expect(located.length).toBeGreaterThan(0);

    // Every anchored diagnostic must land on a real section fence, not on an
    // arbitrary line that happens to be non-zero.
    for (const diagnostic of located) {
      expect(lines[diagnostic.line]).toMatch(/^```json uw:section=/);
    }

    // And distinct sections must land on distinct lines — proof we're mapping
    // per-section rather than pinning everything to one spot.
    expect(new Set(located.map((d) => d.line)).size).toBeGreaterThan(1);
  });

  it('reports a parse failure as a diagnostic rather than throwing', () => {
    const truncated = `${UWX().slice(0, 400)}\n\`\`\`json uw:section=broken\n{`;
    expect(() => analyzeDocument(truncated, 'deal.uwx.md')).not.toThrow();
  });
});

describe('line numbering', () => {
  it('never emits a negative line', () => {
    for (const [text, name] of [
      [LITE(), 'deal.uw.md'],
      [UWX(), 'deal.uwx.md'],
      ['garbage', 'x.uw.md'],
    ] as const) {
      for (const d of analyzeDocument(text, name).diagnostics) {
        expect(d.line).toBeGreaterThanOrEqual(0);
        expect(d.endLine).toBeGreaterThanOrEqual(d.line);
      }
    }
  });
});
