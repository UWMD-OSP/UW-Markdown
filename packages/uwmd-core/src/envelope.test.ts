import { describe, expect, it } from 'vitest';
import {
  areEnvelopesEquivalent,
  computeEnvelopeDigest,
  fromUWEnvelope,
  stampEnvelopeDigest,
  toUWEnvelope,
  verifyEnvelopeDigest,
} from './envelope.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function block(value: number): UWBlock {
  const meta: UWBlock['meta'] = {
    section: 'property',
    version: 1,
    superseded: false,
    source: 'manual',
    agent_id: null,
    agent_version: null,
    actor: 'owner',
    timestamp: '2026-07-26T00:00:00Z',
    confidence: 'high',
    human_review_required: false,
    flags: [],
    input_hash: null,
    notes: null,
  };
  const content = { _meta: meta, total_units: value };
  return {
    annotation: { section: 'property', v: 1 },
    meta,
    content,
    prose: 'Property narrative.',
    rawJson: JSON.stringify(content),
    lineStart: 1,
    lineEnd: 3,
  };
}

function document(value = 24): ParsedUWFile {
  return {
    frontmatter: {
      uw_version: '1.1',
      deal_id: 'uw_test',
      deal_name: 'Envelope test',
    } as ParsedUWFile['frontmatter'],
    sections: { property: block(value) },
    prose: { property: 'Property narrative.' },
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: 'source bytes are intentionally not part of the model envelope',
  };
}

describe('UW Document Envelope', () => {
  it('rehydrates _meta as the authoritative block metadata', () => {
    const envelope = toUWEnvelope(document());
    const restored = fromUWEnvelope(envelope);
    const property = restored.sections['property'] as UWBlock;
    expect(property.meta).toBe(property.content['_meta']);
    expect(property.prose).toBe('Property narrative.');
  });

  it('ignores volatile producer fields when testing semantic equivalence', () => {
    const left = toUWEnvelope(document(), { generatedAt: '2026-01-01T00:00:00Z', generator: 'a' });
    const right = toUWEnvelope(document(), { generatedAt: '2026-12-31T00:00:00Z', generator: 'b' });
    expect(areEnvelopesEquivalent(left, right)).toBe(true);
  });

  it('changes its digest when semantic content changes', async () => {
    const first = toUWEnvelope(document(24));
    const second = toUWEnvelope(document(25));
    expect(await computeEnvelopeDigest(first)).not.toBe(await computeEnvelopeDigest(second));
  });

  it('includes block integrity values in the envelope digest', async () => {
    const first = toUWEnvelope(document());
    const second = structuredClone(first);
    const property = second.sections['property'];
    if (!('content' in property)) throw new Error('expected property block');
    (property.content['_meta'] as Record<string, unknown>)['content_hash'] = 'sha256:changed';
    expect(await computeEnvelopeDigest(first)).not.toBe(await computeEnvelopeDigest(second));
  });
  it('stamps a verifiable digest', async () => {
    const stamped = await stampEnvelopeDigest(toUWEnvelope(document()));
    expect((await verifyEnvelopeDigest(stamped)).valid).toBe(true);
  });
});
