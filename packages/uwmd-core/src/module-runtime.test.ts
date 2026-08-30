import { describe, expect, it } from 'vitest';
import { createModuleRegistry } from './modules.js';
import {
  checkModuleSections,
  evaluateModuleCalculations,
  validateAgainstModules,
} from './module-runtime.js';
import type { ModuleManifest } from './protocol.js';
import type { ParsedUWFile, UWBlock } from './types.js';

// Deliberately a toy manifest rather than the hospitality one: core must not
// depend on a sibling package, and what is under test here is the runtime's
// semantics — ordering, null-vs-false, asset-class scope — not any particular
// module's arithmetic. `@uwmd/module-hospitality` covers the real thing.

const BASE: ModuleManifest = {
  manifest_version: '1',
  id: 'org.example.toy',
  name: 'Toy Module',
  version: '1.0.0',
  description: 'A module that exists to exercise the runtime.',
  authors: ['test'],
  license: 'MIT',
  requires_protocol: '>=1.0.0',
  requires_format: '>=1.0',
  requires_tier: 'tier-3-calc-host',
  asset_classes: ['hospitality'],
};

function registryOf(...modules: ModuleManifest[]) {
  return createModuleRegistry({ modules, hostTier: 'tier-4-agent-host' });
}

function block(sectionId: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section: sectionId } as UWBlock['annotation'],
    content: { section_id: sectionId, content },
    meta: {} as UWBlock['meta'],
    prose: '',
    rawJson: '',
    lineStart: 1,
    lineEnd: 1,
  };
}

function file(
  sections: Record<string, UWBlock>,
  assetClass = 'hospitality',
): ParsedUWFile {
  return {
    frontmatter: { asset_class: assetClass } as ParsedUWFile['frontmatter'],
    sections,
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: '',
  };
}

const HOTEL = file({ hotel_metrics: block('hotel_metrics', { adr: 200, occupancy: 0.5 }) });

describe('evaluateModuleCalculations', () => {
  it('threads each result into the next as prior_results', () => {
    const manifest: ModuleManifest = {
      ...BASE,
      calculations: [
        { id: 'revpar', label: 'RevPAR', formula: 'hotel_metrics.adr * hotel_metrics.occupancy', deterministic: true },
        { id: 'doubled', label: 'Doubled', formula: 'revpar * 2', deterministic: true },
      ],
    };
    const outcomes = evaluateModuleCalculations(HOTEL, registryOf(manifest));
    expect(outcomes.map((o) => o.result.value)).toEqual([100, 200]);
    expect(outcomes.every((o) => o.module_id === 'org.example.toy')).toBe(true);
  });

  it('degrades a dependent of a failed calc to null, and reports the cause', () => {
    // Worth pinning because the degradation is silent on its own: an
    // unresolved identifier evaluates to `null` (§VIII.2), so `dependent`
    // *succeeds* with no value and any rule reading it falls quiet. The
    // MOD-CALC-ERROR issue is the only trace of what actually broke.
    const manifest: ModuleManifest = {
      ...BASE,
      calculations: [
        { id: 'bad', label: 'Bad', formula: 'no_such_builtin(1)', deterministic: true },
        { id: 'dependent', label: 'Dependent', formula: 'bad + 1', deterministic: true },
      ],
    };
    const outcomes = evaluateModuleCalculations(HOTEL, registryOf(manifest));
    expect(outcomes[0]?.result.ok).toBe(false);
    expect(outcomes[1]?.result.ok).toBe(true);
    expect(outcomes[1]?.result.value).toBeNull();

    const issues = validateAgainstModules(HOTEL, registryOf(manifest));
    const reported = issues.find((i) => i.code === 'MOD-CALC-ERROR');
    expect(reported?.severity).toBe('error');
    expect(reported?.message).toContain("'bad'");
  });

  it('skips modules that do not declare the document asset class', () => {
    const manifest: ModuleManifest = {
      ...BASE,
      calculations: [{ id: 'x', label: 'X', formula: '1', deterministic: true }],
    };
    expect(evaluateModuleCalculations(file({}, 'office'), registryOf(manifest))).toEqual([]);
  });

  it('runs a module that declares no asset class at all against everything', () => {
    const manifest: ModuleManifest = {
      ...BASE,
      calculations: [{ id: 'x', label: 'X', formula: '1', deterministic: true }],
    };
    delete (manifest as { asset_classes?: unknown }).asset_classes;
    expect(evaluateModuleCalculations(file({}, 'office'), registryOf(manifest))).toHaveLength(1);
  });
});

describe('validateAgainstModules', () => {
  const rule = (rule: string, severity: 'error' | 'warning' = 'warning') => ({
    ...BASE,
    calculations: [
      { id: 'revpar', label: 'RevPAR', formula: 'hotel_metrics.adr * hotel_metrics.occupancy', deterministic: true },
    ],
    validations: [{ code: 'CC-MOD-TOY-01', severity, message: 'toy rule violated', rule }],
  });

  it('fires when a rule is false', () => {
    const issues = validateAgainstModules(HOTEL, registryOf(rule('revpar > 500')));
    expect(issues.map((i) => i.code)).toEqual(['CC-MOD-TOY-01']);
    expect(issues[0]?.severity).toBe('warning');
  });

  it('is silent when a rule is true', () => {
    expect(validateAgainstModules(HOTEL, registryOf(rule('revpar > 50')))).toEqual([]);
  });

  it('is silent when a rule evaluates to null — absence is not violation', () => {
    // The distinction the whole design turns on. A document that carries no
    // `hotel_brand` has not violated a rule about franchise fees; it has said
    // nothing about them. Treating null as false fires every module rule on
    // every partial file, which is most files most of the time.
    const issues = validateAgainstModules(HOTEL, registryOf(rule('hotel_brand.missing > 1')));
    expect(issues).toEqual([]);
  });

  it('honors the declared severity, including error', () => {
    const issues = validateAgainstModules(HOTEL, registryOf(rule('revpar > 500', 'error')));
    expect(issues[0]?.severity).toBe('error');
  });

  it('attributes every finding to the module that made it', () => {
    const issues = validateAgainstModules(HOTEL, registryOf(rule('revpar > 500')));
    expect(issues[0]?.remediation).toContain('org.example.toy');
  });

  it('reports a rule that cannot evaluate as MOD-RULE-ERROR', () => {
    const issues = validateAgainstModules(HOTEL, registryOf(rule('no_such_builtin(1) > 0')));
    expect(issues.map((i) => i.code)).toEqual(['MOD-RULE-ERROR']);
    expect(issues[0]?.severity).toBe('error');
  });
});

describe('checkModuleSections', () => {
  const withSections: ModuleManifest = {
    ...BASE,
    sections: [
      { id: 'hotel_metrics', display_name: 'Hotel Operating Metrics', required: true, schema: {} },
      { id: 'hotel_brand', display_name: 'Brand & Franchise', schema: {} },
    ],
  };

  it('reports a missing required section as an error naming the module', () => {
    const issues = checkModuleSections(file({}), withSections);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('MOD-SECTION-MISSING');
    expect(issues[0]?.section).toBe('hotel_metrics');
    expect(issues[0]?.message).toContain('org.example.toy');
  });

  it('says nothing about an optional section that is absent', () => {
    expect(checkModuleSections(HOTEL, withSections)).toEqual([]);
  });
});
