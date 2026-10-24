import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringifyUWX } from './lite-bridge.js';
import { describe, expect, it } from 'vitest';
import {
  CompositionError,
  parseUWPart,
  resolveComposition,
  resolveComposite,
  validateExternalDirective,
  externalizeSection,
  stringifyUWPart,
  type UWPart,
} from './composition.js';
import { parseUWFile } from './parser.js';
import type { UWBlock, UWMeta, UWProvenance } from './types.js';
import { buildMeta } from './metadata.js';
import { computeEnvelopeDigest, toUWEnvelope, canonicalizeUWEnvelope } from './envelope.js';

/** A Format 3.0 `_meta`; `provenance` members override the defaults. */
const META = (section: string, provenance: Partial<UWProvenance> = {}): UWMeta => {
  const meta = buildMeta(section, 1, {
    source: 'document/rent_roll', actor: 'conformance', confidence: 'high', timestamp: '2026-06-01T00:00:00Z',
  });
  return { ...meta, provenance: { ...meta.provenance, ...provenance } };
};

const ROWS = [
  { unit_id: '210', tenant_name: 'Anchor Tenant LLC', monthly_rent: 15400 },
  { unit_id: '215', tenant_name: 'Second Tenant LLC', monthly_rent: 9100 },
  { unit_id: '220', tenant_name: 'Third Tenant LLC', monthly_rent: 7350 },
];

function fragment(row: Record<string, unknown>): UWPart {
  const source = [
    '---',
    'uw_version: "3.0"',
    'uwpart_version: "1.0"',
    `part_id: lease-suite-${row['unit_id']}`,
    'section: rent_roll',
    'collection_member: true',
    '---',
    '',
    '## Rent Roll {#rent_roll}',
    '',
    '```json uw:section=rent_roll v=1',
    JSON.stringify({ _meta: META('rent_roll'), ...row }, null, 2),
    '```',
    '',
  ].join('\n');
  return parseUWPart(parseUWFile(source));
}

/** The externalized parent: rent roll replaced by a directive naming parts. */
function externalRecord(partIds: string[]): string {
  return [
    '---',
    "uw_version: \"3.0\"",
    'deal_id: uw_composition',
    'asset_class: multifamily',
    '---',
    '',
    '## Rent Roll {#rent_roll}',
    '',
    '```json uw:section=rent_roll external=true v=1',
    JSON.stringify(
      {
        _meta: META('rent_roll'),
        rent_roll_type: 'multifamily',
        external: {
          parts: partIds,
          collection_key: 'unit_id',
          collection_path: 'units',
          part_count: partIds.length,
        },
      },
      null,
      2,
    ),
    '```',
    '',
  ].join('\n');
}

/** The inline twin: the same rent roll typed out in one block. */
function inlineRecord(rows: Record<string, unknown>[]): string {
  return [
    '---',
    "uw_version: \"3.0\"",
    'deal_id: uw_composition',
    'asset_class: multifamily',
    '---',
    '',
    '## Rent Roll {#rent_roll}',
    '',
    '```json uw:section=rent_roll v=1',
    JSON.stringify(
      {
        _meta: META('rent_roll'),
        rent_roll_type: 'multifamily',
        units: rows,
      },
      null,
      2,
    ),
    '```',
    '',
  ].join('\n');
}

const partsMap = (parts: UWPart[]): Map<string, UWPart> =>
  new Map(parts.map((p) => [p.part_id, p]));

describe('I-1 — digest invariance', () => {
  it('an externalized record resolves to the same canonical form as its inline twin', () => {
    const parts = partsMap(ROWS.map(fragment));
    const resolved = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-210', 'lease-suite-215', 'lease-suite-220'])),
      { parts },
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.issues).toEqual([]);

    const inline = parseUWFile(inlineRecord(ROWS));

    // Compared on the canonical form, not source bytes — source bytes obviously
    // differ, and that is the point of the rule.
    expect(canonicalizeUWEnvelope(toUWEnvelope(resolved.document))).toBe(
      canonicalizeUWEnvelope(toUWEnvelope(inline)),
    );
  });

  it('the semantic digests are identical', async () => {
    const parts = partsMap(ROWS.map(fragment));
    const resolved = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-210', 'lease-suite-215', 'lease-suite-220'])),
      { parts },
    );
    const a = await computeEnvelopeDigest(toUWEnvelope(resolved.document));
    const b = await computeEnvelopeDigest(toUWEnvelope(parseUWFile(inlineRecord(ROWS))));
    expect(a).toBe(b);
  });

  it('holds regardless of the order parts are listed in', async () => {
    const parts = partsMap(ROWS.map(fragment));
    const forward = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-210', 'lease-suite-215', 'lease-suite-220'])),
      { parts },
    );
    const shuffled = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-220', 'lease-suite-210', 'lease-suite-215'])),
      { parts },
    );
    expect(shuffled.status).toBe('resolved');
    expect(await computeEnvelopeDigest(toUWEnvelope(forward.document))).toBe(
      await computeEnvelopeDigest(toUWEnvelope(shuffled.document)),
    );
  });

  it('holds regardless of the order the parts map iterates', async () => {
    const forward = partsMap(ROWS.map(fragment));
    const reversed = partsMap([...ROWS].reverse().map(fragment));
    const ids = ['lease-suite-210', 'lease-suite-215', 'lease-suite-220'];
    const a = resolveComposition(parseUWFile(externalRecord(ids)), { parts: forward });
    const b = resolveComposition(parseUWFile(externalRecord(ids)), { parts: reversed });
    expect(await computeEnvelopeDigest(toUWEnvelope(a.document))).toBe(
      await computeEnvelopeDigest(toUWEnvelope(b.document)),
    );
  });

  it('strips the external marker from the fence annotation', () => {
    // The subtle half of I-1: the envelope's semantic value includes
    // `annotation`, so a resolved block still carrying `external=true` would
    // digest differently from its inline twin even with identical content.
    const parts = partsMap(ROWS.map(fragment));
    const resolved = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-210', 'lease-suite-215', 'lease-suite-220'])),
      { parts },
    );
    const block = resolved.document.sections['rent_roll'] as { annotation: Record<string, unknown>; content: Record<string, unknown> };
    expect(block.annotation['external']).toBeUndefined();
    // And the directive itself is gone from the content.
    expect(block.content['external']).toBeUndefined();
    expect(block.content['units']).toHaveLength(3);
  });
});

describe('merge semantics', () => {
  it('sorts rows by collection key under a byte-wise order', () => {
    const parts = partsMap(ROWS.map(fragment));
    const resolved = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-220', 'lease-suite-210', 'lease-suite-215'])),
      { parts },
    );
    const units = (resolved.document.sections['rent_roll'] as { content: Record<string, unknown> })
      .content['units'] as Record<string, unknown>[];
    expect(units.map((u) => u['unit_id'])).toEqual(['210', '215', '220']);
  });

  it('refuses a duplicate collection key rather than last-one-wins', () => {
    const dup = { ...ROWS[0]!, tenant_name: 'Conflicting Claim LLC' };
    const parts = partsMap([...ROWS.map(fragment), fragment({ ...dup, unit_id: '210' })]);
    // Both fragments share part_id lease-suite-210, so name them distinctly.
    const conflicting = parseUWFile(externalRecord(['lease-suite-210', 'lease-suite-215']));
    const twoClaims = new Map(parts);
    twoClaims.set('lease-suite-215', { ...twoClaims.get('lease-suite-215')!, blocks: twoClaims.get('lease-suite-210')!.blocks });

    const resolved = resolveComposition(conflicting, { parts: twoClaims });
    expect(resolved.status).toBe('unresolved');
    expect(resolved.issues.map((i) => i.code)).toContain('COMP-DUP-KEY');
  });

  it('reports a missing part as unresolved, never as a smaller collection', () => {
    const parts = partsMap([fragment(ROWS[0]!), fragment(ROWS[1]!)]);
    const resolved = resolveComposition(
      parseUWFile(externalRecord(['lease-suite-210', 'lease-suite-215', 'lease-suite-220'])),
      { parts },
    );
    expect(resolved.status).toBe('unresolved');
    expect(resolved.issues.map((i) => i.code)).toContain('COMP-UNRESOLVED');
    // The load-bearing assertion: the section was NOT silently rewritten to two
    // rows. A rent roll missing a tenant still totals and still produces a
    // confident DSCR, which is why this must not degrade quietly.
    const block = resolved.document.sections['rent_roll'] as { content: Record<string, unknown> };
    expect(block.content['units']).toBeUndefined();
    expect(block.content['external']).toBeDefined();
  });
});

describe('resolveComposite', () => {
  // portfolio ← deal-a ← rr-a
  //           ← deal-b
  const PORTFOLIO = {
    members: ['portfolio', 'deal-a', 'deal-b', 'rr-a'],
    links: [
      { from: 'deal-a', to: 'portfolio' },
      { from: 'deal-b', to: 'portfolio' },
      { from: 'rr-a', to: 'deal-a' },
    ],
  };

  it('walks a nested composite leaves-first and reports depth', () => {
    const r = resolveComposite(PORTFOLIO);
    expect(r.status).toBe('resolved');
    expect(r.member_count).toBe(4);
    expect(r.depth).toBe(3);
    // Leaves precede their parents, and the root comes last.
    expect(r.order.indexOf('rr-a')).toBeLessThan(r.order.indexOf('deal-a'));
    expect(r.order.indexOf('deal-a')).toBeLessThan(r.order.indexOf('portfolio'));
    expect(r.order.at(-1)).toBe('portfolio');
  });

  it('detects a direct cycle rather than recursing', () => {
    const r = resolveComposite({
      members: ['a', 'b'],
      links: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
    });
    expect(r.status).toBe('unresolved');
    expect(r.issues.map((i) => i.code)).toContain('COMP-CYCLE');
  });

  it('detects a longer cycle with no root', () => {
    const r = resolveComposite({
      members: ['a', 'b', 'c'],
      links: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }],
    });
    expect(r.status).toBe('unresolved');
    expect(r.issues.map((i) => i.code)).toContain('COMP-CYCLE');
  });

  it('enforces the depth bound', () => {
    const members = ['m0', 'm1', 'm2', 'm3'];
    const links = [
      { from: 'm3', to: 'm2' },
      { from: 'm2', to: 'm1' },
      { from: 'm1', to: 'm0' },
    ];
    expect(resolveComposite({ members, links, maxDepth: 4 }).status).toBe('resolved');
    const r = resolveComposite({ members, links, maxDepth: 2 });
    expect(r.status).toBe('unresolved');
    expect(r.issues.map((i) => i.code)).toContain('COMP-DEPTH');
  });

  it('enforces the member bound', () => {
    const r = resolveComposite({ members: ['a', 'b', 'c'], links: [], maxMembers: 2 });
    expect(r.status).toBe('unresolved');
    expect(r.issues.map((i) => i.code)).toContain('COMP-DEPTH');
  });

  it('reports a dangling reference as unresolved, not as a cycle', () => {
    const r = resolveComposite({
      members: ['portfolio'],
      links: [{ from: 'ghost-deal', to: 'portfolio' }],
    });
    expect(r.status).toBe('unresolved');
    expect(r.issues.map((i) => i.code)).toContain('COMP-UNRESOLVED');
  });

  it('reports a corrected leaf as stale, not failed', () => {
    // The parent recorded one digest for its child; the child has since been
    // corrected. That is an unadopted correction, not tampering.
    const r = resolveComposite({
      ...PORTFOLIO,
      recordedDigests: new Map([['deal-a::rr-a', `sha256:${'1'.repeat(64)}`]]),
      actualDigests: new Map([['rr-a', `sha256:${'2'.repeat(64)}`]]),
    });
    expect(r.status).toBe('stale');
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]).toMatchObject({ parent: 'deal-a', child: 'rr-a' });
    // Staleness is not an error: the graph still resolved.
    expect(r.issues).toEqual([]);
    expect(r.order.at(-1)).toBe('portfolio');
  });

  it('clears staleness once the parent adopts the new digest', () => {
    const digest = `sha256:${'2'.repeat(64)}`;
    const r = resolveComposite({
      ...PORTFOLIO,
      recordedDigests: new Map([['deal-a::rr-a', digest]]),
      actualDigests: new Map([['rr-a', digest]]),
    });
    expect(r.status).toBe('resolved');
    expect(r.stale).toEqual([]);
  });

  it('is order-independent across shuffled links', () => {
    const forward = resolveComposite(PORTFOLIO);
    const shuffled = resolveComposite({
      members: [...PORTFOLIO.members].reverse(),
      links: [...PORTFOLIO.links].reverse(),
    });
    expect(shuffled.order).toEqual(forward.order);
    expect(shuffled.depth).toBe(forward.depth);
  });

  it('handles a diamond without visiting the shared child twice', () => {
    const r = resolveComposite({
      members: ['top', 'left', 'right', 'shared'],
      links: [
        { from: 'left', to: 'top' },
        { from: 'right', to: 'top' },
        { from: 'shared', to: 'left' },
        { from: 'shared', to: 'right' },
      ],
    });
    expect(r.status).toBe('resolved');
    expect(r.order.filter((id) => id === 'shared')).toHaveLength(1);
    expect(r.order.indexOf('shared')).toBeLessThan(r.order.indexOf('left'));
  });
});

// inherited_assumption resolution (RFC 0021 §5) is the starter cascade's; its
// cases live in @uwmd/core's cascade.inherited-assumption.test.ts (RFC 0083).

describe('validateExternalDirective', () => {
  const ok = { parts: ['a', 'b'], collection_key: 'unit_id', collection_path: 'units', part_count: 2 };

  it('accepts a well-formed directive', () => {
    expect(validateExternalDirective(ok)).toEqual([]);
  });

  it('catches a truncated parts array via part_count', () => {
    const errors = validateExternalDirective({ ...ok, parts: ['a'], part_count: 2 });
    expect(errors.map((e) => e.code)).toContain('COMP-COUNT-MISMATCH');
  });

  it('rejects an empty parts array', () => {
    expect(validateExternalDirective({ ...ok, parts: [], part_count: 0 }).length).toBeGreaterThan(0);
  });

  it('rejects a part named twice', () => {
    const errors = validateExternalDirective({ ...ok, parts: ['a', 'a'], part_count: 2 });
    expect(errors.map((e) => e.code)).toContain('COMP-DUP-KEY');
  });
});

describe('parseUWPart', () => {
  const partSource = (overrides: string[] = []) =>
    [
      '---',
      'uw_version: "3.0"',
      'uwpart_version: "1.0"',
      'part_id: lease-suite-210',
      'section: rent_roll',
      'collection_member: true',
      ...overrides,
      '---',
      '',
      '## Rent Roll {#rent_roll}',
      '',
      '```json uw:section=rent_roll v=1',
      JSON.stringify({ _meta: META('rent_roll'), unit_id: '210' }),
      '```',
      '',
    ].join('\n');

  it('reads a well-formed fragment', () => {
    const part = parseUWPart(parseUWFile(partSource()));
    expect(part.part_id).toBe('lease-suite-210');
    expect(part.section).toBe('rent_roll');
    expect(part.collection_member).toBe(true);
    expect(part.blocks).toHaveLength(1);
  });

  it('refuses a fragment carrying a deal_id', () => {
    expect(() => parseUWPart(parseUWFile(partSource(['deal_id: uw_parkview'])))).toThrow(
      /not an underwriting record/,
    );
  });

  it('refuses a fragment whose blocks target another section', () => {
    const mismatched = [
      '---',
      'uw_version: "3.0"',
      'uwpart_version: "1.0"',
      'part_id: p1',
      'section: rent_roll',
      '---',
      '',
      '## Valuation {#valuation}',
      '',
      '```json uw:section=valuation v=1',
      JSON.stringify({ _meta: META('valuation'), purchase_price: 1 }),
      '```',
      '',
    ].join('\n');
    try {
      parseUWPart(parseUWFile(mismatched));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CompositionError).code).toBe('COMP-SECTION-MISMATCH');
    }
  });

  it('refuses a fragment declaring an unregistered section', () => {
    const bad = partSource().replace('section: rent_roll', 'section: not_a_section');
    expect(() => parseUWPart(parseUWFile(bad))).toThrow(CompositionError);
  });

  it('refuses a fragment with no blocks', () => {
    const empty = ['---', 'uw_version: "3.0"', 'uwpart_version: "1.0"', 'part_id: p1', 'section: rent_roll', '---', ''].join('\n');
    expect(() => parseUWPart(parseUWFile(empty))).toThrow(/carries no block/);
  });
});

describe('externalizeSection — I-1 read backwards', () => {
  it('round-trips: externalizing then resolving reproduces the inline canonical form', () => {
    const inline = parseUWFile(inlineRecord(ROWS));
    const { document, parts } = externalizeSection(inline, {
      section: 'rent_roll',
      collectionKey: 'unit_id',
      collectionPath: 'units',
      partIdPrefix: 'lease-suite',
    });

    // The record now carries a directive rather than rows.
    const block = document.sections['rent_roll'] as unknown as UWBlock;
    expect((block.content as Record<string, unknown>)['units']).toBeUndefined();
    expect((block.content as Record<string, unknown>)['external']).toMatchObject({
      collection_key: 'unit_id',
      collection_path: 'units',
      part_count: 3,
    });

    const resolved = resolveComposition(document, { parts: partsMap(parts) });
    expect(resolved.status).toBe('resolved');
    expect(resolved.issues).toEqual([]);

    // The whole point: a packaging decision must not move the digest.
    expect(canonicalizeUWEnvelope(toUWEnvelope(resolved.document))).toBe(
      canonicalizeUWEnvelope(toUWEnvelope(inline)),
    );
  });

  it('emits fragments that parse standalone', () => {
    const inline = parseUWFile(inlineRecord(ROWS));
    const { parts } = externalizeSection(inline, {
      section: 'rent_roll',
      collectionKey: 'unit_id',
      collectionPath: 'units',
      partIdPrefix: 'lease-suite',
    });

    // "Parses correctly and hashes properly" is a hard requirement: a fragment
    // only readable beside its parent is not independently reviewable.
    for (const part of parts) {
      const reparsed = parseUWPart(parseUWFile(stringifyUWPart(part)));
      expect(reparsed.part_id).toBe(part.part_id);
      expect(reparsed.section).toBe('rent_roll');
      expect(reparsed.collection_member).toBe(true);
    }
  });

  it('round-trips through serialized fragments, not just in-memory ones', () => {
    const inline = parseUWFile(inlineRecord(ROWS));
    const { document, parts } = externalizeSection(inline, {
      section: 'rent_roll',
      collectionKey: 'unit_id',
      collectionPath: 'units',
      partIdPrefix: 'lease-suite',
    });

    // Through the text form, which is what the CLI actually writes to disk.
    const reloaded = parts.map((p) => parseUWPart(parseUWFile(stringifyUWPart(p))));
    const resolved = resolveComposition(document, { parts: partsMap(reloaded) });

    expect(resolved.status).toBe('resolved');
    expect(canonicalizeUWEnvelope(toUWEnvelope(resolved.document))).toBe(
      canonicalizeUWEnvelope(toUWEnvelope(inline)),
    );
  });

  it('refuses a section that is already externalized', () => {
    const parsed = parseUWFile(externalRecord(['lease-suite-210']));
    expect(() =>
      externalizeSection(parsed, {
        section: 'rent_roll',
        collectionKey: 'unit_id',
        collectionPath: 'units',
      }),
    ).toThrow(CompositionError);
  });

  it('refuses a row with no usable collection key', () => {
    const inline = parseUWFile(inlineRecord([{ tenant_name: 'No Unit LLC', monthly_rent: 1 }]));
    expect(() =>
      externalizeSection(inline, {
        section: 'rent_roll',
        collectionKey: 'unit_id',
        collectionPath: 'units',
      }),
    ).toThrow(/no usable 'unit_id'/);
  });

  it('refuses a section that is absent', () => {
    const inline = parseUWFile(inlineRecord(ROWS));
    expect(() =>
      externalizeSection(inline, {
        section: 'debt',
        collectionKey: 'id',
        collectionPath: 'tranches',
      }),
    ).toThrow(/no section 'debt'/);
  });
});

it('externalized producer annotation survives actual UWX serialization exactly', () => {
  const inline = parseUWFile(readFileSync(resolve(process.cwd(), '../../examples/standalone/authored-2026-10-17/inline-deal.uwx.md'), 'utf8'));
  const {document} = externalizeSection(inline, {section: 'rent_roll', collectionKey: 'unit_id', collectionPath: 'units', partIdPrefix: 'synthetic'});
  const model = toUWEnvelope(document);
  const source = stringifyUWX(model);
  expect(source).toContain('external=true');
  expect(canonicalizeUWEnvelope(toUWEnvelope(parseUWFile(source)))).toBe(canonicalizeUWEnvelope(model));
});
