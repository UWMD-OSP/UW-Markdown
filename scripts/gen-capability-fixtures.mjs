#!/usr/bin/env node
// Regenerate the `conformance/capability/` token fixtures (RFC 0011).
//
// Tokens are generated rather than hand-authored because their third segment
// is a signature over the first two; the key is the same published TEST pair
// the signing suite uses (`conformance/signing/keys`), so anyone can
// regenerate and get byte-identical output. Ed25519 is deterministic.
//
// Scenario 06 alone signs with a freshly generated key under the SAME kid, so
// its bytes differ per run — the scenario pins `bad_signature`, which any run
// of this script preserves.
//
// Run: node scripts/gen-capability-fixtures.mjs   (build first — imports dist/)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  importPrivateKey,
  generateSigningKeyPair,
  signCapabilityToken,
  CAPABILITY_AUDIENCE,
} from '../packages/uwmd-signing/dist/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = join(ROOT, 'conformance', 'capability');
const KID = 'uwmd-conformance-ed25519';

const privateJwk = JSON.parse(
  readFileSync(join(ROOT, 'conformance', 'signing', 'keys', 'signer-private.jwk.json'), 'utf8'),
);
const key = { kid: KID, alg: 'ed25519', privateKey: await importPrivateKey('ed25519', { jwk: privateJwk }) };

const BASE = {
  iss: 'https://coordinator.conformance.uwmd.org',
  sub: 'agent/L2.inst-A',
  aud: CAPABILITY_AUDIENCE,
  deal: 'DEAL-CAP-01',
  sections: ['noi_model'],
  stages: ['screening'],
  ops: ['section_supersede'],
  iat: 1600000000,          // 2020 — safely in the past
  exp: 4102444800,          // 2100-01-01 — the suite must not rot
};

const TOKENS = {
  '01-valid-token-accepts':   { ...BASE, jti: 'CAP-01-VALID' },
  '02-expired-token-rejects': { ...BASE, jti: 'CAP-02-EXPIRED', exp: 1600000001 },
  '03-wrong-section':         { ...BASE, jti: 'CAP-03-SECTION' },
  '04-wrong-deal':            { ...BASE, jti: 'CAP-04-DEAL', deal: 'DEAL-OTHER' },
  '05-sub-mismatch':          { ...BASE, jti: 'CAP-05-SUB' },
  '07-no-escalation':         { ...BASE, jti: 'CAP-07-ESCALATION', sections: ['validation'], ops: ['section_replace', 'section_supersede'] },
};

for (const [scenario, claims] of Object.entries(TOKENS)) {
  writeFileSync(join(SUITE, scenario, 'token.jwt'), await signCapabilityToken(claims, key), 'utf8');
  console.log(`signed ${scenario} (${claims.jti})`);
}

// 06: right kid, wrong key bytes → bad_signature.
const stranger = (await generateSigningKeyPair('ed25519', KID)).signing;
writeFileSync(
  join(SUITE, '06-bad-signature', 'token.jwt'),
  await signCapabilityToken({ ...BASE, jti: 'CAP-06-FORGED' }, stranger),
  'utf8',
);
console.log('signed 06-bad-signature (stranger key, same kid)');
