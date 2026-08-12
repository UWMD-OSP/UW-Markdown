import { describe, expect, it } from 'vitest';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from './parser.js';

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
