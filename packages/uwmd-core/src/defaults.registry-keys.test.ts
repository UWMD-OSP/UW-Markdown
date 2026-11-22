import { describe, expect, it } from 'vitest';
import { ASSET_CLASSES } from '@uwmd/verify';
import { getAssetClassDefaults, getDefaultRange } from './defaults.js';

// Names every plain object inherits from Object.prototype (or that address it).
const INHERITED = ['constructor', '__proto__', 'toString', 'hasOwnProperty'] as const;

describe('asset-class defaults registry reads own entries only', () => {
  it('still resolves every built-in class', () => {
    for (const assetClass of ASSET_CLASSES) expect(getAssetClassDefaults(assetClass)).not.toBeNull();
  });

  it.each(INHERITED)('has no defaults for %s', (name) => {
    expect(getAssetClassDefaults(name)).toBeNull();
    expect(getDefaultRange(name, 'financing.ltv')).toBeNull();
  });
});
