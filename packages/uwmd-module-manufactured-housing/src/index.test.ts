// RFC 0068, end to end through the public module API and committed fixtures.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createModuleRegistry, evaluateModuleCalculations, getAssetClassDefaults,
  loadModuleManifest, parseUWFile, resolveAssetClass, validateAgainstModules,
  validateUWFile,
} from '@uwmd/core';
import {
  MANUFACTURED_HOUSING_ASSET_CLASS, MANUFACTURED_HOUSING_MODULE,
  MANUFACTURED_HOUSING_MODULE_ID, MANUFACTURED_HOUSING_VIEW_MODELS,
} from './index.js';

const registry = createModuleRegistry({ modules: [MANUFACTURED_HOUSING_MODULE], hostTier: 'tier-3-calc-host' });
const empty = createModuleRegistry({ modules: [], hostTier: 'tier-3-calc-host' });
const fixturePath = resolve(__dirname, '../test/fixtures/desert-palms-mhc.uwx.md');
const source = readFileSync(fixturePath, 'utf8');
const parsed = parseUWFile(source);

it('loads the typed and emitted manifest with identical contents', () => {
  const emitted = JSON.parse(readFileSync(resolve(__dirname, '../dist/manifest.json'), 'utf8'));
  expect(emitted).toEqual(JSON.parse(JSON.stringify(MANUFACTURED_HOUSING_MODULE)));
  for (const manifest of [MANUFACTURED_HOUSING_MODULE, emitted]) {
    expect(loadModuleManifest(manifest, { hostTier: 'tier-3-calc-host' }).errors).toEqual([]);
    expect(loadModuleManifest(manifest, { hostTier: 'tier-1-reader' }).ok).toBe(false);
  }
  expect(Object.isFrozen(MANUFACTURED_HOUSING_MODULE)).toBe(true);
});

it('keeps the permanent class, fallback, and required section; enhances no builtin', () => {
  expect(MANUFACTURED_HOUSING_ASSET_CLASS).toBe('org.uwmd.manufactured_housing');
  expect(MANUFACTURED_HOUSING_MODULE_ID).toBe('org.uwmd.manufactured_housing_module');
  expect(MANUFACTURED_HOUSING_MODULE.asset_classes).toBeUndefined();
  expect(MANUFACTURED_HOUSING_MODULE.declares_asset_classes).toEqual([{
    id: MANUFACTURED_HOUSING_ASSET_CLASS, display_name: 'Manufactured Housing Community',
    fallback: 'multifamily', required_sections: ['mhc_sites'],
  }]);
  expect(MANUFACTURED_HOUSING_MODULE.calculations).toHaveLength(6);
  expect(MANUFACTURED_HOUSING_MODULE.validations).toHaveLength(7);
  expect(MANUFACTURED_HOUSING_MODULE.validations?.every((r) => r.severity === 'error')).toBe(true);
  expect(MANUFACTURED_HOUSING_MODULE.view_models).toEqual(MANUFACTURED_HOUSING_VIEW_MODELS);
  expect(MANUFACTURED_HOUSING_VIEW_MODELS.map((v) => v.section_id)).toEqual(['mhc_sites']);
  expect(getAssetClassDefaults(MANUFACTURED_HOUSING_ASSET_CLASS)).toBeNull();
});

it('publishes descriptive schema requiredness without depending on runtime schema validation', () => {
  const section = MANUFACTURED_HOUSING_MODULE.sections?.[0];
  expect(section?.required).toBe(true);
  expect(section?.schema.required).toEqual([
    'total_sites', 'occupied_sites', 'park_owned_homes', 'weighted_pad_rent_monthly', 'as_of_date',
  ]);
  const properties = section?.schema.properties as Record<string, { type?: string; minimum?: number }>;
  expect(properties.total_sites).toMatchObject({ type: 'integer', minimum: 1 });
  expect(properties.weighted_pad_rent_monthly).toMatchObject({ type: 'number', minimum: 0 });
  expect(section?.schema.allOf).toHaveLength(2);
});

it('keeps the package fixture byte-identical to the public example, with clean core/module validation', () => {
  expect(readFileSync(resolve(__dirname, '../../../examples/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md'), 'utf8')).toBe(source);
  expect(validateUWFile(parsed).issues.filter((i) => i.severity === 'error')).toEqual([]);
  expect(validateAgainstModules(parsed, registry)).toEqual([]);
  expect(parsed.sections.property?.content).not.toHaveProperty('total_units');
});

it('does not compute, report module rules, or reinterpret a document without this module', () => {
  expect(evaluateModuleCalculations(parsed, empty)).toEqual([]);
  expect(validateAgainstModules(parsed, empty)).toEqual([]);
  expect(resolveAssetClass(MANUFACTURED_HOUSING_ASSET_CLASS, empty).status).toBe('unresolved');
});

type Expected = {
  expected_calcs: Record<string, number | null>;
  expected_codes: string[];
  load_module?: boolean;
  known_declarations?: boolean;
  expected_status?: string;
  expected_kind?: string;
  expected_display_name?: string | null;
  expected_fallback?: string;
  expected_issue_code?: string;
  type_error_field?: string;
};
const runtimeDir = resolve(__dirname, '../../../conformance/modules/runtime');
const scenarios = readdirSync(runtimeDir).filter((name) => name.includes('-mhc-'));

describe('committed runtime fixtures and negative controls', () => {
  it.each(scenarios)('%s', (name) => {
    const dir = resolve(runtimeDir, name);
    const expected: Expected = JSON.parse(readFileSync(resolve(dir, 'expected.json'), 'utf8'));
    const file = parseUWFile(readFileSync(resolve(dir, 'deal.uwx.md'), 'utf8'));
    const host = expected.load_module === false ? empty : registry;
    const outcomes = evaluateModuleCalculations(file, host);
    expect(Object.fromEntries(outcomes.map(({ result }) => [result.calc_id, result.value]))).toEqual(expected.expected_calcs);
    const issues = validateAgainstModules(file, host);
    expect([...new Set(issues.map((i) => i.code))].sort()).toEqual([...expected.expected_codes].sort());
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
    if (expected.expected_codes.length === 0) expect(outcomes.every(({ result }) => result.ok)).toBe(true);
    if (expected.expected_status) {
      const resolution = resolveAssetClass(file.frontmatter.asset_class, host, {
        knownDeclarations: expected.known_declarations ? MANUFACTURED_HOUSING_MODULE.declares_asset_classes : undefined,
      });
      expect(resolution.status).toBe(expected.expected_status);
      if (resolution.status === 'resolved') {
        expect(resolution.kind).toBe(expected.expected_kind);
        expect(resolution.declaration?.display_name).toBe(expected.expected_display_name);
      } else if (resolution.status === 'degraded') {
        expect(resolution.fallback).toBe(expected.expected_fallback);
        expect(resolution.issue.code).toBe(expected.expected_issue_code);
        expect(expected.expected_display_name).toBeNull();
        expect(resolution).not.toHaveProperty('declaration');
      }
    }
    if (expected.type_error_field) {
      const rules: Record<string, string[]> = {
        total_sites: ['CC-MOD-MH-01', 'CC-MOD-MH-02', 'CC-MOD-MH-03'],
        occupied_sites: ['CC-MOD-MH-02'], park_owned_homes: ['CC-MOD-MH-03', 'CC-MOD-MH-07'],
        weighted_pad_rent_monthly: ['CC-MOD-MH-04'], poh_home_rent_monthly: ['CC-MOD-MH-07'],
      };
      expect(issues.filter((i) => i.code === 'MOD-RULE-ERROR').map((i) => i.message.match(/rule '([^']+)'/)?.[1])).toEqual(rules[expected.type_error_field]);
      expect(issues.filter((i) => i.code === 'MOD-RULE-ERROR').every((i) => i.message.includes('CALC-TYPE-001'))).toBe(true);
    }
  });
});
