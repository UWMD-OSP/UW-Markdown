// types.ts — the format's shared type surface.
//
// types.ts is almost entirely type declarations, which are erased at runtime and
// cannot be tested directly. The two things here that *can* drift silently are
// worth pinning:
//
//   1. DEFAULT_THRESHOLDS, the one runtime value the module exports.
//   2. The `AssetClass` union, which has four separate runtime mirrors —
//      `ASSET_CLASSES` in modules.ts, `PACK_REGISTRY` in packs/index.ts,
//      `REGISTRY` in defaults.ts, and the web editor's own catalog list. A type
//      union has no runtime representation, so nothing stops a member being
//      added to the union while one of those lists is forgotten. That is the
//      class of drift this file exists to catch.

import { describe, expect, it } from 'vitest';
import { ASSET_CLASSES, DEFAULT_THRESHOLDS, type AssetClass } from './types.js';
import type { ModuleManifest } from './protocol.js';
import { loadModuleManifest } from './modules.js';
import { getPackForAssetClass } from './packs/index.js';
import { getAssetClassDefaults } from './defaults.js';

/**
 * Everything below keys off the real exported list, so a new asset class is
 * automatically held to every rule in this file.
 *
 * The exhaustiveness guarantee lives in `types.ts`, not here: `ASSET_CLASSES`
 * is derived from a `Record<AssetClass, true>` that `tsc` checks. It has to be
 * in a source file — `tsconfig.json` excludes `src/**\/*.test.ts` and vitest
 * transpiles with esbuild, so **no test file in this package is typechecked**
 * and a compile-time assertion written here would be silently inert.
 */
const ALL_ASSET_CLASSES = ASSET_CLASSES;

/**
 * Asset classes that are members of the union but deliberately carry no calc
 * pack and no defaults table.
 *
 * `mixed_use` is the only one. It composes other asset classes rather than
 * standing alone, so it needs a normative format change (a `components`
 * section) before a pack can be written — see RFC 0019. Until that is accepted
 * and implemented, it is a known, documented hole rather than an oversight.
 *
 * **This set is a forcing function, not a permanent allowance.** When the
 * `mixed_use` pack lands, `registers nothing at all` below starts failing and
 * tells you to empty this set; the registry tests then hold the union to full
 * coverage with no exceptions. Adding a *new* unregistered class here should
 * take an equally deliberate act.
 */
const INTENTIONALLY_UNREGISTERED: ReadonlySet<AssetClass> = new Set<AssetClass>(['mixed_use']);

const REGISTERED = ALL_ASSET_CLASSES.filter((c) => !INTENTIONALLY_UNREGISTERED.has(c));

const BASE_MANIFEST: Omit<ModuleManifest, 'asset_classes'> = {
  manifest_version: '1',
  id: 'org.example.drift',
  name: 'Drift Probe',
  version: '1.0.0',
  description: 'Probes which asset classes the module validator accepts.',
  authors: ['UW Markdown Working Group'],
  license: 'MIT',
  requires_protocol: '^1.0.0',
  requires_format: '^1.1.0',
  requires_tier: 'tier-3-calc-host',
};

describe('types — DEFAULT_THRESHOLDS', () => {
  it('every band is a finite number', () => {
    for (const [metric, band] of Object.entries(DEFAULT_THRESHOLDS)) {
      for (const [edge, value] of Object.entries(band as Record<string, number>)) {
        expect(Number.isFinite(value), `${metric}.${edge} must be finite`).toBe(true);
      }
    }
  });

  it('error bands sit outside warning bands, never inside them', () => {
    // A warning must fire before an error as a metric degrades. For a floor
    // (`*_below`) that means the error edge is the lower number; for a ceiling
    // (`*_above`) the error edge is the higher one. Inverting either would make
    // a document error without ever warning.
    for (const [metric, band] of Object.entries(DEFAULT_THRESHOLDS)) {
      const b = band as { error_below?: number; warning_below?: number; error_above?: number; warning_above?: number };

      if (b.error_below !== undefined && b.warning_below !== undefined) {
        expect(b.error_below, `${metric}: error_below must be <= warning_below`).toBeLessThanOrEqual(
          b.warning_below,
        );
      }
      if (b.error_above !== undefined && b.warning_above !== undefined) {
        expect(b.error_above, `${metric}: error_above must be >= warning_above`).toBeGreaterThanOrEqual(
          b.warning_above,
        );
      }
    }
  });

  it('a floor never sits above its own ceiling', () => {
    for (const [metric, band] of Object.entries(DEFAULT_THRESHOLDS)) {
      const b = band as { warning_below?: number; warning_above?: number };
      if (b.warning_below !== undefined && b.warning_above !== undefined) {
        expect(b.warning_below, `${metric}: warning_below must be < warning_above`).toBeLessThan(
          b.warning_above,
        );
      }
    }
  });
});

describe('types — AssetClass has no drifted mirrors', () => {
  it('the union is exactly the ten v1 classes', () => {
    // Guards the exhaustiveness anchor itself: editing the union and
    // ASSET_CLASS_MEMBERS in lockstep keeps tsc quiet, and this is what
    // notices. Adding an asset class is a normative format change (RFC 0003),
    // never a silent addition.
    expect(ALL_ASSET_CLASSES).toHaveLength(10);
    expect([...ALL_ASSET_CLASSES].sort()).toEqual([
      'hospitality',
      'industrial',
      'land',
      'mixed_use',
      'multifamily',
      'office',
      'retail',
      'self_storage',
      'senior_housing',
      'student_housing',
    ]);
  });

  it("modules.ts accepts every member — its ASSET_CLASSES list has not drifted", () => {
    // modules.ts keeps a private ASSET_CLASSES array used to validate a module
    // manifest's declared classes. If the union gains a member and that array
    // does not, a module legitimately targeting the new class is rejected with
    // PROTO-MOD-008. Probed through the public loader rather than by exporting
    // the array purely for a test.
    for (const asset_class of ALL_ASSET_CLASSES) {
      const result = loadModuleManifest({ ...BASE_MANIFEST, asset_classes: [asset_class] });
      const unknownClass = result.errors.filter((e) => e.code === 'PROTO-MOD-008');
      expect(unknownClass, `modules.ts rejects the valid asset class "${asset_class}"`).toEqual([]);
    }
  });

  it('every class outside the documented exception has a calc pack', () => {
    for (const asset_class of REGISTERED) {
      expect(
        getPackForAssetClass(asset_class),
        `no calc pack registered for "${asset_class}" — add it to PACK_REGISTRY in packs/index.ts`,
      ).not.toBeNull();
    }
  });

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

  it('registers nothing at all for the documented exceptions', () => {
    // The forcing function. When mixed_use ships a pack (RFC 0019) this fails,
    // and the fix is to empty INTENTIONALLY_UNREGISTERED — at which point the
    // two tests above hold the union to full coverage with no exceptions left.
    for (const asset_class of INTENTIONALLY_UNREGISTERED) {
      expect(
        getPackForAssetClass(asset_class),
        `"${asset_class}" now has a calc pack — remove it from INTENTIONALLY_UNREGISTERED`,
      ).toBeNull();
      expect(
        getAssetClassDefaults(asset_class),
        `"${asset_class}" now has a defaults table — remove it from INTENTIONALLY_UNREGISTERED`,
      ).toBeNull();
    }
  });
});

describe('types — registries are self-consistent', () => {
  it('each pack declares the asset class it is registered under', () => {
    // Nine packs were written by copying the previous one, which makes a stale
    // `asset_classes` field the most likely copy-paste error. A pack registered
    // under `land` but still claiming `student_housing` would resolve correctly
    // and report the wrong class to every module-aware consumer.
    for (const asset_class of REGISTERED) {
      const pack = getPackForAssetClass(asset_class);
      expect(pack?.asset_classes, `pack for "${asset_class}" declares no asset_classes`).toBeDefined();
      expect(
        pack?.asset_classes,
        `pack registered under "${asset_class}" does not declare it`,
      ).toContain(asset_class);
    }
  });

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

  it('each pack carries at least one deterministic calculation', () => {
    for (const asset_class of REGISTERED) {
      const calcs = getPackForAssetClass(asset_class)?.calculations ?? [];
      expect(calcs.length, `pack for "${asset_class}" declares no calculations`).toBeGreaterThan(0);
      for (const calc of calcs) {
        expect(calc.deterministic, `${asset_class}.${calc.id} must be deterministic`).toBe(true);
      }
    }
  });
});
