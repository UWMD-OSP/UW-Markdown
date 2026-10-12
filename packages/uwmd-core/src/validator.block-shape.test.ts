// META-01 — the one block shape (Format §2.4–§2.5, RFC 0081 §3). A block is the
// bare payload with an inline nested `_meta`; the retired `{section_id, _meta,
// content}` wrapper and the retired flat `_meta` are both META-01 errors.

import { describe, expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { buildMeta } from './runner.js';

const doc = (block: Record<string, unknown>) => parseUWFile(`---
uw_version: "3.0"
deal_id: "shape"
asset_class: multifamily
---

\`\`\`json uw:section=property v=1
${JSON.stringify(block, null, 2)}
\`\`\`
`);
const meta = buildMeta('property', 1, { source: 'manual', actor: 'test', timestamp: '2026-10-12T00:00:00Z' });
const meta01 = (block: Record<string, unknown>) =>
  validateUWFile(doc(block)).issues.filter((i) => i.code === 'META-01');

describe('META-01', () => {
  it('accepts the bare block with nested _meta', () => {
    expect(meta01({ _meta: meta, total_units: 10 })).toEqual([]);
  });

  it('reads a payload member named content as payload, not a wrapper', () => {
    expect(meta01({ _meta: meta, content: { total_units: 10 } })).toEqual([]);
  });

  it('refuses a section_id wrapper member as an error', () => {
    const issues = meta01({ section_id: 'property', _meta: meta, content: { total_units: 10 } });
    expect(issues).toMatchObject([{ severity: 'error', section: 'property' }]);
  });

  it('refuses a flat _meta as an error', () => {
    const flat = { section: 'property', version: 1, superseded: false, source: 'manual', actor: 'test', timestamp: '2026-10-12T00:00:00Z', confidence: 'high', human_review_required: false };
    expect(meta01({ _meta: flat, total_units: 10 })).toMatchObject([{ severity: 'error' }]);
  });

  it('refuses a _meta missing either nested provenance or lifecycle', () => {
    const { provenance: _p, ...noProvenance } = meta;
    const { lifecycle: _l, ...noLifecycle } = meta;
    expect(meta01({ _meta: noProvenance, total_units: 10 })).toHaveLength(1);
    expect(meta01({ _meta: noLifecycle, total_units: 10 })).toHaveLength(1);
  });

  it('leaves an absent _meta to META_MISSING', () => {
    const result = validateUWFile(doc({ total_units: 10 }));
    expect(result.issues.filter((i) => i.code === 'META-01')).toEqual([]);
    expect(result.issues.some((i) => i.code === 'META_MISSING')).toBe(true);
  });
});
