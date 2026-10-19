import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMeta } from '@uwmd/verify';
import { runProcess } from '../../../test/cli.mjs';

vi.setConfig({ testTimeout: 30_000 });
const CLI = resolve(process.cwd(), 'dist/cli.js');
const SOURCE = ['---', 'uw_version: "3.0"', 'asset_class: multifamily', 'deal_id: institution0097', 'quick_metrics:', '  dscr: 1.25', '  ltv: 0.7', '  debt_yield: 0.1', '---', '', '```json uw:section=property', JSON.stringify({ _meta: buildMeta('property', 1, { source: 'manual', actor: 'test', timestamp: '2026-10-19T00:00:00Z' }), total_units: 10 }), '```', ''].join('\n');
const roots: string[] = [];
afterEach(() => { for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function setup() {
  const directory = mkdtempSync(resolve(tmpdir(), 'uwmd institution0097 CLI ')); roots.push(directory);
  const documents = resolve(directory, 'records with spaces'); mkdirSync(documents);
  const file = resolve(documents, 'deal.uwx.md'); writeFileSync(file, SOURCE);
  return { directory, documents, file, config: resolve(documents, '.uw.institution.json') };
}
const run = (args: string[], cwd?: string) => runProcess(process.execPath, [CLI, ...args], { encoding: 'utf8', ...(cwd === undefined ? {} : { cwd }) });
function errorObject(code = 'MALFORMED', pointer?: string) {
  return { category: 'validate', code: `VAL-INSTITUTION-CONFIG-${code}`, message: code === 'MALFORMED' ? 'Selected institution config is malformed.' : 'Selected institution config could not be read.', ...(pointer === undefined ? {} : { pointer }) };
}

describe('RFC0097 actual standalone CLI admission', () => {
  it.each([
    ['bad syntax', '{', undefined], ['trailing value', '{} {}', undefined],
    ['decoded duplicate', String.raw`{"opaque":{"a":1,"\u0061":2}}`, undefined],
    ['lone surrogate', String.raw`{"opaque":"\ud800"}`, undefined],
    ['nonobject root', 'null', undefined], ['noncanonical root', '{"thresholds":null,"validation_overrides":{}}', 'thresholds'],
    ['carrier null', '{"validation_overrides":null}', 'validation_overrides'],
    ['carrier array', '{"validation_overrides":[]}', 'validation_overrides'],
    ['invalid dscr', '{"validation_overrides":{"dscr_warning_below":null}}', 'validation_overrides.dscr_warning_below'],
    ['invalid ltv', '{"validation_overrides":{"ltv_warning_above":".7"}}', 'validation_overrides.ltv_warning_above'],
    ['invalid yield', '{"validation_overrides":{"debt_yield_warning_below":true}}', 'validation_overrides.debt_yield_warning_below'],
    ['recognized overflow', '{"validation_overrides":{"dscr_warning_below":1e309}}', 'validation_overrides.dscr_warning_below'],
    ['atomic siblings', '{"validation_overrides":{"dscr_warning_below":1.108,"ltv_warning_above":"bad"}}', 'validation_overrides.ltv_warning_above'],
    ['fixed order', '{"validation_overrides":{"debt_yield_warning_below":null,"ltv_warning_above":null,"dscr_warning_below":null}}', 'validation_overrides.dscr_warning_below'],
    ['profile before shape', String.raw`{"thresholds":true,"opaque":"\udfff"}`, undefined],
  ])('%s yields only typed error/exit1 and preserves source/config bytes', async (_name, text, pointer) => {
    const { file, config } = setup(); writeFileSync(config, text!);
    const before = readFileSync(config);
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(1); expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({ error: errorObject('MALFORMED', pointer) });
    expect(readFileSync(file, 'utf8')).toBe(SOURCE); expect(readFileSync(config)).toEqual(before);
  });
  it.each([[0xef, 0xbb, 0xbf, 0x7b, 0x7d], [0xff], [0xed, 0xa0, 0x80]].map(octets => ({ octets })))('actual invalid UTF8/BOM bytes refuse before shape (%#)', async ({ octets }) => {
    const { file, config } = setup(); const raw = Buffer.from(octets); writeFileSync(config, raw);
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(1); expect(JSON.parse(result.stdout)).toEqual({ error: errorObject() });
    expect(readFileSync(config)).toEqual(raw);
  });
  it.each([
    ['dscr_warning_below', 1.24, 'FV-04', false], ['dscr_warning_below', 1.25, 'FV-04', false], ['dscr_warning_below', 1.26, 'FV-04', true],
    ['ltv_warning_above', .69, 'FV-09', true], ['ltv_warning_above', .7, 'FV-09', false], ['ltv_warning_above', .71, 'FV-09', false],
    ['debt_yield_warning_below', .09, 'FV-03', false], ['debt_yield_warning_below', .1, 'FV-03', false], ['debt_yield_warning_below', .11, 'FV-03', true],
  ] as const)('actual %s=%s preserves existing strict comparison and result transport', async (key, value, code, expected) => {
    const { file, config } = setup(); const text = JSON.stringify({ validation_overrides: { [key]: value } }); writeFileSync(config, text);
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.issues.some((issue: { code: string }) => issue.code === code)).toBe(expected);
    expect(output.errors).toEqual(output.issues.filter((issue: { severity: string }) => issue.severity === 'error'));
    expect(output.replacement_funding_verification.state).toBe('not_checked');
    expect(readFileSync(file, 'utf8')).toBe(SOURCE); expect(readFileSync(config, 'utf8')).toBe(text);
  });
  it('accepts opaque overflow/paired Unicode and leaves unknown data unapplied', async () => {
    const { file, config } = setup();
    const baseline = await run(['validate', file, '--json']); expect(baseline.status).toBe(0);
    writeFileSync(config, String.raw`{"opaque":1e309,"str":"\ud83d\ude00","validation_overrides":{"unallocated":null}}`);
    const configured = await run(['validate', file, '--json']);
    expect(configured).toEqual(baseline);
  });
  it('selects exactly one explicit relative/spaced file and ignores conflicting adjacent/cwd/parent paths', async () => {
    const { directory, file, config } = setup();
    writeFileSync(config, '{'); writeFileSync(resolve(directory, '.uw.institution.json'), '{');
    const explicit = resolve(directory, 'explicit config.json'); writeFileSync(explicit, '{"validation_overrides":{"dscr_warning_below":1.3}}');
    const result = await run(['validate', file, '--institution', relative(directory, explicit), '--json'], directory);
    expect(result.status).toBe(0); expect(JSON.parse(result.stdout).issues.some((i: { code: string }) => i.code === 'FV-04')).toBe(true);
    const missing = await run(['validate', file, '--institution=absent.json', '--json'], directory);
    expect(missing.status).toBe(1); expect(JSON.parse(missing.stdout)).toEqual({ error: errorObject('UNREADABLE') });
  });
  it('automatic selection follows the actual lexical document directory rather than cwd or parent', async () => {
    const { directory, file, config } = setup();
    writeFileSync(resolve(directory, '.uw.institution.json'), '{');
    const defaults = await run(['validate', relative(directory, file), '--json'], directory);
    expect(defaults.status).toBe(0); expect(JSON.parse(defaults.stdout).error).toBeUndefined();
    writeFileSync(config, '{"validation_overrides":{"dscr_warning_below":1.3}}');
    const selected = await run(['validate', relative(directory, file), '--json'], directory);
    expect(selected.status).toBe(0); expect(JSON.parse(selected.stdout).issues.some((i: { code: string }) => i.code === 'FV-04')).toBe(true);
  });
  it('uses invocation-path sidecar for a document symlink where supported', async ({ skip }) => {
    const { directory, documents, file, config } = setup();
    const alias = resolve(directory, 'alias.uwx.md');
    try { symlinkSync(file, alias, 'file'); }
    catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes((error as NodeJS.ErrnoException).code ?? '')) { skip(); return; } throw error; }
    writeFileSync(config, '{'); writeFileSync(resolve(directory, '.uw.institution.json'), '{"validation_overrides":{"dscr_warning_below":1.3}}');
    const result = await run(['validate', alias, '--json'], documents);
    expect(result.status).toBe(0); expect(JSON.parse(result.stdout).issues.some((i: { code: string }) => i.code === 'FV-04')).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(SOURCE);
  });
  it('selected directory is unreadable, not malformed or absent', async () => {
    const { directory, file } = setup(); const result = await run(['validate', file, '--institution', directory, '--json']);
    expect(result.status).toBe(1); expect(JSON.parse(result.stdout)).toEqual({ error: errorObject('UNREADABLE') });
  });
  it('human mode refuses with code on stderr and no validation claim on stdout', async () => {
    const { file, config } = setup(); writeFileSync(config, '{"secret":"do-not-disclose",');
    const result = await run(['validate', file]);
    expect(result.status).toBe(1); expect(result.stdout).toBe('');
    expect(result.stderr).toContain('VAL-INSTITUTION-CONFIG-MALFORMED');
    expect(result.stderr).not.toContain('do-not-disclose'); expect(result.stderr).not.toContain(config);
  });
  it('fatal document parse and CLI argument admission retain precedence over config', async () => {
    const { file, config } = setup(); writeFileSync(config, '{'); writeFileSync(file, SOURCE.replace('"3.0"', '"unsupported"'));
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).toContain('UNSUPPORTED_FORMAT_VERSION');
    expect(result.stderr).not.toContain('INSTITUTION');
    const argument = await run(['validate', file, '--institution', '--json']);
    expect(argument.status).toBe(1); expect(argument.stdout).toBe(''); expect(argument.stderr).toContain('--institution requires a path');
  });
  it('fatal source-representation mismatch still precedes config admission', async () => {
    const { file, config } = setup(); writeFileSync(config, '{'); writeFileSync(file, SOURCE.slice(0, SOURCE.indexOf('```')));
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(1); expect(result.stdout).toBe(''); expect(result.stderr).toContain('SOURCE_CONTENT_MISMATCH');
    expect(result.stderr).not.toContain('INSTITUTION');
  });
  it('ordinary document findings do not bypass config preflight', async () => {
    const { file, config } = setup(); writeFileSync(config, '{');
    writeFileSync(file, `${SOURCE}\n\`\`\`json uw:section=property\n{"_meta":{"section":"property","provenance":{"actor":""},"lifecycle":{"revision":1,"superseded":false},"quality":{"human_review_required":false}}}\n\`\`\`\n`);
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(1); expect(JSON.parse(result.stdout)).toEqual({ error: errorObject() });
  });
  it('Lite validation also completes config preflight before presenting ordinary results', async () => {
    const { documents, config } = setup(); const file = resolve(documents, 'record.uw.md');
    writeFileSync(file, '---\nuw_version: "1.0"\ndeal_name: Lite\n---\n\n# Lite\n'); writeFileSync(config, '{');
    const result = await run(['validate', file, '--json']);
    expect(result.status).toBe(1); expect(JSON.parse(result.stdout)).toEqual({ error: errorObject() });
  });
  it('an unexpected adapter defect remains internal-error exit2, never malformed or exit1', async () => {
    const { directory, file } = setup(); const hook = resolve(directory, 'injected-bug.mjs');
    writeFileSync(hook, `import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module'; const original = fs.readFileSync; fs.readFileSync = function(path, ...args) { if (typeof path === 'string' && path.endsWith('.uw.institution.json')) throw new RangeError('internal-adapter-test'); return original.call(this, path, ...args); }; syncBuiltinESMExports();`);
    const result = await runProcess(process.execPath, ['--import', pathToFileURL(hook).href, CLI, 'validate', file, '--json'], { encoding: 'utf8' });
    expect(result.status).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('internal-adapter-test'); expect(result.stderr).not.toContain('VAL-INSTITUTION-CONFIG');
  });
});

describe('RFC0097 aggregate and receipt boundaries', () => {
  it.each([{ flags: ['--validate'] }, { flags: [] }])('aggregate keeps wrapper and requested independent operations ($flags)', async ({ flags }) => {
    const { file, config } = setup(); writeFileSync(config, '{');
    const result = await run(['verify', file, ...flags, '--json']);
    expect(result.status).toBe(1); const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(false); expect(output.validation).toEqual({ error: errorObject() });
    expect(output).not.toHaveProperty('replacement_funding_verification'); expect(output).not.toHaveProperty('stated_metrics');
    if (flags.length) { expect(Object.keys(output).sort()).toEqual(['ok', 'validation']); }
    else { expect(output.integrity).toBeDefined(); expect(output.provenance).toBeDefined(); }
  });
  it.each(['--integrity', '--policy'])('nonvalidation %s operation does not discover a config', async flag => {
    const { file, config } = setup(); const baseline = await run(['verify', file, flag, '--json']); writeFileSync(config, '{');
    expect(await run(['verify', file, flag, '--json'])).toEqual(baseline);
  });
  it('human aggregate reports refusal without dereferencing a ValidationResult or presenting funding', async () => {
    const { file, config } = setup(); writeFileSync(config, '{');
    const result = await run(['verify', file, '--validate']);
    expect(result.status).toBe(1); expect(result.stderr).toContain('VAL-INSTITUTION-CONFIG-MALFORMED');
    for (const claim of ['Structural validation:', 'Replacement funding verification:', 'Stated metrics:']) expect(result.stdout).not.toContain(claim);
  });
  it('receipt issue and verify ignore adjacent malformed config and retain exact subjects/counts/verdicts', async () => {
    const { directory, file, config } = setup();
    copyFileSync(resolve(process.cwd(), '../../conformance/receipts/verify/01-clean/deal.uwx.md'), file);
    const sourceBefore = readFileSync(file);
    const issueArgs = ['receipt', 'issue', file, '--stdout', '--issued-at', '2026-10-19T00:00:00Z'];
    const baseline = await run(issueArgs); expect(baseline.status).toBe(0);
    const receipt = resolve(directory, 'receipt.json'); writeFileSync(receipt, baseline.stdout);
    const verdict = await run(['receipt', 'verify', file, receipt, '--json']);
    writeFileSync(config, '{');
    expect(await run(issueArgs)).toEqual(baseline);
    expect(await run(['receipt', 'verify', file, receipt, '--json'])).toEqual(verdict);
    expect(readFileSync(file)).toEqual(sourceBefore); expect(readFileSync(config, 'utf8')).toBe('{');
  });
});
