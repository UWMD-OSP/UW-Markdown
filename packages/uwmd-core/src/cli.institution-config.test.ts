import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runProcess } from '../../../test/cli.mjs';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const cli = resolve(process.cwd(), 'dist/cli.js');
const fixture = readFileSync(resolve(process.cwd(), '../../conformance/documents/fixtures/02-full-multifamily.uwx.md'), 'utf8');
type Issue = { code: string; severity: string; threshold?: { min?: number; max?: number } };
async function run(file: string, cwd: string, extra: string[] = [], command = 'validate') {
  const result = await runProcess(process.execPath, [cli, command, file, ...extra, '--json'], { encoding: 'utf8', cwd });
  return { ...result, dto: JSON.parse(result.stdout) };
}
function setup() {
  const directory = mkdtempSync(resolve(tmpdir(), 'uwmd institution CLI '));
  const records = resolve(directory, 'record folder'); mkdirSync(records);
  const elsewhere = resolve(directory, 'other cwd'); mkdirSync(elsewhere);
  return { directory, elsewhere, file: resolve(records, 'deal with spaces.uwx.md'), adjacent: resolve(records, '.uw.institution.json') };
}

describe('actual CLI documented institution configuration', () => {
  it.each([
    ['dscr_warning_below', 'dscr', 1.25, 'FV-04', 'below'],
    ['ltv_warning_above', 'ltv', .70, 'FV-09', 'above'],
    ['debt_yield_warning_below', 'debt_yield', .09, 'FV-03', 'below'],
  ] as const)('%s respects below/equal/above from adjacent file across cwd and spaces', async (key, metric, value, code, direction) => {
    const paths = setup();
    const source = fixture.replace(new RegExp(`^(  ${metric}:).*`, 'm'), `$1 ${value}`);
    writeFileSync(paths.file, source);
    try {
      for (const threshold of [value - .01, value, value + .01]) {
        const config = JSON.stringify({ validation_overrides: { [key]: threshold } });
        writeFileSync(paths.adjacent, config);
        const observed = await run(paths.file, paths.elsewhere);
        expect(observed.status).toBe(0); expect(observed.stderr).toBe('');
        const issues = observed.dto.issues.filter((i: Issue) => i.code === code);
        const hit = direction === 'below' ? value < threshold : value > threshold;
        expect(issues).toHaveLength(hit ? 1 : 0);
        if (hit) {
          expect(issues[0].severity).toBe('warning');
          expect(issues[0].threshold).toEqual(direction === 'below' ? { min: threshold } : { max: threshold });
        }
        expect(readFileSync(paths.file, 'utf8')).toBe(source);
        expect(readFileSync(paths.adjacent, 'utf8')).toBe(config);
      }
    } finally { rmSync(paths.directory, { recursive: true, force: true }); }
  });
  it('explicit cwd-relative path selects one file rather than merging adjacent fields', async () => {
    const paths = setup(); writeFileSync(paths.file, fixture);
    const adjacent = JSON.stringify({ validation_overrides: { dscr_warning_below: 1.05, ltv_warning_above: .69 } });
    const explicit = JSON.stringify({ validation_overrides: { dscr_warning_below: 1.3 } });
    writeFileSync(paths.adjacent, adjacent); writeFileSync(resolve(paths.elsewhere, 'explicit.json'), explicit);
    try {
      const observed = await run(paths.file, paths.elsewhere, ['--institution', 'explicit.json']);
      expect(observed.status).toBe(0); expect(observed.stderr).toBe('');
      expect(observed.dto.issues.filter((i: Issue) => i.code === 'FV-04')).toHaveLength(1);
      expect(observed.dto.issues.some((i: Issue) => i.code === 'FV-09')).toBe(false);
      expect(readFileSync(paths.file, 'utf8')).toBe(fixture);
      expect(readFileSync(paths.adjacent, 'utf8')).toBe(adjacent);
      expect(readFileSync(resolve(paths.elsewhere, 'explicit.json'), 'utf8')).toBe(explicit);
    } finally { rmSync(paths.directory, { recursive: true, force: true }); }
  });
  it('verify validation shares discovery while integrity-only never loads config', async () => {
    const paths = setup(); writeFileSync(paths.file, fixture);
    writeFileSync(paths.adjacent, JSON.stringify({ validation_overrides: { dscr_warning_below: 1.05 } }));
    try {
      const observed = await run(paths.file, paths.elsewhere, ['--validate'], 'verify');
      expect(observed.stderr).toBe(''); expect(observed.dto.validation.issues.some((i: Issue) => i.code === 'FV-04')).toBe(false);
      writeFileSync(paths.adjacent, '{');
      const integrity = await run(paths.file, paths.elsewhere, ['--integrity'], 'verify');
      expect(integrity.stderr).toBe(''); expect(integrity.dto.validation).toBeUndefined();
      expect(readFileSync(paths.adjacent, 'utf8')).toBe('{');
      expect(readFileSync(paths.file, 'utf8')).toBe(fixture);
    } finally { rmSync(paths.directory, { recursive: true, force: true }); }
  });
  it('absent adjacent config keeps defaults even when cwd has a sidecar', async () => {
    const paths = setup(); writeFileSync(paths.file, fixture);
    writeFileSync(resolve(paths.elsewhere, '.uw.institution.json'), JSON.stringify({ validation_overrides: { dscr_warning_below: 1.05 } }));
    try {
      const observed = await run(paths.file, paths.elsewhere);
      expect(observed.status).toBe(0); expect(observed.stderr).toBe('');
      expect(observed.dto.issues.filter((i: Issue) => i.code === 'FV-04').map((i: Issue) => i.threshold)).toEqual([{ min: 1.2 }]);
      expect(readFileSync(paths.file, 'utf8')).toBe(fixture);
    } finally { rmSync(paths.directory, { recursive: true, force: true }); }
  });
});
