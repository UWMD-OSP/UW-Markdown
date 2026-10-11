import { describe, it, expect } from 'vitest';
import { loadModuleManifest, getPackForAssetClass } from '@uwmd/core';
import { DATA_CENTER_MODULE, DATA_CENTER_VIEW_MODELS } from './index.js';
describe('official compatibility shell', () => {
  it('loads without redeclaring builtin content', () => {
    expect(loadModuleManifest(DATA_CENTER_MODULE).ok).toBe(true);
    expect(DATA_CENTER_MODULE.declares_asset_classes ?? []).toEqual([]);
    expect(DATA_CENTER_MODULE.sections).toEqual([]);
    expect(DATA_CENTER_MODULE.calculations).toEqual([]);
    expect(DATA_CENTER_MODULE.validations).toEqual([]);
    expect(DATA_CENTER_VIEW_MODELS).toEqual([]);
    expect(getPackForAssetClass('data_center')!.calculations!.length).toBeGreaterThan(10);
  });
});
