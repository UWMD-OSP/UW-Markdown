// Release-prepared archives, or explicitly requested published registry versions,
// installed in an empty directory. Never publishes or changes account settings.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RELEASE_PACKAGES } from './release-packages.mjs';
import { changelogReleaseSections, changelogUnreleasedEntries } from './release-state.mjs';

const args = process.argv.slice(2);
const publishedCommit = args[0] === '--published' ? args[1] : null;
assert.ok(args.length === 0 || (args.length === 2 && /^[0-9a-f]{40}$/.test(publishedCommit ?? '')), 'Usage: node scripts/check-prepared-consumers.mjs [--published <release-commit>]');
const root = process.cwd();
const manifest = (dir) => JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
const coreVersion = manifest('packages/uwmd-core').version;
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const section = changelogReleaseSections(changelog).find(value => value.version === coreVersion);
const prepared = section && / - \d{4}-\d{2}-\d{2}$/.test(section.heading)
  && !/^### Released\s*$/m.test(section.body) && changelogUnreleasedEntries(changelog).length === 0;

if (!prepared && !publishedCommit) {
  console.log('[SKIP] No release-prepared generation; ordinary package checks apply.');
} else {
  const sandbox = mkdtempSync(join(tmpdir(), 'uwmd-prepared-consumer-'));
  const npm = process.env.npm_execpath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const prefix = process.env.npm_execpath ? [process.env.npm_execpath] : [];
  try {
    const packed = publishedCommit ? RELEASE_PACKAGES.map(({ name, dir }) => ({ name, version: manifest(dir).version, files: [] })) : JSON.parse(execFileSync(npm, [...prefix, 'pack', '--workspaces', '--ignore-scripts', '--json', '--pack-destination', sandbox], { cwd: root, encoding: 'utf8' }));
    assert.equal(packed.length, RELEASE_PACKAGES.length);
    const expected = Object.fromEntries(RELEASE_PACKAGES.map(({ name, dir }) => [name, manifest(dir).version]));
    for (const archive of packed) {
      assert.equal(archive.version, expected[archive.name]);
      assert.ok(archive.files.every(file => !file.path.startsWith('src/') && !/\.test\.(?:js|d\.ts)(?:\.map)?$/.test(file.path)));
    }
    const registryEvidence = [];
    if (publishedCommit) {
      assert.equal(execFileSync('git', ['cat-file', '-t', `v${coreVersion}`], { encoding: 'utf8' }).trim(), 'tag', 'Publication tag must be annotated');
      const tagCommit = execFileSync('git', ['rev-parse', `v${coreVersion}^{commit}`], { encoding: 'utf8' }).trim();
      assert.equal(tagCommit, publishedCommit, 'Publication tag target changed');
      for (const { name, version } of packed) {
        const endpoint = `https://registry.npmjs.org/${encodeURIComponent(name)}?uwmd_verification=${Date.now()}`;
        const response = await fetch(endpoint, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
        assert.equal(response.status, 200, `${name}: registry unavailable`);
        const packument = await response.json();
        assert.equal(packument.name, name);
        const value = packument.versions?.[version];
        assert.equal(value?.version, version, `${name}@${version}: registry version not visible`);
        assert.equal(packument['dist-tags']?.latest, version, `${name}: latest dist-tag differs`);
        assert.equal(value.gitHead, publishedCommit);
        assert.ok(value.dist?.integrity && value.dist?.shasum && value.dist?.attestations?.url && value.dist?.signatures?.length);
        const tarballUrl = new URL(value.dist.tarball);
        assert.equal(tarballUrl.origin, 'https://registry.npmjs.org');
        const tarball = await fetch(tarballUrl, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
        assert.equal(tarball.status, 200);
        const bytes = Buffer.from(await tarball.arrayBuffer());
        assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, value.dist.integrity);
        assert.equal(createHash('sha1').update(bytes).digest('hex'), value.dist.shasum);
        const attestationUrl = new URL(value.dist.attestations.url);
        assert.equal(attestationUrl.origin, 'https://registry.npmjs.org');
        const attestationResponse = await fetch(attestationUrl, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
        assert.equal(attestationResponse.status, 200);
        const attestations = await attestationResponse.json();
        registryEvidence.push({ name, version, latest: packument['dist-tags'].latest, gitHead: value.gitHead, dependencies: value.dependencies ?? {}, engines: value.engines ?? {}, dist: value.dist, tarball_bytes: bytes.length, attestations });
      }
      writeFileSync(join(root, 'publication-registry-evidence.json'), JSON.stringify({ observed_at: new Date().toISOString(), release_commit: publishedCommit, packages: registryEvidence }, null, 2));
    }
    writeFileSync(join(sandbox, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    const typescriptVersion = JSON.parse(readFileSync('node_modules/typescript/package.json', 'utf8')).version;
    const nodeTypesVersion = JSON.parse(readFileSync('node_modules/@types/node/package.json', 'utf8')).version;
    execFileSync(npm, [...prefix, 'install', '--ignore-scripts', '--no-audit', '--no-fund', ...(publishedCommit ? ['--prefer-online', ...packed.map(value => `${value.name}@${value.version}`)] : packed.map(value => join(sandbox, value.filename))), `typescript@${typescriptVersion}`, `@types/node@${nodeTypesVersion}`], { cwd: sandbox, stdio: 'inherit' });
    for (const [name, version] of Object.entries(expected)) {
      const installed = JSON.parse(readFileSync(join(sandbox, 'node_modules', name, 'package.json'), 'utf8'));
      assert.equal(installed.version, version);
      for (const [dependency, pin] of Object.entries(installed.dependencies ?? {})) {
        if (Object.hasOwn(expected, dependency)) assert.equal(pin, expected[dependency], `${name}: incompatible dependency ${dependency}`);
      }
    }
    if (publishedCommit) {
      const signatures = execFileSync(npm, [...prefix, 'audit', 'signatures'], { cwd: sandbox, encoding: 'utf8' });
      console.log(signatures);
      writeFileSync(join(root, 'publication-signatures.log'), signatures);
    }
    writeFileSync(join(sandbox, 'consumer.ts'), `import * as verify from '@uwmd/verify';
import * as verifyBrowser from '@uwmd/verify/browser';
import * as core from '@uwmd/core';
import * as coreBrowser from '@uwmd/core/browser';
import * as signing from '@uwmd/signing';
import * as batch from '@uwmd/batch';
import * as excel from '@uwmd/excel';
import * as report from '@uwmd/report';
import * as lake from '@uwmd/lake';
export const apis = [verify, verifyBrowser, core, coreBrowser, signing, batch, excel, report, lake];
`);
    execFileSync(process.execPath, [join(sandbox, 'node_modules/typescript/bin/tsc'), '--strict', '--skipLibCheck', 'false', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.ts'], { cwd: sandbox, stdio: 'inherit' });
    writeFileSync(join(sandbox, 'smoke.mjs'), `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as verify from '@uwmd/verify';
import * as core from '@uwmd/core';
import { toWorkbook } from '@uwmd/excel';
import { generateReport } from '@uwmd/report';
import { generateSigningKeyPair, signDocument, InMemoryKeyStore, createDocumentSignatureVerifier } from '@uwmd/signing';
const source = readFileSync(process.argv[2], 'utf8');
const receipt = await core.issueReceipt(source);
assert.equal(receipt.computation.engine, '@uwmd/verify');
assert.equal(receipt.computation.engine_version, ${JSON.stringify(expected['@uwmd/verify'])});
assert.equal((await verify.verifyReceipt(receipt, source)).verdict, 'verified');
const edited = structuredClone(receipt); edited.computation.results[0].value += 0.01;
assert.equal((await verify.verifyReceipt(edited, source)).verdict, 'failed');
edited.computation.engine_version = '0.0.0';
const cross = await verify.verifyReceipt(edited, source);
assert.equal(cross.verdict, 'unverifiable'); assert.ok(cross.issues.some(value => value.code === 'RCP-07'));
const wb = await toWorkbook(core.parseUWFile(source)); assert.ok((await wb.xlsx.writeBuffer()).byteLength > 0);
const html = await generateReport(core.parseUWFile(source), { format: 'html' }); assert.ok(html.bytes.byteLength > 0);
const { signing, verifying } = await generateSigningKeyPair('ed25519', 'prepared-consumer');
const signature = await signDocument(source, signing);
assert.equal((await verify.verifyDocumentSignature(source, signature, { signatureVerifier: createDocumentSignatureVerifier(new InMemoryKeyStore([verifying])) })).state, 'verified');
console.log('PASS packaged receipt states, XLSX serialization, HTML report and document authentication; no spreadsheet recalculation claim');
`);
    execFileSync(process.execPath, [join(sandbox, 'smoke.mjs'), resolve('examples/Parkview-Apts-Glendale-AZ.uwx.md')], { cwd: sandbox, stdio: 'inherit' });
    const version = execFileSync(process.execPath, [join(sandbox, 'node_modules/@uwmd/cli/bin/uwmd.mjs'), '--version'], { cwd: sandbox, encoding: 'utf8' });
    assert.ok(version.includes(coreVersion));
    assert.ok(version.includes(expected['@uwmd/verify']));
    if (publishedCommit) {
      execFileSync('python3', ['conformance/runner/runner.py', '--impl', `${process.execPath} ${join(sandbox, 'node_modules/@uwmd/cli/bin/uwmd.mjs')}`, '--no-skip', '--manifest-out', 'publication-cli-conformance.json'], { cwd: root, stdio: 'inherit' });
    }
    console.log(`[PASS] ${packed.length} ${publishedCommit ? 'exact published registry versions' : 'actual archives'} installed outside the workspace; strict root/browser declarations, CLI and public APIs passed.`);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}
