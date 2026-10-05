import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { generateBlankUWFile, INIT_SCENARIOS, UWInitError } from './init.js';
import { parseUWFile } from './parser.js';
import { resolvePolicy } from './editor.js';
import type { UWFrontmatter } from './types.js';

describe('generateBlankUWFile', () => {
  it('honors supplied frontmatter values and produces the standard section scaffold', () => {
    const content = generateBlankUWFile({
      dealId: 'uw_2026_SENIOR',
      dealName: 'Sunrise Senior Living',
      address: '123 Care Way',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
      assetClass: 'senior_housing',
      assetSubtype: 'assisted_living',
      dealStage: 'full_underwrite',
      tier: 'analyst',
    });
    const parsed = parseUWFile(content);

    expect(parsed.frontmatter).toMatchObject({
      deal_id: 'uw_2026_SENIOR',
      deal_name: 'Sunrise Senior Living',
      asset_class: 'senior_housing',
      asset_subtype: 'assisted_living',
      deal_stage: 'full_underwrite',
      tier: 'analyst',
    });
    // Custom calculations and scenarios have dedicated parsed collections;
    // the remaining 20 scaffold blocks are ordinary sections.
    expect(Object.keys(parsed.sections)).toHaveLength(20);
    expect(parsed.custom_calculations).toHaveLength(1);
    expect(parsed.custom_scenarios).toHaveLength(1);
    expect(parsed.pipeline_log[0]?.content.entries).toHaveLength(1);
  });

  it('uses documented defaults when options are omitted', () => {
    const parsed = parseUWFile(generateBlankUWFile({ dealId: 'uw_2026_DEFAULTS' }));

    expect(parsed.frontmatter.deal_name).toBe('Untitled Deal');
    expect(parsed.frontmatter.asset_class).toBe('multifamily');
    expect(parsed.frontmatter.deal_stage).toBe('screening');
    expect(parsed.frontmatter.tier).toBe('screener');
    expect(parsed.frontmatter.pipeline_state?.L0_ingestion).toBe('pending');
    expect(parsed.frontmatter.scenario).toBeNull();
  });

  it('writes a supplied scenario into the frontmatter (Format §6.7)', () => {
    // `uwmd init --scenario` was documented but dropped: the template
    // hardcoded `scenario: null`.
    const parsed = parseUWFile(
      generateBlankUWFile({ dealId: 'uw_2026_SCENARIO', scenario: 'value_add' }),
    );
    expect(parsed.frontmatter.scenario).toBe('value_add');
  });
});

describe('INIT_SCENARIOS', () => {
  it('lists exactly the frontmatter scenario values Format §2.2 lists, in order', () => {
    const specPath = fileURLToPath(new URL('../../../spec/UW_FORMAT_SPEC_v1.md', import.meta.url));
    const line = readFileSync(specPath, 'utf-8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('scenario: "'));
    expect(line).toBeDefined();
    const listed = /^scenario: "([^"]+)"/.exec(line ?? '')?.[1]?.split(' | ');
    expect(INIT_SCENARIOS).toEqual(listed);
  });
});


describe('generateBlankUWFile — every stamped source is governed by a policy', () => {
  // The generator used to stamp `wizard` and `engine:uwmd`, neither of which
  // matched a BUILTIN_EDIT_POLICIES pattern. Every freshly created document
  // therefore carried blocks no policy governed, and replacing them in place
  // silently destroyed the prior version. A catch-all now covers unrecognized
  // sources, but a generator emitting one is still a bug: it means the document
  // gets the conservative fallback instead of the policy it actually warrants.
  const content = generateBlankUWFile({ dealName: 'Policy Check', assetClass: 'multifamily' });
  const parsed = parseUWFile(content);

  it('never falls through to the catch-all', () => {
    const blocks = [
      ...Object.values(parsed.sections),
      ...(parsed.pipeline_log ?? []),
    ].flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      return 'meta' in entry ? [entry] : Object.values(entry);
    });
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const source = (block as { meta?: { source?: string } })?.meta?.source;
      if (!source) continue;
      const policy = resolvePolicy(source);
      expect(policy?.source_pattern, `'${source}' fell through to the catch-all`).not.toBe('*');
    }
  });

  it('keeps the section stubs editable by a person', () => {
    // Not `system/init`: that resolves to `system/*`, authority `system_only`,
    // and these stubs exist to be filled in by a human.
    const property = parsed.sections.property as { meta?: { source?: string } };
    expect(property?.meta?.source).toBe('manual');
    expect(resolvePolicy('manual')?.authority).toBe('either');
  });
});

describe('generateBlankUWFile — frontmatter serialization', () => {
  /** The frontmatter lines between the opening and closing `---`. */
  const frontmatterOf = (content: string): string => content.split('\n---\n')[0]!.slice('---\n'.length);
  const lineOf = (content: string, key: string): string | undefined =>
    frontmatterOf(content).split('\n').find((l) => l.startsWith(`${key}: `));

  it('keeps the existing bytes for values that need no quoting change', () => {
    const content = generateBlankUWFile({
      dealId: 'uw_2026_BYTES',
      dealName: 'Sunrise Senior Living',
      address: '123 Care Way',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85001',
      assetClass: 'senior_housing',
      assetSubtype: 'assisted_living',
      dealStage: 'full_underwrite',
      scenario: 'value_add',
      tier: 'analyst',
    });
    expect(frontmatterOf(content)).toContain(
      [
        'uw_version: "2.0"',
        'deal_id: "uw_2026_BYTES"',
        'deal_name: "Sunrise Senior Living"',
      ].join('\n'),
    );
    expect(frontmatterOf(content)).toContain(
      [
        'property_address: "123 Care Way"',
        'city: "Phoenix"',
        'state: "AZ"',
        'zip: "85001"',
        'asset_class: senior_housing',
        'asset_subtype: assisted_living',
        'loan_type: null',
        'scenario: value_add',
      ].join('\n'),
    );
    expect(lineOf(content, 'deal_stage')).toBe('deal_stage: full_underwrite');
    expect(lineOf(content, 'tier')).toBe('tier: analyst');

    const defaults = generateBlankUWFile({ dealId: 'uw_2026_DEFAULTS' });
    expect(lineOf(defaults, 'property_address')).toBe('property_address: ""');
    expect(lineOf(defaults, 'asset_subtype')).toBe('asset_subtype: null');
    expect(lineOf(defaults, 'scenario')).toBe('scenario: null');
  });

  const QUOTED_FIELDS = [
    ['dealId', 'deal_id'],
    ['dealName', 'deal_name'],
    ['address', 'property_address'],
    ['city', 'city'],
    ['state', 'state'],
    ['zip', 'zip'],
  ] as const;

  const AWKWARD_VALUES = [
    'He said "hi"',
    'C:\\deals\\north',
    "O'Brien Plaza",
    'Suite 4: North',
    'Lot #12 # not a comment',
    '  padded  ',
    '\tleading tab',
    '',
    'null',
    '~',
    'true',
    'false',
    'yes',
    '123',
    '-5',
    '0x10',
    '1e3',
    'Infinity',
    '[]',
    '{a: 1}',
    '- item',
    '---',
    'Café Société — 東京 🏢',
  ];

  it.each(QUOTED_FIELDS.flatMap(([option, key]) => AWKWARD_VALUES.map((value) => [option, key, value] as const)))(
    '%s %j reads back exactly, in the reference reader and in a YAML library',
    (option, key, value) => {
      const content = generateBlankUWFile({ dealId: 'uw_2026_RT', [option]: value });
      expect(parseUWFile(content, { strict: true }).frontmatter[key as keyof UWFrontmatter]).toBe(value);
      expect((parseYaml(frontmatterOf(content)) as Record<string, unknown>)[key]).toBe(value);
    },
  );

  it.each([
    ['garden_style', 'garden_style'],
    ['com.example.data_center', 'com.example.data_center'],
    ['Garden Style', '"Garden Style"'],
    ['null', '"null"'],
    ['yes', '"yes"'],
    ['1960s', '"1960s"'],
    ['', '""'],
    ['mid-rise', '"mid-rise"'],
  ])('asset_subtype %j is written as %s and reads back exactly', (value, written) => {
    const content = generateBlankUWFile({ dealId: 'uw_2026_PLAIN', assetSubtype: value });
    expect(lineOf(content, 'asset_subtype')).toBe(`asset_subtype: ${written}`);
    expect(parseUWFile(content, { strict: true }).frontmatter.asset_subtype).toBe(value);
    expect((parseYaml(frontmatterOf(content)) as Record<string, unknown>).asset_subtype).toBe(value);
  });

  it('writes the deal name as a single heading line', () => {
    const content = generateBlankUWFile({ dealId: 'uw_2026_HEAD', dealName: 'Lot #12 "North" {#property}' });
    expect(content.split('\n').filter((l) => l.startsWith('# '))).toEqual(['# Lot #12 "North" {#property}']);
  });

  it.each([
    ['dealName', 'line\nbreak'],
    ['dealName', 'carriage\rreturn'],
    ['address', 'next\u0085line'],
    ['city', 'line\u2028separator'],
    ['zip', 'nul\u0000byte'],
    ['state', 'del\u007f'],
    ['dealName', 'lone \ud800 surrogate'],
    ['dealName', `O'Brien "North"`],
    ['address', "O'Brien \\ North"],
    ['assetSubtype', 'two\nlines'],
  ])('refuses %s %j', (option, value) => {
    expect(() => generateBlankUWFile({ dealId: 'uw_2026_BAD', [option]: value })).toThrow(UWInitError);
  });

  it('refuses a non-string value', () => {
    expect(() =>
      generateBlankUWFile({ dealId: 'uw_2026_BAD', dealName: true as unknown as string }),
    ).toThrow(/deal_name: must be a string/);
  });

  it('refuses quoted content the reference reader would reject, rather than writing it', () => {
    // `: &x` inside quotes is legal YAML, but the reader's pre-pass reads it as
    // an anchor. Writing it would produce a file the reference reader refuses.
    let caught: unknown;
    try {
      generateBlankUWFile({ dealId: 'uw_2026_BAD', dealName: 'Smith: &Co' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(UWInitError);
    expect((caught as UWInitError).code).toBe('INIT_UNREPRESENTABLE_VALUE');
    expect((caught as UWInitError).field).toBe('frontmatter');
  });
});
