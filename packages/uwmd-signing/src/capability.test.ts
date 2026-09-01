// Capability tokens — sign/verify roundtrip and every rejection branch
// (Protocol §XIV, RFC 0011).

import { describe, expect, it, beforeAll } from 'vitest';
import type { CapabilityVerifyContext } from '@uwmd/core';
import {
  CAPABILITY_AUDIENCE,
  createCapabilityVerifier,
  signCapabilityToken,
  type CapabilityTokenClaims,
} from './capability.js';
import { generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import type { SigningKey } from './keys.js';

const NOW = 1_760_000_000; // fixed clock, unix seconds

let key: SigningKey;
let store: InMemoryKeyStore;
let strangerKey: SigningKey;

beforeAll(async () => {
  const pair = await generateSigningKeyPair('ed25519', 'coord-2026');
  key = pair.signing;
  store = new InMemoryKeyStore([pair.verifying]);
  strangerKey = { ...(await generateSigningKeyPair('ed25519', 'coord-2026')).signing };
});

const CLAIMS: CapabilityTokenClaims = {
  iss: 'https://coordinator.example.com',
  sub: 'agent/L2.inst-A',
  aud: CAPABILITY_AUDIENCE,
  deal: 'DEAL-CAP-01',
  sections: ['noi_model', 'debt_structure'],
  stages: ['screening', 'term_sheet'],
  ops: ['section_supersede'],
  iat: NOW - 60,
  exp: NOW + 3600,
  jti: 'JTI-ROUNDTRIP',
};

const CTX: CapabilityVerifyContext = {
  deal_id: 'DEAL-CAP-01',
  section: 'noi_model',
  stage: 'screening',
  op: 'section_supersede',
  source: 'agent/L2.inst-A',
};

function verifier(s: InMemoryKeyStore = store) {
  return createCapabilityVerifier(s, { now: () => NOW });
}

async function verdictFor(claims: Partial<CapabilityTokenClaims>, ctx: Partial<CapabilityVerifyContext> = {}) {
  const token = await signCapabilityToken({ ...CLAIMS, ...claims } as CapabilityTokenClaims, key);
  return verifier().verify(token, { ...CTX, ...ctx });
}

describe('roundtrip', () => {
  it('accepts an in-scope token and surfaces sub + jti', async () => {
    const verdict = await verdictFor({});
    expect(verdict).toEqual({ ok: true, sub: 'agent/L2.inst-A', jti: 'JTI-ROUNDTRIP' });
  });

  it('treats absent sections/stages/ops claims as unconstrained', async () => {
    const verdict = await verdictFor({ sections: undefined, stages: undefined, ops: undefined },
      { section: 'risk_assessment', stage: null, op: 'frontmatter_set' });
    expect(verdict.ok).toBe(true);
  });
});

describe('structure and signature', () => {
  it('rejects non-JWT garbage as malformed', async () => {
    expect(await verifier().verify('not-a-token', CTX)).toEqual({ ok: false, reason: 'malformed' });
    expect(await verifier().verify('a.b', CTX)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects an unknown kid', async () => {
    const token = await signCapabilityToken(CLAIMS, { ...key, kid: 'nobody-holds-this' });
    expect(await verifier().verify(token, CTX)).toEqual({ ok: false, reason: 'unknown_kid' });
  });

  it('rejects a signature from a different key', async () => {
    // strangerKey signs under the SAME kid the store resolves — wrong key bytes.
    const token = await signCapabilityToken(CLAIMS, strangerKey);
    expect(await verifier().verify(token, CTX)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a tampered payload', async () => {
    const token = await signCapabilityToken(CLAIMS, key);
    const [h, , s] = token.split('.') as [string, string, string];
    const forged = Buffer.from(JSON.stringify({ ...CLAIMS, deal: 'DEAL-OTHER' }), 'utf8')
      .toString('base64url');
    expect(await verifier().verify(`${h}.${forged}.${s}`, CTX)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a missing required claim as malformed', async () => {
    expect(await verdictFor({ jti: undefined as unknown as string })).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects a sub outside the RFC 0031 actor grammar as malformed', async () => {
    expect(await verdictFor({ sub: 'agent/L2/inst-A' })).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('scope claims, one rejection each', () => {
  it('expired', async () => {
    expect(await verdictFor({ exp: NOW - 1 })).toEqual({ ok: false, reason: 'expired' });
  });

  it('not_yet_valid', async () => {
    expect(await verdictFor({ iat: NOW + 60 })).toEqual({ ok: false, reason: 'not_yet_valid' });
  });

  it('wrong_audience', async () => {
    expect(await verdictFor({ aud: 'uwmd-read' })).toEqual({ ok: false, reason: 'wrong_audience' });
  });

  it('wrong_deal', async () => {
    expect(await verdictFor({}, { deal_id: 'DEAL-OTHER' })).toEqual({ ok: false, reason: 'wrong_deal' });
  });

  it('wrong_section', async () => {
    expect(await verdictFor({}, { section: 'risk_assessment' })).toEqual({ ok: false, reason: 'wrong_section' });
  });

  it('wrong_stage — including a file with no declared stage', async () => {
    expect(await verdictFor({}, { stage: 'closing' })).toEqual({ ok: false, reason: 'wrong_stage' });
    expect(await verdictFor({}, { stage: null })).toEqual({ ok: false, reason: 'wrong_stage' });
  });

  it('wrong_op', async () => {
    expect(await verdictFor({}, { op: 'section_replace' })).toEqual({ ok: false, reason: 'wrong_op' });
  });

  it('sub_mismatch', async () => {
    expect(await verdictFor({}, { source: 'agent/L2.inst-B' })).toEqual({ ok: false, reason: 'sub_mismatch' });
  });
});
