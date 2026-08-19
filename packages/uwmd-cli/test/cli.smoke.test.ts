import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, it, expect } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '..', 'bin', 'uwmd.mjs');
const FIXTURE = resolve(__dirname, '..', '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md');
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
] as const;

function exampleFixture(filename: string) {
  return resolve(__dirname, '..', '..', '..', 'examples', filename);
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: 'utf8' });
}

function runCliBinary(args: string[]) {
  return spawnSync(process.execPath, [CLI_BIN, ...args]);
}

describe('uwmd CLI', () => {
  it('prints help on --help with exit code 0', () => {
    const r = runCli(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/uwmd/i);
  });

  it('parses the bundled Parkview fixture to JSON on stdout', () => {
    const r = runCli(['parse', FIXTURE]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toMatchObject({
      frontmatter: expect.any(Object),

      sections: expect.any(Object),
    });
  });

  it('parses a UW Lite document with typed anchored fields', () => {
    const r = runCli(['parse', LITE_FIXTURE]);
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

  it('validates a UW Lite document without treating it as UWX', () => {
    const r = runCli(['validate', LITE_FIXTURE, '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({
      representation: 'uw-lite-markdown',
      overall_status: 'clean',
      issues: [],
    });
  });

  it('compiles UW Lite to structured UWX on stdout', () => {
    const r = runCli(['convert', LITE_FIXTURE, '--to', 'uwx', '--stdout']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('```json uw:section=valuation');
    expect(r.stdout).toContain('"purchase_price": 12500000');
    expect(r.stdout).toContain('```json uw:section=x_uw_lite_source');
  });

  describe('the shipped UW Lite example', () => {
    it('validates clean', () => {
      const r = runCli(['validate', LITE_EXAMPLE, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        representation: 'uw-lite-markdown',
        overall_status: 'clean',
        issues: [],
      });
    });

    it('carries the same inputs as its .uwx.md twin', () => {
      const r = runCli(['convert', LITE_EXAMPLE, '--to', 'uwx', '--stdout']);
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
    it('derives the metrics its prose quotes', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-lite-example-'));
      try {
        const compiled = resolve(temp, 'compiled.uwx.md');
        expect(
          runCli(['convert', LITE_EXAMPLE, '--to', 'uwx', '--output', compiled]).status,
        ).toBe(0);

        const cases: Array<[string, string]> = [
          ['noi_model.net_operating_income / debt_structure.annual_debt_service', '1.1091'],
          ['debt_structure.loan_amount / valuation.purchase_price', '0.7000'],
          ['noi_model.net_operating_income / valuation.purchase_price', '0.0551'],
          ['noi_model.net_operating_income / debt_structure.loan_amount', '0.0787'],
        ];

        for (const [formula, expected] of cases) {
          const calcPath = resolve(temp, 'calc.json');
          writeFileSync(calcPath, JSON.stringify({ formula }));
          const r = runCli(['calc', compiled, calcPath]);
          expect(r.status).toBe(0);
          expect(r.stdout).toContain(expected);
        }
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  });

  it('writes an explicit omission report for lossy UWX-to-Lite projection', () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-lite-'));
    try {
      const reportPath = resolve(temp, 'projection.json');
      const r = runCli([
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

    it('validates conforming manifests and exits 0', () => {
      const r = runCli([
        'modules', 'validate',
        moduleFixture('accept', '01-minimal.module.json'),
        moduleFixture('accept', '02-full-surface.module.json'),
        '--tier', 'tier-4-agent-host',
      ]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('2/2 manifest(s) loaded');
    });

    it('exits non-zero and points at the failing declaration', () => {
      const r = runCli([
        'modules', 'validate',
        moduleFixture('reject', '02-agent-layer-malformed.module.json'),
      ]);
      expect(r.status).toBe(1);
      // The pointer is what makes the output actionable.
      expect(r.stdout).toContain('agent_layers[0].prompt_template');
      expect(r.stdout).toContain('PROTO-MOD-060');
    });

    it('lists the registry that a set of manifests forms', () => {
      const r = runCli([
        'modules', 'list',
        moduleFixture('accept', '02-full-surface.module.json'),
        '--tier', 'tier-4-agent-host',
        '--json',
      ]);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout).modules).toEqual([
        expect.objectContaining({
          id: 'org.uwmd.full-surface',
          calculations: 1,
          agent_layers: 1,
          asset_classes: ['multifamily', 'student_housing'],
        }),
      ]);
    });

    it('refuses to list a registry it could not build', () => {
      const r = runCli([
        'modules', 'list',
        moduleFixture('reject', '01-unknown-top-level-key.module.json'),
      ]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Registry refused to load');
    });
  });

  describe('deal packages (RFC 0018)', () => {
    const buildPackage = (temp: string) => {
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
      expect(runCli(['package', 'create', manifestPath, '--output', zipPath]).status).toBe(0);
      return { manifestPath, zipPath };
    };

    it('creates, lists, and verifies a package', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { zipPath } = buildPackage(temp);
        const list = runCli(['package', 'list', zipPath, '--json']);
        expect(list.status).toBe(0);
        expect(JSON.parse(list.stdout).members).toHaveLength(2);

        const verify = runCli(['package', 'verify', zipPath, '--json']);
        expect(verify.status).toBe(0);
        expect(JSON.parse(verify.stdout).status).toBe('verified');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    // The rule the context view exists to enforce.
    it('never inlines source-evidence bytes into a context view', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { zipPath } = buildPackage(temp);
        const ctx = runCli(['package', 'to-context', zipPath, '--stdout']);
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

    it('projects only entity-layer links, with synthesized provenance', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { zipPath } = buildPackage(temp);
        const edges = JSON.parse(runCli(['package', 'edges', zipPath]).stdout);
        expect(edges).toHaveLength(1);
        expect(edges[0].type).toBe('guarantees');
        expect(edges[0].provenance[0].source).toBe('pkg:smoke:1');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('exits non-zero when a member no longer matches the manifest', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-pkg-'));
      try {
        const { manifestPath, zipPath } = buildPackage(temp);
        // Change the payload after the manifest was written: encoding must refuse.
        writeFileSync(resolve(temp, 'records', 'deal.uwx.md'), 'tampered\n', 'utf8');
        const rebuilt = runCli(['package', 'create', manifestPath, '--output', zipPath]);
        expect(rebuilt.status).toBe(1);
        expect(rebuilt.stderr).toContain('digest does not match');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  });

  it('validates the bundled fixture without errors', () => {
    const r = runCli(['validate', FIXTURE]);
    expect(r.status).toBe(0);
  });

  describe.each(ASSET_CLASS_FIXTURES)('%s example', (assetClass, filename) => {
    const fixture = exampleFixture(filename);

    it('resolves scope with its registered default table', () => {
      const r = runCli(['scope', fixture, '--json']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        asset_class: assetClass,
        defaults_table: `${assetClass}@1.0.0`,
      });
    });

    it('ranks refinement gaps as JSON', () => {
      const r = runCli(['refine', fixture, '--json']);
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

    it('exports a document envelope that retains the asset class', () => {
      const r = runCli(['export', fixture, '--stdout']);
      expect(r.status).toBe(0);
      expect(JSON.parse(r.stdout)).toMatchObject({
        frontmatter: { asset_class: assetClass },
        semantic_digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      });
    });
  });

  it('exports a digested UW Document Envelope to stdout', () => {
    const r = runCli(['export', FIXTURE, '--stdout']);
    expect(r.status).toBe(0);
    const exported = JSON.parse(r.stdout);
    expect(exported.envelope_version).toBe('1.0');
    expect(exported.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exported).not.toHaveProperty('uwjson_version');
    expect(exported).not.toHaveProperty('prose');
  });

  it('exports a UW Lite document as a digested UW Document Envelope', () => {
    const r = runCli(['export', LITE_FIXTURE, '--stdout']);
    expect(r.status).toBe(0);
    const exported = JSON.parse(r.stdout);
    expect(exported.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(exported.sections.valuation.content.purchase_price).toBe(12_500_000);
    expect(exported.extensions.x_uw_lite_source.content.markdown).toContain(
      '# Acquisition',
    );
  });

  it('converts Markdown to deterministic UW XML on stdout', () => {
    const r = runCli(['convert', FIXTURE, '--to', 'uw-xml', '--stdout']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(r.stdout).toContain('<uw:document xmlns:uw="https://uwmd.org/ns/document/1"');
    expect(r.stdout).toMatch(/<uw:semantic_digest uw:type="string">sha256:[0-9a-f]{64}<\/uw:semantic_digest>/);
  });

  it('converts verified UW XML back to UW JSON', () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-'));
    try {
      const xml = runCli(['convert', FIXTURE, '--to', 'xml', '--stdout']);
      expect(xml.status).toBe(0);
      const xmlPath = resolve(temp, 'deal.uw.xml');
      writeFileSync(xmlPath, xml.stdout, 'utf8');
      const json = runCli(['convert', xmlPath, '--to', 'json', '--stdout']);
      expect(json.status).toBe(0);
      const envelope = JSON.parse(json.stdout);
      expect(envelope.envelope_version).toBe('1.0');
      expect(envelope.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('converts Markdown to a CSV bundle ZIP and back to verified JSON', () => {
    const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-csv-'));
    try {
      const zip = runCliBinary(['convert', FIXTURE, '--to', 'csv', '--stdout']);
      expect(zip.status).toBe(0);
      expect(zip.stdout.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      const zipPath = resolve(temp, 'deal.uw.csv.zip');
      writeFileSync(zipPath, zip.stdout);
      const json = runCli(['convert', zipPath, '--to', 'json', '--stdout']);
      expect(json.status).toBe(0);
      const envelope = JSON.parse(json.stdout);
      expect(envelope.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('lists registered representations for API discovery', () => {
    const r = runCli(['formats', '--json']);
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
  it('exits non-zero on a missing file', () => {
    const r = runCli(['parse', resolve(__dirname, 'this-file-does-not-exist.uw.md')]);
    expect(r.status).not.toBe(0);
  });

  // Default output paths were entirely untested, which is how all three of the
  // bugs below survived the .uwx.md migration. They are user-visible filenames,
  // so they are worth pinning.
  describe('default output paths use .uwx.md', () => {
    it('init writes .uwx.md, not the legacy .uw.md', () => {
      // `generateBlankUWFile()` emits structured UWX content. Writing it to
      // .uw.md created exactly the file the format spec forbids — and every
      // deal a newcomer scaffolded was born legacy.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-'));
      try {
        const r = spawnSync(process.execPath, [CLI_BIN, 'init'], { encoding: 'utf8', cwd: temp });
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

    it('init --name derives a .uwx.md filename', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-init-name-'));
      try {
        const r = spawnSync(process.execPath, [CLI_BIN, 'init', '--name', 'Cedar Court'], {
          encoding: 'utf8',
          cwd: temp,
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('cedar-court.uwx.md');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('export replaces the .uwx.md suffix rather than appending to it', () => {
      // Regression: `replaceUWExtension` did not list .uwx.md, so a UWX input
      // fell through to the append branch and produced deal.uwx.md.uw.json.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-export-'));
      try {
        const dealPath = resolve(temp, 'deal.uwx.md');
        writeFileSync(dealPath, readFileSync(FIXTURE, 'utf8'), 'utf8');
        const r = runCli(['export', dealPath]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('deal.uw.json');
        expect(r.stdout).not.toContain('deal.uwx.md.uw.json');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('report replaces the .uwx.md suffix rather than appending to it', () => {
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-report-'));
      try {
        const dealPath = resolve(temp, 'deal.uwx.md');
        writeFileSync(dealPath, readFileSync(FIXTURE, 'utf8'), 'utf8');
        const r = runCli(['report', dealPath]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('deal.report.html');
        expect(r.stdout).not.toContain('deal.uwx.md.report.html');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });

    it('still resolves output paths for a legacy structured .uw.md input', () => {
      // RFC 0017 keeps legacy structured .uw.md readable. Fixing the UWX case
      // must not break the path it replaced.
      const temp = mkdtempSync(resolve(tmpdir(), 'uwmd-cli-legacy-'));
      try {
        const dealPath = resolve(temp, 'legacy.uw.md');
        writeFileSync(dealPath, readFileSync(FIXTURE, 'utf8'), 'utf8');
        const r = runCli(['export', dealPath]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('legacy.uw.json');
        expect(r.stdout).not.toContain('legacy.uw.md.uw.json');
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
    });
  });
});

describe('composition — compose, resolve, and --resolved (RFC 0021)', () => {
  const INLINE = resolve(
    __dirname,
    '..',
    '..',
    '..',
    'conformance',
    'composition',
    'resolve',
    'inline-vs-external',
    'inline.uwx.md',
  );

  /** A scratch copy of the inline record, externalized in place. */
  function externalized(): { dir: string; record: string } {
    const dir = mkdtempSync(resolve(tmpdir(), 'uwmd-compose-'));
    const record = resolve(dir, 'deal.uwx.md');
    writeFileSync(record, readFileSync(INLINE, 'utf8'), 'utf8');
    const out = runCli(['compose', record, '--externalize', 'rent_roll', '--part-prefix', 'lease-suite', '--in-place']);
    expect(out.status).toBe(0);
    return { dir, record };
  }

  it('compose splits a section into fragments and leaves a directive', () => {
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

  it('resolve reassembles the record without moving its digest', () => {
    const { dir, record } = externalized();
    try {
      const roundTrip = resolve(dir, 'roundtrip.uwx.md');
      const out = runCli(['resolve', record, '--output', roundTrip]);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('RESOLVED');

      // The claim `compose` prints to the user, checked rather than asserted.
      const a = runCli(['export', INLINE, '--stdout']);
      const b = runCli(['export', roundTrip, '--stdout']);
      expect(a.status).toBe(0);
      expect(b.status).toBe(0);
      expect(JSON.parse(b.stdout).digest).toBe(JSON.parse(a.stdout).digest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolve refuses, and does not under-resolve, when a fragment is missing', () => {
    const { dir, record } = externalized();
    try {
      rmSync(resolve(dir, 'parts', 'lease-suite-220.uwpart.md'));
      const out = runCli(['resolve', record, '--json']);
      expect(out.status).toBe(1);
      const report = JSON.parse(out.stdout);
      expect(report.status).toBe('unresolved');
      expect(report.issues.map((i: { code: string }) => i.code)).toContain('COMP-UNRESOLVED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('export --resolved inlines the rows; without it the directive survives', () => {
    const { dir, record } = externalized();
    try {
      const resolved = runCli(['export', record, '--resolved', '--stdout']);
      expect(resolved.status).toBe(0);
      const withRows = JSON.parse(resolved.stdout);
      const section = withRows.sections.rent_roll.content ?? withRows.sections.rent_roll;
      expect(Array.isArray(section.units)).toBe(true);
      expect(section.units).toHaveLength(3);
      expect(section.external).toBeUndefined();

      const plain = runCli(['export', record, '--stdout']);
      expect(plain.status).toBe(0);
      const asStored = JSON.parse(plain.stdout);
      const stored = asStored.sections.rent_roll.content ?? asStored.sections.rent_roll;
      expect(stored.external).toBeDefined();
      expect(stored.units).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('verify --resolved and export --resolved refuse a record they cannot assemble', () => {
    const { dir, record } = externalized();
    try {
      rmSync(resolve(dir, 'parts', 'lease-suite-220.uwpart.md'));

      const verified = runCli(['verify', record, '--resolved']);
      expect(verified.status).toBe(1);
      expect(verified.stderr).toContain('COMP-UNRESOLVED');

      const leaked = resolve(dir, 'leaked.uw.json');
      const exported = runCli(['export', record, '--resolved', '--output', leaked]);
      expect(exported.status).toBe(1);
      // Refusing must not leave a half-answer on disk.
      expect(existsSync(leaked)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
