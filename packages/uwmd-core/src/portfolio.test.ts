// Portfolio & relationship profiles (RFC 0015, protocol §XV) — validation
// against the canonical edge registry, identity, provenance, preservation,
// queries, and the RFC 0018 projection bridge.

import { describe, expect, it } from 'vitest';
import {
  validatePortfolioProfile,
  uninterpretedPortfolioTypes,
  getPortfolioRelationships,
  entityEdgesToPortfolioEdges,
  PORTFOLIO_PROFILE_VERSION,
  PORTFOLIO_ENTITY_TYPES,
  type PortfolioProfile,
} from './portfolio.js';
import { projectPackageLinksToEntityEdges, type UWDealPackageManifest } from './deal-package.js';

const VALID: PortfolioProfile = {
  portfolio_version: '1.0',
  portfolio_id: 'industrial-2026',
  entities: [
    { id: 'property:parkview', type: 'property', deal_id: 'uw_2026_a3f9b1' },
    { id: 'borrower:acme', type: 'borrower', display_name: 'Acme Holdings' },
    { id: 'loan:senior', type: 'loan' },
    { id: 'doc:org-chart', type: 'document' },
  ],
  edges: [
    { id: 'edge:1', type: 'owns', from: 'borrower:acme', to: 'property:parkview',
      provenance: [{ source: 'org-chart.pdf', locator: 'p.2' }] },
    { id: 'edge:2', type: 'secures', from: 'property:parkview', to: 'loan:senior',
      provenance: [{ source: 'loan-agreement.pdf', locator: '§2.1' }] },
    { id: 'edge:3', type: 'supports', from: 'doc:org-chart', to: 'property:parkview',
      provenance: [{ source: 'org-chart.pdf' }] },
  ],
};

const clone = (): PortfolioProfile => JSON.parse(JSON.stringify(VALID)) as PortfolioProfile;

describe('validatePortfolioProfile', () => {
  it('accepts a valid multi-entity profile', () => {
    expect(validatePortfolioProfile(VALID)).toEqual([]);
  });
  it('refuses a non-object and a wrong version', () => {
    expect(validatePortfolioProfile(null)[0]!.code).toBe('PORT-001');
    expect(validatePortfolioProfile([])[0]!.code).toBe('PORT-001');
    const p = clone();
    p.portfolio_version = '2.0-draft';
    expect(validatePortfolioProfile(p).map((e) => e.code)).toEqual(['PORT-002']);
  });
  it('refuses missing arrays', () => {
    expect(validatePortfolioProfile({ portfolio_version: '1.0', edges: [] }).map((e) => e.code)).toContain('PORT-003');
    expect(validatePortfolioProfile({ portfolio_version: '1.0', entities: [] }).map((e) => e.code)).toContain('PORT-004');
  });
  it('refuses a duplicate id — across entities AND edges, one namespace', () => {
    const p = clone();
    p.entities.push({ id: 'property:parkview', type: 'property' });
    expect(validatePortfolioProfile(p).map((e) => e.code)).toEqual(['PORT-006']);
    const q = clone();
    q.edges[1]!.id = 'edge:1';
    expect(validatePortfolioProfile(q).map((e) => e.code)).toEqual(['PORT-006']);
    const r = clone();
    r.edges[0]!.id = 'loan:senior'; // collides with an entity id
    expect(validatePortfolioProfile(r).map((e) => e.code)).toEqual(['PORT-006']);
  });
  it('refuses a dangling endpoint, with the pointer naming the side', () => {
    const p = clone();
    p.edges[0]!.to = 'property:nowhere';
    const errors = validatePortfolioProfile(p);
    expect(errors.map((e) => e.code)).toEqual(['PORT-008']);
    expect(errors[0]!.pointer).toBe('edges[0].to');
  });
  it('refuses empty provenance and a provenance entry with no source', () => {
    const p = clone();
    p.edges[0]!.provenance = [];
    expect(validatePortfolioProfile(p).map((e) => e.code)).toEqual(['PORT-009']);
    const q = clone();
    q.edges[0]!.provenance = [{ locator: 'p.2' } as never];
    expect(validatePortfolioProfile(q).map((e) => e.code)).toEqual(['PORT-009']);
  });
  it('refuses a KNOWN member-layer type as an entity edge — the two-layer rule', () => {
    const p = clone();
    p.edges[0]!.type = 'abstracts';
    const errors = validatePortfolioProfile(p);
    expect(errors.map((e) => e.code)).toEqual(['PORT-010']);
  });
  it('enforces builtin from/to entity-kind constraints', () => {
    const p = clone();
    // `owns` is borrower → property; a loan cannot own.
    p.edges[0]!.from = 'loan:senior';
    expect(validatePortfolioProfile(p).map((e) => e.code)).toEqual(['PORT-011']);
  });
  it('preserves unknown edge types, entity types, and fields — no refusal', () => {
    const p = clone();
    p.edges.push({
      id: 'edge:x', type: 'x_cross_collateralized', from: 'property:parkview', to: 'loan:senior',
      provenance: [{ source: 'intercreditor.pdf' }], x_weight: 0.5,
    });
    p.entities.push({ id: 'fund:hype', type: 'x_fund', x_vintage: 2026 });
    expect(validatePortfolioProfile(p)).toEqual([]);
    const u = uninterpretedPortfolioTypes(p);
    expect(u).toEqual({ entity_types: ['x_fund'], edge_types: ['x_cross_collateralized'] });
  });
  it('an extension entity type exempts the endpoint from builtin kind constraints', () => {
    const p = clone();
    p.entities.push({ id: 'fund:hype', type: 'x_fund' });
    p.edges.push({
      id: 'edge:4', type: 'owns', from: 'fund:hype', to: 'property:parkview',
      provenance: [{ source: 'lpa.pdf' }],
    });
    expect(validatePortfolioProfile(p)).toEqual([]);
  });
});

describe('getPortfolioRelationships', () => {
  it('returns all edges, or the edges touching one entity', () => {
    expect(getPortfolioRelationships(VALID)).toHaveLength(3);
    const around = getPortfolioRelationships(VALID, 'property:parkview');
    expect(around.map((e) => e.id).sort()).toEqual(['edge:1', 'edge:2', 'edge:3']);
    expect(getPortfolioRelationships(VALID, 'loan:senior').map((e) => e.id)).toEqual(['edge:2']);
    expect(getPortfolioRelationships(VALID, 'nobody')).toEqual([]);
  });
});

describe('entityEdgesToPortfolioEdges — the RFC 0018 producer bridge', () => {
  it('wraps projected package edges into valid profile edges', () => {
    const manifest: UWDealPackageManifest = {
      package_version: '1.0',
      package_id: 'pkg-1',
      members: [
        { member_id: 'deal', role: 'underwriting', media_type: 'text/markdown', content_digest: `sha256:${'a'.repeat(64)}` },
        { member_id: 'lease', role: 'source_evidence', media_type: 'application/pdf', content_digest: `sha256:${'b'.repeat(64)}` },
      ],
      links: [
        { link_id: 'l1', type: 'supports', from: 'lease', to: 'deal' },
      ],
    } as unknown as UWDealPackageManifest;
    const projected = projectPackageLinksToEntityEdges(manifest);
    expect(projected.length).toBeGreaterThan(0);
    const edges = entityEdgesToPortfolioEdges(projected);
    expect(edges[0]!.id).toBe('edge:1');
    // The wrapped edges carry everything a profile edge needs.
    for (const e of edges) {
      expect(typeof e.type).toBe('string');
      expect(e.provenance.length).toBeGreaterThan(0);
    }
  });
  it('generates deterministic ids in input order with a custom prefix', () => {
    const edges = entityEdgesToPortfolioEdges(
      [
        { type: 'related_to', from: 'a', to: 'b', provenance: [{ source: 's' }] },
        { type: 'related_to', from: 'b', to: 'c', provenance: [{ source: 's' }] },
      ],
      'pkg-1',
    );
    expect(edges.map((e) => e.id)).toEqual(['pkg-1:1', 'pkg-1:2']);
  });
});

describe('constants', () => {
  it('publishes the profile version and the closed initial entity types', () => {
    expect(PORTFOLIO_PROFILE_VERSION).toBe('1.0');
    expect(PORTFOLIO_ENTITY_TYPES).toEqual(['property', 'deal', 'borrower', 'loan', 'document']);
  });
});
