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

  // §VIII.5. `round_to` is the precision contract a receipt digest depends on,
  // so a malformed one is refused rather than clamped or quietly replaced by
  // the unit default — two hosts must not derive different digests from one
  // manifest.
  it('accepts round_to across the permitted band, including zero', () => {
    for (const round_to of [0, 2, 6, 12]) {
      const result = loadModuleManifest({
        ...BASE,
        calculations: [{ ...BASE.calculations![0], round_to }],
      });
      expect(result.ok, `round_to: ${round_to}`).toBe(true);
    }
  });

  it('rejects a round_to that is out of range or not a whole number', () => {
    for (const round_to of [-1, 13, 2.5, '2' as unknown as number]) {
      const result = loadModuleManifest({
        ...BASE,
        calculations: [{ ...BASE.calculations![0], round_to }],
      });
      expect(result.ok, `round_to: ${String(round_to)}`).toBe(false);
      expect(result.errors.map((e) => e.code)).toContain('PROTO-MOD-067');
    }
  });

  it('accepts a calculation section_roles map and refuses a malformed one (RFC 0066)', () => {
    const roles = (section_roles: unknown) => loadModuleManifest({
      ...BASE,
      calculations: [{ ...BASE.calculations![0], section_roles } as never],
    });
    expect(roles({ debt_structure: 'senior' }).ok).toBe(true);
    for (const bad of [{ debt_structure: 'component' }, { debt_structure: 'mezzanine' }, { 'Debt': 'senior' }, ['senior'], 'senior']) {
      expect(roles(bad).errors.map((e) => e.code), JSON.stringify(bad)).toContain('PROTO-MOD-079');
    }
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

  // A typo'd construct name used to load clean and contribute nothing, which is
  // the worst possible outcome: the module author's work silently vanishes.
  it('rejects unknown keys at the manifest root and inside declarations', () => {
    const root = loadModuleManifest({ ...BASE, calculationz: [] });
    expect(root.ok).toBe(false);
    expect(root.errors.some((e) => e.code === 'PROTO-MOD-064' && e.pointer === 'calculationz')).toBe(true);

    const nested = loadModuleManifest({
      ...BASE,
      calculations: [{ ...BASE.calculations![0], bogus: 1 }],
    });
    expect(nested.ok).toBe(false);
    expect(
      nested.errors.some((e) => e.code === 'PROTO-MOD-064' && e.pointer === 'calculations[0].bogus'),
    ).toBe(true);
  });

  it('validates agent layer declarations', () => {
    const result = loadModuleManifest({
      ...BASE,
      requires_tier: 'tier-4-agent-host',
      agent_layers: [{ id: 'NOT_A_LAYER', reads: 'noi_model', writes: [''], prompt_template: 42 }],
    }, { hostTier: 'tier-4-agent-host' });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-057', 'PROTO-MOD-059', 'PROTO-MOD-060']),
    );
  });

  it('accepts a well-formed agent layer', () => {
    const result = loadModuleManifest({
      ...BASE,
      requires_tier: 'tier-4-agent-host',
      agent_layers: [
        { id: 'L7_storage', reads: ['property'], writes: ['risk_assessment'], prompt_template: 'x' },
      ],
    }, { hostTier: 'tier-4-agent-host' });

    expect(result.errors).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate agent layer ids', () => {
    const layer = { id: 'L7_storage', reads: ['property'], writes: ['risk_assessment'], prompt_template: 'x' };
    const result = loadModuleManifest({
      ...BASE,
      requires_tier: 'tier-4-agent-host',
      agent_layers: [layer, { ...layer }],
    }, { hostTier: 'tier-4-agent-host' });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-058')).toBe(true);
  });

  it('validates section declarations', () => {
    const result = loadModuleManifest({
      ...BASE,
      sections: [{ id: '', display_name: '', schema: 'not-an-object' }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-035', 'PROTO-MOD-037', 'PROTO-MOD-038']),
    );
  });

  it('validates view models and their field hints', () => {
    const result = loadModuleManifest({
      ...BASE,
      view_models: [
        {
          section_id: 's',
          display_name: 'S',
          display_order: -1,
          description: 'd',
          primary_fields: [{ path: 'a', label: 'A', kind: 'moneys', decimals: 42 }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(['PROTO-MOD-045', 'PROTO-MOD-051', 'PROTO-MOD-052']),
    );
  });

  it('rejects a malformed depends_on without misreporting it as a missing dependency', () => {
    const result = loadModuleManifest({ ...BASE, depends_on: ['org.example.other'] });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-062')).toBe(true);
    // The old code iterated the string and reported `Missing module dependency: undefined`.
    expect(result.errors.some((e) => e.message.includes('undefined'))).toBe(false);
  });

  it('enforces the schema length bounds on id, name, and description', () => {
    expect(loadModuleManifest({ ...BASE, id: 'ab' }).errors.some((e) => e.code === 'PROTO-MOD-065')).toBe(true);
    expect(loadModuleManifest({ ...BASE, name: 'x'.repeat(201) }).errors.some((e) => e.code === 'PROTO-MOD-065')).toBe(true);
    expect(loadModuleManifest({ ...BASE, description: 'x'.repeat(2001) }).errors.some((e) => e.code === 'PROTO-MOD-065')).toBe(true);
  });

  it('rejects non-numeric threshold overrides', () => {
    const result = loadModuleManifest({ ...BASE, thresholds: { min_dscr: 'high' } });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'PROTO-MOD-041')).toBe(true);
  });

  // The schema documents `^1` as a valid requires_protocol spelling, but only
  // `X.Y` was padded to full semver, so a bare major never parsed and every
  // range containing one was silently unsatisfiable.
  it('accepts partial semver ranges down to a bare major', () => {
    for (const range of ['^1', '^1.1', '^1.1.0', '>=1 <2', '*']) {
      const result = loadModuleManifest({ ...BASE, requires_protocol: range, requires_format: range });
      expect(result.errors.filter((e) => e.code === 'PROTO-MOD-030' || e.code === 'PROTO-MOD-031')).toEqual([]);
    }
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

  // Both manifests used to load and `byId` returned whichever came last, so a
  // registry lookup silently resolved to the wrong module.
  it('refuses two manifests sharing an id rather than letting the last one win', () => {
    const shadow: ModuleManifest = { ...BASE, name: 'Shadow', version: '2.0.0' };

    expect(() => createModuleRegistry({ modules: [BASE, shadow] })).toThrow(ModuleRegistryError);
    try {
      createModuleRegistry({ modules: [BASE, shadow] });
    } catch (e) {
      expect((e as ModuleRegistryError).errors.some((err) => err.code === 'PROTO-MOD-066')).toBe(true);
    }
  });
});

// Protocol §VII.3: two unrelated modules may not declare the same section id,
// calculation id or view-model section_id; a dependent's declaration overrides
// its dependency's. No outcome may depend on registry order.
describe('createModuleRegistry — §VII.3 declaration conflicts', () => {
  const module = (id: string, extra: Partial<ModuleManifest> = {}): ModuleManifest => ({
    manifest_version: '1',
    id,
    name: id,
    version: '1.0.0',
    description: 'Synthetic §VII.3 module.',
    authors: ['test'],
    license: 'MIT',
    requires_protocol: '>=1.0.0',
    requires_format: '>=1.0',
    requires_tier: 'tier-3-calc-host',
    ...extra,
  });
  const section = (id: string, required = false) => ({ id, display_name: id, schema: { type: 'object' }, required });
  const calc = (id: string, formula: string) => ({ id, label: id, formula, deterministic: true });
  const viewModel = (section_id: string, display_name: string) => ({
    section_id,
    display_name,
    display_order: 30,
    description: display_name,
    primary_fields: [],
  });
  const dep = (id: string) => ({ depends_on: [{ id, version: '^1.0.0' }] });
  const codesOf = (modules: ModuleManifest[]): string[] => {
    try {
      createModuleRegistry({ modules });
      return [];
    } catch (e) {
      return (e as ModuleRegistryError).errors.map((err) => err.code);
    }
  };

  const NAMESPACES = [
    { name: 'section', code: 'PROTO-MOD-080', decl: (v: string) => ({ sections: [section('shared', v === 'b')] }) },
    {
      name: 'calculation',
      code: 'PROTO-MOD-081',
      decl: (v: string) => ({ calculations: [calc('shared', v === 'a' ? '1' : '2')] }),
    },
    { name: 'view model', code: 'PROTO-MOD-082', decl: (v: string) => ({ view_models: [viewModel('shared', v)] }) },
  ] as const;

  for (const ns of NAMESPACES) {
    describe(ns.name, () => {
      const a = module('org.example.a', ns.decl('a'));
      const b = module('org.example.b', ns.decl('b'));
      const bDependent = module('org.example.b', { ...ns.decl('b'), ...dep('org.example.a') });

      it('refuses two unrelated modules in either order, with the same code', () => {
        expect(codesOf([a, b])).toEqual([ns.code]);
        expect(codesOf([b, a])).toEqual([ns.code]);
      });

      it('lets a dependent override the declaration of its dependency', () => {
        const registry = createModuleRegistry({ modules: [a, bDependent] });
        const map = {
          section: registry.effectiveDeclarations.sections,
          calculation: registry.effectiveDeclarations.calculations,
          'view model': registry.effectiveDeclarations.view_models,
        }[ns.name];
        expect(map.get('shared')?.module_id).toBe('org.example.b');
      });

      it('refuses the reversed order through the existing dependency rule, not by picking a winner', () => {
        // A dependent listed before its dependency has never loaded
        // (PROTO-MOD-027), so an override has exactly one possible outcome.
        expect(codesOf([bDependent, a])).toEqual(['PROTO-MOD-027']);
      });
    });
  }

  it('reports every conflicting namespace of a refused module', () => {
    const a = module('org.example.a', { sections: [section('s')], calculations: [calc('c', '1')] });
    const b = module('org.example.b', { sections: [section('s')], calculations: [calc('c', '2'), calc('own', '3')] });
    expect(codesOf([a, b]).sort()).toEqual(['PROTO-MOD-080', 'PROTO-MOD-081']);
  });

  it('follows a chain: C overrides B, which overrides A', () => {
    const a = module('org.example.a', { calculations: [calc('x', '1')] });
    const b = module('org.example.b', { calculations: [calc('x', '2')], ...dep('org.example.a') });
    const c = module('org.example.c', { calculations: [calc('x', '3')], ...dep('org.example.b') });
    const registry = createModuleRegistry({ modules: [a, b, c] });
    expect(registry.effectiveDeclarations.calculations.get('x')?.module_id).toBe('org.example.c');
  });

  it('refuses two siblings that both override one dependency, in either order', () => {
    // The second sibling names A, but B's override of A is in effect, and
    // replacing it would silently undo B.
    const a = module('org.example.a', { calculations: [calc('x', '1')] });
    const b = module('org.example.b', { calculations: [calc('x', '2')], ...dep('org.example.a') });
    const c = module('org.example.c', { calculations: [calc('x', '3')], ...dep('org.example.a') });
    expect(codesOf([a, b, c])).toEqual(['PROTO-MOD-081']);
    expect(codesOf([a, c, b])).toEqual(['PROTO-MOD-081']);
  });

  it('does not treat a transitive dependency as a declared one', () => {
    // C depends on B, B on A; B does not declare x. §VII.3 relates modules
    // that declare one another in depends_on, so C may not override A's x.
    const a = module('org.example.a', { calculations: [calc('x', '1')] });
    const b = module('org.example.b', dep('org.example.a'));
    const c = module('org.example.c', { calculations: [calc('x', '3')], ...dep('org.example.b') });
    expect(codesOf([a, b, c])).toEqual(['PROTO-MOD-081']);
  });

  it('refuses a dependency cycle through the existing dependency rule', () => {
    const a = module('org.example.a', { calculations: [calc('x', '1')], ...dep('org.example.b') });
    const b = module('org.example.b', { calculations: [calc('x', '2')], ...dep('org.example.a') });
    expect(codesOf([a, b])).toContain('PROTO-MOD-027');
    expect(codesOf([b, a])).toContain('PROTO-MOD-027');
  });

  it('keeps refusing duplicates inside one manifest where it already did', () => {
    expect(codesOf([module('org.example.a', { sections: [section('s'), section('s')] })])).toContain('PROTO-MOD-036');
    expect(codesOf([module('org.example.a', { calculations: [calc('x', '1'), calc('x', '2')] })])).toContain(
      'PROTO-MOD-015',
    );
  });

  it('applies the first of two view models one manifest declares for a section_id, which the loader accepts', () => {
    const a = module('org.example.a', { view_models: [viewModel('s', 'First'), viewModel('s', 'Second')] });
    const registry = createModuleRegistry({ modules: [a] });
    expect(registry.effectiveDeclarations.view_models.get('s')?.declaration.display_name).toBe('First');
  });

  it('returns one effective declaration per id from getModuleCalculationsForAssetClass', () => {
    const a = module('org.example.a', { asset_classes: ['office'], calculations: [calc('x', '1'), calc('y', 'x + 1')] });
    const b = module('org.example.b', {
      asset_classes: ['office'],
      calculations: [calc('x', '2')],
      ...dep('org.example.a'),
    });
    const decls = getModuleCalculationsForAssetClass(createModuleRegistry({ modules: [a, b] }), 'office');
    expect(decls.map((d) => `${d.id}=${d.formula}`)).toEqual(['x=2', 'y=x + 1']);
  });
});
