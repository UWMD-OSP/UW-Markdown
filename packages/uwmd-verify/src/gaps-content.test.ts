import { describe, expect, it } from 'vitest';
import { readGapsContent } from './gaps-content.js';
import { parseUWFile } from './parser.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const EMPTY = ['---', 'uw_version: "3.0"', '---', ''].join('\n');

function withGaps(content: unknown): ParsedUWFile {
  const block = { annotation: { section: 'gaps' }, content, meta: {} } as unknown as UWBlock;
  return { ...parseUWFile(EMPTY), sections: { gaps: block } };
}

describe('readGapsContent', () => {
  it('returns null for an absent gaps section', () => {
    expect(readGapsContent(parseUWFile(EMPTY))).toBeNull();
  });

  it('returns the items array when present', () => {
    const c = readGapsContent(withGaps({ items: [{ section: 'property', reason: 'missing' }] }));
    expect(c?.items.length).toBe(1);
  });

  it('keeps a stated summary', () => {
    const summary = { total_open: 1, blocking_current_stage: 0, blocking_next_stage: 1 };
    expect(readGapsContent(withGaps({ items: [], summary }))?.summary).toEqual(summary);
  });

  it('returns null when items is not an array', () => {
    expect(readGapsContent(withGaps({ items: 'none' }))).toBeNull();
  });
});
