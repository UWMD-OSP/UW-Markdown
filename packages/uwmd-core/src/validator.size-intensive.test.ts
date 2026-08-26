// CC-13 — the property section must state the class's primary size field
// (Protocol §XIII.1). RFC 0027 / UW_FORMAT_SPEC §5.3. Always a warning, and
// each of the five applicability preconditions silences the rule entirely.

import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>, annotation: Record<string, unknown> = {}): UWBlock {
  return {
    annotation: { section, ...annotation },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-25T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(
  sections: Record<string, UWBlock>,
  assetClass: string,
  frontmatterExtra: Record<string, unknown> = {},
): ParsedUWFile {
  return {
    frontmatter: { asset_class: assetClass, ...frontmatterExtra } as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

const find = (parsed: ParsedUWFile, code: string): ValidationMessage | undefined =>
  validateUWFile(parsed).issues.find((i) => i.code === code);

describe('validateUWFile — CC-13 primary size field (RFC 0027)', () => {
  it('warns when an office property omits rentable_square_feet, and never blocks', () => {
    const parsed = file({ property: block('property', { year_built: 1998 }) }, 'office');
    const issue = find(parsed, 'CC-13');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.section).toBe('property');
    expect(issue!.field).toBe('rentable_square_feet');
    // enriched from BUILTIN_REMEDIATIONS
    const reg = BUILTIN_REMEDIATIONS.find((r) => r.code === 'CC-13');
    expect(reg).toBeDefined();
    expect(reg!.severity).toBe('warning');
    expect(issue!.title).toBe(reg!.title);
    expect(issue!.remediation).toBe(reg!.remediation);
    // a warning-only doc still validates as warnings, not errors
    expect(validateUWFile(parsed).overall_status).not.toBe('errors');
  });

  it('is satisfied by a stated primary size field', () => {
    const parsed = file(
      { property: block('property', { rentable_square_feet: 42_500 }) },
      'office',
    );
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('zero is a stated quantity, not an absence — no warning', () => {
    // §4.1 says zero SHOULD NOT be used for "unknown", but a stated zero is a
    // statement; CC-13 judges absence only.
    const parsed = file({ property: block('property', { keys: 0 }) }, 'hospitality');
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('a null primary size field still warns — null is the spelled absence', () => {
    const parsed = file({ property: block('property', { keys: null }) }, 'hospitality');
    expect(find(parsed, 'CC-13')).toBeDefined();
  });

  it('fires per class through the registry, not total_units', () => {
    const hotel = file({ property: block('property', { total_units: 142 }) }, 'hospitality');
    const issue = find(hotel, 'CC-13');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('keys');
  });

  it('is silent for mixed_use (§XIII.2)', () => {
    const parsed = file({ property: block('property', {}) }, 'mixed_use');
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('is silent for an unrecognized asset class (§XIII.3)', () => {
    const parsed = file({ property: block('property', {}) }, 'data_center');
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('is silent when the document has no property section at all', () => {
    const parsed = file({}, 'office');
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('is silent for a non-deal document profile', () => {
    const parsed = file({ property: block('property', {}) }, 'office', {
      document_profile: 'market-data-v1',
    });
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('fires for the explicit deal-underwriting profile', () => {
    const parsed = file({ property: block('property', {}) }, 'office', {
      document_profile: 'deal-underwriting-v1',
    });
    expect(find(parsed, 'CC-13')).toBeDefined();
  });

  it('is silent for a compiled UW Lite summary (x_uw_lite_source present)', () => {
    const parsed = file(
      {
        property: block('property', {}),
        x_uw_lite_source: block('x_uw_lite_source', { representation: 'uw-lite-markdown' }),
      },
      'office',
    );
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });

  it('is silent when the property section is externalized (RFC 0021)', () => {
    const parsed = file(
      { property: block('property', { external: true, parts: [] }, { external: true }) },
      'office',
    );
    expect(find(parsed, 'CC-13')).toBeUndefined();
  });
});
