import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPackForAssetClass } from './builtin-packs/index.js';
import { sizeDenominators } from './metric-verification.js';
import { getSizeIntensive, requiredSectionsFor } from './protocol.js';
import { issueReceipt } from './receipts.js';
import { ASSET_CLASSES } from './types.js';
import { validateUWFile } from './validator.js';

const PARKVIEW = resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uwx.md');
// Names every plain object inherits from Object.prototype (or that address it).
const INHERITED = ['constructor', '__proto__', 'toString', 'hasOwnProperty'] as const;

const withAssetClass = (value: string): string => {
  const source = readFileSync(PARKVIEW, 'utf8');
  expect(source).toContain('asset_class: "multifamily"');
  return source.replace('asset_class: "multifamily"', `asset_class: "${value}"`);
};

describe('built-in asset-class registries read own entries only', () => {
  it('still resolves every built-in class', () => {
    for (const assetClass of ASSET_CLASSES) expect(getPackForAssetClass(assetClass)?.version).toBeTruthy();
    expect(getSizeIntensive('multifamily')?.path).toBe('total_units');
  });

  it.each(INHERITED)('resolves no pack and no size intensive for %s', (name) => {
    expect(getPackForAssetClass(name)).toBeNull();
    expect(getSizeIntensive(name)).toBeNull();
    expect(sizeDenominators('noi / property.total_units', [name])).toEqual([]);
    expect(requiredSectionsFor('closing', name)).toEqual(requiredSectionsFor('closing'));
  });

  it.each(INHERITED)('validates a document with asset_class %s into findings', (name) => {
    const result = validateUWFile(withAssetClass(name));
    expect(result.errors.map(issue => issue.code)).toContain('INVALID-ASSET-CLASS-001');
  });

  it.each(INHERITED)('refuses to issue a receipt for asset_class %s as unresolved', async (name) => {
    await expect(issueReceipt(withAssetClass(name), { filename: PARKVIEW })).rejects.toThrow(/RCP_PACK_UNRESOLVED/);
  });
});
