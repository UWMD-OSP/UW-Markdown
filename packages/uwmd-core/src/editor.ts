// Tier-2 Editor — applyEdit() dispatcher for the four EditOperation kinds
// defined in protocol.ts (UW_PROTOCOL_v1.md §V.2):
//
//   - frontmatter_set
//   - section_replace
//   - section_supersede
//   - pipeline_log_append
//
// Honors BUILTIN_EDIT_POLICIES authority + supersede_on_edit semantics
// (UW_PROTOCOL_v1.md §V.3) and protects the immutable frontmatter fields
// from §V.6 (uw_version, deal_id, created).
//
// Pure: no I/O. The runner consumes the returned content string and the
// caller writes it back to disk.

import type { ParsedUWFile, UWBlock, UWMeta } from './types.js';
import type {
  CapabilityVerifier,
  EditAuthority,
  EditOperation,
  EditPolicy,
  ProtocolError,
} from './protocol.js';
import { BUILTIN_EDIT_POLICIES, parseActorSource } from './protocol.js';
import { getSection, getSectionVariant, parseUWFile } from './parser.js';
import { buildMeta } from './runner.js';
import { inferGaps, summarizeGaps } from './gaps.js';
import { computeBlockHash } from './integrity.js';
import { isV2File, stampMetaIntoBlockContent, bumpRawMetaVersion, reshapeMetaV1toV2 } from './meta-shape.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Identity of the actor performing the edit. The dispatcher uses `source` to
 * resolve an EditPolicy and to stamp `_meta.source` on the new block.
 */
export interface EditContext {
  /** Human name, system identifier, or agent ID. Stamped on `_meta.actor`. */
  actor: string;
  /** Provenance pattern. Examples: "manual", "agent/L6", "document/rent_roll", "system/init", "institution/abc-bank". */
  source: string;
  /** Agent identifier when source begins with "agent/". */
  agentId?: string | null;
  /** Agent semver. */
  agentVersion?: string | null;
  /** Confidence to stamp on new blocks. Defaults to 'medium'. */
  confidence?: 'high' | 'medium' | 'low';
  /** Free-form `_meta.notes` for the new block. */
  notes?: string;
  /**
   * SHA-256 content_hash of the section's current head, captured at read time.
   * Required when the head carries `_meta.content_hash` AND the caller is
   * editing through `applyEditAsync` with `integrity: true`. A mismatch with
   * the live head triggers INT-02 (concurrent write detected).
   */
  parentHash?: string | null;
  /**
   * A capability token authorizing this edit (Protocol §XIV, RFC 0011).
   * Required whenever the editor is configured with
   * `EditOptions.capabilityVerifier`; ignored otherwise.
   */
  capability_token?: string;
}

export interface EditResult {
  ok: boolean;
  /** New file content if the edit applied. Undefined on failure. */
  content?: string;
  /** Protocol error if the edit was rejected. */
  error?: ProtocolError;
  /** Version assigned to the new block (section_* ops). */
  newVersion?: number;
  /** True if a prior block was marked superseded. */
  supersededPriorBlock?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Frontmatter fields that MUST NOT be modified post-init (UW_PROTOCOL_v1.md §V.6). */
const IMMUTABLE_FRONTMATTER_FIELDS: readonly string[] = [
  'uw_version',
  'deal_id',
  'created',
];

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Optional behaviors that layer on top of the base edit. Currently:
 *   - `maintainGaps`: after a successful section or frontmatter edit, re-parse
 *     the file, recompute gaps via inferGaps(mergeWithExisting=true), and
 *     write the result back as the `gaps` section. The maintenance write is
 *     stamped with source='system/gaps-maintainer' so it can be filtered.
 *     Default: false. See FORMAT_SPEC §4.22.
 */
export interface EditOptions {
  maintainGaps?: boolean;
  /**
   * Enable content_hash chain enforcement (UW_PROTOCOL_v1.md §V.10):
   *   - If the section's current head has `_meta.content_hash`, the caller's
   *     `EditContext.parentHash` MUST equal it (else INT-02).
   *   - The new block is stamped with `parent_hash = prior.content_hash`.
   *   - The new block's `content_hash` is computed and stamped.
   * No effect when the prior head carries no content_hash (chain stays opt-out).
   *
   * Only honored by `applyEditAsync` (hashing requires async crypto APIs).
   */
  integrity?: boolean;
  /**
   * When supplied, every write MUST present a `capability_token` the verifier
   * accepts; edits without one, or with a rejected one, fail with POL-03
   * (Protocol §XIV, RFC 0011). The static §V.3 authority check still runs
   * first — a token narrows authority, it never overrides a policy refusal.
   *
   * Honored by `applyEditAsync` only (verification is async crypto). The sync
   * `applyEdit` with this option set REFUSES the edit (PROTO-EDIT-008) rather
   * than silently skipping the check.
   */
  capabilityVerifier?: CapabilityVerifier;
}

export function applyEdit(
  fileContent: string,
  parsed: ParsedUWFile,
  op: EditOperation,
  ctx: EditContext,
  policies: readonly EditPolicy[] = BUILTIN_EDIT_POLICIES,
  options: EditOptions = {},
): EditResult {
  // A configured capability verifier can only be honored on the async path
  // (verification is Web Crypto). Refusing here is deliberate: silently
  // skipping the check would turn a mis-wired call site into an authorization
  // bypass (Protocol §XIV, RFC 0011).
  if (options.capabilityVerifier) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-008',
        'A capabilityVerifier is configured but applyEdit is synchronous; use applyEditAsync, which performs the (async) token verification.',
      ),
    };
  }

  // INT-02: stale parent hash detection (sync portion). When the section head
  // carries content_hash, ctx.parentHash must match it. The async stamping of
  // the new block's content_hash happens in applyEditAsync.
  if ((op.kind === 'section_replace' || op.kind === 'section_supersede')) {
    const head = lookupSection(parsed, op.section_id, op.variant);
    const headHash = head?.meta?.content_hash;
    if (headHash && ctx.parentHash != null && ctx.parentHash !== headHash) {
      return {
        ok: false,
        error: protoError(
          'INT-02',
          `Stale parent_hash for '${op.section_id}': caller-supplied '${ctx.parentHash}' does not match current head '${headHash}'. Re-read and retry.`,
          op.section_id,
        ),
      };
    }
  }

  const result = dispatchEdit(fileContent, parsed, op, ctx, policies);
  if (!result.ok || !result.content) return result;

  // Skip gap maintenance when this very edit is itself the gaps maintenance
  // write — prevents infinite recursion.
  const isGapsWrite =
    (op.kind === 'section_replace' || op.kind === 'section_supersede') &&
    op.section_id === 'gaps';
  if (!options.maintainGaps || isGapsWrite) return result;

  return maintainGapsAfterEdit(result, policies);
}

/**
 * Async wrapper around `applyEdit` that adds content_hash chain stamping when
 * `options.integrity` is set AND the section's prior head carried a
 * `content_hash`. Otherwise behaves identically to `applyEdit`.
 *
 * Hashing is async because Web Crypto's SHA-256 is async; this preserves the
 * sync `applyEdit` API surface for callers that don't need integrity.
 */
export async function applyEditAsync(
  fileContent: string,
  parsed: ParsedUWFile,
  op: EditOperation,
  ctx: EditContext,
  policies: readonly EditPolicy[] = BUILTIN_EDIT_POLICIES,
  options: EditOptions = {},
): Promise<EditResult> {
  // Capability gate (Protocol §XIV, RFC 0011). Runs before the write, after
  // nothing — but note the static §V.3 authority check inside dispatchEdit
  // still applies to whatever this gate admits: a token narrows authority,
  // it never overrides a policy refusal. On success the token's jti is
  // recorded in the new block's notes as `capability:<jti>`.
  const { capabilityVerifier, ...restOptions } = options;
  if (capabilityVerifier) {
    const section =
      op.kind === 'frontmatter_set' ? '_frontmatter'
      : op.kind === 'pipeline_log_append' ? 'pipeline_log'
      : op.section_id;
    if (!ctx.capability_token) {
      return {
        ok: false,
        error: protoError(
          'POL-03',
          'This editor requires a capability token and the edit presented none.',
          section,
        ),
      };
    }
    const verdict = await capabilityVerifier.verify(ctx.capability_token, {
      deal_id: parsed.frontmatter.deal_id ?? '',
      section,
      stage: parsed.frontmatter.deal_stage ?? null,
      op: op.kind,
      source: ctx.source,
    });
    if (!verdict.ok) {
      return {
        ok: false,
        error: protoError(
          'POL-03',
          `Capability token rejected: ${verdict.reason}.`,
          section,
        ),
      };
    }
    const jtiNote = `capability:${verdict.jti}`;
    ctx = { ...ctx, notes: ctx.notes ? `${ctx.notes}; ${jtiNote}` : jtiNote };
  }

  const result = applyEdit(fileContent, parsed, op, ctx, policies, restOptions);
  if (!result.ok || !result.content || !options.integrity) return result;
  if (op.kind !== 'section_replace' && op.kind !== 'section_supersede') return result;

  const priorHead = lookupSection(parsed, op.section_id, op.variant);
  const priorHash = priorHead?.meta?.content_hash;
  if (!priorHash) return result; // chain stays opt-out when prior is unhashed

  const reparsed = parseUWFile(result.content);
  const newHead = lookupSection(reparsed, op.section_id, op.variant);
  if (!newHead) return result;

  // Stamp parent_hash + content_hash on the new head. Canonicalization is
  // versioned by the file's uw_version (RFC 0009 — the v2 rule for 2.0 files).
  const v2 = isV2File(reparsed.frontmatter);
  newHead.meta.parent_hash = priorHash;
  // Compute over the block (canonicalizer strips content_hash itself).
  newHead.meta.content_hash = await computeBlockHash(newHead, { shape: v2 ? 'v2' : 'v1' });

  const stamped = restampBlockMeta(result.content, newHead, v2);
  return { ...result, content: stamped };
}

/**
 * Re-emit a single block in `content` with a fresh _meta payload. Locates the
 * block by lineStart/lineEnd from the parsed AST and rewrites only that range.
 * `block.meta` is always the flat in-memory view; for a v2 file it is
 * reshaped back to the nested on-disk form (with the `_overrides` lift).
 */
function restampBlockMeta(content: string, block: UWBlock, v2: boolean): string {
  const lines = content.split('\n');
  const fence = lines[block.lineStart - 1] ?? '';
  const closing = lines[block.lineEnd - 1] ?? '```';
  let updatedContent: Record<string, unknown>;
  if (v2) {
    const { field_overrides, ...rest } = block.meta;
    updatedContent = { ...block.content, _meta: reshapeMetaV1toV2(rest as UWMeta) as unknown };
    delete updatedContent['_overrides'];
    if (field_overrides !== undefined && field_overrides.length > 0) {
      updatedContent['_overrides'] = field_overrides;
    }
  } else {
    updatedContent = { ...block.content, _meta: block.meta };
  }
  const json = JSON.stringify(updatedContent, null, 2);
  const before = lines.slice(0, block.lineStart - 1);
  const after = lines.slice(block.lineEnd);
  return [...before, fence, ...json.split('\n'), closing, ...after].join('\n');
}

function dispatchEdit(
  fileContent: string,
  parsed: ParsedUWFile,
  op: EditOperation,
  ctx: EditContext,
  policies: readonly EditPolicy[],
): EditResult {
  switch (op.kind) {
    case 'frontmatter_set':
      return applyFrontmatterSet(fileContent, op, ctx);
    case 'section_replace':
      return applySectionReplace(fileContent, parsed, op, ctx, policies);
    case 'section_supersede':
      return applySectionSupersede(fileContent, parsed, op, ctx, policies);
    case 'pipeline_log_append':
      return applyPipelineLogAppend(fileContent, parsed, op);
    default: {
      // Exhaustive check — TS will flag a new EditOperation kind that isn't routed.
      const _exhaustive: never = op;
      void _exhaustive;
      return {
        ok: false,
        error: protoError(
          'PROTO-EDIT-007',
          `Unknown EditOperation kind: ${(op as { kind?: string }).kind}`,
        ),
      };
    }
  }
}

function maintainGapsAfterEdit(prior: EditResult, policies: readonly EditPolicy[]): EditResult {
  if (!prior.content) return prior;
  let reparsed: ParsedUWFile;
  try {
    reparsed = parseUWFile(prior.content);
  } catch {
    // If the edit produced unparseable output, surface the original result.
    // The caller is expected to validate before persisting anyway.
    return prior;
  }
  const stage = reparsed.frontmatter.deal_stage ?? 'scope';
  const items = inferGaps(reparsed, { mergeWithExisting: true, stage });
  const summary = summarizeGaps(items, stage);
  const gapsContent = { items, summary };

  const existing = getSection(reparsed, 'gaps');
  const ctx: EditContext = {
    actor: 'system/gaps-maintainer',
    source: 'system/gaps-maintainer',
    confidence: 'high',
    notes: 'Auto-maintained by editor; see FORMAT_SPEC §4.22.',
  };
  const op: EditOperation = existing
    ? {
        kind: 'section_replace',
        section_id: 'gaps',
        content: gapsContent as unknown as Record<string, unknown>,
        meta: { confidence: 'high' },
      }
    : {
        kind: 'section_supersede',
        section_id: 'gaps',
        content: gapsContent as unknown as Record<string, unknown>,
        meta: { confidence: 'high' },
      };

  const after = dispatchEdit(prior.content, reparsed, op, ctx, policies);
  if (!after.ok) return prior; // best-effort: if maintenance fails, keep the prior result
  return { ...prior, content: after.content };
}

// ─── frontmatter_set ──────────────────────────────────────────────────────────

function applyFrontmatterSet(
  fileContent: string,
  op: Extract<EditOperation, { kind: 'frontmatter_set' }>,
  _ctx: EditContext,
): EditResult {
  const { path, value } = op;

  const top = path.split('.')[0];
  if (IMMUTABLE_FRONTMATTER_FIELDS.includes(top)) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-002',
        `Frontmatter field '${top}' is immutable post-init (UW_PROTOCOL_v1.md §V.6).`,
        path,
      ),
    };
  }

  const segments = path.split('.');
  if (segments.length > 2) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-003',
        `Frontmatter dot-paths deeper than 2 levels are not supported in v1; got '${path}'.`,
        path,
      ),
    };
  }

  const now = new Date().toISOString();
  const yamlValue = serializeYamlScalar(value);
  if (yamlValue === null) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-008',
        `Cannot serialize value for path '${path}'; only scalars and arrays of scalars are supported in v1.`,
        path,
      ),
    };
  }

  let updated: string;
  if (segments.length === 1) {
    const next = setFrontmatterTopLevel(fileContent, segments[0], yamlValue);
    if (next === null) {
      return {
        ok: false,
        error: protoError(
          'PROTO-EDIT-009',
          `Frontmatter key '${segments[0]}' not found.`,
          path,
        ),
      };
    }
    updated = next;
  } else {
    const next = setFrontmatterNested(fileContent, segments[0], segments[1], yamlValue);
    if (next === null) {
      return {
        ok: false,
        error: protoError(
          'PROTO-EDIT-009',
          `Frontmatter path '${path}' not found.`,
          path,
        ),
      };
    }
    updated = next;
  }

  // last_modified always bumped (§V.6) — unless the edit *was* last_modified.
  if (top !== 'last_modified') {
    const stamped = setFrontmatterTopLevel(updated, 'last_modified', `"${now}"`);
    if (stamped !== null) updated = stamped;
  }

  return { ok: true, content: updated };
}

// ─── section_replace ──────────────────────────────────────────────────────────

function applySectionReplace(
  fileContent: string,
  parsed: ParsedUWFile,
  op: Extract<EditOperation, { kind: 'section_replace' }>,
  ctx: EditContext,
  policies: readonly EditPolicy[],
): EditResult {
  const existing = lookupSection(parsed, op.section_id, op.variant);
  if (!existing) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-005',
        `Cannot section_replace '${op.section_id}'${op.variant ? ` variant=${op.variant}` : ''}: section not found. Use section_supersede or write a new section.`,
        op.section_id,
      ),
    };
  }

  const existingSource = existing.meta?.source ?? 'manual';
  const policy = resolvePolicy(existingSource, policies);
  const auth = checkAuthority(ctx.source, policy);
  if (!auth.ok) {
    return {
      ok: false,
      error: protoError('PROTO-EDIT-001', auth.message, op.section_id),
    };
  }

  if (policy?.supersede_on_edit) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-004',
        `Source '${existingSource}' requires supersede_on_edit; use section_supersede for '${op.section_id}'.`,
        op.section_id,
      ),
    };
  }

  const newVersion = (existing.meta?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const meta = buildMeta(op.section_id, newVersion, {
    source: ctx.source,
    agentId: ctx.agentId ?? undefined,
    agentVersion: ctx.agentVersion ?? undefined,
    actor: ctx.actor,
    confidence: ctx.confidence ?? 'medium',
    notes: ctx.notes,
  });
  // buildMeta uses Date.now() — pin to the timestamp that frontmatter is also bumped to.
  meta.timestamp = now;

  // Allow the operation's `meta` partial to override scalar fields (e.g. flags, confidence).
  const finalMeta: UWMeta = { ...meta, ...op.meta, version: newVersion, superseded: false } as UWMeta;
  const blockContent = stripReservedKeys(op.content);
  // Emit the shape the file's uw_version demands (RFC 0009: nested for 2.0).
  stampMetaIntoBlockContent(blockContent, finalMeta, isV2File(parsed.frontmatter));

  const annotation = buildFenceAnnotation(op.section_id, op.variant, ctx.source, now, newVersion, finalMeta.confidence);
  const blockJson = JSON.stringify(blockContent, null, 2);
  const newBlockText = `${annotation}\n${blockJson}\n\`\`\``;

  const lines = fileContent.split('\n');
  const before = lines.slice(0, existing.lineStart - 1);
  const after = lines.slice(existing.lineEnd);
  const replaced = [...before, ...newBlockText.split('\n'), ...after].join('\n');

  const stamped = setFrontmatterTopLevel(replaced, 'last_modified', `"${now}"`) ?? replaced;
  return { ok: true, content: stamped, newVersion, supersededPriorBlock: false };
}

// ─── section_supersede ────────────────────────────────────────────────────────

function applySectionSupersede(
  fileContent: string,
  parsed: ParsedUWFile,
  op: Extract<EditOperation, { kind: 'section_supersede' }>,
  ctx: EditContext,
  policies: readonly EditPolicy[],
): EditResult {
  const existing = lookupSection(parsed, op.section_id, op.variant);

  if (existing) {
    const existingSource = existing.meta?.source ?? 'manual';
    const policy = resolvePolicy(existingSource, policies);
    const auth = checkAuthority(ctx.source, policy);
    if (!auth.ok) {
      return {
        ok: false,
        error: protoError('PROTO-EDIT-001', auth.message, op.section_id),
      };
    }
  }
  // No existing block → new section. Allowed regardless of policy.

  const newVersion = (existing?.meta?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const meta = buildMeta(op.section_id, newVersion, {
    source: ctx.source,
    agentId: ctx.agentId ?? undefined,
    agentVersion: ctx.agentVersion ?? undefined,
    actor: ctx.actor,
    confidence: ctx.confidence ?? 'medium',
    notes: ctx.notes,
  });
  meta.timestamp = now;
  const finalMeta: UWMeta = { ...meta, ...op.meta, version: newVersion, superseded: false } as UWMeta;
  const blockContent = stripReservedKeys(op.content);
  stampMetaIntoBlockContent(blockContent, finalMeta, isV2File(parsed.frontmatter));

  let lines = fileContent.split('\n');
  let supersededPriorBlock = false;
  if (existing && !existing.meta?.superseded) {
    lines = markBlockSuperseded(lines, existing);
    supersededPriorBlock = true;
  }

  const annotation = buildFenceAnnotation(op.section_id, op.variant, ctx.source, now, newVersion, finalMeta.confidence);
  const blockJson = JSON.stringify(blockContent, null, 2);
  const newBlockText = `${annotation}\n${blockJson}\n\`\`\``;

  // Re-parse after marking superseded so insertion point math is current.
  const reparsedAfterMark = parseUWFile(lines.join('\n'));
  const insertAt = findInsertionPoint(lines, reparsedAfterMark);
  lines.splice(insertAt, 0, '', newBlockText, '');

  const stamped = setFrontmatterTopLevel(lines.join('\n'), 'last_modified', `"${now}"`) ?? lines.join('\n');
  return { ok: true, content: stamped, newVersion, supersededPriorBlock };
}

// ─── pipeline_log_append ──────────────────────────────────────────────────────

function applyPipelineLogAppend(
  fileContent: string,
  parsed: ParsedUWFile,
  op: Extract<EditOperation, { kind: 'pipeline_log_append' }>,
): EditResult {
  if (parsed.pipeline_log.length === 0) {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-006',
        'No pipeline_log block exists to append to. Initialize one via the runner or create the section first.',
        'pipeline_log',
      ),
    };
  }

  const lastLogBlock = parsed.pipeline_log[parsed.pipeline_log.length - 1];
  let blockContent: Record<string, unknown>;
  try {
    blockContent = JSON.parse(lastLogBlock.rawJson) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: protoError(
        'PROTO-EDIT-006',
        'pipeline_log block JSON is malformed; cannot append entry.',
        'pipeline_log',
      ),
    };
  }

  const entries = (blockContent['entries'] as unknown[]) ?? [];
  entries.push(op.entry);
  blockContent['entries'] = entries;

  const now = new Date().toISOString();
  const meta = (blockContent['_meta'] as Record<string, unknown> | undefined) ?? {};
  // Shape-aware bump: v2 pipeline blocks carry lifecycle.revision /
  // provenance.timestamp (RFC 0009); the fence v= mirror gets either.
  const nextVersion = bumpRawMetaVersion(meta, now);
  blockContent['_meta'] = meta;

  const updatedJson = JSON.stringify(blockContent, null, 2);
  const lines = fileContent.split('\n');
  const newAnnotation = (lines[lastLogBlock.lineStart - 1] ?? '')
    .replace(/\bv=\d+/, `v=${nextVersion}`)
    .replace(/\bts=\S+/, `ts=${now}`);

  lines.splice(
    lastLogBlock.lineStart - 1,
    lastLogBlock.lineEnd - lastLogBlock.lineStart + 1,
    newAnnotation,
    updatedJson,
    '```',
  );

  const stamped = setFrontmatterTopLevel(lines.join('\n'), 'last_modified', `"${now}"`) ?? lines.join('\n');
  return { ok: true, content: stamped };
}

// ─── Policy + authority resolution ────────────────────────────────────────────

/**
 * Resolve the most-specific policy for a given source string. Specificity is
 * "longer pattern wins"; an exact (non-glob) match always wins.
 */
export function resolvePolicy(
  source: string,
  policies: readonly EditPolicy[] = BUILTIN_EDIT_POLICIES,
): EditPolicy | null {
  let best: { policy: EditPolicy; score: number } | null = null;
  for (const policy of policies) {
    const m = matchSource(source, policy.source_pattern);
    if (!m.matched) continue;
    if (!best || m.score > best.score) best = { policy, score: m.score };
  }
  return best ? best.policy : null;
}

function matchSource(source: string, pattern: string): { matched: boolean; score: number } {
  if (pattern === source) return { matched: true, score: 1_000_000 };
  if (!pattern.includes('*')) return { matched: false, score: 0 };
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}$`);
  if (re.test(source)) return { matched: true, score: pattern.length };
  return { matched: false, score: 0 };
}

function checkAuthority(
  actorSource: string,
  policy: EditPolicy | null,
): { ok: true } | { ok: false; message: string } {
  // No policy means the caller supplied a policy list with no catch-all —
  // BUILTIN_EDIT_POLICIES always terminates in one. Refuse rather than grant:
  // a list that does not cover a source is an incomplete policy, and reading
  // that as authorization is how the unpoliced-write path opened.
  if (!policy) {
    const remedy = 'cover every source, or include a catch-all as BUILTIN_EDIT_POLICIES does';
    return {
      ok: false,
      message: `No edit policy matches source '${actorSource}'. The supplied policy list must ${remedy}.`,
    };
  }

  // Classify from the parsed actor namespace, never from string prefixes
  // (RFC 0031). The prefix test's negative space was the bug: anything that
  // wasn't `system/`/`agent/` counted as human, so the malformed colon form
  // `agent:L0-01` — and every bare resolution tag — was classified as a human
  // write. A source outside the grammar now classifies as *nothing*: it can
  // still write wherever authority is 'either', but it can never satisfy
  // human_only, agent_only, or system_only. `document/*` is likewise none of
  // the three — a document is evidence, not an authority class.
  const actor = parseActorSource(actorSource);
  const isSystem = actor.kind === 'namespaced'
    && (actor.namespace === 'system' || actor.namespace === 'institution');
  const isAgent = actor.kind === 'namespaced' && actor.namespace === 'agent';
  const isHuman = actor.kind === 'manual';

  const allowed = (auth: EditAuthority): boolean => {
    switch (auth) {
      case 'either':
        return true;
      case 'system_only':
        return isSystem;
      case 'agent_only':
        return isAgent;
      case 'human_only':
        return isHuman;
    }
  };

  if (allowed(policy.authority)) return { ok: true };
  return {
    ok: false,
    message: `Actor source '${actorSource}' is not permitted under policy authority '${policy.authority}' for source pattern '${policy.source_pattern}'.`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lookupSection(
  parsed: ParsedUWFile,
  sectionId: string,
  variant: string | undefined,
): UWBlock | null {
  return variant
    ? getSectionVariant(parsed, sectionId, variant)
    : getSection(parsed, sectionId);
}

function buildFenceAnnotation(
  sectionId: string,
  variant: string | undefined,
  source: string,
  ts: string,
  version: number,
  confidence: string,
): string {
  const variantPart = variant ? ` variant=${variant}` : '';
  return `\`\`\`json uw:section=${sectionId}${variantPart} source=${source} ts=${ts} v=${version} confidence=${confidence}`;
}

function stripReservedKeys(content: Record<string, unknown>): Record<string, unknown> {
  // The dispatcher constructs canonical _meta. Drop any caller-supplied _meta
  // or _notes from `content` to mirror Tier-4's _meta substitution rule
  // (UW_PROTOCOL_v1.md §IX.4) — same logic, applied at Tier-2.
  const { _meta: _drop1, _notes: _drop2, ...rest } = content;
  void _drop1;
  void _drop2;
  return { ...rest };
}

function markBlockSuperseded(lines: string[], block: UWBlock): string[] {
  const result = [...lines];
  const fenceIdx = block.lineStart - 1;
  if (fenceIdx >= 0 && fenceIdx < result.length) {
    const fenceLine = result[fenceIdx];
    if (fenceLine && !fenceLine.includes('superseded=true')) {
      result[fenceIdx] = fenceLine.replace(
        /^(```json\s+uw:section=\S+(?:\s+variant=\S+)?)/,
        '$1 superseded=true',
      );
    }
  }
  for (let i = block.lineStart; i < block.lineEnd - 1; i++) {
    const line = result[i];
    if (line?.includes('"superseded": false')) {
      result[i] = line.replace('"superseded": false', '"superseded": true');
      break;
    }
  }
  return result;
}

function findInsertionPoint(lines: string[], parsed: ParsedUWFile): number {
  if (parsed.pipeline_log.length > 0) {
    const firstLogBlock = parsed.pipeline_log[0];
    let idx = firstLogBlock.lineStart - 2;
    while (idx > 0 && lines[idx]?.trim() === '') idx--;
    if (lines[idx]?.trim().startsWith('##')) idx--;
    while (idx > 0 && lines[idx - 1]?.trim() === '') idx--;
    return idx + 1;
  }
  return lines.length;
}

// ─── Frontmatter setters ──────────────────────────────────────────────────────

function setFrontmatterTopLevel(content: string, key: string, yamlValue: string): string | null {
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return null;

  const fm = content.slice(0, fmEnd);
  const rest = content.slice(fmEnd);

  const pattern = new RegExp(`^(${escapeRegex(key)}:\\s*)(.+)$`, 'm');
  if (!pattern.test(fm)) return null;
  return fm.replace(pattern, `$1${yamlValue}`) + rest;
}

function setFrontmatterNested(
  content: string,
  parentKey: string,
  childKey: string,
  yamlValue: string,
): string | null {
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return null;

  const fm = content.slice(0, fmEnd);
  const rest = content.slice(fmEnd);

  const parentIdx = fm.indexOf(`\n${parentKey}:`);
  if (parentIdx === -1) return null;

  const pattern = new RegExp(
    `(\\n${escapeRegex(parentKey)}:[^\\n]*(?:\\n  [^\\n]+)*\\n  ${escapeRegex(childKey)}:\\s*)([^\\n]+)`,
  );
  if (!pattern.test(fm)) return null;
  return fm.replace(pattern, `$1${yamlValue}`) + rest;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Serialize a JS scalar/array into its YAML literal form for inline frontmatter
 * substitution. Returns null if the value is too complex for v1 (objects).
 */
function serializeYamlScalar(value: unknown): string | null {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value); // double-quoted
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const el of value) {
      const s = serializeYamlScalar(el);
      if (s === null) return null;
      parts.push(s);
    }
    return `[${parts.join(', ')}]`;
  }
  return null; // objects unsupported in v1
}

function protoError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'edit', code, message, ...(pointer ? { pointer } : {}) };
}
