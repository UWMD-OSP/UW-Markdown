import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseUWFile } from '@uwmd/verify';
import { resolveRenderMetrics } from './render-metrics.js';
import { render } from './renderer.js';

describe('rendered metric summaries', () => {
  it.each(['Desert-Palms-MHC-Apache-Junction-AZ', 'Roosevelt-Row-MixedUse-Phoenix-AZ'])('fills missing metrics for %s without editing the record', (name) => {
    const parsed = parseUWFile(readFileSync(resolve('../../examples', `${name}.uwx.md`), 'utf8'));
    delete parsed.frontmatter.quick_metrics;
    const before = structuredClone(parsed);
    const metrics = resolveRenderMetrics(parsed);
    for (const key of ['dscr', 'ltv', 'cap_rate']) expect(typeof metrics[key], key).toBe('number');
    for (const format of ['summary', 'chat', 'csv'] as const) {
      const content = render(parsed, { format }).content;
      expect(content).not.toMatch(/\$n\/a|n\/ax|n\/a yrs/);
      if (format === 'csv') {
        expect(content.split('\n')[1]).toMatch(/,\d+\.\d{3},-?\d+\.\d{2},-?\d+\.\d{2},/);
      }
    }
    expect(parsed).toEqual(before);
  });
  it('keeps authored values and explicit nulls, and formats declared precision', () => {
    const parsed = parseUWFile(readFileSync(resolve('../../examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8'));
    parsed.frontmatter.quick_metrics = { dscr: 1.2976998918, ltv: 0.4938, cap_rate: null };
    const before = structuredClone(parsed);
    expect(resolveRenderMetrics(parsed)).toMatchObject({ dscr: 1.2976998918, ltv: 0.4938, cap_rate: null });
    const csv = render(parsed, { format: 'csv' }).content;
    expect(csv).toContain(',1.298,49.38,,');
    expect(parsed).toEqual(before);
  });
});
