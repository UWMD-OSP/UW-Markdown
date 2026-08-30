import { describe, expect, it } from 'vitest';
import {
  assetClassDeclarationConflicts,
  declaredAssetClasses,
  declaredModuleDependencies,
  isCustomAssetClass,
  parseAssetClass,
  resolveAssetClass,
} from './asset-class.js';
import { createModuleRegistry } from './modules.js';
import type { ModuleAssetClassDecl, ModuleManifest } from './protocol.js';
import { ASSET_CLASSES } from './types.js';

const BASE: ModuleManifest = {
  manifest_version: '1',
  id: 'com.example.datacenters',
  name: 'Data Center Module',
  version: '1.0.0',
  description: 'Declares a custom asset class.',
  authors: ['test'],
  license: 'MIT',
  requires_protocol: '>=1.0.0',
  requires_format: '>=1.0',
  requires_tier: 'tier-1-reader',
};

const DECL: ModuleAssetClassDecl = {
  id: 'com.example.data_center',
  display_name: 'Data Center',
  fallback: 'industrial',
};

function registryWith(...declarations: ModuleAssetClassDecl[][]) {
  return createModuleRegistry({
    modules: declarations.map((decls, i) => ({
      ...BASE,
      id: `com.example.mod${i}`,
      declares_asset_classes: decls,
    })),
    hostTier: 'tier-4-agent-host',
  });
}

describe('parseAssetClass', () => {
  it('classifies every builtin as builtin', () => {
    for (const builtin of ASSET_CLASSES) {
      expect(parseAssetClass(builtin)).toEqual({ ok: true, kind: 'builtin', id: builtin });
    }
  });

  it('accepts a three-segment reverse-DNS identifier and splits it', () => {
    expect(parseAssetClass('com.example.data_center')).toEqual({
      ok: true,
      kind: 'custom',
      id: 'com.example.data_center',
      namespace: 'com.example',
      name: 'data_center',
    });
  });

  it('accepts more than three segments', () => {
    const parsed = parseAssetClass('com.example.specialty.boutique_office');
    expect(parsed.ok && parsed.kind).toBe('custom');
    expect(parsed.ok && parsed.kind === 'custom' && parsed.namespace).toBe('com.example.specialty');
  });

  const REJECTED: Array<[string, string, string]> = [
    ['an unnamespaced unknown', 'data_center', 'INVALID-ASSET-CLASS-001'],
    // Two segments reads as a namespace with no owner, and is where squatting
    // on a short prefix starts to look attractive.
    ['only two segments', 'example.data_center', 'INVALID-ASSET-CLASS-001'],
    ['capital letters', 'com.Example.DataCenter', 'INVALID-ASSET-CLASS-001'],
    ['a hyphen', 'com.example.data-center', 'INVALID-ASSET-CLASS-001'],
    ['a leading digit in a segment', 'com.example.1data', 'INVALID-ASSET-CLASS-001'],
    ['a trailing dot', 'com.example.data_center.', 'INVALID-ASSET-CLASS-001'],
    ['an empty string', '', 'INVALID-ASSET-CLASS-001'],
    // The namespace already prevents collision, so this is stricter than
    // correctness needs — but it removes the ambiguity the closed enum exists
    // to remove, and defeats host-side suffix matching.
    ['a final segment shadowing a builtin', 'com.example.multifamily', 'INVALID-ASSET-CLASS-002'],
  ];

  it.each(REJECTED)('rejects %s', (_label, raw, code) => {
    const parsed = parseAssetClass(raw);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error.code).toBe(code);
    expect(!parsed.ok && parsed.error.remediation).toBeTruthy();
  });

  it('permits a final segment that merely contains a builtin name', () => {
    // `multifamily_senior` is not `multifamily`, and banning it would leave an
    // author no way to name a specialization at all.
    expect(isCustomAssetClass('com.example.multifamily_senior')).toBe(true);
  });
});

describe('resolveAssetClass', () => {
  it('resolves a builtin with no registry at all', () => {
    expect(resolveAssetClass('office', null)).toEqual({
      status: 'resolved',
      kind: 'builtin',
      id: 'office',
    });
  });

  it('resolves a custom class when the declaring module is loaded', () => {
    const result = resolveAssetClass('com.example.data_center', registryWith([DECL]));
    expect(result.status).toBe('resolved');
    expect(result.status === 'resolved' && result.declaration?.display_name).toBe('Data Center');
  });

  it('degrades to the fallback when the module is absent but a declaration is known', () => {
    const result = resolveAssetClass('com.example.data_center', registryWith([]), {
      knownDeclarations: [DECL],
    });
    expect(result.status).toBe('degraded');
    expect(result.status === 'degraded' && result.fallback).toBe('industrial');
    expect(result.status === 'degraded' && result.issue.code).toBe('MOD-FALLBACK-001');
  });

  it('does NOT treat a known declaration as though the module were loaded', () => {
    // The distinction is the whole point: a cached declaration gives a display
    // name and a fallback, not the module's calculations and validations.
    const result = resolveAssetClass('com.example.data_center', registryWith([]), {
      knownDeclarations: [DECL],
    });
    expect(result.status).not.toBe('resolved');
  });

  it('is unresolved when neither the module nor a fallback is available', () => {
    const result = resolveAssetClass('com.example.data_center', registryWith([]));
    expect(result.status).toBe('unresolved');
    expect(result.status === 'unresolved' && result.issue.code).toBe('MOD-MISSING-001');
  });

  it('is unresolved with a fallback-less declaration, not degraded', () => {
    // Omitting `fallback` is a claim that no approximation is honest. Honoring
    // it means the reader loses the document rather than being shown a lie.
    const result = resolveAssetClass('com.example.life_sciences', registryWith([]), {
      knownDeclarations: [{ id: 'com.example.life_sciences', display_name: 'Life Sciences' }],
    });
    expect(result.status).toBe('unresolved');
  });

  it('reports a malformed identifier as unresolved rather than throwing', () => {
    const result = resolveAssetClass('DataCenter', registryWith([DECL]));
    expect(result.status).toBe('unresolved');
    expect(result.status === 'unresolved' && result.issue.code).toBe('INVALID-ASSET-CLASS-001');
  });

  it('reaches the same verdict for every host holding the same modules', () => {
    // Determinism is the contract that makes an open extension point safe.
    const a = resolveAssetClass('com.example.data_center', registryWith([DECL]));
    const b = resolveAssetClass('com.example.data_center', registryWith([DECL]));
    expect(a).toEqual(b);
  });
});

describe('declaredAssetClasses', () => {
  it('collects declarations across modules', () => {
    const registry = registryWith([DECL], [{ id: 'com.example.cold_storage', display_name: 'Cold Storage' }]);
    expect([...declaredAssetClasses(registry).keys()].sort()).toEqual([
      'com.example.cold_storage',
      'com.example.data_center',
    ]);
  });

  it('keeps the first declaration rather than letting registry order decide', () => {
    const registry = registryWith(
      [{ ...DECL, display_name: 'First' }],
      [{ ...DECL, display_name: 'Second' }],
    );
    expect(declaredAssetClasses(registry).get(DECL.id)?.display_name).toBe('First');
  });
});

describe('assetClassDeclarationConflicts', () => {
  it('reports two modules declaring the same identifier', () => {
    const registry = registryWith([DECL], [DECL]);
    const codes = assetClassDeclarationConflicts(registry).map((i) => i.code);
    expect(codes).toContain('MOD-ASSET-CLASS-CONFLICT-001');
  });

  it('reports a shared display name separately, as the cosmetic problem it is', () => {
    const registry = registryWith(
      [DECL],
      [{ id: 'org.other.data_center', display_name: 'Data Center' }],
    );
    const codes = assetClassDeclarationConflicts(registry).map((i) => i.code);
    expect(codes).toEqual(['MOD-DISPLAY-CONFLICT-001']);
  });

  it('says nothing when declarations are distinct', () => {
    const registry = registryWith([DECL], [{ id: 'com.example.cold_storage', display_name: 'Cold Storage' }]);
    expect(assetClassDeclarationConflicts(registry)).toEqual([]);
  });
});

describe('declaredModuleDependencies', () => {
  it('reads both the string and object forms', () => {
    expect(
      declaredModuleDependencies({
        modules: ['com.example.plain', { id: 'com.example.pinned', version: '>=0.1.0 <1.0.0' }],
      }),
    ).toEqual([
      { id: 'com.example.plain' },
      { id: 'com.example.pinned', version: '>=0.1.0 <1.0.0' },
    ]);
  });

  it('ignores entries with no usable id rather than inventing one', () => {
    expect(declaredModuleDependencies({ modules: [42, {}, null] })).toEqual([]);
  });

  it('returns nothing when the key is absent or not a list', () => {
    expect(declaredModuleDependencies({})).toEqual([]);
    expect(declaredModuleDependencies({ modules: 'com.example.one' })).toEqual([]);
  });
});
