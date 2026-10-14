// The asset-class defaults registry against the `AssetClass` union and the
// builtin packs (starter product). Moved from @uwmd/verify's types.test.ts with
// the defaults tables (RFC 0083); the pack half of each rule stays there.
import { describe, expect, it } from 'vitest';
import { ASSET_CLASSES, getPackForAssetClass, type AssetClass } from '@uwmd/verify';
import { getAssetClassDefaults } from './defaults.js';

const ALL_ASSET_CLASSES = ASSET_CLASSES;

/**
 * Asset classes that are members of the union but deliberately carry no calc
 * pack and no defaults table. Empty since RFC 0019 (mixed_use). Keep this set
 * equal to the one in @uwmd/verify's types.test.ts.
 */
const INTENTIONALLY_UNREGISTERED: ReadonlySet<AssetClass> = new Set<AssetClass>([]);

const REGISTERED = ALL_ASSET_CLASSES.filter((c) => !INTENTIONALLY_UNREGISTERED.has(c));

describe('defaults — AssetClass has no drifted mirrors', () => {
  it('every class outside the documented exception has a defaults table', () => {
    for (const asset_class of REGISTERED) {
      expect(
        getAssetClassDefaults(asset_class),
        `no defaults table registered for "${asset_class}" — add it to REGISTRY in defaults.ts`,
      ).not.toBeNull();
    }
  });

  it('the pack registry and the defaults registry cover the same classes', () => {
    // These two are updated by hand in separate files by the same recipe, so
    // they drift as a pair. Whichever is forgotten, this catches it.
    const withPack = ALL_ASSET_CLASSES.filter((c) => getPackForAssetClass(c) !== null);
    const withDefaults = ALL_ASSET_CLASSES.filter((c) => getAssetClassDefaults(c) !== null);
    expect(withPack).toEqual(withDefaults);
  });

  it('registers no defaults table for the documented exceptions', () => {
    for (const asset_class of INTENTIONALLY_UNREGISTERED) {
      expect(
        getAssetClassDefaults(asset_class),
        `"${asset_class}" now has a defaults table — remove it from INTENTIONALLY_UNREGISTERED`,
      ).toBeNull();
    }
  });
});

describe('defaults — registries are self-consistent', () => {
  it('each defaults table stamps its own asset class', () => {
    // The cascade reports provenance as `${table.asset_class}@${table.version}`,
    // so a mis-stamped table silently attributes a default to the wrong class.
    for (const asset_class of REGISTERED) {
      const table = getAssetClassDefaults(asset_class);
      expect(table?.asset_class, `defaults table registered under "${asset_class}" mis-stamps itself`).toBe(
        asset_class,
      );
    }
  });
});
