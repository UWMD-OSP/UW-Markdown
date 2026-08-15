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
    uw_version: '1.1',
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

describe('UW XML 1.0', () => {
  it('round-trips the envelope and restores unsafe JSON keys', async () => {
    const xml = await stringifyUWXml(envelope);
    expect(xml).toContain('<uw:member uw:type="object" name="x unsafe/key">');
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
      resolve(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md'),
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

  it('rejects DTDs, duplicate object members, and digest tampering', async () => {
    await expect(parseUWXml('<!DOCTYPE x><uw:document/>')).rejects.toThrow(/XML_DTD_FORBIDDEN/);

    const xml = await stringifyUWXml(envelope);
    const duplicate = xml.replace('</uw:frontmatter>', '  <uw:deal_id uw:type="string">again</uw:deal_id>\n  </uw:frontmatter>');
    await expect(parseUWXml(duplicate)).rejects.toThrow(/XML_DUPLICATE_MEMBER/);

    const tampered = xml.replace('XML &amp; Unicode', 'Tampered');
    await expect(parseUWXml(tampered)).rejects.toThrow(/XML_DIGEST_MISMATCH/);

    const extraAttribute = xml.replace('format-version="1.1"', 'format-version="1.1" surprise="true"');
    await expect(parseUWXml(extraAttribute)).rejects.toThrow(/XML_UNEXPECTED_MEMBER/);

    const structuralText = xml.replace('<uw:frontmatter uw:type="object">', '<uw:frontmatter uw:type="object">not-whitespace');
    await expect(parseUWXml(structuralText)).rejects.toThrow(/XML_STRUCTURAL_TEXT/);

    const reservedItemKey = xml.replace('</uw:frontmatter>', '<uw:item uw:type="string">bad</uw:item></uw:frontmatter>');
    await expect(parseUWXml(reservedItemKey)).rejects.toThrow(/XML_MEMBER_NAME_INVALID/);

    await expect(stringifyUWXml({ ...envelope, invalid: '\ud800' })).rejects.toThrow(/XML_CHARACTER_INVALID/);
  });

  it('requires a digest on verified interchange input', async () => {
    const xml = (await stringifyUWXml(envelope)).replace(
      /^ {2}<uw:semantic_digest[^\n]*\n/m,
      '',
    );
    await expect(parseUWXml(xml)).resolves.toMatchObject({ envelope_version: '1.0' });
    await expect(parseUWXmlVerified(xml)).rejects.toThrow(/XML_DIGEST_MISSING/);
  });
  it('enforces input and nesting limits', async () => {
    const xml = await stringifyUWXml(envelope);
    await expect(parseUWXml(xml, { maxBytes: 20 })).rejects.toThrow(UWXmlError);
    await expect(parseUWXml(xml, { maxDepth: 1 })).rejects.toThrow();
  });
});
