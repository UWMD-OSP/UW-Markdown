import { describe, expect, it } from 'vitest';
import {
  detectUWSourceRepresentation,
  UWSourceRepresentationError,
} from './source-representation.js';

const UWX = [
  '---',
  "uw_version: \"3.0\"",
  '---',
  '```json uw:section=deal_summary',
  '{"_meta":{},"deal_name":"Example"}',
  '```',
  '',
].join('\n');

const LITE = [
  '---',
  'uw_lite_version: 1.0',
  '---',
  '# Example',
  '- Purchase price: $1,000,000 <!-- uw:acquisition.purchase_price -->',
  '',
].join('\n');

describe('detectUWSourceRepresentation', () => {
  it('recognizes the new UWX extension', () => {
    expect(detectUWSourceRepresentation(UWX, 'deal.uwx.md')).toEqual({
      representation: 'uwx-markdown',
      confidence: 'content',
      warnings: [],
    });
  });

  it('refuses structured content under a .uw.md name as SOURCE_CONTENT_MISMATCH (RFC 0081 §4)', () => {
    expect(() => detectUWSourceRepresentation(UWX, 'deal.uw.md')).toThrow(/SOURCE_CONTENT_MISMATCH/);
  });

  it('refuses it under explicit UWX selection too: there is no override', () => {
    expect(() => detectUWSourceRepresentation(UWX, 'deal.uw.md', 'uwx-markdown')).toThrow(
      /SOURCE_CONTENT_MISMATCH/,
    );
    expect(detectUWSourceRepresentation(UWX, 'deal.uwx.md', 'uwx-markdown')).toEqual({
      representation: 'uwx-markdown',
      confidence: 'explicit',
      warnings: [],
    });
  });

  it('recognizes Lite by version and field anchors', () => {
    expect(detectUWSourceRepresentation(LITE, 'deal.uw.md').representation).toBe(
      'uw-lite-markdown',
    );
  });

  it('rejects a .uwx.md extension with Lite content', () => {
    expect(() => detectUWSourceRepresentation(LITE, 'deal.uwx.md')).toThrow(
      UWSourceRepresentationError,
    );
  });

  it('requires an explicit choice for mixed content', () => {
    expect(() => detectUWSourceRepresentation(`${UWX}\n${LITE}`, 'deal.md')).toThrow(
      /SOURCE_REPRESENTATION_AMBIGUOUS/,
    );
  });

  // Issue #408: a Lite → UWX conversion keeps the Lite source, anchors and all,
  // as a JSON string in x_uw_lite_source. That is data inside a fence, not a
  // Lite marker in the Markdown.
  const KEPT_LITE = [
    UWX.trimEnd(),
    '```json uw:section=x_uw_lite_source',
    JSON.stringify({ _meta: {}, markdown: LITE }),
    '```',
    '',
  ].join('\n');

  it('reads Lite anchors inside a UWX fence body as data', () => {
    for (const lineBreak of ['\n', '\r\n']) {
      const source = KEPT_LITE.replaceAll('\n', lineBreak);
      expect(detectUWSourceRepresentation(source, 'deal.uwx.md').representation).toBe(
        'uwx-markdown',
      );
      expect(detectUWSourceRepresentation(source, 'deal.md').representation).toBe('uwx-markdown');
      expect(
        detectUWSourceRepresentation(source, 'deal.uwx.md', 'uwx-markdown').representation,
      ).toBe('uwx-markdown');
    }
  });

  it('still finds a Lite marker in prose outside the fences', () => {
    const source = `${KEPT_LITE}\n- Loan: $1 <!-- uw:debt.loan_amount -->\n`;
    expect(() => detectUWSourceRepresentation(source, 'deal.md')).toThrow(
      /SOURCE_REPRESENTATION_AMBIGUOUS/,
    );
  });
});
