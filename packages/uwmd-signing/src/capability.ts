// Capability tokens — the reference CapabilityVerifier (Protocol §XIV, RFC 0011).
//
// A capability token is a JWS Compact–encoded JWT a coordinator signs:
// "this actor may write these sections at these stages for this deal, until
// this time." Core defines the `CapabilityVerifier` interface and the editor
// hook (`EditOptions.capabilityVerifier`); this module supplies the crypto —
// JWT decode, JOSE-alg mapping onto the §V.11 algorithm shortlist, and
// signature verification over the same KeyStore block signatures use. One
// key-distribution story, not two.
//
// Scope discipline mirrors the editor's: this verifier checks the token
// against the edit context it is handed. The static §V.3 policy check is the
// editor's job and runs regardless — a token narrows authority, never widens.

import type {
  CapabilityRejection,
  CapabilityVerdict,
  CapabilityVerifier,
  CapabilityVerifyContext,
  UWSignatureAlgorithm,
} from '@uwmd/core';
import { parseActorSource } from '@uwmd/core';
import { fromBase64Url, toBase64Url, utf8 } from './base64.js';
import type { KeyStore, SigningKey } from './keys.js';
import { signPayload } from './sign.js';
import { verifyRawSignature } from './verify.js';

/** The claims a capability token carries (Protocol §XIV.2). */
export interface CapabilityTokenClaims {
  /** Coordinator identity (informational; not verified beyond the signature). */
  iss: string;
  /** The RFC 0031 actor source being authorized (format spec §2.6 grammar). */
  sub: string;
  /** MUST be `uwmd-edit`. */
  aud: string;
  /** Frontmatter `deal_id` binding. */
  deal: string;
  /** Section ids the token may write (`_frontmatter` for frontmatter ops). Absent = unconstrained. */
  sections?: string[];
  /** DealStage values the token is valid at. Absent = unconstrained. */
  stages?: string[];
  /** EditOperation kinds permitted. Absent = unconstrained. */
  ops?: string[];
  /** Issued at (unix seconds). */
  iat: number;
  /** Expiry (unix seconds). */
  exp: number;
  /** Unique token id, recorded in the written block's notes as `capability:<jti>`. */
  jti: string;
}

/** The fixed JWT audience for edit authorization. */
export const CAPABILITY_AUDIENCE = 'uwmd-edit' as const;

// JOSE `alg` header names for the §V.11 shortlist. The token is a JWT, so its
// header speaks JOSE; the KeyStore speaks the protocol's own names.
const JOSE_TO_UW: Readonly<Record<string, UWSignatureAlgorithm>> = Object.freeze({
  EdDSA: 'ed25519',
  ES256: 'es256',
  ES384: 'es384',
});
const UW_TO_JOSE: Readonly<Record<UWSignatureAlgorithm, string>> = Object.freeze({
  ed25519: 'EdDSA',
  es256: 'ES256',
  es384: 'ES384',
});

export interface CapabilityVerifierOptions {
  /** Clock override, unix seconds. Tests and replay; defaults to wall time. */
  now?: () => number;
}

/**
 * Build the reference {@link CapabilityVerifier} over a {@link KeyStore}.
 *
 * Rejection order follows §XIV.3: structure and signature first (`malformed`,
 * `unknown_kid`, `bad_signature`), then time, then each scope claim, then the
 * `sub` ↔ `_meta.source` binding. Absent `sections`/`stages`/`ops` claims are
 * unconstrained; every other claim is required and its absence is `malformed`.
 */
export function createCapabilityVerifier(
  store: KeyStore,
  options: CapabilityVerifierOptions = {},
): CapabilityVerifier {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  return {
    async verify(token: string, ctx: CapabilityVerifyContext): Promise<CapabilityVerdict> {
      const decoded = decodeCompact(token);
      if (!decoded) return reject('malformed');
      const { header, claims, signingInput, signature } = decoded;

      const alg = JOSE_TO_UW[header.alg ?? ''];
      if (!alg || typeof header.kid !== 'string' || header.kid.length === 0) {
        return reject('malformed');
      }
      const sigVerdict = await verifyRawSignature(signingInput, alg, header.kid, signature, store);
      if (!sigVerdict.ok) {
        if (sigVerdict.reason === 'unknown_kid') return reject('unknown_kid');
        if (sigVerdict.reason === 'bad_signature') return reject('bad_signature');
        return reject('malformed'); // algorithm_mismatch / malformed input
      }

      if (!hasRequiredClaims(claims)) return reject('malformed');
      // `sub` outside the RFC 0031 actor grammar can never match a governed
      // `_meta.source`; report it as a malformed token, not a mismatch.
      if (parseActorSource(claims.sub).kind === 'invalid') return reject('malformed');

      const at = now();
      if (at < claims.iat) return reject('not_yet_valid');
      if (at >= claims.exp) return reject('expired');
      if (claims.aud !== CAPABILITY_AUDIENCE) return reject('wrong_audience');
      if (claims.deal !== ctx.deal_id) return reject('wrong_deal');
      if (claims.sections && !claims.sections.includes(ctx.section)) return reject('wrong_section');
      if (claims.stages) {
        // A file with no declared stage fails a stage-constrained token: the
        // token asserts a stage scope the file cannot demonstrate.
        if (ctx.stage === null || !claims.stages.includes(ctx.stage)) return reject('wrong_stage');
      }
      if (claims.ops && !claims.ops.includes(ctx.op)) return reject('wrong_op');
      if (claims.sub !== ctx.source) return reject('sub_mismatch');

      return { ok: true, sub: claims.sub, jti: claims.jti };
    },
  };
}

/**
 * Sign a capability token: JWS Compact over the JSON claims, JOSE alg names
 * in the header. A coordinator-side convenience (and the fixture generator
 * for the conformance suite) — verification does not require it.
 */
export async function signCapabilityToken(
  claims: CapabilityTokenClaims,
  key: SigningKey,
): Promise<string> {
  const header = { alg: UW_TO_JOSE[key.alg], kid: key.kid, typ: 'JWT' };
  const signingInput = `${b64Json(header)}.${b64Json(claims)}`;
  const signature = await signPayload(signingInput, key);
  return `${signingInput}.${signature}`;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function reject(reason: CapabilityRejection): CapabilityVerdict {
  return { ok: false, reason };
}

function b64Json(value: unknown): string {
  return toBase64Url(utf8(JSON.stringify(value)));
}

interface DecodedToken {
  header: { alg?: string; kid?: string; typ?: string };
  claims: Partial<CapabilityTokenClaims>;
  /** `<b64 header>.<b64 payload>` — the bytes the signature covers. */
  signingInput: string;
  /** base64url signature segment, still encoded (verifyRawSignature decodes). */
  signature: string;
}

function decodeCompact(token: string): DecodedToken | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, signature] = parts as [string, string, string];
  if (!h || !p || !signature) return null;
  let header: unknown;
  let claims: unknown;
  try {
    header = JSON.parse(new TextDecoder().decode(fromBase64Url(h)));
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(p)));
  } catch {
    return null;
  }
  if (!isObject(header) || !isObject(claims)) return null;
  return {
    header: header as DecodedToken['header'],
    claims: claims as Partial<CapabilityTokenClaims>,
    signingInput: `${h}.${p}`,
    signature,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasRequiredClaims(claims: Partial<CapabilityTokenClaims>): claims is CapabilityTokenClaims {
  return (
    typeof claims.iss === 'string' &&
    typeof claims.sub === 'string' &&
    typeof claims.aud === 'string' &&
    typeof claims.deal === 'string' &&
    typeof claims.iat === 'number' && Number.isFinite(claims.iat) &&
    typeof claims.exp === 'number' && Number.isFinite(claims.exp) &&
    typeof claims.jti === 'string' && claims.jti.length > 0 &&
    (claims.sections === undefined || isStringArray(claims.sections)) &&
    (claims.stages === undefined || isStringArray(claims.stages)) &&
    (claims.ops === undefined || isStringArray(claims.ops))
  );
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
