import { Ajv2020 } from 'ajv/dist/2020.js';
import { toUWEnvelope, fromUWEnvelope, computeEnvelopeDigest } from './envelope.js';
import type { UWBlock } from './types.js';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUWFile, blockPayload } from './parser.js';
import { validateUWFile } from './validator.js';
import { checkBuiltinClassContent } from './builtin-class-validation.js';
import { parseAssetClass } from './asset-class.js';
import { ASSET_CLASSES } from './types.js';
import { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';
import { getPackForAssetClass } from './builtin-packs/index.js';
import { evaluateCalc } from './calc/index.js';
import { issueReceipt, verifyReceipt } from './receipts.js';
import { getSizeIntensive, resolveDealSize } from './protocol.js';
const root = resolve(__dirname, '../../..');
const corpus = resolve(root, 'conformance/builtin-classes');
const classCodes = (codes: string[]) => [...new Set(codes)].filter(c => /^CC-(DC|MH|HOSP)-/.test(c) || ['CLS-03', 'CLS-04', 'MOD-RULE-ERROR', 'MOD-CALC-ERROR'].includes(c)).sort();

describe('RFC 0080 official builtin controls', () => {
  for (const name of readdirSync(corpus).filter(n => /^\d+/.test(n))) {
    it(name, () => {
      const expected = JSON.parse(readFileSync(resolve(corpus, name, 'expected.json'), 'utf8'));
      const parsed = parseUWFile(readFileSync(resolve(corpus, name, 'deal.uwx.md'), 'utf8'));
      expect(classCodes(checkBuiltinClassContent(parsed).map(i => i.code))).toEqual([...new Set(expected.expected_codes)].sort());
      expect(classCodes(validateUWFile(parsed).issues.map(i => i.code))).toEqual([...new Set(expected.expected_codes)].sort());
      const results = Object.fromEntries((getPackForAssetClass(parsed.frontmatter.asset_class)?.calculations ?? []).map(c => {
        const result = evaluateCalc(c, { parsed, prior_results: {}, locale: 'en-US' });
        if (typeof expected.expected_calcs[c.id] === 'number') expect(result.ok, `${c.id}:${result.error?.message}`).toBe(true);
        return [c.id, result.value];
      }));
      for (const [id, value] of Object.entries(expected.expected_calcs)) expect(results[id], id).toBe(value);
    });
  }
  it('has one spelling per class: a namespaced builtin suffix is refused (RFC 0081 §5)', () => {
    // The retired alias is an ordinary namespaced id now, refused like any other.
    for (const id of ['org.uwmd.data_center', 'com.example.data_center', 'com.example.manufactured_housing']) {
      expect(parseAssetClass(id)).toMatchObject({ ok: false, error: { code: 'INVALID-ASSET-CLASS-002' } });
      expect(getPackForAssetClass(id)).toBeNull(); expect(getSizeIntensive(id)).toBeNull();
    }
  });
  it('has exact primary-size identity checks with negative controls', () => {
    for (const [file, field, code] of [['Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md', 'critical_it_load_kw', 'CC-DC-08'], ['Desert-Palms-MHC-Apache-Junction-AZ.uwx.md', 'total_sites', 'CC-MH-08']]) {
      const parsed = parseUWFile(readFileSync(resolve(root, 'examples', file!), 'utf8'));
      expect(checkBuiltinClassContent(parsed).some(i => i.code === code)).toBe(false);
      expect(resolveDealSize(parsed)?.basis).toBe(field);
      const property = parsed.sections.property! as import('./types.js').UWBlock;
      (property.content as Record<string, number>)[field!] += 1;
      expect(checkBuiltinClassContent(parsed).map(i => i.code)).toContain(code);
    }
  });
  it('mirrors every standard section schema without field-contract drift', () => {
    for (const content of Object.values(BUILTIN_CLASS_CONTENT)) for (const section of content.sections) {
      const { $schema, $id, title, description: _description, ...schema } = JSON.parse(readFileSync(resolve(root, `spec/schemas/section-${section.id.replace(/_/g, '-')}.schema.json`), 'utf8'));
      const runtime = section.schema;
      expect(schema, section.id).toEqual(runtime);
    }
  });
  it('issues and resolves receipts for every builtin without injected packs', async () => {
    const source = readFileSync(resolve(root, 'examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');
    for (const cls of ASSET_CLASSES) {
      const input = source.replace(/asset_class:.*$/m, `asset_class: ${cls}`).replace(/uw_version:.*$/m, "uw_version: \"3.0\"");
      const receipt = await issueReceipt(input, { issued_at: '2026-10-10T00:00:00Z' });
      expect(receipt.computation.pack).toBe(getPackForAssetClass(cls)!.id);
      expect((await verifyReceipt(receipt, input)).verdict, cls).toBe('verified');
    }
  });
});


describe('Builtin record shapes', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  const readSchema = (name: string) => JSON.parse(readFileSync(resolve(root, `spec/schemas/${name}.schema.json`), 'utf8'));
  const blockSchema = ajv.compile(readSchema('uwmd-block'));
  const envelopeSchema = ajv.compile(readSchema('uw-document-envelope'));
  ajv.addSchema(readSchema('section-capital-stack'));
  const componentSchema = ajv.compile(readSchema('section-components'));
  for (const file of ['Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md', 'Desert-Palms-MHC-Apache-Junction-AZ.uwx.md']) {
    it(`${file}: canonical blocks and lossless machine envelope`, async () => {
      const parsed = parseUWFile(readFileSync(resolve(root, 'examples', file), 'utf8'));
      for (const entry of Object.values(parsed.sections)) {
        const blocks = 'annotation' in entry ? [entry as UWBlock] : Object.values(entry);
        for (const block of blocks) expect(blockSchema(block.content), JSON.stringify(blockSchema.errors)).toBe(true);
      }
      const envelope = toUWEnvelope(parsed);
      expect(envelopeSchema(envelope), JSON.stringify(envelopeSchema.errors)).toBe(true);
      const restored = fromUWEnvelope(envelope);
      for (const id of Object.keys(parsed.sections)) {
        expect((restored.sections[id] as UWBlock).meta).toEqual((parsed.sections[id] as UWBlock).meta);
        expect((restored.sections[id] as UWBlock).content).toEqual((parsed.sections[id] as UWBlock).content);
      }
      expect(await computeEnvelopeDigest(toUWEnvelope(restored))).toBe(await computeEnvelopeDigest(envelope));
    });
  }
  for (const name of readdirSync(resolve(root, 'conformance/calc/fixtures')).filter(n => /^mixed-use-(data_center|manufactured_housing)_/.test(n))) {
    it(`${name}: standard component_class`, () => {
      const source = readFileSync(resolve(root, 'conformance/calc/fixtures', name, 'deal.uwx.md'), 'utf8');
      const parsed = parseUWFile(source);
      const components = parsed.sections.components as UWBlock;
      expect(componentSchema(blockPayload(components)), JSON.stringify(componentSchema.errors)).toBe(true);
      expect(validateUWFile(parsed).issues.filter(i => /^(MU-|CC-11$|CC-12$)/.test(i.code))).toEqual([]);
      expect(envelopeSchema(toUWEnvelope(parsed)), JSON.stringify(envelopeSchema.errors)).toBe(true);
      const wrong = parseUWFile(source);
      const badPayload = (wrong.sections.components as UWBlock).content as Record<string, Record<string, unknown>>;
      badPayload.data_center!.component_class = 'industrial';
      badPayload.data_center!.net_operating_income = 1;
      expect(componentSchema(badPayload)).toBe(false);
      expect(validateUWFile(wrong).issues.map(i => i.code)).toEqual(expect.arrayContaining(['MU-03', 'CC-12']));
    });
  }
  it('keeps the mixed-use component contract', () => {
    const parsed = parseUWFile(readFileSync(resolve(root, 'examples/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md'), 'utf8'));
    expect(validateUWFile(parsed).issues.filter(i => /^(MU-|CC-11$|CC-12$)/.test(i.code))).toEqual([]);
  });
});

describe('Every class follows the same rules (RFC 0081 §5)', () => {
  const saguaro = readFileSync(resolve(root, 'examples/Saguaro-Select-Hotel-Tempe-AZ.uwx.md'), 'utf8');
  const hotel = readFileSync(resolve(corpus, '01-hospitality-fixture/deal.uwx.md'), 'utf8');
  const mutate = (source: string, from: string, to: string) => {
    expect(source.includes(from), from).toBe(true);
    return source.replace(from, to);
  };
  const classIssues = (source: string) => checkBuiltinClassContent(parseUWFile(source));
  const calcErrors = (source: string) => classIssues(source).filter(i => i.code === 'MOD-CALC-ERROR');

  // No calculation is exempt for having predated the builtin, and no
  // `modules` entry changes a severity.
  it.each([
    ['zero available room nights', '"available_room_nights": 51830', '"available_room_nights": 0'],
    ['string rooms revenue', '"rooms_revenue": 6080000', '"rooms_revenue": "6080000"'],
  ])('a hospitality record with %s reports the failed calculation as MOD-CALC-ERROR', (_label, from, to) => {
    expect(calcErrors(mutate(saguaro, from, to)).map(i => [i.severity, i.message.includes('revpar')])).toEqual([['error', true]]);
  });

  it('reports a failed class calculation as an error whatever the modules list says', () => {
    const broken = mutate(hotel, '"fb_revenue": 900000', '"fb_revenue": 0');
    const expected = [['error', true]];
    expect(calcErrors(broken).map(i => [i.severity, i.message.includes('fb_gross_margin')])).toEqual(expected);
    const named = mutate(broken, 'asset_class: hospitality\n', 'asset_class: hospitality\nmodules:\n  - id: org.uwmd.hospitality\n');
    expect(calcErrors(named).map(i => [i.severity, i.message.includes('fb_gross_margin')])).toEqual(expected);
  });

  it('CC-HOSP-04 names the missing canonical RevPAR inputs', () => {
    const source = mutate(hotel, '"rooms_revenue": 3784320', '"rooms_revenue": null');
    const issues = validateUWFile(parseUWFile(source)).issues;
    const found = issues.filter(i => i.code === 'CC-HOSP-04');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', section: 'hotel_metrics', field: 'market_revpar' });
    expect(found[0]!.message).toContain('noi_model.income.rooms_revenue');
    expect(found[0]!.message).toContain('rent_roll.available_room_nights');
    // No ADR x occupancy fallback: CC-HOSP-01 neither fires nor errors.
    expect(issues.map(i => i.code)).not.toContain('CC-HOSP-01');
    expect(issues.map(i => i.code)).not.toContain('MOD-RULE-ERROR');
  });

  it('stays quiet when no comp set is stated, and when RevPAR computes', () => {
    const noComp = hotel.replace(/"market_revpar":\s*[0-9.]+/, '"market_revpar": null');
    expect(noComp).not.toBe(hotel);
    expect(classIssues(noComp).map(i => i.code)).not.toContain('CC-HOSP-04');
    expect(classIssues(saguaro).map(i => i.code)).not.toContain('CC-HOSP-04');
  });

  it.each([
    ['rent_roll', 'keys'],
    ['hotel_metrics', 'adr'],
    ['hotel_metrics', 'occupancy'],
    ['hotel_metrics', 'available_room_nights'],
    ['hotel_metrics', 'key_count'],
  ])('rejects the removed official home %s.%s without repairing it', (section, field) => {
    for (const value of [null, 0, false, '', 250, {}, []]) {
      const parsed = parseUWFile(hotel);
      const block = parsed.sections[section!] as UWBlock;
      (block.content as Record<string, unknown>)[field!] = value;
      const before = JSON.stringify(parsed);
      const expected = { code: 'CLS-04', severity: 'error', section, field };
      expect(checkBuiltinClassContent(parsed).filter(i => i.code === 'CLS-04')).toMatchObject([expected]);
      expect(validateUWFile(parsed).errors.filter(i => i.code === 'CLS-04')).toMatchObject([expected]);
      expect(JSON.stringify(parsed)).toBe(before);
    }
  });

  it('checks only the selected current hospitality statement and preserves other field owners', () => {
    const parsed = parseUWFile(hotel);
    const current = parsed.sections.hotel_metrics as UWBlock;
    const invalid = { ...current, role: 'component' as const, content: { ...current.content as Record<string, unknown>, adr: 250 } };
    parsed.sections.hotel_metrics = { detail: invalid, base: current };
    parsed.superseded.hotel_metrics = [invalid];
    expect(checkBuiltinClassContent(parsed).filter(i => i.code === 'CLS-04')).toEqual([]);
    // Unknown-field diagnostic allocation and universal annotations are separate.
    (current.content as Record<string, unknown>)['custom_note'] = 'retained';
    (current.content as Record<string, unknown>)['_notes'] = 'annotated';
    expect(checkBuiltinClassContent(parsed).filter(i => i.code === 'CLS-04')).toEqual([]);
    parsed.frontmatter.asset_class = 'office';
    parsed.sections.hotel_metrics = invalid;
    expect(checkBuiltinClassContent(parsed).filter(i => i.code === 'CLS-04')).toEqual([]);
  });
  it('reports field-contract defects as errors', () => {
    const mesa = readFileSync(resolve(root, 'examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md'), 'utf8');
    const fractional = mutate(mesa, '"raised_floor_sf": 60000', '"raised_floor_sf": 60000.5');
    expect(classIssues(fractional).filter(i => i.code === 'CLS-04').map(i => i.severity)).toEqual(['error']);
  });
});
