// cli.ts runs on import, so its contracts are tested through the built CLI.
// Build before testing (`npm run build`), as the @uwmd/cli smoke tests do.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'dist', 'cli.js');
const DEAL = resolve(__dirname, '..', '..', '..', 'examples', 'verification', 'deal.uwx.md');

describe('uwmd-report default output name', () => {
  const temp = mkdtempSync(join(tmpdir(), 'uwmd-report-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  it('names the output after the input without its .uwx.md extension', () => {
    // Through 0.8.30 only `.uw.md` was stripped, so deal.uwx.md produced
    // deal.uwx.report.html (and deal.uwx.pdf).
    const input = join(temp, 'deal.uwx.md');
    copyFileSync(DEAL, input);
    const stdout = execFileSync(process.execPath, [CLI, input, '--format', 'html'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(stdout.trim()).toBe(join(temp, 'deal.report.html'));
    expect(existsSync(join(temp, 'deal.report.html'))).toBe(true);
    expect(readdirSync(temp).sort()).toEqual(['deal.report.html', 'deal.uwx.md']);
  });

  it('documents .uwx.md input in its help', () => {
    const help = execFileSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' });
    expect(help).toContain('uwmd-report <input.uwx.md>');
    expect(help).not.toContain('.uw.md ');
  });
});
