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
});
