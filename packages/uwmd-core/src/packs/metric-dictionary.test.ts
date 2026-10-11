import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ASSET_CLASSES } from '../types.js';
import { SIZE_INTENSIVES, type MetricDictionary } from '../protocol.js';
import { getExprDependencies } from '../calc/dependencies.js';
import { parseExpression } from '../calc/parser.js';
import { evaluateCalc } from '../calc/index.js';
import { parseUWFile } from '../parser.js';
import { resolveRoundTo } from '../calc/quantize.js';
import { getPackForAssetClass } from './index.js';

const readJson = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));
const dictionary: MetricDictionary = readJson('../../../../spec/metrics/builtin.json');
const schema = readJson('../../../../spec/schemas/metric-dictionary.schema.json');
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);

function extractedCalculations(): Omit<MetricDictionary['calculations'][number], 'minimum_stated_decimals'>[] {
  return ASSET_CLASSES.flatMap(assetClass => {
    const pack = getPackForAssetClass(assetClass);
    expect(pack, assetClass).not.toBeNull();
    return (pack!.calculations ?? []).map(c => ({
      id: c.id, label: c.label!, asset_classes: [assetClass], formula: c.formula,
      input_paths: getExprDependencies(parseExpression(c.formula)), unit: c.unit!,
      round_to: resolveRoundTo(c), section_roles: c.section_roles ?? {},
      null_semantics: 'expression' as const, deterministic: c.deterministic as true,
    }));
  });
}

const sorted = <T extends { id: string; asset_classes: readonly string[] }>(rows: readonly T[]) =>
  [...rows].sort((a, b) => `${a.asset_classes}:${a.id}`.localeCompare(`${b.asset_classes}:${b.id}`));

function unique(rows: readonly { id: string; asset_classes: readonly string[] }[]) {
  const keys = rows.flatMap(row => row.asset_classes.map(c => `${c}:${row.id}`));
  expect(new Set(keys).size).toBe(keys.length);
}

describe('normative metric dictionary parity', () => {
  it('validates the dictionary and refuses malformed entries', () => {
    expect(validate(dictionary), JSON.stringify(validate.errors)).toBe(true);
    const missingPrecision = structuredClone(dictionary) as unknown as { calculations: Record<string, unknown>[] };
    delete missingPrecision.calculations[0].round_to;
    expect(validate(missingPrecision)).toBe(false);
    const missingMinimum = structuredClone(dictionary) as unknown as { calculations: Record<string, unknown>[] };
    delete missingMinimum.calculations[0].minimum_stated_decimals;
    expect(validate(missingMinimum)).toBe(false);
    const negativeMinimum = structuredClone(dictionary) as unknown as { calculations: { minimum_stated_decimals: number }[] };
    negativeMinimum.calculations[0].minimum_stated_decimals = -1;
    expect(validate(negativeMinimum)).toBe(false);
    for (let ceiling = 0; ceiling <= 12; ceiling++) {
      const aboveCeiling = structuredClone(dictionary) as unknown as { calculations: { minimum_stated_decimals: number; round_to: number }[] };
      aboveCeiling.calculations[0].round_to = ceiling;
      aboveCeiling.calculations[0].minimum_stated_decimals = ceiling + 1;
      expect(validate(aboveCeiling)).toBe(false);
    }
    const roundedSize = structuredClone(dictionary) as unknown as { size_intensives: Record<string, unknown>[] };
    roundedSize.size_intensives[0].round_to = 6;
    expect(validate(roundedSize)).toBe(false);
    const unknownNullRule = structuredClone(dictionary) as unknown as { calculations: Record<string, unknown>[] };
    unknownNullRule.calculations[0].null_semantics = 'missing_is_zero';
    expect(validate(unknownNullRule)).toBe(false);
  });

  it('pins every minimum to the RFC 0079 Decisions policy', () => {
    for (const m of dictionary.calculations) {
      const minimum = ['cap_rate', 'debt_yield', 'cash_on_cash'].includes(m.id) ? 4
        : ['%', 'x'].includes(m.unit) || /sqft|psf|nrsf/.test(m.id) ? 2 : 0;
      expect(m.minimum_stated_decimals, `${m.asset_classes}:${m.id}`).toBe(minimum);
    }
    for (const m of dictionary.size_intensives) expect(m.minimum_stated_decimals).toBe(0);
  });

  it('matches every calculation in every builtin pack in both directions', () => {
    for (const m of dictionary.calculations) {
      expect(m.minimum_stated_decimals).toBeLessThanOrEqual(m.round_to);
      expect(m.round_to).toBe(({ '$': 2, '%': 6, x: 4 } as Record<string, number>)[m.unit]);
      expect(evaluateCalc(m, { parsed: parseUWFile(''), prior_results: {}, locale: 'en-US' }).round_to).toBe(m.round_to);
    }
    unique(dictionary.calculations);
    // Minimum statement precision is dictionary verification metadata, not a
    // ModuleCalcDecl engine-output property. It is schema-checked above.
    // Equality includes formula text, every potential input path, labels, units,
    // effective rounding, role selection and deterministic/null contracts.
    expect(sorted(dictionary.calculations.map(({ minimum_stated_decimals: _minimum, ...definition }) => definition))).toEqual(sorted(extractedCalculations()));
    expect(new Set(dictionary.calculations.flatMap(c => c.asset_classes))).toEqual(new Set(ASSET_CLASSES));
  });

  it('matches every primary-size registry row and its secondary fields in both directions', () => {
    unique(dictionary.size_intensives);
    const expected = Object.entries(SIZE_INTENSIVES).map(([assetClass, size]) => ({
      id: size.path, label: size.label, asset_classes: [assetClass],
      formula: `property.${size.path}`, input_paths: [`property.${size.path}`],
      unit: size.unit, round_to: null, minimum_stated_decimals: 0, section_roles: {},
      null_semantics: 'finite_stated_number', path: size.path, secondary: size.secondary,
    }));
    expect(sorted(dictionary.size_intensives)).toEqual(sorted(expected));
    expect(dictionary.size_intensives.some(s => s.asset_classes.includes('mixed_use'))).toBe(false);
  });
});
