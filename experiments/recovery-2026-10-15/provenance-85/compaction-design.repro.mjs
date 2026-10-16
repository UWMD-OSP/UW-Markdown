// Read-only design evidence using existing APIs; no proposed verifier/transform implemented.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = resolve(process.argv[2] ?? '.');
const core = await import(pathToFileURL(join(repo, 'packages/uwmd-core/dist/index.js')));
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const raw = readFileSync(join(repo, 'conformance/documents/fixtures/01-minimal-screening.uwx.md'));
const text = raw.toString('utf8');
const parsed = core.parseUWFile(text);
assert.equal(Object.values(parsed.superseded).flat().length, 0);
const subject = await core.resolveDocumentSigningSubject(text);
// No-history case: the proposed transform leaves the bytes unchanged.
const carrier = JSON.stringify({
  kind: 'uwmd-history-projection',
  projection_version: '1',
  authority: 'projection',
  source: { raw_sha256: hash(raw), semantic_subject: subject },
  view: { transform: 'omit-superseded/1', encoding: 'base64', bytes: raw.toString('base64'), raw_sha256: hash(raw) },
}, null, 2);
const refusal = (reader, input) => {
  let code;
  try { reader(input); } catch (error) { code = error.code; }
  assert.ok(code, 'Existing reader must refuse the whole projection carrier');
  return code;
};
const markdownCode = refusal(core.parseUWFile, carrier);
const jsonCode = refusal(core.parseUWJson, carrier);
assert.equal(markdownCode, 'UNSUPPORTED_FORMAT_VERSION');
assert.equal(jsonCode, 'ENVELOPE_UNSUPPORTED_VERSION');
// These APIs take content, not a suffix: renaming cannot change these refusals.
const markedRecord = text.replace('uw_version:', 'history_projection: true\nuw_version:');
assert.equal(core.parseUWFile(markedRecord).frontmatter.uw_version, '3.0');
const crlf = text.replace(/\r?\n/g, '\r\n');
assert.notEqual(hash(raw), hash(Buffer.from(crlf)));
assert.deepEqual(await core.resolveDocumentSigningSubject(crlf), subject);
const historical = readFileSync(join(repo, 'examples/parkview-after-L6.uwx.md'), 'utf8');
const historyParsed = core.parseUWFile(historical);
assert.ok(Object.values(historyParsed.superseded).flat().length > 0);
const dropped = core.toUWEnvelope(historyParsed, { includeSuperseded: false });
assert.deepEqual(core.parseUWJson(JSON.stringify(dropped)).superseded, {});
assert.equal(historyParsed.raw, historical);
assert.equal(readFileSync(join(repo, 'conformance/documents/fixtures/01-minimal-screening.uwx.md')).equals(raw), true);
process.stdout.write(`${JSON.stringify({
  scope: 'Existing-reader boundary and identity observations only; no new capability implementation',
  source_commit: process.argv[3] ?? 'caller must record exact built-source commit',
  observations: {
    whole_projection_markdown_refusal: markdownCode,
    whole_projection_uw_json_refusal: jsonCode,
    ignored_frontmatter_marker_still_reads_as_format: '3.0',
    renamed_suffix_changes_neither_content_reader: true,
    crlf_raw_identity_differs_but_guarded_semantic_subject_matches: true,
    legacy_history_omitting_envelope_still_accepted: true,
    source_bytes_unchanged: true,
  },
  limitations: ['Not an independent reader implementation', 'No new projection verification, archive linking, states or conformance expectations implemented', 'No signature backend or financial computation exercised'],
}, null, 2)}\n`);
