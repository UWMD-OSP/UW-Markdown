import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GALLERY } from './examples.js';
import { runChecks } from './run.js';

const repo = (path: string) => readFileSync(resolve(__dirname, '../../../..', path), 'utf8');

describe('runChecks', () => {
  it('verifies a clean record', async () => {
    const result = await runChecks(repo('examples/verification/deal.uwx.md'));
    expect(result.kind).toBe('checked');
    if (result.kind === 'checked') {
      expect(result.ok).toBe(true);
      expect(result.metrics.counts.failed).toBe(0);
    }
  });

  it('fails a record whose stated cap rate disagrees with its inputs', async () => {
    const result = await runChecks(repo('examples/verification/deal.wrong-cap-rate.uwx.md'));
    expect(result.kind === 'checked' && result.ok).toBe(false);
    if (result.kind === 'checked') expect(result.metrics.evidence.find((e) => e.state === 'failed')?.path).toBe('quick_metrics.cap_rate');
  });

  it('refuses an empty input and an unparseable one with a code', async () => {
    expect(await runChecks('  ')).toMatchObject({ kind: 'refused', code: 'EMPTY' });
    expect(await runChecks('---\nuw_version: "9.9"\n---\n')).toMatchObject({ kind: 'refused', code: 'UNSUPPORTED_FORMAT_VERSION' });
  });
});

describe('the example gallery', () => {
  it('carries one synthetic example per builtin class, each of which verifies', async () => {
    const classes = new Set(GALLERY.map((e) => e.asset_class));
    for (const cls of ['multifamily', 'office', 'retail', 'industrial', 'self_storage', 'hospitality', 'mixed_use',
      'senior_housing', 'student_housing', 'land', 'data_center', 'manufactured_housing']) expect(classes, cls).toContain(cls);
    for (const example of GALLERY) {
      const result = await runChecks(example.source);
      expect(result.kind, example.file).toBe('checked');
      if (result.kind === 'checked') expect(result.metrics.counts.failed, example.file).toBe(0);
    }
  });
});
