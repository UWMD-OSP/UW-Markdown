// Issue `field` spellings (Protocol §III.6a, RFC 0104): a dotted path from the
// block payload root, array elements by index, a missing object by itself.

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import type { ValidationMessage } from './types.js';

const HEADER = '---\nuw_version: "3.0"\ndeal_id: "rfc0104"\nasset_class: multifamily\n---\n\n';

function meta(section: string, provenance: Record<string, unknown>, quality: Record<string, unknown> = {}) {
  return {
    section,
    provenance: { actor: 'test', timestamp: '2026-10-20T00:00:00Z', source: 'manual', ...provenance },
    quality: { confidence: 'high', human_review_required: false, ...quality },
    lifecycle: { revision: 1, superseded: false },
  };
}
const block = (section: string, body: Record<string, unknown>) =>
  `\`\`\`json uw:section=${section}\n${JSON.stringify(body)}\n\`\`\`\n\n`;
const issues = (...blocks: string[]): ValidationMessage[] =>
  validateUWFile(parseUWFile(HEADER + blocks.join(''))).issues;
const at = (list: ValidationMessage[], code: string) =>
  list.filter((i) => i.code === code).map((i) => [i.section, i.field]);

describe('validateUWFile — issue field paths (RFC 0104)', () => {
  it('names each completeness member by its full _meta path', () => {
    const body = { _meta: { section: 'property', provenance: { actor: 'test' }, quality: {}, lifecycle: {} }, total_units: 10 };
    const found = issues(block('property', body));
    expect(at(found, 'META_FIELD_MISSING_VERSION')).toEqual([['property', '_meta.lifecycle.revision']]);
    expect(at(found, 'META_FIELD_MISSING_SOURCE')).toEqual([['property', '_meta.provenance.source']]);
    expect(at(found, 'META_FIELD_MISSING_TIMESTAMP')).toEqual([['property', '_meta.provenance.timestamp']]);
    expect(at(found, 'META_FIELD_MISSING_CONFIDENCE')).toEqual([['property', '_meta.quality.confidence']]);
  });

  it('names a missing _meta object by itself', () => {
    expect(at(issues(block('property', { total_units: 10 })), 'META_MISSING')).toEqual([['property', '_meta']]);
  });

  it('names the review flag for low confidence without review', () => {
    const body = { _meta: meta('property', {}, { confidence: 'low' }), total_units: 10 };
    expect(at(issues(block('property', body)), 'META_LOW_CONFIDENCE_NO_REVIEW_FLAG'))
      .toEqual([['property', '_meta.quality.human_review_required']]);
  });

  it('names the provenance member for every SRC finding', () => {
    expect(at(issues(block('property', { _meta: meta('property', { source: 'agent:L1' }), total_units: 10 })), 'SRC-01'))
      .toEqual([['property', '_meta.provenance.source']]);
    expect(at(issues(block('property', { _meta: meta('property', { source: 'ai_extracted' }), total_units: 10 })), 'SRC-02'))
      .toEqual([['property', '_meta.provenance.source']]);
    expect(at(issues(block('property', { _meta: meta('property', { resolution: 'guessed' }), total_units: 10 })), 'SRC-03'))
      .toEqual([['property', '_meta.provenance.resolution']]);
  });

  it('addresses tranches by index, not id (D3)', () => {
    const stack = {
      _meta: meta('capital_stack', {}), point_in_time: 'closing',
      tranches: [
        { id: 'senior', class: 'senior_debt', position: 1, amount: 100, rate: 0.05 },
        { id: 'common', class: 'common_equity', position: 0, amount: 50 },
      ],
    };
    expect(at(issues(block('capital_stack', stack)), 'CS-01')).toEqual([['capital_stack', 'tranches[1].position']]);
  });

  it('names a stale gap by its item in the gaps section', () => {
    const gaps = {
      _meta: meta('gaps', {}),
      items: [
        { section: 'noi_model', field_path: 'expense_ratio', reason: 'pending', last_checked: '2020-01-01T00:00:00Z' },
      ],
    };
    const stale = issues(block('gaps', gaps)).filter((i) => i.code === 'DQ-05');
    expect(stale.map((i) => [i.section, i.field])).toEqual([['gaps', 'items[0].last_checked']]);
    expect(stale[0]!.message).toContain('noi_model.expense_ratio');
  });

  it('gives every frontmatter-scoped issue section "frontmatter" (owner ruling 2026-10-21)', () => {
    const frontmatter = (lines: string) =>
      validateUWFile(parseUWFile(`---\nuw_version: "3.0"\ndeal_id: "rfc0104"\n${lines}---\n\n`)).issues;
    const pairs = (list: ValidationMessage[], codes: string[]) =>
      list.filter((i) => codes.includes(i.code)).map((i) => [i.code, i.section, i.field]);
    expect(pairs(frontmatter('asset_class: true\nlocale: xx-XX\ncurrency_code: usd\n'), ['INVALID-ASSET-CLASS-001', 'LOC-01', 'CUR-01']))
      .toEqual(expect.arrayContaining([
        ['INVALID-ASSET-CLASS-001', 'frontmatter', 'asset_class'],
        ['LOC-01', 'frontmatter', 'locale'],
        ['CUR-01', 'frontmatter', 'currency_code'],
      ]));
    expect(pairs(frontmatter('asset_class: com.example.custom.widget\n'), ['MOD-DEPENDENCY-UNDECLARED']))
      .toEqual([['MOD-DEPENDENCY-UNDECLARED', 'frontmatter', 'modules']]);
    expect(validateUWFile(parseUWFile('---\nuw_version: "3.0"\ndeal_id: "rfc0104"\nquick_metrics:\n  dscr: 0.9\n---\n\n')).deal_flags
      .map((f) => [f.code, f.section, f.field])).toEqual([['FV-04', 'frontmatter', 'quick_metrics.dscr']]);
  });
});
