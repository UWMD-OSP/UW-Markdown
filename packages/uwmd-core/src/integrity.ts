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

import { canonicalize } from './integrity-canonical.js';
import type { ParsedUWFile, UWBlock } from './types.js';
import type { EditPolicy } from './protocol.js';
import { BUILTIN_EDIT_POLICIES } from './protocol.js';

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
 */
export async function computeBlockHash(block: UWBlock): Promise<string> {
  // The canonical scope is the block CONTENT including meta, since meta
  // carries the cascade-relevant provenance. The two excluded keys are
  // stripped by the canonicalizer.
  return sha256Hex({ ...block.content, _meta: block.meta });
}

// ─── Public types ────────────────────────────────────────────────────────────

export type IntegrityCode = 'INT-01' | 'INT-02' | 'INT-03' | 'INT-04' | 'POL-01' | 'POL-02';

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
 * `chains_verified`.
 */
export async function verifyChain(parsed: ParsedUWFile): Promise<IntegrityResult> {
  const issues: IntegrityIssue[] = [];
  let chainsWithHashes = 0;
  let chainsVerified = 0;

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
      const recomputed = await computeBlockHash(block);
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

  const errors = issues.filter((i) => i.severity === 'error').length;
  return {
    ok: errors === 0,
    issues,
    chains_verified: chainsVerified,
    chains_with_hashes: chainsWithHashes,
  };
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

type ActorClass = 'agent' | 'human' | 'system';

function classifyActor(actor: string, source: string): ActorClass {
  if (source.startsWith('system/') || source.startsWith('institution/')) return 'system';
  if (source.startsWith('agent/') || actor.startsWith('agent/')) return 'agent';
  return 'human';
}

function authorityAllows(authority: EditPolicy['authority'], actor: ActorClass): boolean {
  switch (authority) {
    case 'either':
      return actor === 'agent' || actor === 'human';
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
