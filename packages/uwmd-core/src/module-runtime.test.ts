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

  it('scopes a module that DECLARES a custom class to that class (RFC 0039)', () => {
    // `asset_classes` names builtins a module enhances and cannot carry a
    // custom id (PROTO-MOD-008), so a declaring module's scope is the class it
    // declares. Without this, a data-center module would run against every
    // office file and raise MOD-SECTION-MISSING on all of them.
    const manifest: ModuleManifest = {
      ...BASE,
      declares_asset_classes: [
        { id: 'org.example.data_center', display_name: 'Data Center', fallback: 'industrial' },
      ],
      sections: [{ id: 'dc_capacity', display_name: 'Capacity', required: true, schema: {} }],
      calculations: [{ id: 'x', label: 'X', formula: '1', deterministic: true }],
    };
    delete (manifest as { asset_classes?: unknown }).asset_classes;
    const registry = registryOf(manifest);
    expect(evaluateModuleCalculations(file({}, 'org.example.data_center'), registry)).toHaveLength(1);
    expect(evaluateModuleCalculations(file({}, 'office'), registry)).toEqual([]);
    expect(evaluateModuleCalculations(file({}, 'industrial'), registry)).toEqual([]);
    expect(validateAgainstModules(file({}, 'industrial'), registry)).toEqual([]);
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

// RFC 0071: a bad authored date is document data, not a broken rule. The
// predicate returns `false`, so the rule reports its own code through the
// ordinary path; MOD-RULE-ERROR stays reserved for evaluation failures.
describe('is_calendar_date in module rules (RFC 0071)', () => {
  // HYPOTHETICAL — NOT THE RFC 0071 SHIPPING FLOOR. Nobody has selected the
  // first Protocol release that contains RFC 0071; release preparation assigns
  // it. This stand-in exists only to drive the existing semver refusal path
  // (§VII.2 step 3) in a toy manifest, and to show why `>=` that release is
  // required where `>2.21.0` would wrongly admit a hypothetical 2.21.1 that
  // lacks the builtin. It appears in no real manifest, version matrix or
  // protocol constant.
  const HYPOTHETICAL_FIRST_RELEASE_FOR_TEST_ONLY = '2.22.0';
  const RULES: ModuleManifest = {
    ...BASE,
    requires_protocol: `>=${HYPOTHETICAL_FIRST_RELEASE_FOR_TEST_ONLY}`,
    validations: [
      // Required and valid, section-guarded as RFC 0068 writes its rules.
      { code: 'CC-TOY-DATE', severity: 'error', message: 'as_of_date missing or not a valid date', rule: 'site_facts == null || is_calendar_date(site_facts.as_of_date)' },
      // Valid when present.
      { code: 'CC-TOY-OPT', severity: 'error', message: 'closing_date not a valid date', rule: 'site_facts.closing_date == null || is_calendar_date(site_facts.closing_date)' },
    ],
  };
  const host = () => createModuleRegistry({ modules: [RULES], hostTier: 'tier-4-agent-host', protocolVersion: HYPOTHETICAL_FIRST_RELEASE_FOR_TEST_ONLY });
  const codes = (content: Record<string, unknown>) =>
    validateAgainstModules(file({ site_facts: block('site_facts', content) }), host()).map((i) => i.code);

  it('is silent on a valid date and when the optional date is absent', () => {
    expect(codes({ as_of_date: '2024-02-29' })).toEqual([]);
  });

  it.each([
    ['impossible', '2026-02-30'],
    ['not a leap year', '2023-02-29'],
    ['malformed', '2026-1-01'],
    ['a date-time', '2026-10-03T00:00:00Z'],
    ['padded', ' 2026-10-03'],
    ['a number', 20261003],
    ['a boolean', true],
    ['an array', ['2026-10-03']],
    ['an object', { date: '2026-10-03' }],
    ['null', null],
  ])('reports the rule’s own code, not MOD-RULE-ERROR, when the date is %s', (_label, value) => {
    expect(codes({ as_of_date: value })).toEqual(['CC-TOY-DATE']);
  });

  it('reports a required date that is absent under its own code', () => {
    expect(codes({})).toEqual(['CC-TOY-DATE']);
  });

  it('applies the optional-date pattern: silent on absence, fires on a bad value', () => {
    expect(codes({ as_of_date: '2026-10-03', closing_date: null })).toEqual([]);
    expect(codes({ as_of_date: '2026-10-03', closing_date: '2026-13-01' })).toEqual(['CC-TOY-OPT']);
  });

  it('is silent when the guarded section is absent', () => {
    expect(validateAgainstModules(file({}), host())).toEqual([]);
  });

  it('reports a wrong-arity call and an argument failure as MOD-RULE-ERROR', () => {
    const broken: ModuleManifest = {
      ...RULES,
      validations: [
        { code: 'CC-TOY-ARITY', severity: 'error', message: 'x', rule: 'is_calendar_date()' },
        { code: 'CC-TOY-ARG', severity: 'error', message: 'x', rule: 'is_calendar_date(1 / 0)' },
      ],
    };
    const issues = validateAgainstModules(
      file({}),
      createModuleRegistry({ modules: [broken], hostTier: 'tier-4-agent-host', protocolVersion: HYPOTHETICAL_FIRST_RELEASE_FOR_TEST_ONLY }),
    );
    expect(issues.map((i) => i.code)).toEqual(['MOD-RULE-ERROR', 'MOD-RULE-ERROR']);
    expect(issues[0]?.message).toContain('CC-TOY-ARITY');
    expect(issues[0]?.message).toContain('CALC-TYPE-001');
    expect(issues[1]?.message).toContain('CC-TOY-ARG');
    expect(issues[1]?.message).toContain('CALC-DIV-ZERO');
  });

  it('evaluates in a module calculation through the same evaluator', () => {
    const withCalc: ModuleManifest = {
      ...RULES,
      validations: [],
      calculations: [{ id: 'as_of_valid', label: 'As-of valid', formula: 'is_calendar_date(site_facts.as_of_date)', deterministic: true }],
    };
    const registry = createModuleRegistry({ modules: [withCalc], hostTier: 'tier-4-agent-host', protocolVersion: HYPOTHETICAL_FIRST_RELEASE_FOR_TEST_ONLY });
    const run = (as_of_date: unknown) =>
      evaluateModuleCalculations(file({ site_facts: block('site_facts', { as_of_date }) }), registry)[0]?.result.value;
    expect(run('0000-02-29')).toBe(true);
    expect(run('1900-02-29')).toBe(false);
  });

  it('is refused at load by a host whose protocol the §X floor excludes, through the existing path', () => {
    // No new loader check: the manifest's own `requires_protocol` range does
    // the work under §VII.2 step 3, reported as the existing PROTO-MOD-030.
    // 2.21.1 is a hypothetical later patch that lacks the builtin.
    for (const older of ['2.21.0', '2.21.1']) {
      expect(() => createModuleRegistry({ modules: [RULES], hostTier: 'tier-4-agent-host', protocolVersion: older }))
        .toThrow(/PROTO-MOD-030/);
    }
  });

  it('shows why `>2.21.0` is not a §X floor: it admits a hypothetical 2.21.1 that lacks the builtin', () => {
    const wrongFloor: ModuleManifest = { ...RULES, requires_protocol: '>2.21.0' };
    expect(() => createModuleRegistry({ modules: [wrongFloor], hostTier: 'tier-4-agent-host', protocolVersion: '2.21.1' }))
      .not.toThrow();
  });
});

// Protocol §VII.3: where a dependent redeclares a calculation or section id
// its dependency declares, one declaration applies, and it is the dependent's.
describe('dependent overrides at runtime (§VII.3)', () => {
  const BASE_DEP = { depends_on: [{ id: BASE.id, version: '^1.0.0' }] };
  const calc = (id: string, formula: string) => ({ id, label: id, formula, deterministic: true });

  it("runs the dependent's formula once, where the dependency declared it, so later reads see it", () => {
    const base: ModuleManifest = { ...BASE, calculations: [calc('x', '1'), calc('y', 'x + 10')] };
    const dependent: ModuleManifest = {
      ...BASE,
      id: 'org.example.toy-override',
      ...BASE_DEP,
      calculations: [calc('x', '2'), calc('z', 'x + 100')],
    };
    const outcomes = evaluateModuleCalculations(file({}), registryOf(base, dependent));
    expect(outcomes.map((o) => `${o.module_id}:${o.result.calc_id}=${o.result.value}`)).toEqual([
      'org.example.toy-override:x=2',
      'org.example.toy:y=12',
      'org.example.toy-override:z=102',
    ]);
  });

  it('feeds validation rules the overriding value and reports one outcome per id', () => {
    const base: ModuleManifest = {
      ...BASE,
      calculations: [calc('x', '1')],
      validations: [{ code: 'CC-TOY-01', severity: 'warning', message: 'x is not 2', rule: 'x == 2' }],
    };
    const dependent: ModuleManifest = { ...BASE, id: 'org.example.toy-override', ...BASE_DEP, calculations: [calc('x', '2')] };
    expect(validateAgainstModules(file({}), registryOf(base, dependent))).toEqual([]);
  });

  it("checks a redeclared section once, against the dependent's declaration", () => {
    const section = (required: boolean) => ({ id: 'hotel_extra', display_name: 'Extra', schema: { type: 'object' }, required });
    const base: ModuleManifest = { ...BASE, sections: [section(true)] };
    const relaxed: ModuleManifest = { ...BASE, id: 'org.example.toy-override', ...BASE_DEP, sections: [section(false)] };
    expect(validateAgainstModules(file({}), registryOf(base, relaxed))).toEqual([]);

    const plain: ModuleManifest = { ...BASE, sections: [section(false)] };
    const strict: ModuleManifest = { ...BASE, id: 'org.example.toy-override', ...BASE_DEP, sections: [section(true)] };
    const issues = validateAgainstModules(file({}), registryOf(plain, strict));
    expect(issues.map((i) => i.code)).toEqual(['MOD-SECTION-MISSING']);
    expect(issues[0]?.message).toContain("'org.example.toy-override'");
  });
});
