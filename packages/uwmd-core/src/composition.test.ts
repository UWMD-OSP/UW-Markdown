import { describe, expect, it } from 'vitest';
import {
  CompositionError,
  parseUWPart,
  resolveComposition,
  resolveComposite,
  validateExternalDirective,
  type UWPart,
} from './composition.js';
import { parseUWFile } from './parser.js';
import {
  AmbiguousInheritanceError,
  resolveValue,
  selectInheritedAssumption,
} from './cascade.js';
import { computeEnvelopeDigest, toUWEnvelope, canonicalizeUWEnvelope } from './envelope.js';

const META = (section: string) =>
  JSON.stringify({
    section,
    version: 1,
    superseded: false,
    source: 'document/rent_roll',
    agent_id: null,
    agent_version: null,
    actor: 'conformance',
    ts: '2026-06-01T00:00:00Z',
  });

const ROWS = [
  { unit_id: '210', tenant_name: 'Anchor Tenant LLC', monthly_rent: 15400 },
  { unit_id: '215', tenant_name: 'Second Tenant LLC', monthly_rent: 9100 },
  { unit_id: '220', tenant_name: 'Third Tenant LLC', monthly_rent: 7350 },
];

function fragment(row: Record<string, unknown>): UWPart {
  const source = [
    '---',
    'uwpart_version: "1.0"',
    `part_id: lease-suite-${row['unit_id']}`,
    'section: rent_roll',
    'collection_member: true',
    '---',
    '',
    '## Rent Roll {#rent_roll}',
    '',
    '```json uw:section=rent_roll v=1',
    JSON.stringify({ _meta: JSON.parse(META('rent_roll')), ...row }, null, 2),
    '```',
    '',
  ].join('\n');
  return parseUWPart(parseUWFile(source));
}

/** The externalized parent: rent roll replaced by a directive naming parts. */
function externalRecord(partIds: string[]): string {
  return [
    '---',
    'uw_version: "1.1"',
    'deal_id: uw_composition',
    'asset_class: multifamily',
    '---',
    '',
    '## Rent Roll {#rent_roll}',
    '',
    '```json uw:section=rent_roll external=true v=1',
    JSON.stringify(
      {
        _meta: JSON.parse(META('rent_roll')),
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
    'uw_version: "1.1"',
    'deal_id: uw_composition',
    'asset_class: multifamily',
    '---',
    '',
    '## Rent Roll {#rent_roll}',
    '',
    '```json uw:section=rent_roll v=1',
    JSON.stringify(
      {
        _meta: JSON.parse(META('rent_roll')),
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

describe('inherited_assumption (RFC 0021 §5)', () => {
  const deal = () =>
    parseUWFile(
      [
        '---',
        'uw_version: "1.1"',
        'deal_id: uw_child',
        'asset_class: multifamily',
        '---',
        '',
        '## Valuation {#valuation}',
        '',
        '```json uw:section=valuation v=1',
        JSON.stringify({
          _meta: {
            section: 'valuation',
            version: 1,
            superseded: false,
            source: 'user_input',
            agent_id: null,
            agent_version: null,
            actor: 'analyst',
            ts: '2026-06-01T00:00:00Z',
          },
          exit_cap_rate_pct: 0.0625,
        }),
        '```',
        '',
      ].join('\n'),
    );

  const ancestor = (id: string, distance: number, values: Record<string, unknown>) => ({
    document_id: id,
    digest: `sha256:${'a'.repeat(64)}`,
    distance,
    values,
  });

  it('resolves an inherited value and names the asserting ancestor', () => {
    const r = resolveValue('assumptions.reserve_per_unit', deal(), {
      inherited: [ancestor('portfolio:west', 1, { 'assumptions.reserve_per_unit': 300 })],
    });
    expect(r.step).toBe('inherited_assumption');
    expect(r.source).toBe('inherited_assumption');
    expect(r.value).toBe(300);
    // Traceable to the document that asserted it, never ambient.
    expect(r.resolved_from).toBe('portfolio:west');
  });

  it('never overrides the descendant own user_input', () => {
    const r = resolveValue('valuation.exit_cap_rate_pct', deal(), {
      inherited: [ancestor('portfolio:west', 1, { 'valuation.exit_cap_rate_pct': 0.07 })],
    });
    expect(r.step).toBe('user_input');
    expect(r.value).toBe(0.0625);
  });

  it('takes the nearest ancestor when several assert the field', () => {
    const r = resolveValue('assumptions.reserve_per_unit', deal(), {
      inherited: [
        ancestor('fund:global', 3, { 'assumptions.reserve_per_unit': 250 }),
        ancestor('portfolio:west', 1, { 'assumptions.reserve_per_unit': 300 }),
        ancestor('region:sw', 2, { 'assumptions.reserve_per_unit': 275 }),
      ],
    });
    expect(r.value).toBe(300);
    expect(r.resolved_from).toBe('portfolio:west');
  });

  it('refuses equidistant ancestors rather than picking one', () => {
    // Diamond inheritance resolves explicitly or not at all.
    expect(() =>
      resolveValue('assumptions.reserve_per_unit', deal(), {
        inherited: [
          ancestor('portfolio:west', 2, { 'assumptions.reserve_per_unit': 300 }),
          ancestor('portfolio:east', 2, { 'assumptions.reserve_per_unit': 250 }),
        ],
      }),
    ).toThrow(AmbiguousInheritanceError);
  });

  it('names both ancestors in the ambiguity error', () => {
    try {
      selectInheritedAssumption('assumptions.reserve_per_unit', [
        ancestor('portfolio:west', 2, { 'assumptions.reserve_per_unit': 300 }),
        ancestor('portfolio:east', 2, { 'assumptions.reserve_per_unit': 250 }),
      ]);
      expect.unreachable('should have thrown');
    } catch (e) {
      const err = e as AmbiguousInheritanceError;
      expect(err.code).toBe('COMP-AMBIGUOUS-INHERIT');
      expect(err.ancestors).toEqual(['portfolio:east', 'portfolio:west']);
    }
  });

  it('outranks investor_profile and market_data', () => {
    const r = resolveValue('assumptions.reserve_per_unit', deal(), {
      inherited: [ancestor('portfolio:west', 1, { 'assumptions.reserve_per_unit': 300 })],
      profile: { source_id: 'inst:default', values: { 'assumptions.reserve_per_unit': 200 } },
    });
    expect(r.step).toBe('inherited_assumption');
    expect(r.value).toBe(300);
  });

  it('contributes nothing to a standalone record', () => {
    // The reason no pre-0021 digest moves: inheritance resolves along the
    // composition DAG only, and a standalone record has no ancestors.
    const r = resolveValue('assumptions.reserve_per_unit', deal(), {});
    expect(r.step).not.toBe('inherited_assumption');
  });

  it('falls through when no ancestor asserts the field', () => {
    const r = resolveValue('valuation.exit_cap_rate_pct', deal(), {
      inherited: [ancestor('portfolio:west', 1, { 'assumptions.reserve_per_unit': 300 })],
    });
    expect(r.step).toBe('user_input');
  });
});

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
      JSON.stringify({ _meta: JSON.parse(META('rent_roll')), unit_id: '210' }),
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
      'uwpart_version: "1.0"',
      'part_id: p1',
      'section: rent_roll',
      '---',
      '',
      '## Valuation {#valuation}',
      '',
      '```json uw:section=valuation v=1',
      JSON.stringify({ _meta: JSON.parse(META('valuation')), purchase_price: 1 }),
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
    const empty = ['---', 'uwpart_version: "1.0"', 'part_id: p1', 'section: rent_roll', '---', ''].join('\n');
    expect(() => parseUWPart(parseUWFile(empty))).toThrow(/carries no block/);
  });
});
