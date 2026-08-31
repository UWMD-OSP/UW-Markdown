import { describe, expect, it } from 'vitest';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from './parser.js';
import { resolvePolicy } from './editor.js';

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
