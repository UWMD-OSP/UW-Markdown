// RFC 0072: every new diagnostic is warning-only; identities never select math.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateBlankUWFile } from './init.js';
import {
  parseUWFile,
  validateUWFile,
  SCENARIOS,
  evaluateCalc,
  type ParsedUWFile,
  type UWBlock,
} from '@uwmd/verify';

/** Plan names RFC 0072 retired; they are ordinary non-standard values now. */
const FORMERLY_RETIRED = ['nnn_single_tenant', 'lihtc_section8', 'build_to_rent', 'distressed_reo'];
import { MULTIFAMILY_PACK, getPackForAssetClass } from './packs/index.js';
import { resolveValue } from './cascade.js';

const identityCodes = new Set(['DQ-07', 'DQ-08', 'DQ-09']);
const identityIssues = (file: ParsedUWFile) => validateUWFile(file).issues.filter(i => identityCodes.has(i.code));
function scaffold() {
  return parseUWFile(generateBlankUWFile({ dealId: 'RFC-0072' }));
}
function setPropertySubtype(file: ParsedUWFile, subtype: unknown) {
  (file.sections['property'] as UWBlock).content['asset_subtype'] = subtype;
}

describe('RFC 0072 business-plan identity', () => {
  it.each([...SCENARIOS, 'com.example.repositioning', null, undefined])('accepts %j without a new issue', scenario => {
    const file = scaffold();
    if (scenario === undefined) delete file.frontmatter.scenario;
    else file.frontmatter.scenario = scenario;
    expect(identityIssues(file)).toEqual([]);
  });
  it.each([...FORMERLY_RETIRED, 'entitled_land_acquisition', 'other', 'com.plan', '', 42, false, ['value_add'], { plan: 'value_add' }])('warns but never errors on %j', scenario => {
    const file = scaffold();
    file.frontmatter['scenario'] = scenario as string;
    const before = JSON.stringify(file);
    expect(identityIssues(file)).toMatchObject([{ code: 'DQ-07', severity: 'warning', field: 'scenario' }]);
    expect(validateUWFile(file).errors).toEqual([]);
    expect(JSON.stringify(file)).toBe(before);
  });
  it.each([undefined, null, 'build_to_rent'])('admits BTR in both carriers or property fallback from %j', subtype => {
    const file = scaffold();
    file.frontmatter.asset_subtype = subtype;
    file.frontmatter.scenario = 'stabilized_acquisition';
    setPropertySubtype(file, 'build_to_rent');
    expect(identityIssues(file)).toEqual([]);
  });
  it('admits frontmatter-only BTR and reports both directions of carrier disagreement', () => {
    const file = scaffold();
    file.frontmatter.asset_subtype = 'build_to_rent';
    expect(identityIssues(file)).toEqual([]);
    for (const [fm, property] of [['build_to_rent', 'garden_style'], ['garden_style', 'build_to_rent']]) {
      file.frontmatter.asset_subtype = fm;
      setPropertySubtype(file, property);
      expect(identityIssues(file)).toMatchObject([{ code: 'DQ-08', severity: 'warning', value: property }]);
      expect(identityIssues(file)[0]!.message).toContain(`frontmatter ${JSON.stringify(fm)}`);
      expect(validateUWFile(file).errors).toEqual([]);
    }
  });
  it('checks a selected property variant, never invents a fallback from an ambiguous map', () => {
    const file = scaffold();
    const property = file.sections['property'] as UWBlock;
    property.content['asset_subtype'] = 'build_to_rent';
    file.frontmatter.asset_subtype = 'garden_style';
    file.sections['property'] = { base: property };
    expect(identityIssues(file)).toMatchObject([{ code: 'DQ-08', severity: 'warning' }]);
    file.sections['property'] = { a: property, b: structuredClone(property) };
    expect(identityIssues(file)).toEqual([]);
  });
  it.each(['frontmatter', 'property'])('warns on BTR outside multifamily in %s', carrier => {
    const file = scaffold();
    file.frontmatter.asset_class = 'land';
    if (carrier === 'frontmatter') file.frontmatter.asset_subtype = 'build_to_rent';
    else setPropertySubtype(file, 'build_to_rent');
    expect(identityIssues(file)).toMatchObject([{ code: 'DQ-09', severity: 'warning' }]);
    expect(validateUWFile(file).errors).toEqual([]);
  });
  it('keeps free subtype values and their disagreements admissible', () => {
    const file = scaffold();
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
  it.each([...SCENARIOS, ...FORMERLY_RETIRED, 'com.example.repositioning', 'entitled_land_acquisition', undefined])('keeps math, defaults, coverage and stages unchanged for %s', scenario => {
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
    const defaultFile = scaffold();
    defaultFile.frontmatter.scenario = scenario;
    defaultFile.frontmatter.asset_subtype = 'build_to_rent';
    const resolved = resolveValue('noi_model.rent_growth_pct_y1', defaultFile);
    expect(resolved.step).toBe('asset_class_default');
    expect(resolved).toEqual(resolveValue('noi_model.rent_growth_pct_y1', scaffold()));
    expect(JSON.stringify(parsed)).toBe(before);
    expect(parsed.raw).toBe(raw);
  });
});
