// RFC 0072: every new diagnostic is warning-only; identities never select math.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { SCENARIOS, RETIRED_SCENARIOS } from './scenario.js';
import { MULTIFAMILY_PACK, getPackForAssetClass } from './packs/index.js';
import { evaluateCalc } from './calc/index.js';
import { resolveValue } from './cascade.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const identityCodes = new Set(['DQ-07', 'DQ-08', 'DQ-09']);
const identityIssues = (file: ParsedUWFile) => validateUWFile(file).issues.filter(i => identityCodes.has(i.code));
function scaffold(version: '1.1' | '2.0') {
  return parseUWFile(generateBlankUWFile({ dealId: 'RFC-0072', formatVersion: version }));
}
function setPropertySubtype(file: ParsedUWFile, subtype: unknown) {
  (file.sections['property'] as UWBlock).content['asset_subtype'] = subtype;
}

describe.each(['1.1', '2.0'] as const)('RFC 0072 in format %s', version => {
  it.each([...SCENARIOS, 'com.example.repositioning', null, undefined])('accepts %j without a new issue', scenario => {
    const file = scaffold(version);
    if (scenario === undefined) delete file.frontmatter.scenario;
    else file.frontmatter.scenario = scenario;
    expect(identityIssues(file)).toEqual([]);
  });
  it.each([...RETIRED_SCENARIOS, 'entitled_land_acquisition', 'other', 'com.plan', '', 42, false, ['value_add'], { plan: 'value_add' }])('warns but never errors on %j', scenario => {
    const file = scaffold(version);
    file.frontmatter['scenario'] = scenario as string;
    const before = JSON.stringify(file);
    expect(identityIssues(file)).toMatchObject([{ code: 'DQ-07', severity: 'warning', field: 'scenario' }]);
    expect(validateUWFile(file).errors).toEqual([]);
    expect(JSON.stringify(file)).toBe(before);
  });
  it.each([undefined, null, 'build_to_rent'])('admits BTR in both carriers or property fallback from %j', subtype => {
    const file = scaffold(version);
    file.frontmatter.asset_subtype = subtype;
    file.frontmatter.scenario = 'stabilized_acquisition';
    setPropertySubtype(file, 'build_to_rent');
    expect(identityIssues(file)).toEqual([]);
  });
  it('admits frontmatter-only BTR and reports both directions of carrier disagreement', () => {
    const file = scaffold(version);
    file.frontmatter.asset_subtype = 'build_to_rent';
    expect(identityIssues(file)).toEqual([]);
    for (const [fm, property] of [['build_to_rent', 'garden_style'], ['garden_style', 'build_to_rent']]) {
      file.frontmatter.asset_subtype = fm;
      setPropertySubtype(file, property);
      expect(identityIssues(file)).toMatchObject([{ code: 'DQ-08', severity: 'warning', value: property }]
      );
      expect(identityIssues(file)[0]!.message).toContain(`frontmatter ${JSON.stringify(fm)}`));
      expect(validateUWFile(file).errors).toEqual([]);
    }
  });
  it('checks a selected property variant, never invents a fallback from an ambiguous map', () => {
    const file = scaffold(version);
    const property = file.sections['property'] as UWBlock;
    property.content['asset_subtype'] = 'build_to_rent';
    file.frontmatter.asset_subtype = 'garden_style';
    file.sections['property'] = { base: property };
    expect(identityIssues(file)).toMatchObject([{ code: 'DQ-08', severity: 'warning' }]);
    file.sections['property'] = { a: property, b: structuredClone(property) };
    expect(identityIssues(file)).toEqual([]);
  });
  it.each(['frontmatter', 'property'])('warns on BTR outside multifamily in %s', carrier => {
    const file = scaffold(version);
    file.frontmatter.asset_class = 'land';
    if (carrier === 'frontmatter') file.frontmatter.asset_subtype = 'build_to_rent';
    else setPropertySubtype(file, 'build_to_rent');
    expect(identityIssues(file)).toMatchObject([{ code: 'DQ-09', severity: 'warning' }]);
    expect(validateUWFile(file).errors).toEqual([]);
  });
  it('keeps free subtype values and their disagreements admissible', () => {
    const file = scaffold(version);
    file.frontmatter.asset_class = 'land';
    file.frontmatter.asset_subtype = 'entitled_residential';
    setPropertySubtype(file, 'apartments_over_retail_with_hotel');
    expect(identityIssues(file)).toEqual([]);
    expect(validateUWFile(file).errors).toEqual([]);
  });
});

describe('D5 — identity has no underwriting behavior', () => {
  const raw = readFileSync(new URL('../../../examples/Parkview-Apts-Glendale-AZ.uwx.md', import.meta.url), 'utf8');
  const original = parseUWFile(raw);
  const baseline = validateUWFile(original);
  const packResults = (parsed: ParsedUWFile) => (MULTIFAMILY_PACK.calculations ?? []).map(calc => evaluateCalc(calc, { parsed, prior_results: {}, locale: 'en-US' }));
  const expectedPackResults = packResults(original);
  it.each([...SCENARIOS, ...RETIRED_SCENARIOS, 'com.example.repositioning', 'entitled_land_acquisition', undefined])('keeps math, defaults, coverage and stages unchanged for %s', scenario => {
    const parsed = parseUWFile(raw);
    parsed.frontmatter.scenario = scenario;
    parsed.frontmatter.asset_subtype = 'build_to_rent';
    const before = JSON.stringify(parsed);
    const result = validateUWFile(parsed);
    expect(result.errors).toEqual(baseline.errors);
    expect(result.issues.filter(i => !identityCodes.has(i.code))).toEqual(baseline.issues);
    expect(result.stage_readiness).toEqual(baseline.stage_readiness);
    expect(result.coverage).toEqual(baseline.coverage);
    expect(getPackForAssetClass(parsed.frontmatter.asset_class)).toBe(getPackForAssetClass(original.frontmatter.asset_class));
    expect(packResults(parsed)).toEqual(expectedPackResults);
    const defaultFile = scaffold('2.0');
    defaultFile.frontmatter.scenario = scenario;
    defaultFile.frontmatter.asset_subtype = 'build_to_rent';
    const resolved = resolveValue('noi_model.rent_growth_pct_y1', defaultFile);
    expect(resolved.step).toBe('asset_class_default');
    expect(resolved).toEqual(resolveValue('noi_model.rent_growth_pct_y1', scaffold('2.0')));
    expect(JSON.stringify(parsed)).toBe(before);
    expect(parsed.raw).toBe(raw);
  });
});
