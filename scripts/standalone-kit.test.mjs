// Current standalone validation/composition/package controls; no legacy freeze.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseUWFile, validateUWFile, parseUWPart, resolveComposition, toUWEnvelope,
  canonicalizeUWEnvelope, computeEnvelopeDigest, decodeUWDealPackageZip,
  encodeUWDealPackageZip, verifyUWDealPackage, projectUWDealPackageContext,
  validateUWDealPackageContext,
} from '../packages/uwmd-verify/dist/index.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const historical = join(root, 'examples/standalone');
const current = join(historical, 'authored-2026-10-17');
const read = path => readFileSync(path, 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const declarations = json(join(current, 'declarations.json'));
const files = ['lease-abstract-v1', 'source-note-v1', 'inline-deal', 'externalized-deal'];

test('six explicit authored review/lifecycle declarations match actual canonical blocks and one-line reasons', () => {
  assert.equal(declarations.top_level_blocks.length, 6);
  assert.deepEqual(declarations.top_level_blocks.map(x => x.human_review_required), [true, true, false, true, false, true]);
  assert.ok(declarations.top_level_blocks.every(x => x.superseded === false));
  for (const file of files) {
    const source = read(join(current, `${file}.uwx.md`));
    const parsed = parseUWFile(source);
    const expected = declarations.top_level_blocks.filter(x => x.file === `${file}.uwx.md`);
    assert.equal(Object.keys(parsed.sections).length, expected.length);
    for (const row of expected) {
      const block = parsed.sections[row.section];
      assert.equal(block.content._meta, block.meta);
      assert.equal(block.meta.quality.human_review_required, row.human_review_required);
      assert.equal(block.meta.lifecycle.superseded, row.superseded);
      assert.equal(block.meta.lifecycle.revision, 1);
      assert.equal(block.meta.provenance.actor, declarations.author);
      assert.equal(block.meta.provenance.timestamp, declarations.authored_at);
      assert.equal(block.meta.provenance.notes, row.reason);
      assert.ok(row.reason.length > 30 && !row.reason.includes('\n'));
    }
    assert.deepEqual(validateUWFile(parsed).errors, []);
  }
});

test('new positive declarations do not infer review from narrative and retain strict missing-boolean errors', () => {
  for (const file of files) {
    for (const [group, field, code] of [['quality', 'human_review_required', 'META-02'], ['lifecycle', 'superseded', 'META-03']]) {
      const parsed = parseUWFile(read(join(current, `${file}.uwx.md`)));
      const first = Object.values(parsed.sections)[0];
      delete first.content._meta[group][field];
      const issues = validateUWFile(parsed).errors;
      assert.deepEqual(issues.map(x => x.code), [code]);
      assert.equal(issues[0].field, `_meta.${group}.${field}`);
    }
  }
});

test('missing review declarations on every current block retain independent errors', () => {
  for (const [index, file] of files.entries()) {
    const parsed = parseUWFile(read(join(current, `${file}.uwx.md`)));
    for (const block of Object.values(parsed.sections)) delete block.content._meta.quality.human_review_required;
    const errors = validateUWFile(parsed).errors;
    assert.equal(errors.length, index < 2 ? 1 : 2);
    assert.ok(errors.every(x => x.code === 'META-02' && x.severity === 'error' && x.field === '_meta.quality.human_review_required'));
  }
});

test('actual CLI accepts all four NEW positives without changing their sources', () => {
  for (const file of files) {
    const path = join(current, `${file}.uwx.md`);
    const before = readFileSync(path);
    const result = spawnSync(process.execPath, [join(root, 'packages/uwmd-cli/bin/uwmd.mjs'), 'validate', path, '--json'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const response = JSON.parse(result.stdout);
    assert.deepEqual(response.errors, []);
    for (const [key, severity] of [['errors', 'error'], ['warnings', 'warning'], ['info', 'info']]) assert.deepEqual(response[key], response.issues.filter(x => x.severity === severity));
    assert.deepEqual(readFileSync(path), before);
  }
});

test('new part identities and metadata are complete; full resolved inline/external models and digests match', async () => {
  const parts = new Map();
  for (const file of readdirSync(join(current, 'parts'))) {
    const parsed = parseUWFile(read(join(current, 'parts', file)));
    const part = parseUWPart(parsed);
    assert.ok(part.part_id.startsWith('authored-2026-10-17-'));
    assert.deepEqual(validateUWFile(parsed).errors, []);
    for (const block of part.blocks) {
      assert.equal(typeof block.meta.quality.human_review_required, 'boolean');
      assert.equal(block.meta.lifecycle.superseded, false);
    }
    parts.set(part.part_id, part);
  }
  assert.equal(parts.size, 5);
  const inline = parseUWFile(read(join(current, 'inline-deal.uwx.md')));
  const external = parseUWFile(read(join(current, 'externalized-deal.uwx.md')));
  assert.equal(inline.frontmatter.deal_id, declarations.logical_deal_id);
  assert.equal(external.frontmatter.deal_id, declarations.logical_deal_id);
  const resolved = resolveComposition(external, { parts });
  assert.equal(resolved.status, 'resolved');
  assert.equal(canonicalizeUWEnvelope(toUWEnvelope(resolved.document)), canonicalizeUWEnvelope(toUWEnvelope(inline)));
  assert.equal(await computeEnvelopeDigest(toUWEnvelope(resolved.document)), await computeEnvelopeDigest(toUWEnvelope(inline)));
  assert.deepEqual(validateUWFile(resolved.document).errors, []);
});

test('new ZIP covers each new artifact identity and exact copy, verifies all semantic digests and preserves source boundary', async () => {
  const raw = readFileSync(join(current, 'package/standalone-authored.uwpkg.zip'));
  const decoded = decodeUWDealPackageZip(raw);
  const manifest = json(join(current, 'package/manifest.json'));
  assert.deepEqual(decoded.manifest, manifest);
  assert.equal(manifest.package_id, declarations.package_id);
  assert.equal(manifest.members.length, 10);
  assert.equal(new Set(manifest.members.map(x => x.id)).size, 10);
  for (const member of manifest.members) {
    assert.deepEqual(Buffer.from(decoded.payloads[member.path]), readFileSync(join(current, 'package', member.path)));
    assert.equal(member.sha256, `sha256:${sha(decoded.payloads[member.path])}`);
    if (member.path.startsWith('records/')) {
      const file = member.path.slice(8);
      assert.deepEqual(readFileSync(join(current, file)), readFileSync(join(current, 'package', member.path)));
      assert.equal(member.id, declarations.top_level_blocks.find(x => x.file === file).member_id);
    }
  }
  const verified = await verifyUWDealPackage(decoded, { semanticDigestOf: async (_id, bytes) => computeEnvelopeDigest(toUWEnvelope(parseUWFile(new TextDecoder().decode(bytes)))) });
  assert.deepEqual(verified, { status: 'verified', errors: [], unverifiable_members: [] });
  const native = await encodeUWDealPackageZip(decoded);
  assert.deepEqual(await encodeUWDealPackageZip(decoded), native);
  const roundtrip = decodeUWDealPackageZip(native);
  assert.deepEqual(roundtrip.manifest, decoded.manifest);
  assert.deepEqual(roundtrip.payloads, decoded.payloads);
  const contents = Object.fromEntries(manifest.members.filter(x => x.role !== 'source_evidence').map(x => [x.id, new TextDecoder().decode(decoded.payloads[x.path])]));
  const context = projectUWDealPackageContext(manifest, { contents });
  assert.deepEqual(validateUWDealPackageContext(context), []);
  const source = manifest.members.find(x => x.role === 'source_evidence');
  assert.deepEqual(context.source_evidence[source.id], { status: 'not_transferred' });
  assert.equal(JSON.stringify(context).includes(new TextDecoder().decode(decoded.payloads[source.path])), false);
});
