import { describe, expect, it } from 'vitest';
import { compact, diff } from './compactor.js';
import { generateBlankUWFile } from './init.js';
import { parseUWFile } from './parser.js';

function blankDeal(): string {
  return generateBlankUWFile({
    dealId: 'uw_2026_COMPACTOR',
    dealName: 'Compactor Test',
  });
}

describe('compact', () => {
  it('removes each superseded fence without disturbing the current block', () => {
    const original = blankDeal();
    const superseded = original.replace(
      'v=1 confidence=low\n{',
      'v=1 superseded=true confidence=low\n{',
    ).replace('"superseded": false', '"superseded": true');
    const current = original.replace('"_notes": null', '"_notes": "current"');
    const parsed = parseUWFile(`${superseded}\n${current.slice(current.indexOf('```json uw:section=deal_context'))}`);

    const result = compact(parsed);

    expect(result).not.toContain('"superseded": true');
    expect(result).toContain('"_notes": "current"');
  });
});

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
