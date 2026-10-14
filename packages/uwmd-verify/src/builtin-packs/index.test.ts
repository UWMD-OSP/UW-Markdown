import { describe, expect, it } from 'vitest';
import { ASSET_CLASSES } from '../types.js';
import * as builtin from './index.js';

const PACK_NAMES = [
  'DATA_CENTER_PACK', 'HOSPITALITY_PACK', 'INDUSTRIAL_PACK', 'LAND_PACK', 'MANUFACTURED_HOUSING_PACK',
  'MIXED_USE_PACK', 'MULTIFAMILY_PACK', 'OFFICE_PACK', 'RETAIL_PACK', 'SELF_STORAGE_PACK',
  'SENIOR_HOUSING_PACK', 'STUDENT_HOUSING_PACK',
] as const;

describe('builtin pack manifests (RFC 0083)', () => {
  it('registers a pack for every official asset class', () => {
    for (const cls of ASSET_CLASSES) {
      const pack = builtin.getPackForAssetClass(cls);
      expect(pack, cls).not.toBeNull();
      expect(pack?.asset_classes, cls).toContain(cls);
    }
    expect(builtin.getPackForAssetClass('org.example.unregistered')).toBeNull();
  });

  it('registers exactly the twelve exported manifests', () => {
    const registered = new Set(ASSET_CLASSES.map((cls) => builtin.getPackForAssetClass(cls)));
    expect(new Set(PACK_NAMES.map((name) => builtin[name]))).toEqual(registered);
  });
});
