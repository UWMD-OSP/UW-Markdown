import { describe, expect, it } from 'vitest';
import { diff } from './compactor.js';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from '@uwmd/verify';

function blankDeal(): string {
  return generateBlankUWFile({
    dealId: 'uw_2026_COMPACTOR',
    dealName: 'Compactor Test',
  });
}

describe('diff', () => {
  it('reports changed fields but ignores provenance-only _meta changes', () => {
    const before = parseUWFile(blankDeal());
    const changedContent = blankDeal()
      .replace('"_notes": null', '"_notes": "updated"')
      .replace('"version": 1,', '"version": 2,');
    const after = parseUWFile(changedContent);

    const sections = diff(before, after);
    const dealContext = sections.find(section => section.sectionId === 'deal_context');

    expect(dealContext).toMatchObject({
      status: 'changed',
      changedFields: ['_notes'],
    });
    expect(sections.every(section => section.status === 'changed' || section.status === 'unchanged')).toBe(true);
  });
});


it('RFC 0085 has no compaction API on either public entry point', async () => {
  const [normal, browser] = await Promise.all([import('./index.js'), import('./browser.js')]);
  expect(normal).not.toHaveProperty('compact');
  expect(browser).not.toHaveProperty('compact');
  expect(normal.diff).toBeTypeOf('function');
  expect(browser.diff).toBeTypeOf('function');
});
