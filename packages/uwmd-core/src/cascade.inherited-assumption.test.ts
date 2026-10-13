// inherited_assumption in the cascade (RFC 0021 §5). The composition model is
// @uwmd/verify's (composition.test.ts there); resolving an inherited value is
// the starter cascade's, so these cases moved here with it (RFC 0083).
import { describe, expect, it } from 'vitest';
import { buildMeta, parseUWFile, type UWMeta, type UWProvenance } from '@uwmd/verify';
import {
  AmbiguousInheritanceError,
  resolveValue,
  selectInheritedAssumption,
} from './cascade.js';

/** A Format 3.0 `_meta`; `provenance` members override the defaults. */
const META = (section: string, provenance: Partial<UWProvenance> = {}): UWMeta => {
  const meta = buildMeta(section, 1, {
    source: 'document/rent_roll', actor: 'conformance', confidence: 'high', timestamp: '2026-06-01T00:00:00Z',
  });
  return { ...meta, provenance: { ...meta.provenance, ...provenance } };
};

describe('inherited_assumption (RFC 0021 §5)', () => {
  const deal = () =>
    parseUWFile(
      [
        '---',
        "uw_version: \"3.0\"",
        'deal_id: uw_child',
        'asset_class: multifamily',
        '---',
        '',
        '## Valuation {#valuation}',
        '',
        '```json uw:section=valuation v=1',
        JSON.stringify({
          _meta: META('valuation', { source: 'manual', resolution: 'user_input', actor: 'analyst' }),
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
