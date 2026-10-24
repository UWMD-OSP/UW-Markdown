import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { areEnvelopesEquivalent, toUWEnvelope } from './envelope.js';
import { parseUWFile } from './parser.js';
import { UW_JSON_CODEC } from './uwjson.js';
import type { ParsedUWFile } from './types.js';
import { parseUWXml, parseUWXmlVerified, stringifyUWXml, UWXmlError } from './uwxml.js';

const envelope = toUWEnvelope({
  frontmatter: {
    uw_version: '3.0',
    deal_id: 'uw_xml',
    deal_name: 'XML & Unicode — 東京',
  } as ParsedUWFile['frontmatter'],
  sections: {},
  prose: {},
  pipeline_log: [],
  custom_calculations: [],
  custom_scenarios: [],
  extensions: {},
  superseded: {},
  raw: '',
});
envelope['x unsafe/key'] = { nullValue: null, values: [true, 2.5, 'a < b'] };

describe('UW XML 2.0', () => {
  it('round-trips the envelope and restores unsafe JSON keys', async () => {
    const xml = await stringifyUWXml(envelope);
    expect(xml).toContain('<uw:member name-json="&quot;x unsafe/key&quot;"><uw:value type="object">');
    const decoded = await parseUWXml(xml);
    expect(areEnvelopesEquivalent(decoded, envelope)).toBe(true);
    expect(decoded.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('restores a __proto__ member as an own key without touching the prototype', async () => {
    // §4 forbids key sanitization, so the key must survive the round trip —
    // as data on the envelope, never as a mutation of Object.prototype.
    const hostile = { ...envelope };
    Object.defineProperty(hostile, '__proto__', {
      value: { polluted: true },
      writable: true,
      enumerable: true,
      configurable: true,
    });
    const decoded = await parseUWXml(await stringifyUWXml(hostile));
    expect(Object.hasOwn(decoded, '__proto__')).toBe(true);
    expect((decoded as Record<string, unknown>).__proto__).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
  });

  it('matches UW JSON semantic identity across the bundled golden deal', async () => {
    const source = readFileSync(
      resolve(process.cwd(), '..', '..', 'conformance', 'rfc-0089', 'fixtures', 'complete-current.uwx.md'),
      'utf8',
    );
    const golden = toUWEnvelope(parseUWFile(source));
    const json = await UW_JSON_CODEC.encode(golden);
    const xml = await stringifyUWXml(golden);
    const fromJson = await UW_JSON_CODEC.decode(json);
    const fromXml = await parseUWXml(xml);
    expect(fromXml.semantic_digest).toBe(fromJson.semantic_digest);
    expect(areEnvelopesEquivalent(fromXml, fromJson)).toBe(true);
  });
  it('is deterministic apart from semantic-equivalent volatile fields', async () => {
    expect(await stringifyUWXml(envelope)).toBe(await stringifyUWXml(envelope));
  });

  it('rejects declarations, decoded duplicates, structural text and tampering', async () => {
    await expect(parseUWXml('<!DOCTYPE x><uw:document/>')).rejects.toThrow(UWXmlError);
    const xml = await stringifyUWXml(envelope);
    const member = /<uw:member name-json="&quot;format_version&quot;">[\s\S]*?<\/uw:member>/.exec(xml)![0];
    await expect(parseUWXml(xml.replace(member, member + member))).rejects.toThrow(/duplicate XML name/);
    await expect(parseUWXml(xml.replace('XML &amp; Unicode', 'Tampered'))).rejects.toThrow(/semantic digest/);
    await expect(parseUWXml(xml.replace('format-version="3.0"', 'format-version="3.0" surprise="true"'))).rejects.toThrow(/mapping attributes/);
    await expect(parseUWXml(xml.replace('<uw:value type="object">', '<uw:value type="object">not-whitespace'))).rejects.toThrow(/mixed content/);
    await expect(parseUWXml(xml.replace('<uw:value type="object">', '<uw:unknown type="object">'))).rejects.toThrow(UWXmlError);
  });
  it('requires the current complete subject on both XML decoding entry points', async () => {
    const xml = (await stringifyUWXml(envelope)).replace(/<uw:member name-json="&quot;semantic_digest&quot;">[\s\S]*?<\/uw:member>/, '');
    await expect(parseUWXml(xml)).rejects.toThrow(/semantic digest/);
    await expect(parseUWXmlVerified(xml)).rejects.toThrow(/semantic digest/);
  });
  it('enforces input and nesting limits', async () => {
    const xml = await stringifyUWXml(envelope);
    await expect(parseUWXml(xml, { maxBytes: 20 })).rejects.toThrow(UWXmlError);
    await expect(parseUWXml(xml, { maxDepth: 1 })).rejects.toThrow();
  });
});


describe('XML2 direct JSON-value admission', () => {
  it.each(['\ud800', '\ud801', '\udc00'])('refuses unpaired values and member names %j', async value => {
    for (const invalid of [{ value }, { [value]: 'kept' }]) await expect(stringifyUWXml({ ...envelope, invalid })).rejects.toBeInstanceOf(UWXmlError);
  });
  it('refuses nonfinite values before writing a carrier', async () => {
    await expect(stringifyUWXml({ ...envelope, invalid: Number.NaN })).rejects.toThrow(/nonfinite/);
  });
});
