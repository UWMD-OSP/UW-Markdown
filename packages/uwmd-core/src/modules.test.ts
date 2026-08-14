// Module loader tests.

import { describe, expect, it } from 'vitest';
import type { ModuleManifest } from './protocol.js';
import {
  ModuleRegistryError,
  createModuleRegistry,
  getModuleCalculationsForAssetClass,
  loadModuleManifest,
} from './modules.js';

const BASE: ModuleManifest = {
  manifest_version: '1',
  id: 'org.example.storage',
  name: 'Example Storage',
  version: '1.0.0',
  description: 'Example module',
  authors: ['Example'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['self_storage'],
  calculations: [
    {
      id: 'rev_per_nrsf',
      label: 'Revenue / NRSF',
      formula: 'noi_model.income.effective_gross_income / property.net_rentable_square_feet',
      unit: '$',
      deterministic: true,
    },
  ],
};

describe('loadModuleManifest', () => {
  it('loads a valid declarative module manifest', () => {
    const result = loadModuleManifest(BASE);

    expect(result.ok).toBe(true);
    expect(result.manifest?.id).toBe('org.example.storage');
    expect(result.errors).toHaveLength(0);
  });

  it('rejects unparseable formulas and non-deterministic v1 calculations', () => {
    const result = loadModuleManifest({
      ...BASE,
      calculations: [
        { id: 'bad', label: 'Bad', formula: 'noi_model.', deterministic: false },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-018', 'PROTO-MOD-019']),
    );
  });

  it('rejects asset classes outside the v1 enum', () => {
    const result = loadModuleManifest({ ...BASE, asset_classes: ['marina'] });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-008')).toBe(true);
  });

  it('rejects modules requiring a higher host tier', () => {
    const result = loadModuleManifest(BASE, { hostTier: 'tier-1-reader' });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-029')).toBe(true);
  });

  // A typo'd construct name used to load clean and contribute nothing, which is
  // the worst possible outcome: the module author's work silently vanishes.
  it('rejects unknown keys at the manifest root and inside declarations', () => {
    const root = loadModuleManifest({ ...BASE, calculationz: [] });
    expect(root.ok).toBe(false);
    expect(root.errors.some((e) => e.code === 'PROTO-MOD-064' && e.pointer === 'calculationz')).toBe(true);

    const nested = loadModuleManifest({
      ...BASE,
      calculations: [{ ...BASE.calculations![0], bogus: 1 }],
    });
    expect(nested.ok).toBe(false);
    expect(
      nested.errors.some((e) => e.code === 'PROTO-MOD-064' && e.pointer === 'calculations[0].bogus'),
    ).toBe(true);
  });

  it('validates agent layer declarations', () => {
    const result = loadModuleManifest({
      ...BASE,
      requires_tier: 'tier-4-agent-host',
      agent_layers: [{ id: 'NOT_A_LAYER', reads: 'noi_model', writes: [''], prompt_template: 42 }],
    }, { hostTier: 'tier-4-agent-host' });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-057', 'PROTO-MOD-059', 'PROTO-MOD-060']),
    );
  });

  it('accepts a well-formed agent layer', () => {
    const result = loadModuleManifest({
      ...BASE,
      requires_tier: 'tier-4-agent-host',
      agent_layers: [
        { id: 'L7_storage', reads: ['property'], writes: ['risk_assessment'], prompt_template: 'x' },
      ],
    }, { hostTier: 'tier-4-agent-host' });

    expect(result.errors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate agent layer ids', () => {
    const layer = { id: 'L7_storage', reads: ['property'], writes: ['risk_assessment'], prompt_template: 'x' };
    const result = loadModuleManifest({
      ...BASE,
      requires_tier: 'tier-4-agent-host',
      agent_layers: [layer, { ...layer }],
    }, { hostTier: 'tier-4-agent-host' });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-058')).toBe(true);
  });

  it('validates section declarations', () => {
    const result = loadModuleManifest({
      ...BASE,
      sections: [{ id: '', display_name: '', schema: 'not-an-object' }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-035', 'PROTO-MOD-037', 'PROTO-MOD-038']),
    );
  });

  it('validates view models and their field hints', () => {
    const result = loadModuleManifest({
      ...BASE,
      view_models: [
        {
          section_id: 's',
          display_name: 'S',
          display_order: -1,
          description: 'd',
          primary_fields: [{ path: 'a', label: 'A', kind: 'moneys', decimals: 42 }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-045', 'PROTO-MOD-051', 'PROTO-MOD-052']),
    );
  });

  it('rejects a malformed depends_on without misreporting it as a missing dependency', () => {
    const result = loadModuleManifest({ ...BASE, depends_on: ['org.example.other'] });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-062')).toBe(true);
    // The old code iterated the string and reported `Missing module dependency: undefined`.
    expect(result.errors.some((e) => e.message.includes('undefined'))).toBe(false);
  });

  it('enforces the schema length bounds on id, name, and description', () => {
    expect(loadModuleManifest({ ...BASE, id: 'ab' }).errors.some((e) => e.code === 'PROTO-MOD-065')).toBe(true);
    expect(loadModuleManifest({ ...BASE, name: 'x'.repeat(201) }).errors.some((e) => e.code === 'PROTO-MOD-065')).toBe(true);
    expect(loadModuleManifest({ ...BASE, description: 'x'.repeat(2001) }).errors.some((e) => e.code === 'PROTO-MOD-065')).toBe(true);
  });

  it('rejects non-numeric threshold overrides', () => {
    const result = loadModuleManifest({ ...BASE, thresholds: { min_dscr: 'high' } });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-041')).toBe(true);
  });

  // The schema documents `^1` as a valid requires_protocol spelling, but only
  // `X.Y` was padded to full semver, so a bare major never parsed and every
  // range containing one was silently unsatisfiable.
  it('accepts partial semver ranges down to a bare major', () => {
    for (const range of ['^1', '^1.1', '^1.1.0', '>=1 <2', '*']) {
      const result = loadModuleManifest({ ...BASE, requires_protocol: range, requires_format: range });
      expect(result.errors.filter((e) => e.code === 'PROTO-MOD-030' || e.code === 'PROTO-MOD-031')).toEqual([]);
    }
  });
});

describe('createModuleRegistry', () => {
  it('indexes loaded modules and returns contributed calculations by asset class', () => {
    const registry = createModuleRegistry({ modules: [BASE] });

    expect(registry.byId.get(BASE.id)?.name).toBe(BASE.name);
    expect(registry.byAssetClass.get('self_storage')).toHaveLength(1);
    expect(getModuleCalculationsForAssetClass(registry, 'self_storage')).toHaveLength(1);
    expect(getModuleCalculationsForAssetClass(registry, 'office')).toHaveLength(0);
  });

  it('enforces dependency load order and version ranges', () => {
    const dependent: ModuleManifest = {
      ...BASE,
      id: 'org.example.dependent',
      depends_on: [{ id: BASE.id, version: '^1.0.0' }],
    };
    const registry = createModuleRegistry({ modules: [BASE, dependent] });
    expect(registry.modules).toHaveLength(2);

    expect(() => createModuleRegistry({ modules: [dependent] })).toThrow(ModuleRegistryError);
  });

  // Both manifests used to load and `byId` returned whichever came last, so a
  // registry lookup silently resolved to the wrong module.
  it('refuses two manifests sharing an id rather than letting the last one win', () => {
    const shadow: ModuleManifest = { ...BASE, name: 'Shadow', version: '2.0.0' };

    expect(() => createModuleRegistry({ modules: [BASE, shadow] })).toThrow(ModuleRegistryError);
    try {
      createModuleRegistry({ modules: [BASE, shadow] });
    } catch (e) {
      expect((e as ModuleRegistryError).errors.some((err) => err.code === 'PROTO-MOD-066')).toBe(true);
    }
  });
});
