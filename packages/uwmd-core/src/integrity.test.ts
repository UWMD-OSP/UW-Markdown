import { describe, expect, it } from 'vitest';
import { computeBlockHash, sha256Hex, verifyChain, verifyProvenance } from './integrity.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function makeBlock(
  sectionId: string,
  content: Record<string, unknown>,
  meta: Partial<UWBlock['meta']> = {},
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content,
    meta: {
      section: sectionId,
      version: 1,
      superseded: false,
      source: 'manual',
      agent_id: null,
      agent_version: null,
      actor: 'human/jared',
      timestamp: '2026-04-27T00:00:00Z',
      confidence: 'medium',
      human_review_required: false,
      flags: [],
      input_hash: null,
      notes: null,
      ...meta,
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

function makeFile(sections: Record<string, UWBlock>, superseded: Record<string, UWBlock[]> = {}): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
    sections,
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded,
    raw: '',
  };
}

describe('sha256Hex', () => {
  it('produces a stable 64-char hex digest', async () => {
    const hex = await sha256Hex({ a: 1 });
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    const again = await sha256Hex({ a: 1 });
    expect(again).toBe(hex);
  });

  it('is order-independent for object keys', async () => {
    const h1 = await sha256Hex({ a: 1, b: 2 });
    const h2 = await sha256Hex({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });
});

describe('computeBlockHash', () => {
  it('ignores _meta.content_hash and _meta.signature', async () => {
    const a = makeBlock('property', { x: 1 });
    const b = makeBlock('property', { x: 1 }, { content_hash: 'previous', notes: a.meta.notes });
    // signature doesn't exist on UWMeta but the canonicalizer strips it from any meta-shaped object
    const ha = await computeBlockHash(a);
    const hb = await computeBlockHash(b);
    expect(ha).toBe(hb);
  });

  it('changes when content changes', async () => {
    const ha = await computeBlockHash(makeBlock('property', { x: 1 }));
    const hb = await computeBlockHash(makeBlock('property', { x: 2 }));
    expect(ha).not.toBe(hb);
  });
});

describe('verifyChain', () => {
  it('returns ok with no chains_with_hashes when nothing is hashed', async () => {
    const file = makeFile({ property: makeBlock('property', { x: 1 }) });
    const r = await verifyChain(file);
    expect(r.ok).toBe(true);
    expect(r.chains_with_hashes).toBe(0);
    expect(r.chains_verified).toBe(0);
  });

  it('verifies a single hashed block (root chain)', async () => {
    const block = makeBlock('property', { x: 1 });
    block.meta.content_hash = await computeBlockHash(block);
    const file = makeFile({ property: block });
    const r = await verifyChain(file);
    expect(r.ok).toBe(true);
    expect(r.chains_with_hashes).toBe(1);
    expect(r.chains_verified).toBe(1);
  });

  it('emits INT-04 when content_hash does not recompute', async () => {
    const block = makeBlock('property', { x: 1 });
    block.meta.content_hash = 'deadbeef'.repeat(8);
    const r = await verifyChain(makeFile({ property: block }));
    expect(r.ok).toBe(true); // INT-04 is a warning
    expect(r.issues.some((i) => i.code === 'INT-04')).toBe(true);
  });

  it('emits INT-01 (error) when parent_hash does not match prior content_hash', async () => {
    const root = makeBlock('property', { x: 1 }, { version: 1, superseded: true });
    root.meta.content_hash = await computeBlockHash(root);
    const head = makeBlock('property', { x: 2 }, { version: 2, parent_hash: 'wrong' });
    head.meta.content_hash = await computeBlockHash(head);

    const file = makeFile({ property: head }, { property: [root] });
    const r = await verifyChain(file);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'INT-01' && i.severity === 'error')).toBe(true);
  });

  it('emits INT-03 when only some blocks in a chain carry content_hash', async () => {
    const root = makeBlock('property', { x: 1 }, { version: 1, superseded: true });
    root.meta.content_hash = await computeBlockHash(root);
    const head = makeBlock('property', { x: 2 }, { version: 2 });
    // head has no content_hash
    const file = makeFile({ property: head }, { property: [root] });
    const r = await verifyChain(file);
    expect(r.issues.some((i) => i.code === 'INT-03')).toBe(true);
  });

  it('verifies a correctly hashed two-block chain', async () => {
    const root = makeBlock('property', { x: 1 }, { version: 1, superseded: true });
    root.meta.content_hash = await computeBlockHash(root);
    const head = makeBlock('property', { x: 2 }, {
      version: 2,
      parent_hash: root.meta.content_hash,
    });
    head.meta.content_hash = await computeBlockHash(head);

    const file = makeFile({ property: head }, { property: [root] });
    const r = await verifyChain(file);
    expect(r.ok).toBe(true);
    expect(r.chains_verified).toBe(1);
  });
});

describe('verifyProvenance', () => {
  it('returns ok for blocks with no matching policy', () => {
    const file = makeFile({
      ad_hoc_section: makeBlock('ad_hoc_section', { x: 1 }, { source: 'unknown_source' }),
    });
    const r = verifyProvenance(file);
    expect(r.ok).toBe(true);
  });

  it('emits POL-01 when an agent writes a section governed by a human_only policy', () => {
    const file = makeFile({
      risk_assessment: makeBlock(
        'risk_assessment',
        { score: 'low' },
        { source: 'agent/L6', actor: 'agent/L6' },
      ),
    });
    const customPolicies = [
      { source_pattern: 'agent/*', authority: 'human_only' as const, supersede_on_edit: true },
    ];
    const r = verifyProvenance(file, customPolicies);
    expect(r.issues.some((i) => i.code === 'POL-01')).toBe(true);
  });

  it('emits POL-02 when version > 1 but no superseded prior versions exist', () => {
    // rent_roll has supersede_on_edit=true in BUILTIN_EDIT_POLICIES
    const head = makeBlock('rent_roll', { units: [] }, {
      version: 3,
      source: 'document/rent_roll',
      actor: 'agent/L1',
    });
    const file = makeFile({ rent_roll: head }, {});
    const r = verifyProvenance(file);
    expect(r.issues.some((i) => i.code === 'POL-02')).toBe(true);
  });

  it('does NOT emit POL-02 when superseded priors exist', () => {
    const prior = makeBlock('rent_roll', { units: [] }, { version: 1, superseded: true });
    const head = makeBlock('rent_roll', { units: [] }, {
      version: 2,
      source: 'document/rent_roll',
      actor: 'agent/L1',
    });
    const file = makeFile({ rent_roll: head }, { rent_roll: [prior] });
    const r = verifyProvenance(file);
    expect(r.issues.some((i) => i.code === 'POL-02')).toBe(false);
  });
});
