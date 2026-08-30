#!/usr/bin/env node
// Regenerate the `conformance/signing/` fixtures (RFC 0010).
//
// Signed fixtures cannot be hand-authored: `_meta.content_hash` is a digest of
// the block it sits in, and `_meta.signature.sig` is a signature over that
// digest. Editing either by hand produces a file that fails for the wrong
// reason. So the signing suite is generated, from a checked-in test key, and
// this script is the only thing that may write those `.uw.md` files.
//
// The key in `conformance/signing/keys/` is a TEST key with a published private
// half. It exists so anyone can regenerate the corpus and get byte-identical
// output; it authenticates nothing and must never be trusted.
//
// Run: node scripts/gen-signing-fixtures.mjs   (or `npm run gen-signing-fixtures`)
//      Requires a build first — it imports the compiled library.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseUWFile, computeBlockHash } from '../packages/uwmd-core/dist/index.js';
import {
  importPrivateKey,
  signBlock,
  signModule,
  stampModuleSignature,
} from '../packages/uwmd-signing/dist/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = join(ROOT, 'conformance', 'signing');
const KID = 'uwmd-conformance-ed25519';
const SIGNED_AT = '2026-08-27T00:00:00Z';

const privateJwk = JSON.parse(readFileSync(join(SUITE, 'keys', 'signer-private.jwk.json'), 'utf8'));
const key = {
  kid: KID,
  alg: 'ed25519',
  privateKey: await importPrivateKey('ed25519', { jwk: privateJwk }),
};

const BLOCKS = join(SUITE, 'blocks');
const MODULES = join(SUITE, 'modules');
const BASE = readFileSync(join(BLOCKS, 'base-deal.uw.md'), 'utf8');

/**
 * Stamp `content_hash` (and optionally `signature`) into the named section's
 * `_meta` and return the new file text.
 *
 * Rewrites the block's JSON by re-serializing it, which is acceptable here and
 * nowhere else: these files are generated artifacts, not documents whose bytes
 * a Tier-2 edit must preserve.
 */
async function stamp(text, sectionId, { sign = true, hash = true } = {}) {
  const parsed = parseUWFile(text);
  const block = parsed.sections[sectionId];
  if (!block) throw new Error(`no section '${sectionId}' in the base fixture`);

  const contentHash = await computeBlockHash(block);
  // `block.meta` IS the parsed `_meta` object (same reference as
  // `block.content._meta`), so build a copy rather than mutating in place.
  const meta = { ...block.meta };
  if (hash) meta.content_hash = contentHash;
  if (sign) {
    meta.signature = await signBlock(
      { ...block, meta: { ...block.meta, content_hash: contentHash } },
      key,
      { signedAt: SIGNED_AT },
    );
  }

  // `block.content` is the whole parsed JSON object (section_id, _meta,
  // content, _notes), so spreading it preserves key order and swaps `_meta`
  // in place rather than re-wrapping the block one level deeper.
  const rendered = JSON.stringify({ ...block.content, _meta: meta }, null, 2);
  return replaceBlockJson(text, sectionId, rendered);
}

/** Swap the JSON body of the fenced block for `sectionId`. */
function replaceBlockJson(text, sectionId, json) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```json uw:section=') && lines[i].includes(`section=${sectionId} `)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) throw new Error(`no fenced block for '${sectionId}'`);
  let end = start;
  while (end < lines.length && lines[end] !== '```') end++;
  return [...lines.slice(0, start), ...json.split('\n'), ...lines.slice(end)].join('\n');
}

function write(scenario, name, body) {
  mkdirSync(join(BLOCKS, scenario), { recursive: true });
  writeFileSync(join(BLOCKS, scenario, name), body, 'utf8');
}

function writeModule(scenario, manifest) {
  mkdirSync(join(MODULES, scenario), { recursive: true });
  writeFileSync(
    join(MODULES, scenario, 'module.json'),
    `${JSON.stringify(manifest, null, 2)}
`,
    'utf8',
  );
}

// ── 01: a valid signature over a hashed block ────────────────────────────────
const valid = await stamp(BASE, 'property');
write('01-signed-valid', 'deal.uw.md', valid);

// ── 02: the same signature, over content edited after signing ───────────────
// `year_built` moves by one. Both INT-04 (the hash no longer recomputes) and
// INT-07 (the signature no longer verifies) are the correct report: the file
// says two different things about the same bytes.
write('02-signed-tampered', 'deal.uw.md', valid.replace('"year_built": 1995', '"year_built": 1996'));

// ── 03: a valid signature under a kid the fixture keystore does not hold ────
write(
  '03-signed-unknown-kid',
  'deal.uw.md',
  valid.replaceAll(`"kid": "${KID}"`, '"kid": "rotated-out-2019"'),
);

// ── 04: a signature with no content_hash to commit to ───────────────────────
write('04-signed-no-hash', 'deal.uw.md', await stamp(BASE, 'property', { hash: false }));

// ── 05: the valid file again, verified with no signature backend ───────────
// Same bytes as 01; only the verifier's capability differs. That is the point:
// the verdict must change because the *verifier* changed, not the document.
write('05-signed-no-backend', 'deal.uw.md', valid);

// ── Module manifests (RFC 0002) ─────────────────────────────────────────────
// Same key, same key store: a host that trusts a signer trusts them for both
// artifacts, and splitting the corpus across two keys would suggest otherwise.

const BASE_MODULE = JSON.parse(readFileSync(join(MODULES, 'base-module.json'), 'utf8'));
const moduleSignature = await signModule(BASE_MODULE, key, {
  signedAt: SIGNED_AT,
  identity: 'modules@uwmd.org',
});
const signedModule = stampModuleSignature(BASE_MODULE, moduleSignature);

writeModule('01-valid', signedModule);
// Tamper with `description`, which is structurally valid either way, so the
// only thing that can refuse the manifest is the signature.
writeModule('02-tampered', { ...signedModule, description: 'Tampered after signing.' });
writeModule('03-unknown-kid', {
  ...signedModule,
  signature: { ...moduleSignature, kid: 'rotated-out-2019' },
});
writeModule('04-unsigned', BASE_MODULE);
writeModule('05-unsupported-scheme', {
  ...signedModule,
  signature: { ...moduleSignature, scheme: 'sigstore' },
});
writeModule('06-malformed', {
  ...signedModule,
  signature: { scheme: 'uwmd-keystore', alg: 'ed25519', kid: 'uwmd-conformance-ed25519' },
});

console.log('conformance/signing: regenerated 5 block scenarios and 6 module scenarios.');
