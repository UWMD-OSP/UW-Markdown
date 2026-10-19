import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runProcess } from '../../../test/cli.mjs';
import { buildMeta } from '@uwmd/verify';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
const cli = resolve(process.cwd(), 'dist/cli.js');

describe('RFC0094 actual validation CLI transport', () => {
  it.each(['validate', 'verify'])('%s returns exact fields, partitions and error exit without writing', async command => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd-meta0094-'));
    const file = resolve(directory, 'source.uwx.md');
    const m = buildMeta('property', 1, { source: 'manual', actor: 'test', timestamp: '2026-10-18T00:00:00Z' });
    const content = `---
uw_version: "3.0"
asset_class: multifamily
deal_id: leaf-cli
---
\`\`\`json uw:section=property
${JSON.stringify({ _meta: { ...m, quality: { ...m.quality, confidence: 'verified' }, lifecycle: { ...m.lifecycle, revision: 0 }, provenance: { ...m.provenance, timestamp: '2026-10-18T00:00:00Z\n' } }, total_units: 10 })}
\`\`\`
`;
    writeFileSync(file, content);
    try {
      const checked = await runProcess(process.execPath, [cli, command, file, ...(command === 'verify' ? ['--validate'] : []), '--json'], { encoding: 'utf8' });
      expect(checked.status).toBe(1);
      expect(checked.stderr).toBe('');
      const output = JSON.parse(checked.stdout);
      const result = command === 'verify' ? output.validation : output;
      const errors = result.errors.filter((i: { code: string }) => i.code === 'META-04');
      expect(errors.map((i: { field: string }) => i.field)).toEqual(['_meta.quality.confidence', '_meta.lifecycle.revision', '_meta.provenance.timestamp']);
      expect(errors.every((i: { severity: string }) => i.severity === 'error')).toBe(true);
      expect(result.issues.filter((i: { severity: string }) => i.severity === 'error')).toEqual(result.errors);
      expect(readFileSync(file, 'utf8')).toBe(content);
    } finally { unlinkSync(file); rmdirSync(directory); }
  });
});
