// RFC 0009 — the STAGE_CONTRACT merge. The registry is derived mechanically
// from the compact authoring tables, so these tests are equivalence proofs:
// the merged view must answer every question exactly as the three legacy
// surfaces did, across the full cross-product. "No behavior change for
// default-policy files" is the RFC's own acceptance criterion.

import { describe, expect, it } from 'vitest';
import {
  BUILTIN_INCOMPLETE_DATA_POLICIES,
  STAGE_CONTRACT,
  STAGE_REQUIREMENTS,
  STAGE_SECTION_OVERLAYS,
  lookupIncompleteDataPolicy,
  lookupStageContract,
  requiredSectionsFor,
} from './protocol.js';
import type { DealStage } from './types.js';
import { ASSET_CLASSES } from './types.js';

const STAGES = Object.keys(STAGE_REQUIREMENTS) as DealStage[];

/** The legacy resolution algorithm, restated verbatim as the oracle. */
function legacyRequiredSections(stage: DealStage, assetClass?: string): string[] {
  const base = STAGE_REQUIREMENTS[stage].required_sections;
  const overlay = assetClass
    ? STAGE_SECTION_OVERLAYS[assetClass as keyof typeof STAGE_SECTION_OVERLAYS]
    : undefined;
  if (!overlay) return [...base];
  const out: string[] = [];
  for (const section of base) {
    if (overlay.exempt?.includes(section)) continue;
    const replacement = overlay.substitute?.[section] ?? section;
    if (!out.includes(replacement)) out.push(replacement);
  }
  return out;
}

describe('STAGE_CONTRACT — presence equivalence', () => {
  it('matches the legacy resolution for every stage × asset class, order included', () => {
    const classes: (string | undefined)[] = [undefined, ...ASSET_CLASSES, 'not_a_class'];
    for (const stage of STAGES) {
      for (const assetClass of classes) {
        expect(
          requiredSectionsFor(stage, assetClass),
          `${stage} / ${assetClass ?? '(none)'}`,
        ).toEqual(legacyRequiredSections(stage, assetClass));
      }
    }
  });

  it('carries the RFC 0029 overlays as asset_class-qualified rows, not a side table', () => {
    const landRows = STAGE_CONTRACT.filter((r) => r.asset_class === 'land');
    expect(landRows.length).toBeGreaterThan(0);
    expect(landRows.every((r) => r.required === false)).toBe(true);

    const mixedRows = STAGE_CONTRACT.filter((r) => r.asset_class === 'mixed_use');
    expect(mixedRows.some((r) => r.section === 'components' && r.required === true)).toBe(true);
    expect(mixedRows.some((r) => r.section === 'rent_roll' && r.required === false)).toBe(true);
  });

  it('carries the scope stage field requirements, one_of groups included', () => {
    const fieldRows = STAGE_CONTRACT.filter((r) => r.stage === 'scope' && r.field_path !== undefined && r.required);
    expect(fieldRows.map((r) => r.field_path)).toEqual(
      expect.arrayContaining(['property.address', 'property.asset_class']),
    );
    const oneOf = STAGE_CONTRACT.find((r) => r.stage === 'scope' && r.one_of !== undefined);
    expect(oneOf?.one_of).toEqual(['property.asking_price', 'property.units']);
  });
});

describe('STAGE_CONTRACT — policy equivalence', () => {
  it('agrees with lookupIncompleteDataPolicy across the full builtin cross-product', () => {
    const sections = [...new Set(BUILTIN_INCOMPLETE_DATA_POLICIES.map((p) => p.section))];
    const fieldPaths = [undefined, ...new Set(BUILTIN_INCOMPLETE_DATA_POLICIES.map((p) => p.field_path).filter(Boolean))];
    for (const stage of STAGES) {
      for (const section of sections) {
        for (const fp of fieldPaths) {
          const policy = lookupIncompleteDataPolicy(section, fp, stage);
          const row = lookupStageContract(stage, section, fp);
          const where = `${stage}/${section}/${fp ?? '(section)'}`;
          if (policy) {
            expect(row?.on_provisional, where).toEqual(policy.action);
          } else {
            expect(row?.on_provisional, where).toBeUndefined();
          }
        }
      }
    }
  });

  it('states policies for sections a stage does not require (rent_roll at scope)', () => {
    const row = lookupStageContract('scope', 'rent_roll');
    expect(row?.required).toBe(false);
    expect(row?.on_provisional).toEqual({ kind: 'substitute', fallback_source: 'asset_class_default' });
  });

  it('a class-qualified row wins for its class only', () => {
    const land = lookupStageContract('full_underwrite', 'rent_roll', undefined, 'land');
    expect(land?.required).toBe(false);
    const office = lookupStageContract('full_underwrite', 'rent_roll', undefined, 'office');
    expect(office?.required).toBe(true);
    expect(office?.on_provisional).toEqual({ kind: 'halt' });
  });
});

describe('STAGE_CONTRACT — registry hygiene', () => {
  it('is deeply frozen', () => {
    expect(Object.isFrozen(STAGE_CONTRACT)).toBe(true);
    for (const row of STAGE_CONTRACT) expect(Object.isFrozen(row)).toBe(true);
  });

  it('never contradicts itself: one unqualified presence row per (stage, section)', () => {
    const seen = new Set<string>();
    for (const row of STAGE_CONTRACT) {
      if (row.asset_class !== undefined || row.field_path !== undefined || row.one_of !== undefined) continue;
      const key = `${row.stage}|${row.section}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});
