import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildMeta } from '@uwmd/verify';
import { describe, expect, it, vi } from 'vitest';
import { runProcess } from '../../../test/cli.mjs';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const cli = resolve(process.cwd(), 'dist/cli.js');
describe('RFC0095 actual CLI validation transport', () => {
  it.each(['validate', 'verify'])('%s keeps exact fields/partitions/exits and source bytes', async command => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd-meta0095-'));
    const file = resolve(directory, 'source.uwx.md');
    const m = buildMeta('property', 1, { source: 'manual', actor: 'synthetic', timestamp: '2026-10-18T00:00:00Z' });
    const body = { _meta: { ...m, provenance: { ...m.provenance, resolution: 'market_data_accepted' }, quality: { ...m.quality, flags: ['lawful', 4] } }, total_units: 10 };
    const content = `---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: meta0095-cli\n---\n\`\`\`json uw:section=property\n${JSON.stringify(body)}\n\`\`\`\n`;
    writeFileSync(file, content);
    try {
      const observed = await runProcess(process.execPath, [cli, command, file, ...(command === 'verify' ? ['--validate'] : []), '--json'], { encoding: 'utf8' });
      expect(observed.status).toBe(1); expect(observed.stderr).toBe('');
      const dto = JSON.parse(observed.stdout); const result = command === 'verify' ? dto.validation : dto;
      expect(result.errors.filter((i: {code: string}) => ['META-05', 'META-06'].includes(i.code)).map((i: {code: string, field: string}) => [i.code, i.field])).toEqual([['META-05', '_meta.quality.flags[1]'], ['META-06', '_meta.provenance.market_data_ref']]);
      expect(result.issues.filter((i: {severity: string}) => i.severity === 'error')).toEqual(result.errors);
      expect(result.issues.some((i: {code: string, severity: string}) => i.code === 'DQ-06' && i.severity === 'error')).toBe(false);
      expect(readFileSync(file, 'utf8')).toBe(content);
    } finally { unlinkSync(file); rmdirSync(directory); }
  });
});
