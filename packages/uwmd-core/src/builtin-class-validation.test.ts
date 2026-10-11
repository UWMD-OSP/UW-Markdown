import { Ajv2020 } from 'ajv/dist/2020.js';
import { toUWEnvelope, fromUWEnvelope, computeEnvelopeDigest } from './envelope.js';
import type { UWBlock } from './types.js';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUWFile, blockPayload } from './parser.js';
import { validateUWFile } from './validator.js';
import { checkBuiltinClassContent } from './builtin-class-validation.js';
import { parseAssetClass, resolveAssetClass } from './asset-class.js';
import { ASSET_CLASSES } from './types.js';
import { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';
import { getPackForAssetClass } from './packs/index.js';
import { evaluateCalc } from './calc/index.js';
import { issueReceipt, verifyReceipt } from './receipts.js';
import { createModuleRegistry } from './modules.js';
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
  it('resolves only the shipped official alias and preserves source identity', () => {
    const source = readFileSync(resolve(corpus, '06-data-center-fixture/deal.uwx.md'), 'utf8');
    const parsed = parseUWFile(source);
    const before = JSON.stringify(parsed);
    expect(parseAssetClass('org.uwmd.data_center')).toEqual({ ok: true, kind: 'builtin', id: 'data_center' });
    expect(resolveAssetClass('org.uwmd.data_center', createModuleRegistry({ modules: [], hostTier: 'tier-3-calc-host' }))).toMatchObject({ status: 'resolved', kind: 'builtin', id: 'data_center' });
    const codes = validateUWFile(parsed).issues.map(i => i.code);
    expect(codes).toContain('CLS-01'); expect(codes).toContain('CLS-02');
    expect(JSON.stringify(parsed)).toBe(before);
    for (const id of ['com.example.data_center', 'com.example.manufactured_housing']) {
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
      (blockPayload(property) as Record<string, unknown>)[field!] = (blockPayload(property) as Record<string, number>)[field!]! + 1;
      expect(checkBuiltinClassContent(parsed).map(i => i.code)).toContain(code);
    }
  });
  it('mirrors every standard section schema without field-contract drift', () => {
    for (const content of Object.values(BUILTIN_CLASS_CONTENT)) for (const section of content.sections) {
      const { $schema, $id, title, ...schema } = JSON.parse(readFileSync(resolve(root, `spec/schemas/section-${section.id.replace(/_/g, '-')}.schema.json`), 'utf8'));
      expect(schema, section.id).toEqual(section.schema);
    }
  });
  it('issues and resolves receipts for every builtin without injected packs', async () => {
    const source = readFileSync(resolve(root, 'examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');
    for (const cls of ASSET_CLASSES) {
      const input = source.replace(/asset_class:.*$/m, `asset_class: ${cls}`).replace(/uw_version:.*$/m, 'uw_version: "2.1"');
      const receipt = await issueReceipt(input, { issued_at: '2026-10-10T00:00:00Z' });
      expect(receipt.computation.pack).toBe(getPackForAssetClass(cls)!.id);
      expect((await verifyReceipt(receipt, input)).verdict, cls).toBe('verified');
    }
  });
});


describe('Format 2.1 builtin record shapes', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  const readSchema = (name: string) => JSON.parse(readFileSync(resolve(root, `spec/schemas/${name}.schema.json`), 'utf8'));
  const blockSchema = ajv.compile(readSchema('uwmd-block-v2'));
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
  for (const name of readdirSync(resolve(root, 'conformance/tier-3-calc-host/fixtures')).filter(n => /^mixed-use-(data_center|manufactured_housing)_/.test(n))) {
    it(`${name}: standard component_class and additive version gate`, () => {
      const source = readFileSync(resolve(root, 'conformance/tier-3-calc-host/fixtures', name, 'deal.uwx.md'), 'utf8');
      const parsed = parseUWFile(source);
      const components = parsed.sections.components as UWBlock;
      expect(componentSchema(blockPayload(components)), JSON.stringify(componentSchema.errors)).toBe(true);
      expect(validateUWFile(parsed).issues.filter(i => /^(MU-|CC-11$|CC-12$|CLS-05$)/.test(i.code))).toEqual([]);
      expect(envelopeSchema(toUWEnvelope(parsed)), JSON.stringify(envelopeSchema.errors)).toBe(true);
      const wrong = parseUWFile(source);
      const badPayload = blockPayload(wrong.sections.components as UWBlock) as Record<string, Record<string, unknown>>;
      badPayload.data_center!.component_class = 'industrial';
      badPayload.data_center!.net_operating_income = 1;
      expect(componentSchema(badPayload)).toBe(false);
      expect(validateUWFile(wrong).issues.map(i => i.code)).toEqual(expect.arrayContaining(['MU-03', 'CC-12']));
      for (const version of ['1.1', '2.0']) {
        const old = parseUWFile(source.replace('uw_version: "2.1"', `uw_version: "${version}"`));
        expect(checkBuiltinClassContent(old).map(i => i.code)).toContain('CLS-05');
        expect(envelopeSchema(toUWEnvelope(old))).toBe(false);
        old.sections.components = { base: old.sections.components as UWBlock };
        expect(checkBuiltinClassContent(old).map(i => i.code)).toContain('CLS-05');
        expect(envelopeSchema(toUWEnvelope(old))).toBe(false);
      }
    });
  }
  it('retains the original mixed-use component contract at Format 1.1', () => {
    const parsed = parseUWFile(readFileSync(resolve(root, 'examples/Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md'), 'utf8'));
    expect(checkBuiltinClassContent(parsed).map(i => i.code)).not.toContain('CLS-05');
    expect(validateUWFile(parsed).issues.filter(i => /^(MU-|CC-11$|CC-12$|CLS-05$)/.test(i.code))).toEqual([]);
  });
});

describe('RFC 0080 §5: pre-existing documents behave the same', () => {
  const saguaro = readFileSync(resolve(root, 'examples/Saguaro-Select-Hotel-Tempe-AZ.uwx.md'), 'utf8');
  const mutate = (source: string, from: string, to: string) => {
    expect(source.includes(from), from).toBe(true);
    return source.replace(from, to);
  };
  const errors = (source: string) => validateUWFile(parseUWFile(source)).issues.filter(i => i.severity === 'error');
  const classIssues = (source: string) => checkBuiltinClassContent(parseUWFile(source));

  // Both mutations were valid at 099e47e: the builtin RevPAR simply did not
  // compute. They must not start failing because hospitality absorbed the
  // official module's content.
  it.each([
    ['zero available room nights', '"available_room_nights": 51830', '"available_room_nights": 0'],
    ['string rooms revenue', '"rooms_revenue": 6080000', '"rooms_revenue": "6080000"'],
  ])('builtin hospitality with %s stays error-free and adds no class issue', (_label, from, to) => {
    const source = mutate(saguaro, from, to);
    expect(errors(source)).toEqual([]);
    expect(classIssues(source)).toEqual([]);
  });

  it('keeps MOD-CALC-ERROR for a migrated calculation only where the legacy module ran it', () => {
    const fixture = readFileSync(resolve(corpus, '01-hospitality-fixture/deal.uwx.md'), 'utf8');
    const broken = mutate(fixture, '"fb_revenue": 900000', '"fb_revenue": 0');
    const calcErrors = (source: string) => classIssues(source).filter(i => i.code === 'MOD-CALC-ERROR');
    expect(calcErrors(broken)).toEqual([]);
    const named = mutate(broken, 'asset_class: hospitality\n', 'asset_class: hospitality\nmodules:\n  - org.uwmd.hospitality\n');
    expect(calcErrors(named).map(i => [i.severity, i.message.includes('fb_gross_margin')])).toEqual([['error', true]]);
  });

  it('CC-HOSP-04 names the missing canonical RevPAR inputs on the unedited module-era fixture', () => {
    const source = readFileSync(resolve(root, 'conformance/modules/runtime/01-hospitality-fixture/deal.uwx.md'), 'utf8');
    const issues = validateUWFile(parseUWFile(source)).issues;
    const found = issues.filter(i => i.code === 'CC-HOSP-04');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'warning', section: 'hotel_metrics', field: 'market_revpar' });
    expect(found[0]!.message).toContain('noi_model.income.rooms_revenue');
    expect(found[0]!.message).toContain('rent_roll.available_room_nights');
    // No ADR x occupancy fallback: CC-HOSP-01 neither fires nor errors.
    expect(issues.map(i => i.code)).not.toContain('CC-HOSP-01');
    expect(issues.map(i => i.code)).not.toContain('MOD-RULE-ERROR');
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  });

  it('stays quiet when no comp set is stated, and when RevPAR computes', () => {
    const source = readFileSync(resolve(root, 'conformance/modules/runtime/01-hospitality-fixture/deal.uwx.md'), 'utf8');
    const noComp = source.replace(/"market_revpar":\s*[0-9.]+/, '"market_revpar": null');
    expect(noComp).not.toBe(source);
    expect(classIssues(noComp).map(i => i.code)).not.toContain('CC-HOSP-04');
    expect(classIssues(saguaro).map(i => i.code)).not.toContain('CC-HOSP-04');
  });

  it('reports field-contract defects as warnings on legacy-alias and pre-2.1 documents', () => {
    const legacy = readFileSync(resolve(root, 'conformance/modules/runtime/06-data-center-fixture/deal.uwx.md'), 'utf8');
    expect(legacy).toContain('asset_class: "org.uwmd.data_center"');
    const fractional = mutate(legacy, '"raised_floor_sf": 60000', '"raised_floor_sf": 60000.5');
    const cls04 = classIssues(fractional).filter(i => i.code === 'CLS-04');
    expect(cls04.map(i => [i.field, i.severity])).toEqual([['raised_floor_sf', 'warning']]);
    expect(errors(fractional)).toEqual([]);
    // Same alias at Format 2.1 is still the legacy identity: warning.
    const legacy21 = mutate(fractional, 'uw_version: "1.1"', 'uw_version: "2.1"');
    expect(classIssues(legacy21).filter(i => i.code === 'CLS-04').map(i => i.severity)).toEqual(['warning']);
  });

  it('keeps field-contract defects as errors on canonical Format 2.1 records', () => {
    const mesa = readFileSync(resolve(root, 'examples/Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md'), 'utf8');
    const fractional = mutate(mesa, '"raised_floor_sf": 60000', '"raised_floor_sf": 60000.5');
    expect(classIssues(fractional).filter(i => i.code === 'CLS-04').map(i => i.severity)).toEqual(['error']);
  });

  it('accepts Format 2.1 and any later version for the new ids, refusing earlier ones (CLS-05)', () => {
    const desert = readFileSync(resolve(root, 'examples/Desert-Palms-MHC-Apache-Junction-AZ.uwx.md'), 'utf8');
    const cls05 = (version: string) => classIssues(mutate(desert, 'uw_version: "2.1"', `uw_version: "${version}"`))
      .filter(i => i.code === 'CLS-05');
    expect(cls05('2.1')).toEqual([]);
    expect(cls05('2.10')).toEqual([]);
    expect(cls05('3.0')).toEqual([]);
    expect(cls05('2.0')).toHaveLength(1);
    expect(cls05('1.1')).toHaveLength(1);
  });
});
