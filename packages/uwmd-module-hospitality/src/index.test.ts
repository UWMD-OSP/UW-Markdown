import { describe, it, expect } from 'vitest';
import { loadModuleManifest, getPackForAssetClass } from '@uwmd/core';
import { HOSPITALITY_MODULE, HOSPITALITY_VIEW_MODELS } from './index.js';
describe('official compatibility shell', () => {
  it('loads without redeclaring builtin content', () => {
    expect(loadModuleManifest(HOSPITALITY_MODULE).ok).toBe(true);
    expect(HOSPITALITY_MODULE.declares_asset_classes ?? []).toEqual([]);
    expect(HOSPITALITY_MODULE.sections).toEqual([]);
    expect(HOSPITALITY_MODULE.calculations).toEqual([]);
    expect(HOSPITALITY_MODULE.validations).toEqual([]);
    expect(HOSPITALITY_VIEW_MODELS).toEqual([]);
    expect(getPackForAssetClass('hospitality')!.calculations!.length).toBeGreaterThan(10);
  });
});
