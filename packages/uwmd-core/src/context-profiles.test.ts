import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUWFile } from './parser.js';
import { buildContext, estimateTokens } from './context-profiles.js';

const PARKVIEW = readFileSync(
  resolve(__dirname, '../../../examples/Parkview-Apts-Glendale-AZ.uw.md'),
  'utf-8',
);
const PARSED = parseUWFile(PARKVIEW);

describe('buildContext — summary profile', () => {
  it('targets ≤ 600 tokens', () => {
    const r = buildContext(PARSED, 'summary');
    expect(r.profile).toBe('summary');
    expect(r.tokenEstimate).toBeLessThanOrEqual(600);
  });

  it('emits parseable JSON with frontmatter + pipeline_state', () => {
    const r = buildContext(PARSED, 'summary');
    const obj = JSON.parse(r.content) as Record<string, unknown>;
    expect(obj.frontmatter).toBeDefined();
    expect((obj.frontmatter as Record<string, unknown>).deal_id).toBe(PARSED.frontmatter.deal_id);
  });
});

describe('buildContext — compact profile', () => {
  it('emits ≤ 55% of live token count', () => {
    const live = buildContext(PARSED, 'live');
    const cmp = buildContext(PARSED, 'compact');
    expect(cmp.tokenEstimate / live.tokenEstimate).toBeLessThanOrEqual(0.55);
  });

  it('orders sections stable-first (property before rent_roll)', () => {
    const r = buildContext(PARSED, 'compact');
    const propIdx = r.content.indexOf('"property"');
    const rentIdx = r.content.indexOf('"rent_roll"');
    if (propIdx >= 0 && rentIdx >= 0) {
      expect(propIdx).toBeLessThan(rentIdx);
    }
  });

  it('produces parseable JSON with stripped prose', () => {
    const r = buildContext(PARSED, 'compact');
    const obj = JSON.parse(r.content) as Record<string, unknown>;
    // None of the sections should carry a `prose` field.
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'frontmatter') continue;
      expect((v as Record<string, unknown>).prose).toBeUndefined();
    }
  });
});

describe('buildContext — live profile', () => {
  it('includes prose for each section', () => {
    const r = buildContext(PARSED, 'live');
    const obj = JSON.parse(r.content) as Record<string, unknown>;
    let anyHadProse = false;
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'frontmatter') continue;
      if ((v as Record<string, unknown>).prose !== undefined) anyHadProse = true;
    }
    expect(anyHadProse).toBe(true);
  });
});

describe('buildContext — full profile', () => {
  it('returns the input file byte-for-byte', () => {
    const r = buildContext(PARSED, 'full');
    expect(r.content).toBe(PARKVIEW);
  });
});

describe('buildContext — relevant profile', () => {
  it('honors opts.sections', () => {
    const r = buildContext(PARSED, 'relevant', { sections: ['property'] });
    expect(r.sectionsIncluded).toEqual(['property']);
    const obj = JSON.parse(r.content) as Record<string, unknown>;
    expect(obj.property).toBeDefined();
    expect(obj.rent_roll).toBeUndefined();
  });

  it('returns empty (just frontmatter) when no sections given', () => {
    const r = buildContext(PARSED, 'relevant');
    expect(r.sectionsIncluded).toEqual([]);
    const obj = JSON.parse(r.content) as Record<string, unknown>;
    expect(Object.keys(obj)).toEqual(['frontmatter']);
  });
});

describe('truncation', () => {
  it('soft-truncates and sets truncated:true when over maxTokens', () => {
    const r = buildContext(PARSED, 'live', { maxTokens: 100 });
    expect(r.truncated).toBe(true);
    expect(r.tokenEstimate).toBeLessThanOrEqual(101);
  });

  it('does not truncate when under maxTokens', () => {
    const r = buildContext(PARSED, 'summary', { maxTokens: 5_000 });
    expect(r.truncated).toBe(false);
  });
});

describe('estimateTokens', () => {
  it('is chars/4 ceiling', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});
