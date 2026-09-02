// Integrity layer: content_hash + parent_hash chains, provenance verification
// Protocol §V.9 / §V.10 — "Block integrity"
//
// Design notes:
//   - Opt-in: a file with no hashes parses, validates, and verifies as
//     `ok: true, chains_with_hashes: 0`.
//   - The chain walk is per-section: each section's supersede sequence is its
//     own chain. Cross-section chains are intentionally not modeled in v1.
//   - SHA-256 implementation is split between Node (`createHash`) and Web
//     Crypto (`crypto.subtle`). The browser entry point binds the latter via
//     subpath export when adopters import from `@uwmd/core/browser`.

import { canonicalize, canonicalizeExact, canonicalizeV2 } from './integrity-canonical.js';
import { canonicalV2BlockContent, isV2File } from './meta-shape.js';
import type { MetaShape } from './meta-shape.js';
import type { ParsedUWFile, UWBlock, UWBlockSignature } from './types.js';
import { UW_SIGNATURE_ALGORITHMS } from './types.js';
import type { EditPolicy } from './protocol.js';
import { BUILTIN_EDIT_POLICIES, parseActorSource } from './protocol.js';

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * SHA-256 of the canonicalized JSON of `value`. Returns the lowercase hex
 * digest. Async to support Web Crypto on browsers without Node's `crypto`.
 */
export async function sha256Hex(value: unknown): Promise<string> {
  return sha256TextHex(canonicalize(value));
}

/** SHA-256 of an exact UTF-8 string, without JSON canonicalization. */
export async function sha256TextHex(text: string): Promise<string> {
  return sha256BytesHex(new TextEncoder().encode(text));
}

/**
 * SHA-256 of exact bytes.
 *
 * Required for binary payloads (a PDF in a deal package). Routing those through
 * `sha256TextHex` would be wrong: any byte above 0x7F would be re-encoded as
 * multi-byte UTF-8 and produce a digest for different bytes than the ones on
 * disk.
 */
export async function sha256BytesHex(bytes: Uint8Array): Promise<string> {
  // Prefer Node's synchronous crypto when available; falls back to Web Crypto.
  // Both produce identical output for identical input bytes.
  type NodeCrypto = { createHash(alg: string): { update(buf: Uint8Array): { digest(enc: string): string } } };
  const g = globalThis as unknown as {
    process?: { versions?: { node?: string } };
    crypto?: { subtle?: SubtleCrypto };
  };
  const isNode = !!g.process?.versions?.node;
  if (isNode) {
    const mod = (await import('node:crypto')) as unknown as NodeCrypto;
    return mod.createHash('sha256').update(bytes).digest('hex');
  }
  const subtle = g.crypto?.subtle;
  if (!subtle) throw new Error('integrity.sha256BytesHex: no crypto provider available.');
  const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Compute the content_hash for a block. Strips the block's own
 * `_meta.content_hash` and `_meta.signature` before hashing (handled by the
 * canonicalizer).
 *
 * Canonicalization is versioned by the file's `uw_version` (RFC 0009):
 * `shape: 'v1'` (the default) is the frozen 1.x rule; `shape: 'v2'` is the
 * normalize-then-hash rule for `uw_version: "2.0"` files — the block content
 * is reshaped to the canonical nested form first, so both accepted parser
 * shapes yield the identical digest.
 */
export async function computeBlockHash(
  block: UWBlock,
  options: { shape?: MetaShape } = {},
): Promise<string> {
  // The canonical scope is the block CONTENT including meta, since meta
  // carries the cascade-relevant provenance. The excluded keys are stripped
  // by the canonicalizer.
  if (options.shape === 'v2') {
    const normalized = canonicalV2BlockContent({ ...block.content, _meta: block.meta });
    return sha256TextHex(canonicalizeV2(normalized));
  }
  return sha256Hex({ ...block.content, _meta: block.meta });
}

// ─── Public types ────────────────────────────────────────────────────────────

export type IntegrityCode =
  | 'INT-01'
  | 'INT-02'
  | 'INT-03'
  | 'INT-04'
  | 'INT-05'
  | 'INT-06'
  | 'INT-07'
  | 'INT-08'
  | 'POL-01'
  | 'POL-02';

export interface IntegrityIssue {
  code: IntegrityCode;
  severity: 'error' | 'warning';
  message: string;
  section?: string;
  expected?: string;
  actual?: string;
}

export interface IntegrityResult {
  ok: boolean;
  issues: IntegrityIssue[];
  chains_verified: number;
  chains_with_hashes: number;
  /**
   * How many blocks carry `_meta.signature` (RFC 0010). Reported even when no
   * verifier was supplied, so a caller can tell "no signatures" apart from
   * "signatures present but unchecked" — the distinction that makes a
   * `signatures_verified: 0` result readable.
   */
  signatures_present: number;
  /**
   * How many signatures cryptographically verified. Always 0 without a
   * `signatureVerifier`; never inferred from the signature's mere presence.
   */
  signatures_verified: number;
}

// ─── Block signatures (protocol §V.11, RFC 0010) ─────────────────────────────

/**
 * The canonical JSON a block signature covers.
 *
 * Deliberately not the block itself: the signer commits to the block's
 * `content_hash` (which already covers the content), plus the four provenance
 * facts a verifier needs in order to say *who* signed *what*, *when*. Signing
 * the block directly would re-derive the hash for no gain and would drag
 * `parent_hash` into the commitment — see {@link UWBlockSignature}.
 */
export interface BlockSigningInput {
  content_hash: string;
  section: string;
  actor: string;
  timestamp: string;
  kid: string;
  signed_at: string;
}

/**
 * Build the exact bytes a signature is computed over: RFC 8785 canonical JSON
 * of {@link BlockSigningInput}. Crypto-free, so it lives in core — signer and
 * verifier MUST agree on this string or nothing else matters.
 *
 * Returns `null` when the block cannot produce a signing input at all (no
 * `content_hash`, or no signature to take `kid`/`signed_at` from).
 */
export function blockSigningPayload(block: UWBlock): string | null {
  const sig = block.meta.signature;
  const hash = block.meta.content_hash;
  if (!sig || typeof hash !== 'string') return null;
  return canonicalBlockSigningInput({
    content_hash: hash,
    section: block.meta.section,
    actor: block.meta.actor,
    timestamp: block.meta.timestamp,
    kid: sig.kid,
    signed_at: sig.signed_at,
  });
}

/**
 * Canonicalize an explicit signing input.
 *
 * The signer needs this and {@link blockSigningPayload} cannot serve it: at
 * signing time the block has no `_meta.signature` yet, so there is nowhere to
 * read `kid` and `signed_at` from. Both paths funnel through this one function
 * so the two sides cannot drift.
 */
export function canonicalBlockSigningInput(input: BlockSigningInput): string {
  return canonicalizeExact({
    content_hash: input.content_hash,
    section: input.section,
    actor: input.actor,
    timestamp: input.timestamp,
    kid: input.kid,
    signed_at: input.signed_at,
  } satisfies BlockSigningInput);
}

/** Why a signature failed to verify. Mirrors RFC 0010's `SigVerifyError`. */
export type BlockSigFailure =
  | 'unknown_kid'
  | 'algorithm_mismatch'
  | 'bad_signature'
  | 'malformed';

export type BlockSigVerdict = { ok: true } | { ok: false; reason: BlockSigFailure };

/**
 * Plugged in by `@uwmd/signing`; absent here so core stays crypto-free (the
 * same seam `ReceiptSignatureVerifier` uses for receipts).
 */
export interface BlockSignatureVerifier {
  verify(payload: string, signature: UWBlockSignature): Promise<BlockSigVerdict>;
}

export interface VerifyChainOptions {
  /**
   * Supplied by a signing package. Without it, INT-06/INT-07 never fire and a
   * signed block is treated exactly like an unsigned one — verification is
   * opt-in, and silently "passing" an unchecked signature is the failure this
   * design most wants to avoid, which is what `signatures_present` reports.
   */
  signatureVerifier?: BlockSignatureVerifier;
  /**
   * Algorithms to flag as deprecated (INT-08). Empty at protocol 1.7 — no
   * admitted algorithm is deprecated yet — but the knob exists so a deployment
   * can retire one ahead of the spec.
   */
  deprecatedAlgorithms?: readonly string[];
}

// ─── Chain verification ──────────────────────────────────────────────────────

/**
 * For every supersede chain in the parsed file:
 *   - If at least one block in the chain carries `_meta.content_hash`, every
 *     block in the chain MUST carry one (else INT-03 warning).
 *   - Each block's recomputed hash MUST equal the stamped `content_hash`
 *     (else INT-04 warning).
 *   - Each non-root block's `parent_hash` MUST equal the prior block's
 *     `content_hash` (else INT-01 error).
 *
 * A chain with no hashes at all yields no findings and is not counted in
 * `chains_verified` — but its blocks are still swept for signatures, because a
 * signature over a block that has no `content_hash` commits to nothing and is
 * exactly the case INT-05 exists to catch.
 *
 * Signature checks (protocol §V.11) run over every block in the file:
 *   - INT-05 error   — `signature` present with no `content_hash`.
 *   - INT-07 error   — the stamped `content_hash` no longer recomputes, so the
 *     signature covers content that is no longer there (INT-04 reports the same
 *     drift as a warning; on a signed block it is an error).
 *   - INT-06 error   — `kid` unknown to the supplied store.
 *   - INT-07 error   — the signature does not verify.
 *   - INT-08 warning — the algorithm is in the caller's deprecation list.
 */
export async function verifyChain(
  parsed: ParsedUWFile,
  options: VerifyChainOptions = {},
): Promise<IntegrityResult> {
  const issues: IntegrityIssue[] = [];
  let chainsWithHashes = 0;
  let chainsVerified = 0;
  // Canonicalization is versioned by the file's own frontmatter (RFC 0009):
  // digests in a `uw_version: "2.0"` file recompute under the v2 rule.
  const shape: MetaShape = isV2File(parsed.frontmatter) ? 'v2' : 'v1';

  for (const sectionId of Object.keys(parsed.sections)) {
    // Build the chain: prior (superseded) blocks first, then current head.
    const prior = parsed.superseded[sectionId] ?? [];
    const head = currentBlock(parsed, sectionId);
    if (!head) continue;
    const chain: UWBlock[] = [...prior, head];
    const hasAnyHash = chain.some((b) => typeof b.meta.content_hash === 'string');
    if (!hasAnyHash) continue;
    chainsWithHashes++;

    let chainOK = true;
    let prevHash: string | null = null;
    for (let i = 0; i < chain.length; i++) {
      const block = chain[i]!;
      const stamped = block.meta.content_hash;

      // INT-03: partial chain
      if (typeof stamped !== 'string') {
        issues.push({
          code: 'INT-03',
          severity: 'warning',
          section: sectionId,
          message: `Block v${block.meta.version} of '${sectionId}' has no content_hash but other blocks in the chain do.`,
        });
        chainOK = false;
        continue;
      }

      // INT-04: hash mismatch
      const recomputed = await computeBlockHash(block, { shape });
      if (recomputed !== stamped) {
        issues.push({
          code: 'INT-04',
          severity: 'warning',
          section: sectionId,
          message: `Block v${block.meta.version} of '${sectionId}' content_hash does not recompute.`,
          expected: recomputed,
          actual: stamped,
        });
        chainOK = false;
      }

      // INT-01: parent hash mismatch
      if (i > 0) {
        const parent = block.meta.parent_hash;
        if (parent !== prevHash) {
          issues.push({
            code: 'INT-01',
            severity: 'error',
            section: sectionId,
            message: `Block v${block.meta.version} of '${sectionId}' parent_hash does not match prior block.`,
            expected: prevHash ?? '<null>',
            actual: parent ?? '<missing>',
          });
          chainOK = false;
        }
      }

      prevHash = stamped;
    }
    if (chainOK) chainsVerified++;
  }

  const sig = await verifySignatures(parsed, issues, options);

  const errors = issues.filter((i) => i.severity === 'error').length;
  return {
    ok: errors === 0,
    issues,
    chains_verified: chainsVerified,
    chains_with_hashes: chainsWithHashes,
    signatures_present: sig.present,
    signatures_verified: sig.verified,
  };
}

/**
 * Sweep every block in the file for `_meta.signature` and append INT-05..08.
 *
 * Walks all blocks — heads, superseded priors, and every variant — rather than
 * the per-section chain heads `verifyChain` walks. A signature on a superseded
 * block is the whole point of per-block signing: "the sponsor signed *this*
 * version of the rent roll" must stay checkable after the block is superseded.
 */
async function verifySignatures(
  parsed: ParsedUWFile,
  issues: IntegrityIssue[],
  options: VerifyChainOptions,
): Promise<{ present: number; verified: number }> {
  const deprecated = options.deprecatedAlgorithms ?? [];
  let present = 0;
  let verified = 0;

  for (const [sectionId, block] of everyBlock(parsed)) {
    const signature = block.meta.signature;
    if (!signature) continue;
    present++;

    const where = `Block v${block.meta.version} of '${sectionId}'`;

    if (deprecated.includes(signature.alg)) {
      issues.push({
        code: 'INT-08',
        severity: 'warning',
        section: sectionId,
        message: `${where} is signed with deprecated algorithm '${signature.alg}'.`,
        actual: signature.alg,
      });
    }

    // INT-05 needs no key material: a signature over an absent content_hash is
    // structurally void, so it is reported whether or not a verifier exists.
    const payload = blockSigningPayload(block);
    if (payload === null) {
      issues.push({
        code: 'INT-05',
        severity: 'error',
        section: sectionId,
        message: `${where} carries a signature but no content_hash, so the signature commits to nothing.`,
      });
      continue;
    }

    // A signed block whose stamped hash no longer recomputes is INT-07 as well
    // as INT-04, and the escalation from warning to error is the point: on an
    // unsigned block a drifted hash is a bookkeeping slip, but on a signed one
    // it means the content in front of you is not the content anybody signed.
    const recomputed = await computeBlockHash(block, {
      shape: isV2File(parsed.frontmatter) ? 'v2' : 'v1',
    });
    if (recomputed !== block.meta.content_hash) {
      issues.push({
        code: 'INT-07',
        severity: 'error',
        section: sectionId,
        message: `${where} was signed over content_hash ${block.meta.content_hash}, but its content now hashes to ${recomputed}.`,
        expected: recomputed,
        actual: block.meta.content_hash,
      });
      continue;
    }

    if (!(UW_SIGNATURE_ALGORITHMS as readonly string[]).includes(signature.alg)) {
      issues.push({
        code: 'INT-07',
        severity: 'error',
        section: sectionId,
        message: `${where} declares unrecognized signature algorithm '${signature.alg}'.`,
        expected: UW_SIGNATURE_ALGORITHMS.join('|'),
        actual: signature.alg,
      });
      continue;
    }

    if (!options.signatureVerifier) continue;

    const verdict = await options.signatureVerifier.verify(payload, signature);
    if (verdict.ok) {
      verified++;
      continue;
    }
    if (verdict.reason === 'unknown_kid') {
      issues.push({
        code: 'INT-06',
        severity: 'error',
        section: sectionId,
        message: `${where} is signed by key '${signature.kid}', which this verifier's key store does not hold.`,
        actual: signature.kid,
      });
      continue;
    }
    issues.push({
      code: 'INT-07',
      severity: 'error',
      section: sectionId,
      message: `${where} signature did not verify (${verdict.reason}).`,
      actual: signature.kid,
    });
  }

  return { present, verified };
}

/** Every block in the file, superseded priors and variants included. */
function* everyBlock(parsed: ParsedUWFile): Generator<[string, UWBlock]> {
  for (const [sectionId, prior] of Object.entries(parsed.superseded)) {
    for (const block of prior) yield [sectionId, block];
  }
  for (const [sectionId, entry] of Object.entries(parsed.sections)) {
    if (!entry) continue;
    if ('annotation' in (entry as object)) {
      yield [sectionId, entry as UWBlock];
      continue;
    }
    for (const variant of Object.values(entry as Record<string, UWBlock>)) {
      yield [sectionId, variant];
    }
  }
}

// ─── Provenance verification ─────────────────────────────────────────────────

/**
 * Cross-check `_meta.actor` and the operation that produced the block against
 * BUILTIN_EDIT_POLICIES.
 *
 * - POL-01: actor not authorized for the section per its EditPolicy.
 * - POL-02: section_replace used where the policy mandates section_supersede
 *   (heuristic: if `supersede_on_edit` and there are no superseded prior
 *   versions yet `version > 1`, the prior was overwritten not appended).
 */
export function verifyProvenance(
  parsed: ParsedUWFile,
  policies: readonly EditPolicy[] = BUILTIN_EDIT_POLICIES,
): IntegrityResult {
  const issues: IntegrityIssue[] = [];

  for (const sectionId of Object.keys(parsed.sections)) {
    const head = currentBlock(parsed, sectionId);
    if (!head) continue;
    const policy = matchPolicy(head.meta.source, policies);
    if (!policy) continue;

    // POL-01: authority check
    const actorClass = classifyActor(head.meta.actor, head.meta.source);
    if (!authorityAllows(policy.authority, actorClass)) {
      issues.push({
        code: 'POL-01',
        severity: 'error',
        section: sectionId,
        message: `Actor '${head.meta.actor}' (class '${actorClass}') not authorized to write '${sectionId}' (policy authority '${policy.authority}').`,
      });
    }

    // POL-02: replace-where-supersede-required
    if (
      policy.supersede_on_edit &&
      head.meta.version > 1 &&
      (parsed.superseded[sectionId]?.length ?? 0) === 0
    ) {
      issues.push({
        code: 'POL-02',
        severity: 'error',
        section: sectionId,
        message: `Section '${sectionId}' (source pattern '${policy.source_pattern}') requires supersede_on_edit but version ${head.meta.version} has no superseded prior versions.`,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  return {
    ok: errors === 0,
    issues,
    chains_verified: 0,
    chains_with_hashes: 0,
    signatures_present: 0,
    signatures_verified: 0,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentBlock(parsed: ParsedUWFile, sectionId: string): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry) return null;
  if ('annotation' in (entry as object)) return entry as UWBlock;
  // Multi-variant sections: integrity is per-variant; pick the first variant
  // for now. Fuller treatment is RFC 0009.
  const variants = Object.values(entry as Record<string, UWBlock>);
  return variants[0] ?? null;
}

function matchPolicy(source: string, policies: readonly EditPolicy[]): EditPolicy | null {
  for (const p of policies) {
    if (globMatch(p.source_pattern, source)) return p;
  }
  return null;
}

function globMatch(pattern: string, value: string): boolean {
  // Tiny glob: supports trailing `*` and exact matches. Mirrors editor.ts.
  if (pattern === value) return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1); // keep the '/'
    return value.startsWith(prefix);
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }
  return false;
}

type ActorClass = 'agent' | 'human' | 'system' | 'unknown';

/**
 * Classify from the parsed actor namespace, not string prefixes (RFC 0031).
 * A source outside the actor grammar — a legacy colon form, a bare word, a
 * resolution tag — classifies as `unknown`, never as human by default.
 * `document/*` is likewise `unknown`: a document is evidence, not an
 * authority class.
 */
function classifyActor(actor: string, source: string): ActorClass {
  const s = parseActorSource(source);
  if (s.kind === 'namespaced') {
    if (s.namespace === 'system' || s.namespace === 'institution') return 'system';
    if (s.namespace === 'agent') return 'agent';
  }
  const a = parseActorSource(actor);
  if (a.kind === 'namespaced' && a.namespace === 'agent') return 'agent';
  if (s.kind === 'manual') return 'human';
  return 'unknown';
}

function authorityAllows(authority: EditPolicy['authority'], actor: ActorClass): boolean {
  switch (authority) {
    // `unknown` passes `either`: refusing it would turn every legacy source in
    // the wild into a POL-01, which is a migration, not a bug fix. It can
    // never satisfy the three restricted classes below.
    case 'either':
      return actor !== 'system';
    case 'agent_only':
      return actor === 'agent';
    case 'human_only':
      return actor === 'human';
    case 'system_only':
      return actor === 'system';
    default:
      return false;
  }
}
