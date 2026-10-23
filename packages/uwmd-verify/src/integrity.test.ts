import { describe, expect, it } from 'vitest';
import {
  blockSigningPayload,
  canonicalBlockSigningInput,
  computeBlockHash,
  sha256Hex,
  verifyChain,
  verifyProvenance,
  type BlockSignatureVerifier,
  type BlockSigVerdict,
} from './integrity.js';
import { parseUWFile } from './parser.js';
import { InvalidUnicodeError } from './integrity-canonical.js';
import type { ParsedUWFile, UWBlock, UWBlockSignature, UWIntegrity, UWLifecycle, UWProvenance, UWQuality } from './types.js';

/** Nested overrides for a test block's `_meta`, merged member by member. */
interface MetaOverrides {
  lifecycle?: Partial<UWLifecycle>;
  provenance?: Partial<UWProvenance>;
  quality?: Partial<UWQuality>;
  integrity?: UWIntegrity;
}

function makeBlock(
  sectionId: string,
  content: Record<string, unknown>,
  meta: MetaOverrides = {},
): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content,
    meta: {
      section: sectionId,
      provenance: { source: 'manual', actor: 'human/analyst', agent_id: null, agent_version: null, timestamp: '2026-04-27T00:00:00Z', notes: null, ...meta.provenance },
      quality: { confidence: 'medium', human_review_required: false, flags: [], ...meta.quality },
      lifecycle: { revision: 1, superseded: false, ...meta.lifecycle },
      ...(meta.integrity ? { integrity: meta.integrity } : {}),
    },
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

/** Stamp the block's own content_hash (or a stated wrong one). */
async function stampHash(block: UWBlock, hash?: string): Promise<void> {
  block.meta.integrity = { ...block.meta.integrity, content_hash: hash ?? await computeBlockHash(block) };
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
  it('ignores the whole _meta, including integrity.content_hash and integrity.signature', async () => {
    const a = makeBlock('property', { x: 1 });
    const b = makeBlock('property', { x: 1 }, { integrity: { content_hash: 'previous', signature: SIG }, provenance: { actor: 'someone-else' } });
    // The digest covers the block minus _meta (Protocol §V.9), so no metadata
    // edit can change the hash it is supposed to be a digest of.
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
    await stampHash(block);
    const file = makeFile({ property: block });
    const r = await verifyChain(file);
    expect(r.ok).toBe(true);
    expect(r.chains_with_hashes).toBe(1);
    expect(r.chains_verified).toBe(1);
  });

  it('emits INT-04 when content_hash does not recompute', async () => {
    const block = makeBlock('property', { x: 1 });
    await stampHash(block, 'deadbeef'.repeat(8));
    const r = await verifyChain(makeFile({ property: block }));
    expect(r.ok).toBe(true); // INT-04 is a warning
    expect(r.issues.some((i) => i.code === 'INT-04')).toBe(true);
  });

  it('emits INT-01 (error) when parent_hash does not match prior content_hash', async () => {
    const root = makeBlock('property', { x: 1 }, { lifecycle: { revision: 1, superseded: true } });
    await stampHash(root);
    const head = makeBlock('property', { x: 2 }, { lifecycle: { revision: 2 }, integrity: { parent_hash: 'wrong' } });
    await stampHash(head);

    const file = makeFile({ property: head }, { property: [root] });
    const r = await verifyChain(file);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === 'INT-01' && i.severity === 'error')).toBe(true);
  });

  it('emits INT-03 when only some blocks in a chain carry content_hash', async () => {
    const root = makeBlock('property', { x: 1 }, { lifecycle: { revision: 1, superseded: true } });
    await stampHash(root);
    const head = makeBlock('property', { x: 2 }, { lifecycle: { revision: 2 } });
    // head has no content_hash
    const file = makeFile({ property: head }, { property: [root] });
    const r = await verifyChain(file);
    expect(r.issues.some((i) => i.code === 'INT-03')).toBe(true);
  });

  it('verifies a correctly hashed two-block chain', async () => {
    const root = makeBlock('property', { x: 1 }, { lifecycle: { revision: 1, superseded: true } });
    await stampHash(root);
    const head = makeBlock('property', { x: 2 }, {
      lifecycle: { revision: 2 },
      integrity: { parent_hash: root.meta.integrity?.content_hash },
    });
    await stampHash(head);

    const file = makeFile({ property: head }, { property: [root] });
    const r = await verifyChain(file);
    expect(r.ok).toBe(true);
    expect(r.chains_verified).toBe(1);
  });
});

describe('verifyProvenance', () => {
  it('skips a head with a flat or missing _meta (META-01 reports the shape) instead of throwing', () => {
    const md = (meta: string) => `---
uw_version: "3.0"
deal_id: X
---

\`\`\`json uw:section=property v=1
{${meta} "total_units": 24}
\`\`\`
`;
    for (const meta of ['"_meta": {"section": "property", "version": 1, "source": "manual", "actor": "x"},', '']) {
      const r = verifyProvenance(parseUWFile(md(meta)));
      expect(r.ok).toBe(true);
      expect(r.issues).toEqual([]);
    }
  });

  it('returns ok for blocks with no matching policy', () => {
    const file = makeFile({
      ad_hoc_section: makeBlock('ad_hoc_section', { x: 1 }, { provenance: { source: 'unknown_source' } }),
    });
    const r = verifyProvenance(file);
    expect(r.ok).toBe(true);
  });

  it('emits POL-01 when an agent writes a section governed by a human_only policy', () => {
    const file = makeFile({
      risk_assessment: makeBlock(
        'risk_assessment',
        { score: 'low' },
        { provenance: { source: 'agent/risk-rater', actor: 'agent/risk-rater' } },
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
      lifecycle: { revision: 3 },
      provenance: { source: 'document/rent_roll', actor: 'agent/screener' },
    });
    const file = makeFile({ rent_roll: head }, {});
    const r = verifyProvenance(file);
    expect(r.issues.some((i) => i.code === 'POL-02')).toBe(true);
  });

  it('does NOT emit POL-02 when superseded priors exist', () => {
    const prior = makeBlock('rent_roll', { units: [] }, { lifecycle: { revision: 1, superseded: true } });
    const head = makeBlock('rent_roll', { units: [] }, {
      lifecycle: { revision: 2 },
      provenance: { source: 'document/rent_roll', actor: 'agent/screener' },
    });
    const file = makeFile({ rent_roll: head }, { rent_roll: [prior] });
    const r = verifyProvenance(file);
    expect(r.issues.some((i) => i.code === 'POL-02')).toBe(false);
  });
});

// ─── Block signatures (protocol §V.11, RFC 0010) ─────────────────────────────

const SIG: UWBlockSignature = {
  alg: 'ed25519',
  kid: 'sponsor-2026',
  sig: 'ZmFrZS1zaWduYXR1cmU',
  signed_at: '2026-08-27T00:00:00Z',
};

/** A verifier that answers from a table — core is crypto-free, so tests are too. */
function stubVerifier(answers: Record<string, BlockSigVerdict>): BlockSignatureVerifier {
  return {
    async verify(_payload, signature) {
      return answers[signature.kid] ?? { ok: false, reason: 'unknown_kid' };
    },
  };
}

async function hashed(block: UWBlock): Promise<UWBlock> {
  return { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, content_hash: await computeBlockHash(block) } } };
}

describe('canonicalBlockSigningInput', () => {
  it('is key-order independent and covers exactly the six normative fields', () => {
    const payload = canonicalBlockSigningInput({
      signed_at: 'b',
      kid: 'k',
      timestamp: 't',
      actor: 'a',
      section: 's',
      content_hash: 'h',
    });
    expect(payload).toBe(
      '{"actor":"a","content_hash":"h","kid":"k","section":"s","signed_at":"b","timestamp":"t"}',
    );
  });
});

describe('blockSigningPayload', () => {
  it('returns null when the block is unsigned', async () => {
    expect(blockSigningPayload(await hashed(makeBlock('property', { x: 1 })))).toBeNull();
  });

  it('returns null when a signed block has no content_hash', () => {
    expect(blockSigningPayload(makeBlock('property', { x: 1 }, { integrity: { signature: SIG } }))).toBeNull();
  });

  // The signing input names no `parent_hash` field, and `content_hash` covers
  // the block minus `_meta` (§V.9, RFC 0081 §3), so re-rooting a chain keeps
  // both the hash and the signature valid — RFC 0010 §4's intent.
  it('names no parent_hash field, and a re-root keeps the hash and the payload', async () => {
    const base = await hashed(makeBlock('property', { x: 1 }));
    const signed = { ...base, meta: { ...base.meta, integrity: { ...base.meta.integrity, signature: SIG } } };
    const reRooted = { ...signed, meta: { ...signed.meta, integrity: { ...signed.meta.integrity, parent_hash: 'a'.repeat(64) } } };
    expect(blockSigningPayload(reRooted)).toBe(blockSigningPayload(signed));
    expect(await computeBlockHash(reRooted)).toBe(reRooted.meta.integrity?.content_hash);
  });
});

describe('verifyChain signature checks', () => {
  it('counts signatures without a verifier and never claims they verified', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    const signed = { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, signature: SIG } } };
    const r = await verifyChain(makeFile({ property: signed }));
    expect(r.signatures_present).toBe(1);
    expect(r.signatures_verified).toBe(0);
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.code.startsWith('INT-0'))).toEqual([]);
  });

  it('emits INT-05 for a signature with no content_hash', async () => {
    const signed = makeBlock('property', { x: 1 }, { integrity: { signature: SIG } });
    const r = await verifyChain(makeFile({ property: signed }));
    expect(r.issues.map((i) => i.code)).toContain('INT-05');
    expect(r.ok).toBe(false);
  });

  it('emits INT-06 when the key store does not hold the kid', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    const signed = { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, signature: SIG } } };
    const r = await verifyChain(makeFile({ property: signed }), {
      signatureVerifier: stubVerifier({}),
    });
    expect(r.issues.find((i) => i.code === 'INT-06')?.actual).toBe('sponsor-2026');
    expect(r.signatures_verified).toBe(0);
    expect(r.ok).toBe(false);
  });

  it('emits INT-07 when the signature does not verify', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    const signed = { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, signature: SIG } } };
    const r = await verifyChain(makeFile({ property: signed }), {
      signatureVerifier: stubVerifier({ 'sponsor-2026': { ok: false, reason: 'bad_signature' } }),
    });
    expect(r.issues.map((i) => i.code)).toContain('INT-07');
    expect(r.ok).toBe(false);
  });

  it('emits INT-07 for an algorithm outside the admitted set, without a verifier', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    const signed = {
      ...block,
      meta: { ...block.meta, integrity: { ...block.meta.integrity, signature: { ...SIG, alg: 'rs256' as UWBlockSignature['alg'] } } },
    };
    const r = await verifyChain(makeFile({ property: signed }));
    expect(r.issues.find((i) => i.code === 'INT-07')?.actual).toBe('rs256');
  });

  it('emits INT-08 as a warning for a deprecated algorithm and still verifies', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    const signed = { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, signature: SIG } } };
    const r = await verifyChain(makeFile({ property: signed }), {
      deprecatedAlgorithms: ['ed25519'],
      signatureVerifier: stubVerifier({ 'sponsor-2026': { ok: true } }),
    });
    const int08 = r.issues.find((i) => i.code === 'INT-08');
    expect(int08?.severity).toBe('warning');
    expect(r.signatures_verified).toBe(1);
    expect(r.ok).toBe(true);
  });

  it('checks signatures on superseded blocks, not just chain heads', async () => {
    const prior = await hashed(makeBlock('rent_roll', { units: [] }, { lifecycle: { revision: 1, superseded: true } }));
    const signedPrior = { ...prior, meta: { ...prior.meta, integrity: { ...prior.meta.integrity, signature: SIG } } };
    const head = await hashed(
      makeBlock('rent_roll', { units: [{ id: 1 }] }, { lifecycle: { revision: 2 }, integrity: { parent_hash: signedPrior.meta.integrity?.content_hash } }),
    );
    const r = await verifyChain(makeFile({ rent_roll: head }, { rent_roll: [signedPrior] }), {
      signatureVerifier: stubVerifier({ 'sponsor-2026': { ok: true } }),
    });
    expect(r.signatures_present).toBe(1);
    expect(r.signatures_verified).toBe(1);
  });
});


describe('RFC 0081 Format 3.0 payload digest', () => {
  it('excludes all metadata but includes every payload and annotation member', async () => {
    const block = makeBlock('property', { _meta: { provenance: { actor: 'a' }, lifecycle: { revision: 1 }, integrity: { parent_hash: 'a' } }, value: 100, content: 2, _role: 'primary', _notes: 'source note' });
    const before = await computeBlockHash(block);
    block.content._meta = { arbitrary: 'changed', integrity: { parent_hash: 'b' } };
    expect(await computeBlockHash(block)).toBe(before);
    for (const field of ['value', 'content', '_role', '_notes']) {
      const changed = { ...block, content: { ...block.content, [field]: 'different' } };
      expect(await computeBlockHash(changed)).not.toBe(before);
    }
  });
});


describe('JCS block signature error boundaries', () => {
  it.each(['kid', 'actor'] as const)('maps malformed committed %s to INT-07 without calling a backend', async field => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    block.meta.integrity!.signature = { ...SIG, ...(field === 'kid' ? { kid: '\ud800' } : {}) };
    if (field === 'actor') block.meta.provenance.actor = '\ud800';
    const before = JSON.stringify(block);
    expect(await computeBlockHash(block)).toBe(block.meta.integrity!.content_hash);
    expect(() => blockSigningPayload(block)).toThrow(InvalidUnicodeError);
    let calls = 0;
    const recording: BlockSignatureVerifier = { verify: async () => { calls++; return { ok: true }; } };
    for (const options of [{}, { signatureVerifier: recording }]) {
      const result = await verifyChain(makeFile({ property: block }), options);
      expect(result).toMatchObject({ ok: false, signatures_present: 1, signatures_verified: 0 });
      expect(result.issues.map(issue => issue.code)).toEqual(['INT-07']);
    }
    expect(calls).toBe(0);
    expect(JSON.stringify(block)).toBe(before);
  });

  it('does not inspect excluded metadata for an unsigned block', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }, { provenance: { actor: '\ud800' } }));
    expect(await verifyChain(makeFile({ property: block }))).toMatchObject({ ok: true, signatures_present: 0, signatures_verified: 0 });
  });

  it('does not catch arbitrary backend exceptions in the input-encoding guard', async () => {
    const block = await hashed(makeBlock('property', { x: 1 }));
    block.meta.integrity!.signature = SIG;
    const error = new TypeError('backend failure');
    await expect(verifyChain(makeFile({ property: block }), { signatureVerifier: { verify: async () => { throw error; } } })).rejects.toBe(error);
  });
});

describe('RFC 0085 retained root boundary', () => {
  it.each([null, undefined])('accepts a root with parent %s at any revision', async (parent_hash) => {
    const root = makeBlock('property', { total_units: 24 }, { lifecycle: { revision: 9 }, integrity: { parent_hash } });
    await stampHash(root);
    expect(await verifyChain(makeFile({ property: root }))).toMatchObject({ ok: true, chains_verified: 1, chains_with_hashes: 1 });
  });
  it('refuses a declared absent predecessor while still checking signatures and content', async () => {
    const root = makeBlock('property', { total_units: 24 }, { integrity: { parent_hash: 'a'.repeat(64), signature: SIG } });
    await stampHash(root);
    const result = await verifyChain(makeFile({ property: root }));
    expect(result).toMatchObject({ ok: false, chains_verified: 0, chains_with_hashes: 1, signatures_present: 1 });
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INT-01', severity: 'error' })]));
    expect(result.issues.some(i => i.code === 'INT-04')).toBe(false);
    root.content.total_units = 25;
    const tampered = await verifyChain(makeFile({ property: root }));
    expect(tampered.issues.map(i => i.code)).toEqual(expect.arrayContaining(['INT-01', 'INT-04', 'INT-07']));
  });
});
