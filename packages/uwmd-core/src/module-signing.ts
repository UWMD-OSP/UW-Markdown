// Module manifest signatures (protocol §X.1, RFC 0002).
//
// A module manifest is executable surface: it declares calculations whose
// formulas the calc engine evaluates and validations that can flip a deal from
// blocking to advisory. A host that loads one from npm, a URL, or a colleague's
// directory has, without this, no way to ask "is this the manifest the author
// published?"
//
// The layering is the same one block signatures use, for the same reason. Core
// owns the crypto-free half — the canonical bytes a signature covers, the
// structural checks, and the verdict taxonomy — while the algorithms live in
// `@uwmd/signing` and arrive through an injected verifier. Reading and loading a
// module must never require cryptography.
//
// Advisory by design: the protocol fixes what "signature valid" *means* so two
// hosts agree, and leaves what to *do* about an unsigned or invalid module to
// host policy (§X.1.4).

import { canonicalizeExact } from './integrity-canonical.js';
import type { ModuleManifest, ModuleSignature, ProtocolError } from './protocol.js';
import { UW_SIGNATURE_ALGORITHMS } from './types.js';

/** The one scheme protocol 1.x implements. See `ModuleSignature.scheme`. */
export const MODULE_SIGNATURE_SCHEME = 'uwmd-keystore' as const;

/**
 * The exact bytes a module signature covers: RFC 8785 canonical JSON of the
 * manifest with `signature` removed.
 *
 * Removed rather than nulled, so that signing a manifest and then verifying it
 * produce byte-identical input — the failure mode where a signature verifies
 * before it is attached and not after.
 */
export function moduleSigningPayload(manifest: ModuleManifest): string {
  const { signature: _omitted, ...rest } = manifest;
  return canonicalizeExact(rest);
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

export type ModuleSignatureFailure =
  /** The manifest carries no `signature` at all. */
  | 'missing'
  /** `scheme` names something this verifier does not implement. */
  | 'unsupported_scheme'
  /** `signature` is present but structurally invalid. */
  | 'malformed'
  /** `kid` names a key the host's store does not hold. */
  | 'unknown_key'
  /** The signature did not validate over the canonical manifest. */
  | 'invalid';

export type ModuleSignatureVerdict =
  | { ok: true; kid: string; identity?: string }
  | { ok: false; reason: ModuleSignatureFailure; error: ProtocolError };

/**
 * Supplied by `@uwmd/signing`. Mirrors `BlockSignatureVerifier` rather than
 * reusing it, because a module signature carries a `scheme` a block signature
 * has no concept of; collapsing them would mean one of the two lies about its
 * input.
 */
export interface ModuleSignatureVerifier {
  verify(
    payload: string,
    signature: ModuleSignature,
  ): Promise<{ ok: true } | { ok: false; reason: 'unknown_kid' | 'bad_signature' | 'malformed' }>;
}

export interface VerifyModuleSignatureOptions {
  /** Without one, only the structural checks run and the verdict is `malformed`-or-better. */
  verifier?: ModuleSignatureVerifier;
  /**
   * Identity allow-list. When set, a valid signature whose `identity` is absent
   * or unlisted is refused.
   *
   * Note what this can and cannot do: `identity` is a claim inside the signed
   * bytes, so a signature proves the *key holder* asserted it, never that the
   * assertion is true. It is only as good as the host's decision to bind that
   * `kid` to that identity in its key store.
   */
  allowedIdentities?: readonly string[];
}

const CODES: Record<ModuleSignatureFailure, string> = {
  missing: 'PROTO-MOD-068',
  unsupported_scheme: 'PROTO-MOD-069',
  malformed: 'PROTO-MOD-070',
  unknown_key: 'PROTO-MOD-071',
  invalid: 'PROTO-MOD-072',
};

const REMEDIATIONS: Record<ModuleSignatureFailure, string> = {
  missing:
    'Sign the manifest, or relax the host policy to accept unsigned modules (signatures are advisory at the protocol level).',
  unsupported_scheme: `Re-sign under the '${MODULE_SIGNATURE_SCHEME}' scheme, or use a host that implements the named scheme.`,
  malformed: 'Re-sign the manifest; the signature object is not a well-formed ModuleSignature.',
  unknown_key:
    'Add the signing key to the host key store under that kid, or re-sign with a key the host trusts.',
  invalid:
    'The manifest changed after it was signed. Restore the published manifest, or re-sign the version you intend to ship.',
};

function fail(
  reason: ModuleSignatureFailure,
  message: string,
): { ok: false; reason: ModuleSignatureFailure; error: ProtocolError } {
  return {
    ok: false,
    reason,
    error: {
      category: 'module',
      code: CODES[reason],
      message,
      pointer: 'signature',
      remediation: REMEDIATIONS[reason],
    },
  };
}

/**
 * Verify a module manifest's signature.
 *
 * The three refusals a host must keep apart are `missing` (nothing was
 * claimed), `unknown_key` (something was claimed and this host cannot check
 * it), and `invalid` (something was claimed and it is false). They call for
 * three different responses — decide a policy, load a key, reject the module —
 * and a verifier that reports them as one verdict makes all three
 * indistinguishable at the point where the host has to act.
 */
export async function verifyModuleSignature(
  manifest: ModuleManifest,
  options: VerifyModuleSignatureOptions = {},
): Promise<ModuleSignatureVerdict> {
  const signature = manifest.signature;
  if (signature === undefined) {
    return fail('missing', `Module '${manifest.id}' carries no signature.`);
  }

  const structural = checkSignatureShape(signature);
  if (structural) return structural;

  if (!options.verifier) {
    return fail(
      'unknown_key',
      `Module '${manifest.id}' is signed by key '${signature.kid}', but this host has no signature backend to check it with.`,
    );
  }

  const verdict = await options.verifier.verify(moduleSigningPayload(manifest), signature);
  if (!verdict.ok) {
    if (verdict.reason === 'unknown_kid') {
      return fail(
        'unknown_key',
        `Module '${manifest.id}' is signed by key '${signature.kid}', which this host's key store does not hold.`,
      );
    }
    return fail(
      'invalid',
      `Module '${manifest.id}' signature did not verify (${verdict.reason}).`,
    );
  }

  if (options.allowedIdentities) {
    const identity = signature.identity;
    if (identity === undefined || !options.allowedIdentities.includes(identity)) {
      return fail(
        'invalid',
        `Module '${manifest.id}' is validly signed by '${signature.kid}' but its identity ${
          identity === undefined ? 'is absent' : `'${identity}' is not`
        } on this host's allow-list.`,
      );
    }
  }

  return {
    ok: true,
    kid: signature.kid,
    ...(signature.identity !== undefined ? { identity: signature.identity } : {}),
  };
}

/**
 * Structural checks, run before any cryptography.
 *
 * Separated out because they are the part a host can run with no key store at
 * all, and because a malformed signature deserves its own code: telling an
 * author "this did not verify" when the real problem is a missing `signed_at`
 * sends them looking for tampering that never happened.
 */
export function checkSignatureShape(
  signature: unknown,
): { ok: false; reason: ModuleSignatureFailure; error: ProtocolError } | null {
  if (typeof signature !== 'object' || signature === null || Array.isArray(signature)) {
    return fail('malformed', 'signature must be an object.');
  }
  const sig = signature as Record<string, unknown>;

  if (sig['scheme'] !== MODULE_SIGNATURE_SCHEME) {
    return fail(
      'unsupported_scheme',
      `signature.scheme must be '${MODULE_SIGNATURE_SCHEME}' (got ${JSON.stringify(sig['scheme'])}).`,
    );
  }
  if (
    typeof sig['alg'] !== 'string' ||
    !(UW_SIGNATURE_ALGORITHMS as readonly string[]).includes(sig['alg'])
  ) {
    return fail(
      'malformed',
      `signature.alg must be one of ${UW_SIGNATURE_ALGORITHMS.join(', ')}.`,
    );
  }
  for (const key of ['kid', 'sig', 'signed_at'] as const) {
    if (typeof sig[key] !== 'string' || (sig[key] as string).length === 0) {
      return fail('malformed', `signature.${key} must be a non-empty string.`);
    }
  }
  if (sig['identity'] !== undefined && typeof sig['identity'] !== 'string') {
    return fail('malformed', 'signature.identity, when present, must be a string.');
  }
  for (const key of Object.keys(sig)) {
    if (!['scheme', 'alg', 'kid', 'sig', 'signed_at', 'identity'].includes(key)) {
      return fail('malformed', `signature has unknown key '${key}'.`);
    }
  }
  return null;
}
