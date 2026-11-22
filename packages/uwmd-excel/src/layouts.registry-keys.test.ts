import { describe, expect, it } from 'vitest';
import { getLayoutForAssetClass, SUPPORTED_ASSET_CLASSES } from './layouts.js';

// Names every plain object inherits from Object.prototype (or that address it).
const INHERITED = ['constructor', '__proto__', 'toString', 'hasOwnProperty'] as const;

describe('workbook layout registry reads own entries only', () => {
  it('still resolves every supported class', () => {
    for (const assetClass of SUPPORTED_ASSET_CLASSES) expect(getLayoutForAssetClass(assetClass)).not.toBeNull();
  });

  it.each(INHERITED)('has no layout for %s', (name) => {
    expect(getLayoutForAssetClass(name)).toBeNull();
  });
});
