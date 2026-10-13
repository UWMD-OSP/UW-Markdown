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
});
