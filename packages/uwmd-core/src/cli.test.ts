import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runProcess as spawnCli } from '../../../test/cli.mjs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { VERIFY_VERSION } from '@uwmd/verify';
import { REFERENCE_IMPLEMENTATION_MANIFEST } from './reference-implementation.js';

// These tests exercise built executables, stdout/stderr and exit codes.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const cli = resolve(process.cwd(), 'dist/cli.js');
const fixture = (name: string) =>
  resolve(process.cwd(), `../../conformance/hedge/0070-${name}/deal.uwx.md`);
describe('RFC 0070 CLI complete verification', () => {
  it.each([
    ['outright-payment', 0, 'verified'],
    ['stale-amount', 1, 'failed'],
    ['missing-sources-uses', 1, 'unverifiable'],
  ] as const)('%s JSON exposes independent state and exit', async (name, status, state) => {
    const result = await spawnCli(process.execPath, [cli, 'validate', fixture(name), '--json'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(status);
    const data = JSON.parse(result.stdout);
    expect(data.replacement_funding_verification.state).toBe(state);
    expect(data.errors.some((i: { code: string }) => i.code === 'HDG-09')).toBe(false);
  });
  it.each([
    ['outright-payment', 0, 'passed', 'verified'],
    ['stale-amount', 1, 'refused', 'failed'],
  ] as const)(
    '%s text distinguishes structural and complete verdicts',
    async (name, status, complete, state) => {
      const result = await spawnCli(process.execPath, [cli, 'validate', fixture(name)], {
        encoding: 'utf8',
      });
      expect(result.status).toBe(status);
      expect(result.stdout).toContain(`Complete validation: ${complete}`);
      expect(result.stdout).toContain(`Replacement funding verification: ${state}`);
      expect(result.stdout).toContain('Structural validation:');
      if (status === 1) expect(result.stdout).not.toContain('✓  CLEAN');
    }
  );
});

describe('RFC 0070 verify command', () => {
  it.each([
    ['outright-payment', 0, 'verified'],
    ['stale-amount', 1, 'failed'],
  ] as const)('verify --validate %s cannot skip bindings', async (name, status, state) => {
    const result = await spawnCli(
      process.execPath,
      [cli, 'verify', fixture(name), '--validate', '--json'],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(status);
    const data = JSON.parse(result.stdout);
    expect(data.ok).toBe(status === 0);
    expect(data.replacement_funding_verification.state).toBe(state);
    expect(data.validation.errors.some((i: { code: string }) => i.code === 'HDG-09')).toBe(false);
  });
  it('integrity-only verification explicitly leaves funding unchecked', async () => {
    const result = await spawnCli(
      process.execPath,
      [cli, 'verify', fixture('stale-amount'), '--integrity', '--json'],
      { encoding: 'utf8' }
    );
    expect(JSON.parse(result.stdout).replacement_funding_verification).toEqual({
      state: 'not_checked',
      reason: 'not_invoked',
      issues: [],
    });
  });
});

describe('uwmd --version', () => {
  const run = (...args: string[]) => spawnCli(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const manifest = REFERENCE_IMPLEMENTATION_MANIFEST;

  it.each(['--version', '-V', 'version'])('%s prints the manifest versions, not the help text', async (flag) => {
    const result = await run(flag);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split('\n')).toEqual([
      `@uwmd/core ${manifest.version}`,
      `@uwmd/verify ${VERIFY_VERSION}`,
      `Protocol ${manifest.protocol_version}`,
      `Format ${manifest.format_version}`,
    ]);
    expect(result.stdout).not.toContain('Commands:');
  });

  it('manifest prints exactly the ImplementationManifest on stdout and the verify version on stderr', async () => {
    const result = await run('manifest');
    expect(result.status).toBe(0);
    // §II.6a.2: stdout is one JSON document, and the schema admits no extra field.
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(JSON.stringify(manifest)));
    expect(result.stderr.trim()).toBe(`@uwmd/verify ${VERIFY_VERSION}`);
  });
});

describe('commands the CLI does not have', () => {
  const run = (cwd: string, ...args: string[]) =>
    spawnCli(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });

  it('refuses the removed `run` command with a non-zero exit and no side effects', async () => {
    // The toolkit no longer hosts agents. `uwmd run` must fail before it reads
    // or writes anything, not fall through to the help text with exit 0.
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-run-removed-'));
    try {
      const input = resolve(dir, 'x.uw.md');
      const bytes = readFileSync(resolve(process.cwd(), '../../examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');
      writeFileSync(input, bytes);
      const result = await run(dir, 'run', 'x.uw.md', '--agent', 'risk-rater', '--live', '--output', 'out.uw.md');
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe("uwmd: unknown command 'run'. Run 'uwmd --help' for the command list.");
      expect(readdirSync(dir)).toEqual(['x.uw.md']);
      expect(readFileSync(input, 'utf8')).toBe(bytes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses the removed `layers` command (RFC 0112)', async () => {
    const result = await run(process.cwd(), 'layers');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("uwmd: unknown command 'layers'.");
  });

  it('refuses any unknown command the same way', async () => {
    const result = await run(process.cwd(), 'nonsense');
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("uwmd: unknown command 'nonsense'.");
  });

  it.each([{ args: [] }, { args: ['--help'] }, { args: ['-h'] }, { args: ['help'] }])('prints the command list for $args, without `run`', async ({ args }: { args: string[] }) => {
    const result = await run(process.cwd(), ...args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Commands:');
    expect(result.stdout).not.toMatch(/^\s+layers\s/m);
    expect(result.stdout).not.toMatch(/^\s+run\s/m);
    expect(result.stdout).not.toContain('--live');
    expect(result.stdout).not.toContain('ANTHROPIC_API_KEY');
  });
});

describe('RFC 0064 read-only reserve CLI',()=>{
  it.each([{ flags: [] }, { flags: ['--json'] }])('reports a missing file without a stack trace ($flags)', async ({ flags }) => {
    const missing = resolve(process.cwd(), 'missing-reserve-fixture.uwx.md');
    const result = await spawnCli(process.execPath, [cli, 'verify-reserve-accounts', missing, ...flags], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.trim()).toBe(`Error: file not found: ${missing}`);
  });
  it.each([['verified-source-classes',0,'verified'],['balance-mismatch',1,'failed'],['unclassified',1,'unverifiable'],['absent',0,'not_checked']] as const)('%s emits its independent result and exit status',async (name,status,state)=>{
    const file=resolve(process.cwd(),`../../conformance/reserve-accounts/${name}/deal.uwx.md`);
    const result=await spawnCli(process.execPath,[cli,'verify-reserve-accounts',file,'--json'],{encoding:'utf8'});
    expect(result.status,result.stderr).toBe(status); expect(JSON.parse(result.stdout).state).toBe(state);
  });
});

describe('RFC 0065 read-only binding CLI', () => {
  it('returns a typed JSON result for malformed plan JSON', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-draw-json-'));
    const file = resolve(dir, 'plan.json');
    writeFileSync(file, '{ malformed');
    try {
      const deal = resolve(process.cwd(), '../../conformance/reserve-draw-bindings/one-to-one/deal.uwx.md');
      const result = await spawnCli(process.execPath, [cli, 'verify-reserve-draws', deal, file, '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({ state: 'unverifiable', reason: 'invalid_structure', issues: [{ code: 'RDB-01' }] });
    } finally { unlinkSync(file); rmdirSync(dir); }
  });
  it.each([['one-to-one', 0, 'verified'], ['incomplete-draw', 1, 'failed'], ['missing-account', 1, 'unverifiable'], ['absent', 0, 'not_checked']] as const)('%s exposes its independent result', async (name, status, state) => {
    const dir = resolve(process.cwd(), `../../conformance/reserve-draw-bindings/${name}`);
    const args = [cli, 'verify-reserve-draws', resolve(dir, 'deal.uwx.md'), ...(name === 'absent' ? [] : [resolve(dir, 'plan.json')]), '--json'];
    const result = await spawnCli(process.execPath, args, { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(status);
    expect(JSON.parse(result.stdout).state).toBe(state);
  });
  it('handles a missing plan file without a stack trace', async () => {
    const deal = resolve(process.cwd(), '../../conformance/reserve-draw-bindings/one-to-one/deal.uwx.md');
    const missing = resolve(process.cwd(), 'missing-binding-plan.json');
    const result = await spawnCli(process.execPath, [cli, 'verify-reserve-draws', deal, missing, '--json'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(`Error: file not found: ${missing}`);
  });
});


describe('RFC0093 actual source validation transport', () => {
  it.each(['validate', 'verify'])('%s preserves numeric lexical placement in JSON and exit semantics', async command => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-meta0093-'));
    const file = resolve(dir, 'deal.uwx.md');
    const source = `---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: shape-cli\n---\n\`\`\`json uw:section=property\n${JSON.stringify({ '0': 1, _meta: {
        section: 'property', provenance: { source: 'manual', actor: 'test', timestamp: '2026-10-18T00:00:00Z' },
        lifecycle: { revision: 1, superseded: false }, quality: { confidence: 'high', human_review_required: false },
      }, total_units: 10 })}\n\`\`\`\n`;
    writeFileSync(file, source);
    try {
      const result = await spawnCli(process.execPath, [cli, command, file, ...(command === 'verify' ? ['--validate'] : []), '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      const json = JSON.parse(result.stdout);
      const validation = command === 'verify' ? json.validation : json;
      expect(validation.errors.filter((i: { code: string; field?: string }) => i.code === 'META-01' && i.field === '_meta')).toHaveLength(1);
      expect(result.stderr).toBe('');
      expect(readFileSync(file, 'utf8')).toBe(source);
    } finally { unlinkSync(file); rmdirSync(dir); }
  });
});


describe('RFC0093 composed-source CLI transport', () => {
  it('checks part lexical order without replacing assembled financial content or source bytes', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-composed-meta0093-'));
    const file = resolve(dir, 'deal.uwx.md');
    const partsDir = resolve(dir, 'parts');
    const partFile = resolve(partsDir, 'whole.uwpart.md');
    mkdirSync(partsDir);
    const m = {
      section: 'property', provenance: { source: 'manual', actor: 'test', timestamp: '2026-10-18T00:00:00Z' },
      lifecycle: { revision: 1, superseded: false }, quality: { confidence: 'high', human_review_required: false },
    };
    const root = `---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: composed-shape-cli\n---\n\`\`\`json uw:section=property\n${JSON.stringify({
      _meta: m, external: { parts: ['whole'], part_count: 1 },
    })}\n\`\`\`\n`;
    const part = `---\nuw_version: "3.0"\nuwpart_version: "1.0"\npart_id: whole\nsection: property\n---\n\`\`\`json uw:section=property\n{"0":1,"_meta":${JSON.stringify(m)},"total_units":17}\n\`\`\`\n`;
    writeFileSync(file, root);
    writeFileSync(partFile, part);
    try {
      const result = await spawnCli(process.execPath, [cli, 'verify', file, '--resolved', '--parts', partsDir, '--validate', '--json'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      const data = JSON.parse(result.stdout);
      expect(data.validation.errors.filter((i: { code: string; field?: string }) => i.code === 'META-01' && i.field === '_meta')).toHaveLength(1);
      expect(data.validation.issues.some((i: { code: string }) => i.code.startsWith('COMP-'))).toBe(false);
      expect(result.stderr).toBe('');
      expect(readFileSync(file, 'utf8')).toBe(root);
      expect(readFileSync(partFile, 'utf8')).toBe(part);
    } finally { unlinkSync(partFile); rmdirSync(partsDir); unlinkSync(file); rmdirSync(dir); }
  });
});

describe('RFC 0115 portable Verifier subcommands', () => {
  const root = (p: string) => resolve(process.cwd(), `../../${p}`);
  const run = (...args: string[]) => spawnCli(process.execPath, [cli, ...args], { encoding: 'utf8' });

  it.each([
    ['verify-waterfall', 'conformance/runner/derived/waterfall/verify-classic-outcomes/deal.uwx.md', 0, 'verified'],
    ['verify-waterfall', 'conformance/runner/derived/waterfall/verify-promote-overstated/deal.uwx.md', 1, 'failed'],
    ['verify-capital-stack', 'conformance/runner/derived/capital-stack/sizing-disagrees/deal.uwx.md', 1, 'failed'],
    ['verify-lease-up', 'conformance/runner/derived/lease-up/verify-missing-denominator/deal.uwx.md', 0, 'unverifiable'],
    ['verify-cash-flows', 'conformance/runner/derived/cash-flow/verify-moic-no-outflows/deal.uwx.md', 0, 'unverifiable'],
    ['verify-lease-up', 'conformance/reserve-accounts/absent/deal.uwx.md', 0, 'not_applicable'],
  ] as const)('%s %s exits %i with status %s', async (command, file, status, state) => {
    const result = await run(command, root(file), '--json');
    expect(result.status, result.stderr).toBe(status);
    expect(JSON.parse(result.stdout).status).toBe(state);
  });

  it('verify-metrics prints the StatedMetricsReport and exits 1 only on a failed statement', async () => {
    const clean = await run('verify-metrics', root('examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md'), '--json');
    expect(clean.status, clean.stderr).toBe(0);
    expect(JSON.parse(clean.stdout)).toMatchObject({ rule_set: '3.0', counts: { failed: 0 } });
    const wrong = await run('verify-metrics', root('conformance/runner/derived/metrics/statement-home-cap_rate-going-in-disagrees-quick-agrees/deal.uwx.md'), '--json');
    expect(wrong.status).toBe(1);
    expect(JSON.parse(wrong.stdout).counts.failed).toBe(1);
  });

  it('verify-receipt holds no pack, refuses an unreadable receipt, and exits 1 only on failed', async () => {
    const dir = (id: string) => root(`conformance/receipts/verify/${id}`);
    const clean = await run('verify-receipt', `${dir('01-clean')}/receipt.json`, `${dir('01-clean')}/deal.uwx.md`, '--json');
    expect(clean.status).toBe(0);
    expect(JSON.parse(clean.stdout)).toMatchObject({ verdict: 'unverifiable', issues: [{ code: 'RCP-05' }] });
    const mutated = await run('verify-receipt', `${dir('08-market-data-mutated')}/receipt.json`, `${dir('08-market-data-mutated')}/deal.uw.md`,
      '--inputs', `${dir('08-market-data-mutated')}/inputs.json`, '--json');
    expect(mutated.status).toBe(1);
    expect(JSON.parse(mutated.stdout).verdict).toBe('failed');
    const refused = await run('verify-receipt', `${dir('12-receipt-version-1-0')}/receipt.json`, `${dir('12-receipt-version-1-0')}/deal.uwx.md`, '--json');
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.stdout).error).toMatchObject({ code: 'RCP_MALFORMED' });
  });

  it.each(['assemble-property', 'verify-stated-metrics'])('%s is not a command (prelaunch, no alias)', async (command) => {
    const result = await run(command, root('examples/Agave-Court-Apts-Scottsdale-AZ.uwx.md'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`unknown command '${command}'`);
  });
});

describe('RFC 0085 command removal and full exports', () => {
  it('refuses removed commands and flags before reading or writing', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-no-compaction-'));
    const missing = resolve(dir, 'missing.uwx.md');
    const output = resolve(dir, 'out.uw.json');
    try {
      for (const args of [['compact', missing, '--output', output], ['export', missing, '--no-superseded', '--output', output]]) {
        const result = await spawnCli(process.execPath, [cli, ...args], { encoding: 'utf8' });
        expect(result.status).toBe(1);
        expect(result.stderr).not.toContain('ENOENT');
        expect(readdirSync(dir)).toEqual([]);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('preserves history when exporting both UWX and model sources without changing the source', async () => {
    const source = resolve(process.cwd(), '../../conformance/documents/malformed/04-broken-chain.uwx.md');
    const original = readFileSync(source);
    const first = await spawnCli(process.execPath, [cli, 'export', source, '--stdout'], { encoding: 'utf8' });
    expect(first.status).toBe(0);
    const envelope = JSON.parse(first.stdout);
    expect(envelope.superseded.property).toHaveLength(1);
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-full-export-'));
    const model = resolve(dir, 'record.uw.json');
    try {
      writeFileSync(model, first.stdout);
      const second = await spawnCli(process.execPath, [cli, 'export', model, '--stdout'], { encoding: 'utf8' });
      expect(second.status).toBe(0);
      expect(JSON.parse(second.stdout).superseded).toEqual(envelope.superseded);
      expect(readFileSync(model, 'utf8')).toBe(first.stdout);
    } finally { rmSync(dir, { recursive: true, force: true }); }
    expect(readFileSync(source)).toEqual(original);
  });
});
