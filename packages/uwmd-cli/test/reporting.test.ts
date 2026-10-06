import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bin = resolve(root, 'packages/uwmd-cli/bin/uwmd.mjs');
const fixture = readFileSync(resolve(root, 'conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md'), 'utf8');
const partial = fixture.replace(/```json uw:section=sources_uses[^\n]*\r?\n[\s\S]*?```/, '');
const issuedAt = '2026-08-09T00:00:00Z';

function cli(...args: string[]) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

describe('CLI validation and receipt reporting', () => {
  let temp: string;
  let deal: string;
  let receipt: string;
  beforeEach(() => {
    temp = mkdtempSync(resolve(tmpdir(), 'uwmd-reporting-'));
    deal = resolve(temp, 'deal.uwx.md');
    receipt = resolve(temp, 'deal.receipt.json');
    writeFileSync(deal, partial);
  });
  afterEach(() => rmSync(temp, { recursive: true, force: true }));

  function issue() {
    return cli('receipt', 'issue', deal, '--output', receipt, '--issued-at', issuedAt);
  }

  it('keeps clean validation separate from incomplete optional later stages and skipped checks', () => {
    const minimal = readFileSync(resolve(root, 'conformance/tier-1-reader/fixtures/01-minimal-screening.uwx.md'), 'utf8');
    // The historical fixture intentionally warns about its v1 meta spelling.
    // Correct only that spelling in a temporary copy, retaining its stage gaps.
    const clean = minimal.replace(/"section_id": "property",(\r?\n\s+"version")/, '"section": "property",$1');
    expect(clean).not.toBe(minimal);
    const file = resolve(temp, 'clean.uwx.md');
    writeFileSync(file, clean);
    const human = cli('validate', file);
    const json = cli('validate', file, '--json');
    expect(human.status).toBe(0);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toMatchObject({
      overall_status: 'clean', stage_readiness: { screening: false, full_underwrite: false },
    });
    expect(human.stdout).toContain('Validation result: CLEAN');
    expect(human.stdout).toContain('Stage Readiness (workflow completeness):');
    expect(human.stdout).toContain('screening: incomplete');
    expect(human.stdout).toContain('full_underwrite: incomplete');
    expect(human.stdout).not.toContain('✗');
    expect(human.stdout).toMatch(/Cross-checks: \d+ evaluated, [1-9]\d* skipped/);
    expect(human.stdout).toContain('Skipped cross-checks were not evaluated');
    expect(human.stdout).toContain('Receipt readiness: not checked.');
    expect(human.stdout).toContain('Receipt/hash verification: not checked.');
  });

  it('does not imply Lite syntax validation evaluates workflow or receipt metrics', () => {
    const result = cli('validate', resolve(root, 'conformance/lite/fixtures/01-minimal.uw.md'));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Validation result: CLEAN');
    expect(result.stdout).toContain('not checked for Lite syntax validation');
    expect(result.stdout).toContain('Cross-checks: not checked');
    expect(result.stdout).toContain('Receipt readiness: not checked.');
  });

  it('issues a complete receipt with one explicitly uncomputed metric', () => {
    expect(partial).not.toBe(fixture);
    const result = issue();
    expect(result.status).toBe(0);
    const payload = JSON.parse(readFileSync(receipt, 'utf8'));
    expect(payload.issued_at).toBe(issuedAt);
    expect(payload.computation.results).toHaveLength(8);
    expect(payload.computation.results.filter((r: { computed: boolean }) => !r.computed)).toEqual([
      { calc_id: 'cash_on_cash', computed: false, value: null, unit: '%' },
    ]);
    expect(result.stdout.replace(/sha256:[0-9a-f]{64}/g, '<digest>')).toMatchInlineSnapshot(`
"Receipt issued for deal.uwx.md → deal.receipt.json (org.uwmd.pack.multifamily@1.0.1)
Metric completeness: partial
Computed: 7/8
Uncomputed: cash_on_cash
Uncomputed metrics lack structured inputs. The receipt records both computed and uncomputed result statuses.
Missing inputs are a completeness gap; they do not indicate a receipt/hash verification failure.
Canonicalization: uw-envelope-semantic@1.0
Document hash: <digest>
Results hash: <digest>
Receipt/hash verification: not checked against a prior receipt.
A receipt attests that these outputs follow from this record. It does not attest that the inputs are true.
"
`);
  });

  it('reports complete metric coverage when all structured inputs exist', () => {
    writeFileSync(deal, fixture);
    const result = issue();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Metric completeness: complete\nComputed: 8/8\nUncomputed: none');
  });

  it('keeps --stdout machine readable without adding presentation fields', () => {
    const result = cli('receipt', 'issue', deal, '--stdout', '--issued-at', issuedAt);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout);
    expect(payload.computation.results).toHaveLength(8);
    expect(payload).not.toHaveProperty('metric_completeness');
    expect(existsSync(receipt)).toBe(false);
  });

  it('refuses manufactured housing without substituting a pack', () => {
    writeFileSync(deal, fixture.replace('asset_class: multifamily', 'asset_class: manufactured_housing'));
    const result = issue();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Receipt refused [RCP_PACK_UNRESOLVED]');
    expect(result.stderr).toContain('manufactured_housing');
    expect(result.stderr).toContain('No receipt was issued. Receipt/hash verification was not performed.');
    expect(existsSync(receipt)).toBe(false);
  });

  it('names the unresolved calculation, section and variants in a calc refusal', () => {
    // Two debt_structure variants and no selectable one. Pack 1.0.1's
    // cash_on_cash returns null without stated equity, so add the fixture's
    // sources_uses to reach its debt_structure read.
    const variants = readFileSync(resolve(root, 'conformance/tier-3-calc-host/fixtures/variant-03-unresolvable/deal.uwx.md'), 'utf8');
    const sourcesUses = fixture.match(/```json uw:section=sources_uses[^\n]*\r?\n[\s\S]*?```/)?.[0];
    expect(sourcesUses).toBeDefined();
    const file = resolve(temp, 'unresolvable.uwx.md');
    writeFileSync(file, `${variants.trimEnd()}\n\n${sourcesUses}\n`);
    const result = cli('receipt', 'issue', file, '--output', receipt, '--issued-at', issuedAt);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Receipt refused [RCP_COMPUTATION_FAILED]');
    expect(result.stderr).toContain('cash_on_cash (CALC-RESOLVE-002)');
    expect(result.stderr).toContain('Cannot select debt_structure');
    expect(result.stderr).toContain('producer-senior');
    expect(result.stderr).toContain('producer-mezz');
    expect(existsSync(receipt)).toBe(false);
  });

  it('verifies matching uncomputed statuses without treating missing equity as failure', () => {
    expect(issue().status).toBe(0);
    const result = cli('receipt', 'verify', deal, receipt);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Receipt verification verdict: VERIFIED');
    expect(result.stdout).not.toContain('[RCP-');
    const json = cli('receipt', 'verify', deal, receipt, '--json');
    expect(JSON.parse(json.stdout)).toMatchObject({ verdict: 'verified', issues: [] });
  });

  it('reports a document hash mismatch independently of partial metric coverage', () => {
    expect(issue().status).toBe(0);
    writeFileSync(deal, partial.replace('"total_units": 160', '"total_units": 161'));
    const result = cli('receipt', 'verify', deal, receipt);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Receipt verification verdict: FAILED');
    expect(result.stdout).toContain('[RCP-01]');
    expect(result.stdout).toContain('expected sha256:');
    expect(result.stdout).toContain('got sha256:');
    expect(result.stdout).toContain('An uncomputed metric alone is a completeness gap');
    const json = cli('receipt', 'verify', deal, receipt, '--json');
    expect(json.status).toBe(1);
    expect(JSON.parse(json.stdout)).toMatchObject({ verdict: 'failed', issues: [expect.objectContaining({ code: 'RCP-01' })] });
  });
});
