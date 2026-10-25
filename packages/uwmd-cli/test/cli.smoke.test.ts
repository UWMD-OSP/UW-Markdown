// Historical tier names below are intentionally refused negative inputs.
import { runProcess as spawnCli } from '../../../test/cli.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { quantizeDecimal, evaluateCalc, parseUWFile, parseCalculationContext, decodeUWDealPackageZip, encodeUWDealPackageZip, sha256BytesHex, computeEnvelopeDigest, toUWEnvelope, parseUWXml } from '@uwmd/core';

// These tests exercise built executables, stdout/stderr and exit codes.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '..', 'bin', 'uwmd.mjs');
const FIXTURE = resolve(__dirname, '..', '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md');
const CARRIER_FIXTURE = resolve(__dirname, '../../../conformance/rfc-0089/fixtures/complete-current.uwx.md');
const LITE_FIXTURE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'conformance',
  'lite',
  'fixtures',
  '01-minimal.uw.md',
);
// The shipped UW Lite worked example (T11). Distinct from LITE_FIXTURE: this one
// is user-facing documentation, and its prose quotes derived metrics. An example
// nothing exercises is an example that rots.
const LITE_EXAMPLE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'examples',
  'Parkview-Apts-Glendale-AZ.uw.md',
);

const ASSET_CLASS_FIXTURES = [
  ['multifamily', 'Parkview-Apts-Glendale-AZ.uwx.md'],
  ['office', 'Riverside-Office-Phoenix-AZ.uwx.md'],
  ['retail', 'Cactus-Crossing-Retail-Mesa-AZ.uwx.md'],
  ['industrial', 'Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md'],
  ['self_storage', 'Sonoran-Self-Storage-Peoria-AZ.uwx.md'],
  ['hospitality', 'Saguaro-Select-Hotel-Tempe-AZ.uwx.md'],
  ['senior_housing', 'Ocotillo-Senior-Living-Chandler-AZ.uwx.md'],
  ['student_housing', 'Mill-Ave-Commons-Student-Tempe-AZ.uwx.md'],
  ['land', 'Sundance-Ranch-Land-Buckeye-AZ.uwx.md'],
  ['data_center', 'Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md'],
  ['manufactured_housing', 'Desert-Palms-MHC-Apache-Junction-AZ.uwx.md'],
] as const;

function exampleFixture(filename: string) {
  return resolve(__dirname, '..', '..', '..', 'examples', filename);
}

function runCli(args: string[]) {
  return spawnCli(process.execPath, [CLI_BIN, ...args], { encoding: 'utf8' });
}

function runCliBinary(args: string[]) {
  return spawnCli(process.execPath, [CLI_BIN, ...args]);
}

describe('uwmd CLI', () => {
  it('prints help on --help with exit code 0', async () => {
    const r = await runCli(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/uwmd/i);
  });

  // Issue #494: help advertised removed flags and hid init --zip; an unknown
  // render format printed a stack trace.
  it('documents only flags it accepts, and refuses an unknown render format without a stack', async () => {
    const help = (await runCli(['--help'])).stdout;
    expect(help).not.toMatch(/deprecated/i);
    expect(help).toMatch(/--zip <z>\s+ZIP or postal code \(init\)/);
    const r = await runCli(['render', FIXTURE, '--format', 'bogus']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('uwmd: The core renderer does not support \'bogus\' output.');
    expect(r.stderr).not.toMatch(/^\s+at /m);
  });

  it('parses the bundled Parkview fixture to JSON on stdout', async () => {
    const r = await runCli(['parse', FIXTURE]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({
      frontmatter: expect.any(Object),

      sections: expect.any(Object),
    });
  });

  it('parses a UW Lite document with typed anchored fields', async () => {
    const r = await runCli(['parse', LITE_FIXTURE]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({
      representation: 'uw-lite-markdown',
      representation_version: '1.0',
      issues: [],
    });
    expect(parsed.fields).toContainEqual(
      expect.objectContaining({
        path: 'acquisition.purchase_price',
        value: 12_500_000,
        unit: 'USD',
      }),
    );
  });

  it('validates a UW Lite document without treating it as UWX', async () => {
    const r = await runCli(['validate', LITE_FIXTURE, '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({
      representation: 'uw-lite-markdown',
      overall_status: 'clean',
      issues: [],
    });
  });

  it('compiles UW Lite to structured UWX on stdout', async () => {
    const r = await runCli(['convert', LITE_FIXTURE, '--to', 'uwx', '--stdout']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('```json uw:section=valuation');
    expect(r.stdout).toContain('"purchase_price": 12500000');
    expect(r.stdout).toContain('```json uw:section=x_uw_lite_source');
  });

  describe('the shipped UW Lite example', () => {
    it('validates clean', async () => {
      const r = await runCli(['validate', LITE_EXAMPLE, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        representation: 'uw-lite-markdown',
        overall_status: 'clean',
        issues: [],
      });
    });

    it('carries the same inputs as its .uwx.md twin', async () => {
      const r = await runCli(['convert', LITE_EXAMPLE, '--to', 'uwx', '--stdout']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('"purchase_price": 7200000');
      expect(r.stdout).toContain('"net_operating_income": 396635');
      expect(r.stdout).toContain('"loan_amount": 5040000');
      expect(r.stdout).toContain('"annual_debt_service": 357612');
      // The complete Lite source is retained, not discarded on compile.
      expect(r.stdout).toContain('```json uw:section=x_uw_lite_source');
    });

    // The example's prose states these four numbers. They are derived, never
    // stored, so this pins the claim to what the pack actually computes.
    it('derives the metrics its prose quotes', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-lite-example-'));
      try {
        const compiled = resolve(temp, 'compiled.uwx.md');
        expect(
          (await runCli(['convert', LITE_EXAMPLE, '--to', 'uwx', '--output', compiled])).status,
        ).toBe(0);

        const cases: Array<[string, string]> = [
          ['noi_model.net_operating_income / debt_structure.annual_debt_service', '1.1091'],
          ['debt_structure.loan_amount / valuation.purchase_price', '0.7000'],
          ['noi_model.net_operating_income / valuation.purchase_price', '0.0551'],
          ['noi_model.net_operating_income / debt_structure.loan_amount', '0.0787'],
        ];

        const calcPath = resolve(temp, 'metrics.json');
        writeFileSync(calcPath, JSON.stringify(cases.map(([formula]) => ({ formula }))));
        const result = await runCli(['calc', compiled, calcPath]);
        expect(result.status).toBe(0);
        const lines = result.stdout.trim().split('\n');
        expect(lines).toHaveLength(cases.length);
        for (const [index, [, expected]] of cases.entries()) expect(lines[index]).toContain(expected);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  });

  // Issue #409: land's null cap rate made the Lite writer emit a line its own
  // compiler refused, and the refusal surfaced as a stack trace.
  it('round-trips a land record through Lite and refuses a bad Lite unit without a stack', async () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-lite-land-'));
    try {
      const land = resolve(__dirname, '..', '..', '..', 'examples', 'Sundance-Ranch-Land-Buckeye-AZ.uwx.md');
      const lite = resolve(temp, 'land.uw.md');
      expect((await runCli(['convert', land, '--to', 'lite', '--output', lite])).status).toBe(0);
      expect(readFileSync(lite, 'utf8')).not.toContain('uw:valuation.going_in_cap_rate');
      const back = await runCli(['convert', lite, '--to', 'uwx', '--output', resolve(temp, 'land2.uwx.md')]);
      expect(back.status).toBe(0);

      const bad = resolve(temp, 'bad.uw.md');
      writeFileSync(bad, readFileSync(lite, 'utf8').replace(/^(# [^\n]*\n\n)/m, '$1- Going-in cap rate: null <!-- uw:valuation.going_in_cap_rate -->\n'));
      const refused = await runCli(['convert', bad, '--to', 'uwx', '--stdout']);
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain('uwmd: [LITE_COMPILE_UNIT_MISMATCH]');
      expect(refused.stderr).not.toMatch(/^\s+at /m);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('writes an explicit omission report for lossy UWX-to-Lite projection', async () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-lite-'));
    try {
      const reportPath = resolve(temp, 'projection.json');
      const r = await runCli([
        'convert',
        FIXTURE,
        '--to',
        'lite',
        '--projection-report',
        reportPath,
        '--stdout',
      ]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('uw_lite_version: 1.0');
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report).toMatchObject({
        profile: 'deal-summary-v1',
        lossy: true,
        omitted_paths: expect.any(Array),
      });
      expect(report.omitted_paths.length).toBeGreaterThan(0);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  describe('modules', () => {
    const moduleFixture = (kind: string, name: string) =>
      resolve(__dirname, '..', '..', '..', 'conformance', 'modules', kind, name);

    it('validates conforming manifests and exits 0', async () => {
      const r = await runCli([
        'modules', 'validate',
        moduleFixture('accept', '01-minimal.module.json'),
        moduleFixture('accept', '02-full-surface.module.json'),
        '--tier', 'verifier',
      ]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('2/2 manifest(s) loaded');
    });

    it('refuses a retired tier name as a usage error (RFC 0081 §6)', async () => {
      const r = await runCli([
        'modules', 'validate',
        moduleFixture('accept', '01-minimal.module.json'),
        '--tier', 'tier-4-agent-host',
      ]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('--tier must be reader or verifier');
    });

    it('exits non-zero and points at the failing declaration', async () => {
      const r = await runCli([
        'modules', 'validate',
        moduleFixture('reject', '06-calc-unknown-key.module.json'),
      ]);
      expect(r.status).toBe(1);
      // The pointer is what makes the output actionable.
      expect(r.stdout).toContain('calculations[0].bogus');
      expect(r.stdout).toContain('PROTO-MOD-064');
    });

    it('lists the registry that a set of manifests forms', async () => {
      const r = await runCli([
        'modules', 'list',
        moduleFixture('accept', '02-full-surface.module.json'),
        '--tier', 'verifier',
        '--json',
      ]);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout).modules[0]).not.toHaveProperty('agent_layers');
      expect(JSON.parse(r.stdout).modules).toEqual([
        expect.objectContaining({
          id: 'org.uwmd.full-surface',
          calculations: 1,
          asset_classes: ['multifamily', 'student_housing'],
        }),
      ]);
    });

    it('refuses to list a registry it could not build', async () => {
      const r = await runCli([
        'modules', 'list',
        moduleFixture('reject', '01-unknown-top-level-key.module.json'),
      ]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Registry refused to load');
    });
  });

  describe('deal packages (RFC 0018)', () => {
    const createPackageFixture = async (temp: string) => {
      const { createHash } = require('node:crypto') as typeof import('node:crypto');
      const { mkdirSync } = require('node:fs') as typeof import('node:fs');
      mkdirSync(resolve(temp, 'records'), { recursive: true });
      mkdirSync(resolve(temp, 'sources'), { recursive: true });
      const dealText = readFileSync(FIXTURE, 'utf8');
      writeFileSync(resolve(temp, 'records', 'deal.uwx.md'), dealText, 'utf8');
      // Deliberately binary, with bytes above 0x7F.
      const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x00, 0x80]);
      writeFileSync(resolve(temp, 'sources', 'lease.pdf'), pdf);
      const sha = (b: Buffer) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
      const manifest = {
        package_version: '1.0',
        package_id: 'pkg:smoke:1',
        members: [
          {
            id: 'deal:smoke', path: 'records/deal.uwx.md', role: 'underwriting',
            media_type: 'text/vnd.uwmd.extended+markdown',
            sha256: sha(Buffer.from(dealText, 'utf8')),
            document_profile: 'deal-underwriting-v1',
          },
          {
            id: 'source:lease', path: 'sources/lease.pdf', role: 'source_evidence',
            media_type: 'application/pdf', sha256: sha(pdf),
          },
        ],
        links: [{ type: 'guarantees', from: 'source:lease', to: 'deal:smoke' }],
      };
      const manifestPath = resolve(temp, 'manifest.json');
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      const zipPath = resolve(temp, 'smoke.uwpkg.zip');
      expect((await runCli(['package', 'create', manifestPath, '--output', zipPath])).status).toBe(0);
      return { manifestPath, zipPath };
    };

    // Build through the shipped CLI once; each test gets independent copies.
    const template = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-template-'));
    beforeAll(async () => { await createPackageFixture(template); });
    afterAll(() => rmSync(template, { recursive: true, force: true }));
    const buildPackage = (temp: string) => {
      cpSync(template, temp, { recursive: true });
      return { manifestPath: resolve(temp, 'manifest.json'), zipPath: resolve(temp, 'smoke.uwpkg.zip') };
    };
    it('creates, lists, and verifies a package', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { zipPath } = buildPackage(temp);
        const list = await runCli(['package', 'list', zipPath, '--json']);
        expect(list.status).toBe(0);
        expect(JSON.parse(list.stdout).members).toHaveLength(2);

        const verify = await runCli(['package', 'verify', zipPath, '--json']);
        expect(verify.status).toBe(0);
        expect(JSON.parse(verify.stdout).status).toBe('verified');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    // The rule the context view exists to enforce.
    it('never inlines source-evidence bytes into a context view', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { zipPath } = buildPackage(temp);
        const ctx = await runCli(['package', 'to-context', zipPath, '--stdout']);
        expect(ctx.status).toBe(0);
        const parsed = JSON.parse(ctx.stdout);
        expect(Object.keys(parsed.contents)).toEqual(['deal:smoke']);
        expect(parsed.source_evidence['source:lease']).toEqual({ status: 'not_transferred' });
        expect(parsed.incomplete_evidence_context).toBe(true);
        // Belt and braces: the PDF signature must not appear anywhere.
        expect(ctx.stdout).not.toContain('%PDF');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('projects only entity-layer links, with synthesized provenance', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { zipPath } = buildPackage(temp);
        const edges = JSON.parse((await runCli(['package', 'edges', zipPath])).stdout);
        expect(edges).toHaveLength(1);
        expect(edges[0].type).toBe('guarantees');
        expect(edges[0].provenance[0].source).toBe('pkg:smoke:1');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('exits non-zero when a member no longer matches the manifest', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { manifestPath, zipPath } = buildPackage(temp);
        // Change the payload after the manifest was written: encoding must refuse.
        writeFileSync(resolve(temp, 'records', 'deal.uwx.md'), 'tampered\n', 'utf8');
        const rebuilt = await runCli(['package', 'create', manifestPath, '--output', zipPath]);
        expect(rebuilt.status).toBe(1);
        expect(rebuilt.stderr).toContain('digest does not match');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  });

  it('validates the bundled fixture without errors', async () => {
    const r = await runCli(['validate', FIXTURE]);
    expect(r.status).toBe(0);
  });

  describe('scope on RFC 0080 classes', () => {
    const dataCenter = resolve(__dirname, '..', '..', '..', 'conformance', 'builtin-classes', '06-data-center-fixture', 'deal.uwx.md');

    it('reports the builtin class identity', async () => {
      const r = await runCli(['scope', dataCenter, '--json']);
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out).toMatchObject({
        asset_class: 'data_center',
        defaults_table: 'data_center@1.0.0',
      });
      expect(out).not.toHaveProperty('declared_asset_class');
      for (const field of Object.values(out.resolved) as Array<{ step: string; resolved_from?: string }>) {
        if (field.step === 'asset_class_default') expect(field.resolved_from).toBe('data_center@1.0.0');
      }
    });

    it('surfaces each default citation beside source and resolved_from', async () => {
      const r = await runCli(['scope', exampleFixture('Desert-Palms-MHC-Apache-Junction-AZ.uwx.md'), '--json']);
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out).not.toHaveProperty('declared_asset_class');
      expect(out.resolved['rent_roll.vacancy_pct']).toMatchObject({
        step: 'asset_class_default',
        source: 'asset_class_default',
        resolved_from: 'manufactured_housing@1.0.0',
        citation: expect.stringMatching(/multifamily starter range as a proxy/),
      });
    });

    it('lists no data-center expense-ratio default (owner decision 2026-10-10)', async () => {
      const r = await runCli(['scope', exampleFixture('Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md'), '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout).resolved).not.toHaveProperty('noi_model.expense_ratio');
    });
  });

  describe('a role-bearing debt map (RFC 0066)', () => {
    const roles = resolve(__dirname, '..', '..', '..', 'conformance', 'documents', 'fixtures', '10-declared-roles.uwx.md');

    it('scope reports a debt field it cannot select as refused, not defaulted', async () => {
      const r = await runCli(['scope', roles, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout).resolved['debt_structure.rate_pct']).toMatchObject({
        value: null,
        step: null,
        refused: { code: 'CALC-RESOLVE-002' },
      });
    });

    it('refine excludes only cash_on_cash and names why', async () => {
      const r = await runCli(['refine', roles, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout).diagnostics.section_inputs).toEqual([
        expect.objectContaining({ output_id: 'cash_on_cash', section: 'debt_structure', code: 'CALC-RESOLVE-002' }),
      ]);
      expect((await runCli(['refine', roles])).stdout).toContain('Excluded cash_on_cash: debt_structure [CALC-RESOLVE-002]');
    });

    it('calc reads the senior block for a declared role and refuses without one', async () => {
      const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-rfc0066-'));
      try {
        const decl = { id: 'ltv', label: 'LTV', formula: 'debt_structure.loan_amount / valuation.underwritten_value', unit: '%', deterministic: true };
        const senior = resolve(dir, 'senior.json');
        const plain = resolve(dir, 'plain.json');
        writeFileSync(senior, JSON.stringify({ ...decl, section_roles: { debt_structure: 'senior' } }));
        writeFileSync(plain, JSON.stringify(decl));
        const ok = await runCli(['calc', roles, senior, '--json']);
        expect(ok.status).toBe(0);
        expect(JSON.parse(ok.stdout)).toMatchObject({ ok: true, value: 0.6 });
        const refused = await runCli(['calc', roles, plain, '--json']);
        expect(refused.status).toBe(1);
        expect(JSON.parse(refused.stdout)).toMatchObject({ ok: false, error: { code: 'CALC-RESOLVE-002' } });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe.each(ASSET_CLASS_FIXTURES)('%s example', (assetClass, filename) => {
    const fixture = exampleFixture(filename);

    it('resolves scope with its registered default table', async () => {
      const r = await runCli(['scope', fixture, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        asset_class: assetClass,
        defaults_table: `${assetClass}@1.0.0`,
      });
    });

    it('ranks refinement gaps as JSON', async () => {
      const r = await runCli(['refine', fixture, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        by_voi: expect.any(Array),
        by_stage_blocking: expect.any(Array),
        diagnostics: expect.objectContaining({
          graph_size: expect.any(Number),
          resolved: expect.any(Number),
        }),
      });
    });

    it('exports a document envelope that retains the asset class', async () => {
      const r = await runCli(['export', assetClass==='multifamily'?CARRIER_FIXTURE:fixture, '--stdout']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        frontmatter: { asset_class: assetClass },
        semantic_digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      });
    });
  });

  it('refuses retained invalid carrier metadata without rewriting source bytes',async()=>{
    const before=readFileSync(FIXTURE);const result=await runCli(['export',FIXTURE,'--stdout']);
    expect(result.status).toBe(1);expect(result.stderr).toContain('ENVELOPE_INVALID_SCHEMA');expect(readFileSync(FIXTURE)).toEqual(before);
  });

  it('exports a digested UW Document Envelope to stdout', async () => {
    const r = await runCli(['export', CARRIER_FIXTURE, '--stdout']);
    expect(r.status).toBe(0);
    const exported = JSON.parse(r.stdout);
    expect(exported.envelope_version).toBe('2.0');
    expect(exported.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exported).not.toHaveProperty('uwjson_version');
    expect(exported).not.toHaveProperty('prose');
  });

  it('exports a UW Lite document as a digested UW Document Envelope', async () => {
    const r = await runCli(['export', LITE_FIXTURE, '--stdout']);
    expect(r.status).toBe(0);
    const exported = JSON.parse(r.stdout);
    expect(exported.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exported.sections.valuation.content.purchase_price).toBe(12_500_000);
    expect(exported.extensions.x_uw_lite_source.block.content.markdown).toContain(
      '# Acquisition',
    );
  });


  it('converts Markdown to deterministic UW XML on stdout', async () => {
    const r = await runCli(['convert', CARRIER_FIXTURE, '--to', 'uw-xml', '--stdout']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('<uw:document xmlns:uw="https://uwmd.org/ns/document/2" envelope-version="2.0" format-version="3.0">');
    const decoded=await parseUWXml(r.stdout);
    expect(decoded.envelope_version).toBe('2.0');
    expect(decoded.semantic_digest).toBe(await computeEnvelopeDigest(toUWEnvelope(parseUWFile(readFileSync(CARRIER_FIXTURE,'utf8')))));
  });

  it('converts verified UW XML back to UW JSON', async () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-'));
    try {
      const xml = await runCli(['convert', CARRIER_FIXTURE, '--to', 'xml', '--stdout']);
      expect(xml.status).toBe(0);
      const xmlPath = resolve(temp, 'deal.uw.xml');
      writeFileSync(xmlPath, xml.stdout, 'utf8');
      const json = await runCli(['convert', xmlPath, '--to', 'json', '--stdout']);
      expect(json.status).toBe(0);
      const envelope = JSON.parse(json.stdout);
      expect(envelope.envelope_version).toBe('2.0');
      expect(envelope.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('converts Markdown to a CSV bundle ZIP and back to verified JSON', async () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-csv-'));
    try {
      const zip = await runCliBinary(['convert', CARRIER_FIXTURE, '--to', 'csv', '--stdout']);
      expect(zip.status).toBe(0);
      expect(zip.stdout.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      const zipPath = resolve(temp, 'deal.uw.csv.zip');
      writeFileSync(zipPath, zip.stdout);
      const json = await runCli(['convert', zipPath, '--to', 'json', '--stdout']);
      expect(json.status).toBe(0);
      const envelope = JSON.parse(json.stdout);
      expect(envelope.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('lists registered representations for API discovery', async () => {
    const r = await runCli(['formats', '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-json', fidelity: 'model' }),
    );
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-xml', fidelity: 'model' }),
    );
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-csv-bundle', fidelity: 'model' }),
    );
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uw-lite-markdown', fidelity: 'source' }),
    );
    expect(JSON.parse(r.stdout)).toContainEqual(
      expect.objectContaining({ id: 'uwx-markdown', fidelity: 'source' }),
    );
  });
  it('exits non-zero on a missing file', async () => {
    const r = await runCli(['parse', resolve(__dirname, 'this-file-does-not-exist.uw.md')]);
    expect(r.status).not.toBe(0);
  });

  // Default output paths were entirely untested, which is how all three of the
  // bugs below survived the .uwx.md migration. They are user-visible filenames,
  // so they are worth pinning.
  describe('default output paths use .uwx.md', () => {
    it('init writes .uwx.md, not the legacy .uw.md', async () => {
      // `generateBlankUWFile()` emits structured UWX content. Writing it to
      // .uw.md created exactly the file the format spec forbids — and every
      // deal a newcomer scaffolded was born legacy.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-'));
      try {
        const r = await spawnCli(process.execPath, [CLI_BIN, 'init'], { encoding: 'utf8', cwd: temp });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('new-deal.uwx.md');
        expect(r.stdout).not.toMatch(/new-deal\.uw\.md/);
        // The generated file must actually parse as UWX.
        const written = readFileSync(resolve(temp, 'new-deal.uwx.md'), 'utf8');
        expect(written).toContain('uw_version:');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('init refuses to overwrite an existing file, by default name or --output', async () => {
      // A scaffold that silently replaced a deal file destroyed its provenance
      // (invariant 5). Both the derived default and an explicit --output refuse.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-exists-'));
      try {
        const first = await spawnCli(process.execPath, [CLI_BIN, 'init'], { encoding: 'utf8', cwd: temp });
        expect(first.status).toBe(0);
        const target = resolve(temp, 'new-deal.uwx.md');
        writeFileSync(target, 'PRESERVE', 'utf8');
        const again = await spawnCli(process.execPath, [CLI_BIN, 'init'], { encoding: 'utf8', cwd: temp });
        expect(again.status).toBe(1);
        expect(again.stderr).toContain('Refusing to overwrite existing file');
        expect(readFileSync(target, 'utf8')).toBe('PRESERVE');
        const explicit = await spawnCli(process.execPath, [CLI_BIN, 'init', '--output', 'new-deal.uwx.md'], { encoding: 'utf8', cwd: temp });
        expect(explicit.status).toBe(1);
        expect(explicit.stdout).not.toContain('Created:');
        expect(readFileSync(target, 'utf8')).toBe('PRESERVE');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('init --name derives a .uwx.md filename', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-name-'));
      try {
        const r = await spawnCli(process.execPath, [CLI_BIN, 'init', '--name', 'Cedar Court'], {
          encoding: 'utf8',
          cwd: temp,
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('cedar-court.uwx.md');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it.each(['stabilized_acquisition', 'com.example.repositioning'])('init writes %s and independent BTR identity', async scenario => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-scenario-'));
      try {
        const r = await spawnCli(
          process.execPath,
          [CLI_BIN, 'init', '--scenario', scenario, '--asset-class', 'multifamily', '--asset-subtype', 'build_to_rent', '--address', '1 Main St'],
          { encoding: 'utf8', cwd: temp },
        );
        expect(r.status).toBe(0);
        const written = readFileSync(resolve(temp, 'new-deal.uwx.md'), 'utf8');
        expect(written).toContain(`scenario: ${scenario}\n`);
        expect(written).toMatch(/^asset_subtype: build_to_rent$/m);
        expect(written).toMatch(/^asset_class: multifamily$/m);
        expect(written).toContain('property_address: "1 Main St"');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it.each([
      [['--scenario', 'stabilised_acquisition'], "got 'stabilised_acquisition'"],
      [['--scenario', 'build_to_rent'], "got 'build_to_rent'"],
      [['--scenario', 'nnn_single_tenant'], "got 'nnn_single_tenant'"],
      [['--scenario', 'lihtc_section8'], "got 'lihtc_section8'"],
      [['--scenario', 'distressed_reo'], "got 'distressed_reo'"],
      [['--scenario', 'com.plan'], "got 'com.plan'"],
      [['--scenario'], 'got no value'],
    ])('init %j refuses and writes nothing', async (extra, message) => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-bad-scenario-'));
      try {
        const r = await spawnCli(process.execPath, [CLI_BIN, 'init', ...extra], {
          encoding: 'utf8',
          cwd: temp,
        });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('--scenario must be one of');
        expect(r.stderr).toContain(message);
        expect(existsSync(resolve(temp, 'new-deal.uwx.md'))).toBe(false);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    // Issue #492: init wrote any --asset-class, --stage or --tier it was given.
    it.each([
      [['--asset-class', 'bogus'], '--asset-class must be one of', "got 'bogus'"],
      [['--stage', 'bogus'], '--stage must be one of', "got 'bogus'"],
      [['--tier', 'bogus'], '--tier must be one of screener, analyst', "got 'bogus'"],
      [['--stage'], '--stage must be one of', 'got no value'],
    ])('init %j refuses an out-of-vocabulary value and writes nothing', async (extra, rule, message) => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-bad-vocab-'));
      try {
        const r = await spawnCli(process.execPath, [CLI_BIN, 'init', ...extra], { encoding: 'utf8', cwd: temp });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain(rule);
        expect(r.stderr).toContain(message);
        expect(existsSync(resolve(temp, 'new-deal.uwx.md'))).toBe(false);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('init accepts a namespaced custom asset class', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-custom-class-'));
      try {
        const r = await spawnCli(process.execPath, [CLI_BIN, 'init', '--asset-class', 'com.example.specialty_facility'], { encoding: 'utf8', cwd: temp });
        expect(r.status).toBe(0);
        expect(readFileSync(resolve(temp, 'new-deal.uwx.md'), 'utf8')).toContain('asset_class: com.example.specialty_facility');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('init writes awkward values so they read back exactly', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-quote-'));
      try {
        const r = await spawnCli(
          process.execPath,
          [CLI_BIN, 'init', '--name', `He said "it's ready"`, '--address', `O'Brien "C:\\deals\\North" #4: [x]`, '--output', 'q.uwx.md'],
          { encoding: 'utf8', cwd: temp },
        );
        expect(r.status).toBe(0);
        const parsed = await runCli(['parse', resolve(temp, 'q.uwx.md')]);
        expect(parsed.status).toBe(0);
        const frontmatter = JSON.parse(parsed.stdout).frontmatter;
        expect(frontmatter.deal_name).toBe(`He said "it's ready"`);
        expect(frontmatter.property_address).toBe(`O'Brien "C:\\deals\\North" #4: [x]`);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it.each([
      [['--name', 'two\nlines'], 'deal_name: line breaks'],
      [['--name'], 'deal_name: must be a string'],
    ])('init %j refuses with a one-line error and writes nothing', async (extra, message) => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-bad-value-'));
      try {
        const r = await spawnCli(process.execPath, [CLI_BIN, 'init', ...extra, '--output', 'bad.uwx.md'], {
          encoding: 'utf8',
          cwd: temp,
        });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('[INIT_UNREPRESENTABLE_VALUE]');
        expect(r.stderr).toContain(message);
        expect(r.stderr).not.toContain('    at ');
        expect(existsSync(resolve(temp, 'bad.uwx.md'))).toBe(false);
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('export replaces the .uwx.md suffix rather than appending to it', async () => {
      // Regression: `replaceUWExtension` did not list .uwx.md, so a UWX input
      // fell through to the append branch and produced deal.uwx.md.uw.json.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-export-'));
      try {
        const dealPath = resolve(temp, 'deal.uwx.md');
        writeFileSync(dealPath, readFileSync(CARRIER_FIXTURE, 'utf8'), 'utf8');
        const r = await runCli(['export', dealPath]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('deal.uw.json');
        expect(r.stdout).not.toContain('deal.uwx.md.uw.json');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('report replaces the .uwx.md suffix rather than appending to it', async () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-report-'));
      try {
        const dealPath = resolve(temp, 'deal.uwx.md');
        writeFileSync(dealPath, readFileSync(FIXTURE, 'utf8'), 'utf8');
        const r = await runCli(['report', dealPath]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('deal.report.html');
        expect(r.stdout).not.toContain('deal.uwx.md.report.html');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('refuses structured content under a .uw.md name (RFC 0081 §4)', async () => {
      // `.uw.md` is the Lite extension: structured fences under it contradict
      // the representation and are SOURCE_CONTENT_MISMATCH.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-legacy-'));
      try {
        const dealPath = resolve(temp, 'legacy.uw.md');
        writeFileSync(dealPath, readFileSync(FIXTURE, 'utf8'), 'utf8');
        const r = await runCli(['export', dealPath]);
        expect(r.status).not.toBe(0);
        expect(`${r.stdout}${r.stderr}`).toContain('SOURCE_CONTENT_MISMATCH');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  });
});

describe('composition — compose, resolve, and --resolved (RFC 0021)', () => {
  const INLINE = resolve(__dirname, '../../../examples/standalone/authored-2026-10-17/inline-deal.uwx.md');

  const template = mkdtempSync(resolve(tmpdir(), 'uwmd-compose-template-'));
  beforeAll(async () => {
    const record = resolve(template, 'deal.uwx.md');
    writeFileSync(record, readFileSync(INLINE, 'utf8'), 'utf8');
    const out = await runCli(['compose', record, '--externalize', 'rent_roll', '--part-prefix', 'lease-suite', '--in-place']);
    expect(out.status).toBe(0);
  });
  afterAll(() => rmSync(template, { recursive: true, force: true }));

  /** Copy the CLI-generated fixture; mutations cannot leak between tests. */
  function externalized(): { dir: string; record: string } {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-compose-'));
    cpSync(template, dir, { recursive: true });
    return { dir, record: resolve(dir, 'deal.uwx.md') };
  }

  it('compose splits a section into fragments and leaves a directive', async () => {
    const { dir, record } = externalized();
    try {
      const text = readFileSync(record, 'utf8');
      expect(text).toContain('external=true');
      expect(text).toContain('"collection_path": "units"');
      expect(text).toContain('"part_count": 3');

      for (const id of ['210', '215', '220']) {
        const part = readFileSync(resolve(dir, 'parts', `lease-suite-${id}.uwpart.md`), 'utf8');
        expect(part).toContain('uwpart_version: "1.0"');
        expect(part).toContain(`part_id: lease-suite-${id}`);
        expect(part).toContain('collection_member: true');
        // A fragment must never look like a deal.
        expect(part).not.toContain('deal_id');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolve reassembles the record without moving its digest', async () => {
    const { dir, record } = externalized();
    try {
      const roundTrip = resolve(dir, 'roundtrip.uwx.md');
      const out = await runCli(['resolve', record, '--output', roundTrip]);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('RESOLVED');

      // The claim `compose` prints to the user, checked rather than asserted.
      const a = await runCli(['export', INLINE, '--stdout']);
      const b = await runCli(['export', roundTrip, '--stdout']);
      expect(a.status).toBe(0);
      expect(b.status).toBe(0);
      expect(JSON.parse(b.stdout).semantic_digest).toBe(JSON.parse(a.stdout).semantic_digest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolve refuses, and does not under-resolve, when a fragment is missing', async () => {
    const { dir, record } = externalized();
    try {
      rmSync(resolve(dir, 'parts', 'lease-suite-220.uwpart.md'));
      const out = await runCli(['resolve', record, '--json']);
      expect(out.status).toBe(1);
      const report = JSON.parse(out.stdout);
      expect(report.status).toBe('unresolved');
      expect(report.issues.map((i: { code: string }) => i.code)).toContain('COMP-UNRESOLVED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('export --resolved inlines the rows; without it the directive survives', async () => {
    const { dir, record } = externalized();
    try {
      const resolved = await runCli(['export', record, '--resolved', '--stdout']);
      expect(resolved.status).toBe(0);
      const withRows = JSON.parse(resolved.stdout);
      const section = withRows.sections.rent_roll.content ?? withRows.sections.rent_roll;
      expect(Array.isArray(section.units)).toBe(true);
      expect(section.units).toHaveLength(3);
      expect(section.external).toBeUndefined();

      const plain = await runCli(['export', record, '--stdout']);
      expect(plain.status).toBe(0);
      const asStored = JSON.parse(plain.stdout);
      const stored = asStored.sections.rent_roll.content ?? asStored.sections.rent_roll;
      expect(stored.external).toBeDefined();
      expect(stored.units).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('verify --resolved and export --resolved refuse a record they cannot assemble', async () => {
    const { dir, record } = externalized();
    try {
      rmSync(resolve(dir, 'parts', 'lease-suite-220.uwpart.md'));

      const verified = await runCli(['verify', record, '--resolved']);
      expect(verified.status).toBe(1);
      expect(verified.stderr).toContain('COMP-UNRESOLVED');

      const leaked = resolve(dir, 'leaked.uw.json');
      const exported = await runCli(['export', record, '--resolved', '--output', leaked]);
      expect(exported.status).toBe(1);
      // Refusing must not leave a half-answer on disk.
      expect(existsSync(leaked)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});


it('refine displays unresolved period inputs in text and JSON without claiming completeness', async () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-refine-period-'));
  try {
    const input = resolve(temp, 'period.uwx.md');
    const source = readFileSync(FIXTURE, 'utf8');
    const calc = { id: 'missing_period', formula: 'dcf.annual_cash_flows@Y999.noi', label: 'Missing period' };
    writeFileSync(input, [source, '```json uw:section=custom_calculations source=manual v=1', JSON.stringify(calc), '```', ''].join('\n'));
    const text = await runCli(['refine', input, '--targets', 'missing_period']);
    expect(text.status).toBe(0);
    expect(text.stdout).toContain('Excluded missing_period: dcf.annual_cash_flows@Y999.noi [REFINE-PERIOD-MISSING]');
    expect(text.stdout).toContain('until their period inputs are resolved');
    expect(text.stdout).not.toContain('No gap-driven inputs found');
    const json = await runCli(['refine', input, '--targets', 'missing_period', '--json']);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout).diagnostics.period_inputs).toEqual([expect.objectContaining({ output_id: 'missing_period', code: 'REFINE-PERIOD-MISSING' })]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

describe('calculation context files', () => {
  async function scenario(run: (file: string, context: string, write: (value: unknown) => void) => Promise<void>) {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-context-'));
    const file = resolve(dir, 'period.uwx.md');
    const context = resolve(dir, 'context.json');
    const periodSource = readFileSync(resolve(__dirname, '../../../conformance/calc/fixtures/period-01-year-order/deal.uwx.md'), 'utf8');
    const source = [periodSource.replace('uw:section=dcf source=', 'uw:section=dcf variant=base source='),
      '```json uw:section=dcf variant=stress source=manual v=1',
      JSON.stringify({ _role: 'component', annual_cash_flows: [{ year: 3, noi: 900 }] }), '```',
      '```json uw:section=custom_calculations source=manual v=1',
      JSON.stringify({ id: 'context_total', formula: 'dcf.annual_cash_flows@Y3.noi * noi_model.expense_ratio' }), '```', ''].join('\n');
    writeFileSync(file, source);
    try {
      await run(file, context, value => writeFileSync(context, JSON.stringify(value)));
      expect(readFileSync(file, 'utf8')).toBe(source);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  it('calc honors selected periods and ordinary overrides while preserving null and zero', async () => {
    await scenario(async (file, context, write) => {
      write({ sectionVariants: { dcf: 'stress' }, overrides: { 'property.total_units': 0 } });
      const selected = await runCli(['calc', file, 'dcf.annual_cash_flows@Y3.noi + property.total_units', '--calc-context', context, '--json']);
      expect(selected.status).toBe(0);
      expect(JSON.parse(selected.stdout).value).toBe(900);
      write({ overrides: { 'dcf.annual_cash_flows@Y3.noi': null } });
      const missing = await runCli(['calc', file, 'dcf.annual_cash_flows@Y3.noi', `--calc-context=${context}`, '--json']);
      expect(missing.status).toBe(0);
      expect(JSON.parse(missing.stdout).value).toBeNull();
      write({ overrides: { 'dcf.annual_cash_flows@Y3.noi': 0 } });
      const zero = await runCli(['calc', file, 'dcf.annual_cash_flows@Y3.noi', '--calc-context', context, '--json']);
      expect(zero.status).toBe(0);
      expect(JSON.parse(zero.stdout).value).toBe(0);
    });
  });
  it('refine uses selected variants and reports explicit null period inputs', async () => {
    await scenario(async (file, context, write) => {
      const ranking = () => runCli(['refine', file, '--targets', 'context_total', '--calc-context', context, '--json']);
      write({ sectionVariants: { dcf: 'base' } });
      const base = await ranking(); expect(base.status).toBe(0);
      write({ sectionVariants: { dcf: 'stress' } });
      const stress = await ranking(); expect(stress.status).toBe(0);
      // Refinement keeps binary64 interval values; compare with calc only at
      // its existing six-decimal boundary (Protocol VIII.5), as core tests do.
      // Evaluate each actual endpoint instead of scaling an already-computed bound.
      for (const [variant, report] of [['base', base], ['stress', stress]] as const) {
        const gap = JSON.parse(report.stdout).by_voi[0];
        expect(gap.field_path).toBe('noi_model.expense_ratio');
        for (const bound of ['low', 'high'] as const) {
          write({ sectionVariants: { dcf: variant }, overrides: { 'noi_model.expense_ratio': gap.prior_range[bound] } });
          const result = evaluateCalc({ id: 'inline', label: 'inline', deterministic: true,
            formula: 'dcf.annual_cash_flows@Y3.noi * noi_model.expense_ratio' },
          { parsed: parseUWFile(readFileSync(file, 'utf8')), prior_results: {}, locale: 'en-US',
            ...parseCalculationContext(JSON.parse(readFileSync(context, 'utf8'))) });
          expect(result.ok).toBe(true);
          expect(result.round_to).toBe(6);
          expect(quantizeDecimal(gap.affected_outputs[0].range_today[bound], 6)).toBe(result.value);
        }
      }
      expect(JSON.parse(stress.stdout).by_voi[0].affected_outputs[0].range_today.high)
        .toBeGreaterThan(JSON.parse(base.stdout).by_voi[0].affected_outputs[0].range_today.high);
      write({ overrides: { 'dcf.annual_cash_flows@Y3.noi': null } });
      const missing = await ranking(); expect(missing.status).toBe(0);
      expect(JSON.parse(missing.stdout).diagnostics.period_inputs[0].code).toBe('REFINE-PERIOD-MISSING');
      write({ overrides: { 'property.total_units': 0 } });
      const ignored = await ranking(); expect(ignored.status).toBe(1);
      expect(ignored.stderr).toContain('canonical period overrides only');
      expect(ignored.stdout).toBe('');
    });
  });
  it('refuses malformed contexts and a missing flag value before emitting results', async () => {
    await scenario(async (file, context, write) => {
      write({ overides: {} });
      const invalid = await runCli(['calc', file, '1', '--calc-context', context, '--json']);
      expect(invalid.status).toBe(1); expect(invalid.stdout).toBe('');
      expect(invalid.stderr).toContain('Unknown calculation context option');
      const missing = await runCli(['calc', file, '1', '--calc-context', '--json']);
      expect(missing.status).toBe(1); expect(missing.stdout).toBe('');
      expect(missing.stderr).toContain('requires a JSON file path');
    });
  });
});

describe('closed flag vocabulary', () => {
  // Through 4.1.0 the CLI kept every `--name[=value]` and each command read
  // only the flags it knew, so a misspelled security flag passed silently.
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-flags-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  it('verify refuses a misspelled security flag before any work runs', async () => {
    const r = await runCli(['verify', FIXTURE, '--document-signture=x.json', '--keystore=k.json']);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('uwmd verify: unknown flag --document-signture.');
    expect(r.stderr).toContain('--document-signature');
  });

  it('validate refuses an unknown flag, with or without --json', async () => {
    const plain = await runCli(['validate', FIXTURE, '--jsn']);
    expect(plain.status).toBe(1);
    expect(plain.stdout).toBe('');
    expect(plain.stderr).toContain('uwmd validate: unknown flag --jsn.');

    const json = await runCli(['validate', FIXTURE, '--json', '--stages=screening']);
    expect(json.status).toBe(1);
    expect(json.stdout).toBe('');
    expect(json.stderr).toContain('uwmd validate: unknown flag --stages.');
  });

  it('refuses every misspelled verification, signing and integrity flag before any work runs', async () => {
    const misspelled: Array<[string[], string]> = [
      [['verify', FIXTURE, '--signign', '--keystore=k.json'], 'uwmd verify: unknown flag --signign.'],
      [['verify', FIXTURE, '--signing', '--keystor=k.json'], 'uwmd verify: unknown flag --keystor.'],
      [['verify', FIXTURE, '--integrty'], 'uwmd verify: unknown flag --integrty.'],
      [['verify', FIXTURE, '--polcy'], 'uwmd verify: unknown flag --polcy.'],
      [['verify', FIXTURE, '--valdate'], 'uwmd verify: unknown flag --valdate.'],
      [['sign-document', FIXTURE, '--kye=s.json', `--out=${resolve(temp, 'never.json')}`], 'uwmd sign-document: unknown flag --kye.'],
      [['edit', FIXTURE, resolve(temp, 'op.json'), '--capability-tokn=t.json'], 'uwmd edit: unknown flag --capability-tokn.'],
      [['receipt', 'verify', FIXTURE, resolve(temp, 'r.json'), '--jsn'], 'uwmd receipt verify: unknown flag --jsn.'],
      [['package', 'verify', FIXTURE, '--jsn'], 'uwmd package verify: unknown flag --jsn.'],
    ];
    for (const [args, message] of misspelled) {
      const r = await runCli(args);
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stdout, args.join(' ')).toBe('');
      expect(r.stderr, args.join(' ')).toContain(message);
    }
    expect(existsSync(resolve(temp, 'never.json'))).toBe(false);
  });

  it('refuses near-miss spellings and flags from other commands', async () => {
    for (const [args, message] of [
      [['verify', FIXTURE, '--stage=closing'], 'uwmd verify: unknown flag --stage.'],
      [['validate', FIXTURE, '--compact'], 'uwmd validate: unknown flag --compact.'],
      [['validate', FIXTURE, '--stag=closing'], 'uwmd validate: unknown flag --stag.'],
      [['export', FIXTURE, '--compat', '--stdout'], 'uwmd export: unknown flag --compat.'],
      [['compose', FIXTURE, '--externalize', 'rent_roll', '--part=x'], 'uwmd compose: unknown flag --part.'],
    ] as Array<[string[], string]>) {
      const r = await runCli(args);
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stdout, args.join(' ')).toBe('');
      expect(r.stderr, args.join(' ')).toContain(message);
      expect(r.stderr, args.join(' ')).not.toContain('deprecated');
    }
  });

  it('sign-document refuses an unknown flag without touching the artifact path', async () => {
    const out = resolve(temp, 'signature.json');
    const r = await runCli(['sign-document', FIXTURE, `--key=${resolve(temp, 'missing-signer.json')}`, `--out=${out}`, '--bogus']);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('uwmd sign-document: unknown flag --bogus.');
    expect(existsSync(out)).toBe(false);
  });

  it('names a subcommand with its command, and says when a command takes no flags', async () => {
    const receipt = await runCli(['receipt', 'verify', FIXTURE, resolve(temp, 'receipt.json'), '--output=x']);
    expect(receipt.status).toBe(1);
    expect(receipt.stderr).toContain('uwmd receipt verify: unknown flag --output. Accepted flags: --json.');

    const diff = await runCli(['diff', FIXTURE, FIXTURE, '--json']);
    expect(diff.status).toBe(1);
    expect(diff.stdout).toBe('');
    expect(diff.stderr).toContain('uwmd diff: unknown flag --json. The command takes no flags.');
  });

  it('still accepts the flags a command knows', async () => {
    const verify = await runCli(['verify', FIXTURE, '--integrity', '--json']);
    expect(verify.status).toBe(0);
    expect(() => JSON.parse(verify.stdout)).not.toThrow();

    const validate = await runCli(['validate', FIXTURE, '--json']);
    expect(validate.status).toBe(0);
    expect(() => JSON.parse(validate.stdout)).not.toThrow();
  });
});

describe('verify recomputes stated metrics (Protocol §II.2 item 2)', () => {
  // Through 4.2.0 `verify` never ran the stated-metric check, so a stated cap
  // rate that disagrees with its record printed `OK` and exited 0. The two
  // documents are the examples/verification pair; they differ in one line.
  const VALID = resolve(__dirname, '..', '..', '..', 'examples', 'verification', 'deal.uwx.md');
  const WRONG = resolve(__dirname, '..', '..', '..', 'examples', 'verification', 'deal.wrong-cap-rate.uwx.md');
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-metrics-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  it('verifies available metrics and reports the two absent-basis statements', async () => {
    const r = await runCli(['verify', VALID]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✓  OK — deal.uwx.md');
    expect(r.stdout).toContain('Stated metrics: 7 verified, 0 failed, 2 unverifiable');
  });

  it('fails a document with a stated metric that disagrees with its recomputation', async () => {
    const r = await runCli(['verify', WRONG]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('✗  FAIL — deal.wrong-cap-rate.uwx.md');
    expect(r.stdout).toContain('Stated metrics: 6 verified, 1 failed, 2 unverifiable');
    expect(r.stdout).toContain('[FAILED] quick_metrics.cap_rate: stated 0.06, recomputed 0.0542');
    // --validate selects the same phase.
    expect((await runCli(['verify', WRONG, '--validate'])).status).toBe(1);
  });

  it('reports the failure in --json with the same exit code', async () => {
    const r = await runCli(['verify', WRONG, '--json']);
    expect(r.status).toBe(1);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(false);
    expect(out.stated_metrics.counts).toEqual({ verified: 6, failed: 1, unverifiable: 2 });
    expect(out.stated_metrics.evidence.filter((e: { state: string }) => e.state === 'failed'))
      .toEqual([expect.objectContaining({ id: 'cap_rate', path: 'quick_metrics.cap_rate', stated: 0.06, computed: 0.0542 })]);
    const valid = JSON.parse((await runCli(['verify', VALID, '--json'])).stdout);
    expect(valid.ok).toBe(true);
    expect(valid.stated_metrics.counts).toEqual({ verified: 7, failed: 0, unverifiable: 2 });
  });

  it('reports an unverifiable metric without failing, and an unrequested check as not checked', async () => {
    const blank = resolve(temp, 'blank.uwx.md');
    expect((await runCli(['init', '--asset-class', 'multifamily', `--output=${blank}`])).status).toBe(0);
    const stated = resolve(temp, 'stated-without-inputs.uwx.md');
    writeFileSync(stated, readFileSync(blank, 'utf8').replace(/^ {2}cap_rate: null$/m, '  cap_rate: 0.0550'));

    const unverifiable = await runCli(['verify', stated]);
    expect(unverifiable.status).toBe(0);
    expect(unverifiable.stdout).toContain('Stated metrics: 0 verified, 0 failed, 1 unverifiable');
    expect(unverifiable.stdout).toContain('[UNVERIFIABLE] quick_metrics.cap_rate: missing_or_null_input');

    const none = await runCli(['verify', blank]);
    expect(none.status).toBe(0);
    expect(none.stdout).toContain("Stated metrics: none stated for asset class 'multifamily'");

    const skipped = await runCli(['verify', WRONG, '--integrity']);
    expect(skipped.status).toBe(0);
    expect(skipped.stdout).toContain('Stated metrics: not checked (validation not requested)');
    expect(JSON.parse((await runCli(['verify', WRONG, '--integrity', '--json'])).stdout)).not.toHaveProperty('stated_metrics');
  });

  it('still verifies every builtin class example', async () => {
    for (const [, filename] of ASSET_CLASS_FIXTURES) {
      const r = await runCli(['verify', exampleFixture(filename), '--validate', '--json']);
      expect(r.status, filename).toBe(0);
      expect(JSON.parse(r.stdout).stated_metrics.counts.failed, filename).toBe(0);
    }
  });
});

describe('removed 4.2.0 aliases (#412): validate --stage, export --compact, compose --parts', () => {
  // No backward compatibility before launch: each is an unknown flag now,
  // refused with exit 1 like any other (#328), and nothing is written.
  const VALID = resolve(__dirname, '..', '..', '..', 'examples', 'verification', 'deal.uwx.md');
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-removed-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  it('refuses each alias as an unknown flag', async () => {
    const out = resolve(temp, 'x.uw.json');
    for (const [args, message] of [
      [['validate', VALID, '--stage', 'closing'], 'uwmd validate: unknown flag --stage.'],
      [['export', VALID, '--compact', '--output', out], 'uwmd export: unknown flag --compact.'],
      [['compose', VALID, '--externalize', 'rent_roll', '--parts', temp], 'uwmd compose: unknown flag --parts.'],
    ] as Array<[string[], string]>) {
      const r = await runCli(args);
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stderr, args.join(' ')).toContain(message);
      expect(r.stderr, args.join(' ')).not.toContain('deprecated');
    }
    expect(existsSync(out)).toBe(false);
  });
});

describe('init names its file with --output only', () => {
  // Through 4.2.0 `uwmd init my-deal.uwx.md` ignored the argument and wrote
  // new-deal.uwx.md, so the README quick start's next command failed.
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-init-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  it('refuses a file argument and writes nothing', async () => {
    const r = await spawnCli(process.execPath, [CLI_BIN, 'init', 'my-deal.uwx.md'], { encoding: 'utf8', cwd: temp });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("uwmd init: unexpected argument 'my-deal.uwx.md'");
    expect(r.stderr).toContain('--output my-deal.uwx.md');
    expect(readdirSync(temp)).toEqual([]);
  });

  it('runs the README quick start as written', async () => {
    const init = await spawnCli(process.execPath, [CLI_BIN, 'init', '--output', 'my-deal.uwx.md'], { encoding: 'utf8', cwd: temp });
    expect(init.status).toBe(0);
    const validate = await spawnCli(process.execPath, [CLI_BIN, 'validate', 'my-deal.uwx.md'], { encoding: 'utf8', cwd: temp });
    expect(validate.status).toBe(0);
  });
});

describe('the optional @uwmd/signing peer, when it is not installed', () => {
  // An install with core and verify but no signing: every dependency of the
  // workspace is linked in except @uwmd/signing, and Node resolves through the
  // links (--preserve-symlinks) instead of back into the workspace.
  const repo = resolve(__dirname, '..', '..', '..');
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-nosigning-'));
  const modules = resolve(temp, 'node_modules');
  mkdirSync(resolve(modules, '@uwmd'), { recursive: true });
  for (const entry of readdirSync(resolve(repo, 'node_modules'))) {
    const target = resolve(repo, 'node_modules', entry);
    if (entry === '@uwmd' || entry.startsWith('.') || !statSync(target).isDirectory()) continue;
    symlinkSync(target, resolve(modules, entry), 'junction');
  }
  for (const name of ['core', 'verify']) symlinkSync(resolve(repo, 'packages', `uwmd-${name}`), resolve(modules, '@uwmd', name), 'junction');
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  const run = (args: string[]) => spawnCli(
    process.execPath,
    ['--preserve-symlinks', '--preserve-symlinks-main', resolve(modules, '@uwmd', 'core', 'dist', 'cli.js'), ...args],
    { encoding: 'utf8', cwd: temp },
  );
  const notInstalled = ': the optional @uwmd/signing package is not installed. Install it beside @uwmd/cli (npm i @uwmd/signing)';

  it('still runs commands that do not need it', async () => {
    expect((await run(['verify', FIXTURE, '--integrity'])).status).toBe(0);
  });

  it('names the flag the user passed', async () => {
    const document = await run(['verify', FIXTURE, '--document-signature=sig.json', '--keystore=keys.json']);
    expect(document.status).toBe(1);
    expect(document.stderr).toContain(`--document-signature${notInstalled}`);
    expect(document.stderr).not.toContain('--signing');
    expect(document.stderr).not.toContain('Cannot find package');

    const block = await run(['verify', FIXTURE, '--signing', '--keystore=keys.json']);
    expect(block.status).toBe(1);
    expect(block.stderr).toContain(`--signing${notInstalled}`);
  });

  it('gives sign-document the same message instead of a raw resolver error, and writes nothing', async () => {
    const r = await run(['sign-document', FIXTURE, '--key=signer.json', '--out=signature.json']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`uwmd sign-document${notInstalled}`);
    expect(r.stderr).not.toContain('Cannot find package');
    expect(existsSync(resolve(temp, 'signature.json'))).toBe(false);
  });
});

describe('package verify checks semantic digests (RFC 0018; launch audit D-10)', () => {
  // Through 4.2.0 every stated semantic_digest was reported unverifiable with
  // exit 0, so a member changed under a refreshed byte digest went unnoticed.
  // Starter-tool regression checks, not portable conformance (wiki 09).
  const DEMO = resolve(__dirname, '..', '..', '..', 'examples', 'standalone', 'package', 'standalone-demo.uwpkg.zip');
  const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
  afterAll(() => rmSync(temp, { recursive: true, force: true }));

  async function currentPackage() {
    const bytes=new Uint8Array(readFileSync(CARRIER_FIXTURE));
    const part=new TextEncoder().encode('Synthetic part bytes; no semantic verification is claimed.\n');
    const digest=await computeEnvelopeDigest(toUWEnvelope(parseUWFile(new TextDecoder().decode(bytes))));
    return {
      manifest:{package_version:'1.0' as const,package_id:'pkg:synthetic:current',members:[
        {id:'deal:synthetic',path:'records/synthetic.uwx.md',role:'underwriting' as const,media_type:'text/vnd.uwmd.extended+markdown',sha256:`sha256:${await sha256BytesHex(bytes)}`,semantic_digest:digest},
        {id:'part:synthetic',path:'parts/synthetic.uwpart.md',role:'model_encoding' as const,media_type:'text/vnd.uwmd.part+markdown',sha256:`sha256:${await sha256BytesHex(part)}`},
      ],links:[]},payloads:{'records/synthetic.uwx.md':bytes,'parts/synthetic.uwpart.md':part},
    };
  }

  it('verifies a freshly authored current-subject package, exit 0', async () => {
    const path=resolve(temp,'current.uwpkg.zip');writeFileSync(path,await encodeUWDealPackageZip(await currentPackage()));
    const r = await runCli(['package', 'verify', path]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('VERIFIED - current.uwpkg.zip');
    expect(r.stdout).not.toContain('unverifiable');
    const json = await runCli(['package', 'verify', path, '--json']);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ status: 'verified', errors: [], unverifiable_members: [] });
  });

  it('read-only verification refuses the retained demo package identities without repairing it',async()=>{
    const before=readFileSync(DEMO);const result=await runCli(['package','verify',DEMO,'--json']);
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).errors.map(({code,pointer}: {code:string;pointer:string})=>({code,pointer}))).toEqual([
      {code:'PKGVER-003',pointer:'deal:parkview'},
      {code:'PKGVER-003',pointer:'lease:anchor-tenant'},
      {code:'PKGVER-003',pointer:'note:rent-roll-review'},
    ]);
    expect(readFileSync(DEMO)).toEqual(before);
  });

  it('fails a member whose content changed under a stale semantic digest, exit 1', async () => {
    const decoded = decodeUWDealPackageZip(await encodeUWDealPackageZip(await currentPackage()));
    const member = decoded.manifest.members.find((m) => m.id === 'deal:synthetic')!;
    const text = new TextDecoder().decode(decoded.payloads[member.path]);
    const altered = text.replace('Synthetic current carrier', 'Synthetic altered carrier');
    expect(altered).not.toBe(text);
    decoded.payloads[member.path] = new TextEncoder().encode(altered);
    member.sha256 = `sha256:${await sha256BytesHex(decoded.payloads[member.path]!)}`;
    const stale = resolve(temp, 'stale.uwpkg.zip');
    writeFileSync(stale, await encodeUWDealPackageZip(decoded));

    const r = await runCli(['package', 'verify', stale]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('FAILED - stale.uwpkg.zip');
    expect(r.stdout).toContain('PKGVER-003 [deal:synthetic]');
    const json = await runCli(['package', 'verify', stale, '--json']);
    expect(json.status).toBe(1);
    expect(JSON.parse(json.stdout)).toEqual({
      status: 'failed',
      errors: [expect.objectContaining({ category: 'package', code: 'PKGVER-003', pointer: 'deal:synthetic' })],
      unverifiable_members: [],
    });
  });

  it('reports a digest it cannot compute as unverifiable, not failed, exit 0', async () => {
    // A stated semantic digest on a representation the CLI does not
    // canonicalize (a .uwpart.md fragment) is evidence it cannot check.
    const decoded = decodeUWDealPackageZip(await encodeUWDealPackageZip(await currentPackage()));
    const member = decoded.manifest.members.find((m) => m.id === 'part:synthetic')!;
    expect(member.semantic_digest).toBeUndefined();
    member.semantic_digest = `sha256:${'0'.repeat(64)}`;
    const unchecked = resolve(temp, 'unchecked.uwpkg.zip');
    writeFileSync(unchecked, await encodeUWDealPackageZip(decoded));

    const r = await runCli(['package', 'verify', unchecked]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('UNVERIFIABLE - unchecked.uwpkg.zip');
    expect(r.stdout).toContain('(unverifiable) part:synthetic');
    const json = await runCli(['package', 'verify', unchecked, '--json']);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ status: 'unverifiable', errors: [], unverifiable_members: ['part:synthetic'] });
  });
});
