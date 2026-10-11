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
