// Editor integrity tests — INT-02 (stale parent_hash) + applyEditAsync stamping

import { describe, expect, it } from 'vitest';
import { applyEdit, applyEditAsync } from './editor.js';
import type { EditContext } from './editor.js';
import { parseUWFile, getSection } from './parser.js';
import { computeBlockHash, verifyChain } from './integrity.js';
import type { EditOperation } from './protocol.js';

const BASE = `---
uw_version: "1.1"
deal_id: "uw_2026_INT"
deal_name: "Integrity Test Deal"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 Hash Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
status: draft
deal_stage: screening
recommendation: null
flags: []
blocking_flags: []
tier: screener
institution_config_id: null
created_by: wizard
source_documents: []
---

# Integrity Deal

## Property {#property}

\`\`\`json uw:section=property source=manual ts=2026-01-01T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-01T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "total_units": 24,
  "year_built": 1995,
  "asset_class": "multifamily"
}
\`\`\`
`;

const CTX: EditContext = { actor: 'jared', source: 'manual' };

function makeReplaceOp(content: Record<string, unknown>): EditOperation {
  return {
    kind: 'section_replace',
    section_id: 'property',
    content,
    meta: { confidence: 'high' },
  };
}

describe('editor — INT-02 stale parent_hash (sync)', () => {
  it('rejects when prior head has content_hash and ctx.parentHash mismatches', async () => {
    // First, hash-stamp the prior head via applyEditAsync.
    const parsed1 = parseUWFile(BASE);
    const r1 = await applyEditAsync(
      BASE,
      parsed1,
      makeReplaceOp({ total_units: 30, year_built: 1995, asset_class: 'multifamily' }),
      CTX,
      undefined,
      { integrity: false }, // No prior hash → no stamp from applyEditAsync.
    );
    expect(r1.ok).toBe(true);

    // Manually inject a content_hash on the head so the second edit faces a
    // hashed prior. Use computeBlockHash on the parsed result.
    const parsed2 = parseUWFile(r1.content!);
    const head = getSection(parsed2, 'property')!;
    head.meta.content_hash = await computeBlockHash(head);
    // Splice it back into the file content.
    const content2 = r1.content!.replace(
      '"notes": null',
      `"notes": null,\n    "content_hash": "${head.meta.content_hash}"`,
    );
    const parsed3 = parseUWFile(content2);

    // Edit with WRONG parent hash → INT-02.
    const bad = applyEdit(
      content2,
      parsed3,
      makeReplaceOp({ total_units: 99, year_built: 1995, asset_class: 'multifamily' }),
      { ...CTX, parentHash: 'wrong-hash' },
    );
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe('INT-02');

    // Edit with CORRECT parent hash → ok.
    const good = applyEdit(
      content2,
      parsed3,
      makeReplaceOp({ total_units: 99, year_built: 1995, asset_class: 'multifamily' }),
      { ...CTX, parentHash: head.meta.content_hash },
    );
    expect(good.ok).toBe(true);
  });

  it('does not enforce parent_hash when prior head is unhashed', () => {
    const parsed = parseUWFile(BASE);
    const r = applyEdit(
      BASE,
      parsed,
      makeReplaceOp({ total_units: 30, year_built: 1995, asset_class: 'multifamily' }),
      { ...CTX, parentHash: 'whatever' },
    );
    // No INT-02 because prior had no content_hash — chain stays opt-out.
    expect(r.ok).toBe(true);
  });
});

describe('applyEditAsync — content_hash stamping', () => {
  it('does NOT stamp when prior head is unhashed (chain stays opt-out)', async () => {
    const parsed = parseUWFile(BASE);
    const r = await applyEditAsync(
      BASE,
      parsed,
      makeReplaceOp({ total_units: 30, year_built: 1995, asset_class: 'multifamily' }),
      CTX,
      undefined,
      { integrity: true },
    );
    expect(r.ok).toBe(true);
    const head = getSection(parseUWFile(r.content!), 'property')!;
    expect(head.meta.content_hash).toBeUndefined();
    expect(head.meta.parent_hash).toBeUndefined();
  });

  it('stamps content_hash + parent_hash when prior head is hashed', async () => {
    // Seed a hashed prior into the file.
    const parsed = parseUWFile(BASE);
    const seedHead = getSection(parsed, 'property')!;
    const seedHash = await computeBlockHash(seedHead);
    const seeded = BASE.replace(
      '"notes": null',
      `"notes": null,\n    "content_hash": "${seedHash}"`,
    );
    const parsedSeeded = parseUWFile(seeded);

    const r = await applyEditAsync(
      seeded,
      parsedSeeded,
      makeReplaceOp({ total_units: 36, year_built: 1995, asset_class: 'multifamily' }),
      { ...CTX, parentHash: seedHash },
      undefined,
      { integrity: true },
    );
    expect(r.ok).toBe(true);
    const newHead = getSection(parseUWFile(r.content!), 'property')!;
    expect(newHead.meta.parent_hash).toBe(seedHash);
    expect(newHead.meta.content_hash).toMatch(/^[0-9a-f]{64}$/);

    // verifyChain should be ok on the result (single-block chain — head only).
    const ver = await verifyChain(parseUWFile(r.content!));
    expect(ver.ok).toBe(true);
  });
});
