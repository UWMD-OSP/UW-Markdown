import { describe, expect, it } from 'vitest';
import {
  detectUWSourceRepresentation,
  migrateLegacyUWMarkdown,
  UWSourceRepresentationError,
} from './source-representation.js';

const UWX = [
  '---',
  'uw_version: 1.1',
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

  it('refuses structured content under the legacy .uw.md name (sunset at 2.0)', () => {
    expect(() => detectUWSourceRepresentation(UWX, 'deal.uw.md')).toThrow(
      /SOURCE_LEGACY_STRUCTURED/,
    );
  });

  it('an explicit UWX override remains the escape hatch, with the migrate warning', () => {
    const result = detectUWSourceRepresentation(UWX, 'deal.uw.md', 'uwx-markdown');
    expect(result.representation).toBe('uwx-markdown');
    expect(result.confidence).toBe('explicit');
    expect(result.warnings[0]).toContain('.uwx.md');
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

describe('migrateLegacyUWMarkdown', () => {
  it('returns a byte-identical .uwx.md sibling plan', () => {
    const migration = migrateLegacyUWMarkdown('folder/deal.uw.md', UWX);
    expect(migration.destination_file).toBe('folder/deal.uwx.md');
    expect(migration.content).toBe(UWX);
    expect(migration.bytes_changed).toBe(false);
  });

  it('does not migrate Lite content', () => {
    expect(() => migrateLegacyUWMarkdown('deal.uw.md', LITE)).toThrow(
      /SOURCE_MIGRATION_NOT_UWX/,
    );
  });
});
