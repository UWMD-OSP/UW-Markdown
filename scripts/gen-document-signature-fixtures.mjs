#!/usr/bin/env node
// Synthetic RFC 0084 vectors. The published conformance key is test-only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { parseUWFile, computeBlockHash, documentSigningPayload } from '../packages/uwmd-verify/dist/index.js';
import { importPrivateKey, signBlock, signDocument } from '../packages/uwmd-signing/dist/index.js';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'conformance/document-signatures');
const SIGNING = join(ROOT, 'conformance/signing');
const jwk = JSON.parse(readFileSync(join(SIGNING, 'keys/signer-private.jwk.json'), 'utf8'));
const key = { kid: 'uwmd-conformance-ed25519', alg: 'ed25519', privateKey: await importPrivateKey('ed25519', { jwk }) };
const sample = parseUWFile(readFileSync(join(SIGNING, 'blocks/01-signed-valid/deal.uwx.md'), 'utf8')).sections.property;
const at = '2026-10-14T00:00:00Z';
async function block(variant, revenue, superseded, revision, parentHash = null) {
  const meta = structuredClone(sample.meta);
  meta.section = 'operating_statement'; meta.lifecycle = { ...meta.lifecycle, superseded, revision };
  meta.provenance.actor = 'synthetic-analyst'; meta.integrity = { parent_hash: parentHash };
  const content = { _meta: meta, total_revenue: revenue };
  const b = { ...sample, meta, content, annotation: { section: meta.section, variant, superseded }, prose: '' };
  meta.integrity.content_hash = await computeBlockHash(b);
  meta.integrity.signature = await signBlock(b, key, { signedAt: at });
  return { variant, meta, content };
}
function render(b) { return `\`\`\`json uw:section=operating_statement variant=${b.variant} superseded=${b.meta.lifecycle.superseded}\n${JSON.stringify(b.content, null, 2)}\n\`\`\`\n`; }
const historical = await block('t12', 900000, true, 1);
const current = await block('t12', 1000000, false, 2, historical.meta.integrity.content_hash);
const budget = await block('budget', 1200000, false, 1);
const foreign = await block('budget', 1400000, false, 1);
const front = '---\nuw_version: "3.0"\ndeal_name: Synthetic document authentication fixture\n---\n\n';
const source = rows => front + rows.map(render).join('\n');
const valid = source([historical, current, budget]);
const signature = await signDocument(valid, key, { signedAt: at });
const old = structuredClone(historical);
const active = structuredClone(current);
old.meta.lifecycle.superseded = false; old.content._meta = old.meta;
active.meta.lifecycle.superseded = true; active.content._meta = active.meta;
const rows = [
  ['01-valid', valid, signature, 'verified', undefined],
  ['02-relabel', source([historical, { ...current, variant: 'budget' }, { ...budget, variant: 't12' }]), signature, 'failed', 'subject_mismatch'],
  ['03-flip', source([old, active, budget]), signature, 'failed', 'subject_mismatch'],
  ['04-splice', source([historical, current, foreign]), signature, 'failed', 'subject_mismatch'],
  ['05-delete-history', source([current, budget]), signature, 'failed', 'subject_mismatch'],
  ['06-frontmatter', valid.replace('Synthetic document', 'Changed document'), signature, 'failed', 'subject_mismatch'],
  ['07-cosmetic', valid.replace(/^ +/gm, spaces => `${spaces}${spaces}`), signature, 'verified', undefined],
  ['08-missing', valid, null, 'unsigned', 'missing_signature'],
  ['09-unknown-key', valid, signature, 'unverifiable', 'unknown_kid', 'empty'],
  ['10-padded', valid, { ...signature, sig: `${signature.sig}=` }, 'failed', 'malformed'],
  ['11-time-edited', valid, { ...signature, signed_at: '2026-10-15T00:00:00Z' }, 'failed', 'bad_signature'],
  ['12-unsupported-version', valid, { ...signature, signature_version: '2' }, 'unverifiable', 'unsupported_version'],
  ['13-duplicate-active', valid + render(current), signature, 'failed', 'malformed_source'],
  ['14-no-backend', valid, signature, 'unverifiable', 'no_backend', 'none'],
  ['15-retained-prose', valid.replace('```json', 'Changed retained narrative.\n```json'), signature, 'failed', 'subject_mismatch'],
];
for (const [id, raw, artifact, state, reason, backend = 'trusted'] of rows) {
  const dir = join(DIR, id); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'deal.uwx.md'), raw);
  writeFileSync(join(dir, 'signature.json'), `${JSON.stringify(artifact, null, 2)}\n`);
  const expected = { state, ...(reason ? { reason } : {}), backend };
  writeFileSync(join(dir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
  if (backend !== 'none') writeFileSync(join(dir, 'cli.expected.json'), `${JSON.stringify({
    ok: state === 'verified', integrity: { document_signature: { state, ...(reason ? { reason } : {}) } },
  }, null, 2)}\n`);
}
mkdirSync(join(DIR, 'keys'), { recursive: true });
writeFileSync(join(DIR, 'keys/keystore.json'), readFileSync(join(SIGNING, 'keys/keystore.json')));
writeFileSync(join(DIR, 'keys/empty.json'), `${JSON.stringify({ keystore_version: '1', keys: [] }, null, 2)}\n`);
writeFileSync(join(DIR, 'keys/signer.json'), `${JSON.stringify({ kid: key.kid, alg: key.alg, private_key_jwk: jwk }, null, 2)}\n`);
writeFileSync(join(DIR, 'signing-input.json'), `${documentSigningPayload(signature)}\n`);
console.log(`document-signatures: generated ${rows.length} synthetic scenarios.`);
