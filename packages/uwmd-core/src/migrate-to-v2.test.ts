// RFC 0009 — `uwmd migrate --to-v2`: whole-file conversion to the nested
// shape, hash re-stamping under the v2 rule, and the signature policy.

import { describe, expect, it } from 'vitest';
import { migrateToV2 } from './migrate-to-v2.js';
import { parseUWFile, getSection } from './parser.js';
import { validateUWFile } from './validator.js';
import { computeBlockHash, verifyChain } from './integrity.js';

const META_LINES = (extra = '') =>
  [
    '  "_meta": {',
    '    "section_id": "rent_roll",',
    '    "version": 1,',
    '    "superseded": false,',
    '    "source": "manual",',
    '    "agent_id": null,',
    '    "agent_version": null,',
    '    "actor": "jared",',
    '    "timestamp": "2026-08-31T00:00:00Z",',
    '    "confidence": "high",',
    '    "human_review_required": false,',
    '    "flags": [],',
    '    "input_hash": null,',
    `    "notes": null${extra ? ',' : ''}`,
    ...(extra ? [`    ${extra}`] : []),
    '  },',
  ].join('\n');

function v1File(metaExtra = '', body = '  "unit_count": 10'): string {
  return [
    '---',
    'uw_version: "1.1"',
    'deal_id: mig-001',
    'deal_name: Migration Test',
    'asset_class: multifamily',
    '---',
    '',
    '# Rent Roll',
    '',
    '```json uw:section=rent_roll source=manual ts=2026-08-31T00:00:00Z v=1 confidence=high',
    '{',
    META_LINES(metaExtra),
    `${body}`,
    '}',
    '```',
    '',
  ].join('\n');
}

describe('migrateToV2 — happy path', () => {
  it('rewrites uw_version, nests _meta, and the output validates clean', async () => {
    const result = await migrateToV2(v1File());
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(1);
    expect(result.restamped).toBe(0);

    const parsed = parseUWFile(result.content as string);
    expect(parsed.frontmatter.uw_version).toBe('2.0');
    const block = getSection(parsed, 'rent_roll');
    expect(block?.meta_shape).toBe('v2');
    // The flat parse view still works for every consumer.
    expect(block?.meta.version).toBe(1);
    expect(block?.meta.source).toBe('manual');
    expect((block?.content['_meta'] as Record<string, unknown>)['provenance']).toBeDefined();

    const issues = validateUWFile(parsed).issues.filter((i) => i.code.startsWith('META-'));
    expect(issues).toEqual([]);
  });

  it('lifts field_overrides to a top-level _overrides annotation', async () => {
    const result = await migrateToV2(
      v1File('"field_overrides": [{ "path": "units[0].rent", "confidence": "low" }]'),
    );
    expect(result.ok).toBe(true);
    const parsed = parseUWFile(result.content as string);
    const block = getSection(parsed, 'rent_roll');
    const content = block?.content as Record<string, unknown>;
    expect(content['_overrides']).toEqual([{ path: 'units[0].rent', confidence: 'low' }]);
    const meta = content['_meta'] as { quality: Record<string, unknown> };
    expect(meta.quality['field_overrides']).toBeUndefined();
    // ...and the flat view surfaces it as field_overrides.
    expect(block?.meta.field_overrides).toEqual([{ path: 'units[0].rent', confidence: 'low' }]);
  });

  it("rewrites resolution 'manual' to 'user_input' with a provenance note", async () => {
    const result = await migrateToV2(v1File('"resolution": "manual"'));
    expect(result.ok).toBe(true);
    const parsed = parseUWFile(result.content as string);
    const meta = getSection(parsed, 'rent_roll')?.content['_meta'] as {
      provenance: { resolution: string; notes: string };
    };
    expect(meta.provenance.resolution).toBe('user_input');
    expect(meta.provenance.notes).toContain("rewritten to 'user_input'");
  });

  it('re-stamps a hashed block so verifyChain passes under the v2 rule', async () => {
    // Stamp a valid v1 hash first.
    const unstamped = v1File();
    const parsed = parseUWFile(unstamped);
    const head = getSection(parsed, 'rent_roll');
    const v1Hash = await computeBlockHash(head!);
    const stamped = unstamped.replace(
      '"notes": null',
      `"notes": null,\n    "content_hash": "${v1Hash}",\n    "parent_hash": null`,
    );
    const before = await verifyChain(parseUWFile(stamped));
    expect(before.ok).toBe(true);
    expect(before.chains_with_hashes).toBe(1);

    const result = await migrateToV2(stamped);
    expect(result.ok).toBe(true);
    expect(result.restamped).toBe(1);
    const migrated = parseUWFile(result.content as string);
    const after = await verifyChain(migrated);
    expect(after.ok).toBe(true);
    expect(after.chains_verified).toBe(1);
    // The digest moved: v1 and v2 rules are different by design.
    expect(getSection(migrated, 'rent_roll')?.meta.content_hash).not.toBe(v1Hash);
  });

  it('is a no-op on an already-2.0 file', async () => {
    const first = await migrateToV2(v1File());
    const second = await migrateToV2(first.content as string);
    expect(second.ok).toBe(true);
    expect(second.changed).toBe(0);
    expect(second.content).toBe(first.content);
  });

  it('preserves CRLF endings', async () => {
    const crlf = v1File().replace(/\n/g, '\r\n');
    const result = await migrateToV2(crlf);
    expect(result.ok).toBe(true);
    expect((result.content as string).includes('\r\n')).toBe(true);
    expect(parseUWFile(result.content as string).frontmatter.uw_version).toBe('2.0');
  });
});

describe('migrateToV2 — refusals', () => {
  const SIG = '"signature": { "alg": "ed25519", "kid": "k1", "sig": "c2ln", "signed_at": "2026-08-31T00:00:00Z" }';

  it('refuses a signed block with neither --resign nor --strip-signatures', async () => {
    const result = await migrateToV2(v1File(`"content_hash": "abc",\n    ${SIG}`));
    expect(result.ok).toBe(false);
    expect(result.content).toBeNull();
    expect(result.refusals.join(' ')).toContain('signed block');
  });

  it('refuses --strip-signatures combined with --resign', async () => {
    const result = await migrateToV2(v1File(), {
      stripSignatures: true,
      resign: async () => ({ alg: 'ed25519', kid: 'k', sig: 's', signed_at: 'x' }),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals[0]).toContain('mutually exclusive');
  });

  it('refuses a legacy resolution tag in _meta.source (run --source-tags first)', async () => {
    const legacy = v1File().replace('"source": "manual"', '"source": "market_data"');
    const result = await migrateToV2(legacy);
    expect(result.ok).toBe(false);
    expect(result.refusals.join(' ')).toContain('--source-tags');
  });

  it('refuses a block whose JSON does not parse', async () => {
    const broken = v1File().replace('"unit_count": 10', '"unit_count": ');
    const result = await migrateToV2(broken);
    expect(result.ok).toBe(false);
    expect(result.refusals.join(' ')).toContain('does not parse');
  });

  it('refuses a file with no uw_version line', async () => {
    const noVersion = v1File().replace('uw_version: "1.1"\n', '');
    const result = await migrateToV2(noVersion);
    expect(result.ok).toBe(false);
    expect(result.refusals.join(' ')).toContain('uw_version');
  });
});

describe('migrateToV2 — signature policy', () => {
  const SIG = '"signature": { "alg": "ed25519", "kid": "k1", "sig": "c2ln", "signed_at": "2026-08-31T00:00:00Z" }';

  it('--strip-signatures removes the signature and records it in provenance.notes', async () => {
    const unstamped = v1File();
    const head = getSection(parseUWFile(unstamped), 'rent_roll');
    const v1Hash = await computeBlockHash(head!);
    const signedFile = v1File(`"content_hash": "${v1Hash}",\n    "parent_hash": null,\n    ${SIG}`);

    const result = await migrateToV2(signedFile, { stripSignatures: true });
    expect(result.ok).toBe(true);
    const migrated = parseUWFile(result.content as string);
    const block = getSection(migrated, 'rent_roll');
    expect(block?.meta.signature).toBeUndefined();
    expect(block?.meta.notes).toContain('signature stripped at v2 migration (was kid=k1)');
    expect((await verifyChain(migrated)).ok).toBe(true);
  });

  it('--resign re-signs over the new v2 digest', async () => {
    const unstamped = v1File();
    const head = getSection(parseUWFile(unstamped), 'rent_roll');
    const v1Hash = await computeBlockHash(head!);
    const signedFile = v1File(`"content_hash": "${v1Hash}",\n    "parent_hash": null,\n    ${SIG}`);

    let seenHash: string | undefined;
    const result = await migrateToV2(signedFile, {
      resign: async (req) => {
        seenHash = req.content_hash;
        expect(req.prior.kid).toBe('k1');
        return { alg: 'ed25519', kid: 'k2', sig: 'bmV3', signed_at: '2026-09-01T00:00:00Z' };
      },
    });
    expect(result.ok).toBe(true);
    const block = getSection(parseUWFile(result.content as string), 'rent_roll');
    expect(block?.meta.signature?.kid).toBe('k2');
    // The callback was handed the NEW digest, not the old one.
    expect(seenHash).toBe(block?.meta.content_hash);
    expect(seenHash).not.toBe(v1Hash);
    expect(block?.meta.notes).toContain('signature re-issued at v2 migration (kid=k2)');
  });
});
