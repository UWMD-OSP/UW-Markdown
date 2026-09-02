// RFC 0009 — `uwmd migrate --to-v2`: convert a whole v1.x file to the v2
// nested `_meta` shape (`uw_version: "2.0"`).
//
// This is a whole-file conversion, never a per-block one: a file's
// `uw_version` is global (RFC 0009 § One shape per file), so every block is
// reshaped, `field_overrides` lifts to the block-level `_overrides`
// annotation, `resolution: "manual"` is rewritten to `user_input` (the
// vocabulary leaves `SOURCE_TAGS` at 2.0 — recorded in `provenance.notes`),
// and every stamped `content_hash` / `parent_hash` chain is recomputed under
// the v2 canonicalization rule.
//
// Signatures do not survive migration — they commit to the v1 `content_hash`,
// and re-stamping changes it. The choice between re-signing and stripping
// belongs to the key holder, never to this tool: with neither option the
// migration REFUSES a file containing signed blocks, listing them.
//
// Refusal over guesswork, throughout (the `migrate --source-tags` doctrine):
// a block whose JSON does not parse, or whose `_meta.source` is a legacy
// resolution tag (no recoverable actor — run `--source-tags` first), refuses
// the whole migration rather than emitting a file that is schema-invalid v2.

import { canonicalizeV2 } from './integrity-canonical.js';
import {
  canonicalV2BlockContent,
  detectMetaShape,
  reshapeMetaV1toV2,
  reshapeMetaV2toV1,
  uwVersionMajor,
} from './meta-shape.js';
import type { UWMetaV2 } from './meta-shape.js';
import { sha256TextHex } from './integrity.js';
import type { UWBlockSignature, UWFieldOverride, UWMeta } from './types.js';
import { SOURCE_TAGS } from './types.js';

const FENCE_OPEN_RE = /^```json\s+uw:section=(\S+)(.*)?$/;
const FENCE_CLOSE_RE = /^```\s*$/;
const FRONTMATTER_RE = /^---\s*$/;

/** The canonical resolution tags — a legacy-tag `_meta.source` has no
 *  recoverable actor and must go through `migrate --source-tags` first.
 *  (`manual` left SOURCE_TAGS at 2.0; it is an actor, never a legacy tag.) */
const LEGACY_RESOLUTION_TAGS: ReadonlySet<string> = new Set(SOURCE_TAGS);

/** What the CLI hands the re-signing callback for one migrated block. */
export interface ResignRequest {
  section: string;
  /** The block's freshly recomputed v2 content_hash. */
  content_hash: string;
  actor: string;
  timestamp: string;
  /** The signature being replaced (kid/alg travel for key selection). */
  prior: UWBlockSignature;
}

export interface MigrateToV2Options {
  /** Remove signatures, recording each removal in `provenance.notes`. */
  stripSignatures?: boolean;
  /**
   * Re-sign each previously signed block over its new v2 digest. Injected by
   * the CLI (crypto lives in `@uwmd/signing`); the engine stays crypto-free.
   * Mutually exclusive with `stripSignatures`.
   */
  resign?: (request: ResignRequest) => Promise<UWBlockSignature>;
}

export interface MigrateToV2Result {
  ok: boolean;
  /** The migrated document; null when the migration refused. */
  content: string | null;
  /** Blocks reshaped to the nested form. */
  changed: number;
  /** Blocks whose content_hash was recomputed under the v2 rule. */
  restamped: number;
  /** Why the migration refused (empty when ok). */
  refusals: string[];
  /** What the migration did beyond reshaping (vocabulary rewrites, stripped
   *  or re-issued signatures). */
  notes: string[];
}

interface ScannedBlock {
  /** Index into the output line array where the fence line sits. */
  outIndex: number;
  fenceLine: string;
  jsonLines: string[];
  closed: boolean;
  closeLine: string | null;
  section: string;
  variant: string;
  parsed: Record<string, unknown>;
  flatMeta: UWMeta;
  nestedMeta: UWMetaV2;
  overrides: UWFieldOverride[] | undefined;
  hadHash: boolean;
  priorSignature: UWBlockSignature | undefined;
}

/**
 * Convert one v1.x document to the v2 shape. Bytes outside frontmatter's
 * `uw_version` line and the section blocks are preserved exactly; every block
 * is re-serialized with 2-space indentation (the corpus convention).
 */
export async function migrateToV2(
  content: string,
  options: MigrateToV2Options = {},
): Promise<MigrateToV2Result> {
  const refusals: string[] = [];
  const notes: string[] = [];

  if (options.stripSignatures && options.resign) {
    return refuse(['--strip-signatures and --resign are mutually exclusive.']);
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r\n|\n/);

  // ── Frontmatter: locate and rewrite uw_version ─────────────────────────────
  let uwVersionLine = -1;
  let declaredVersion: string | undefined;
  if (lines[0]?.trim() === '---') {
    for (let j = 1; j < lines.length && !FRONTMATTER_RE.test(lines[j] as string); j++) {
      const m = /^(\s*uw_version:\s*)(["']?)([^"'\s]+)\2\s*$/.exec(lines[j] as string);
      if (m) {
        uwVersionLine = j;
        declaredVersion = m[3];
        break;
      }
    }
  }
  if (uwVersionLine === -1) {
    return refuse(['File has no uw_version frontmatter line to migrate.']);
  }
  if (uwVersionMajor(declaredVersion) >= 2) {
    return { ok: true, content, changed: 0, restamped: 0, refusals: [], notes: ['Already uw_version 2.x; nothing to do.'] };
  }

  // ── Scan blocks ────────────────────────────────────────────────────────────
  const out: (string | ScannedBlock)[] = [];
  const blocks: ScannedBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    const fence = FENCE_OPEN_RE.exec(line);
    if (!fence) {
      out.push(i === uwVersionLine ? line.replace(/uw_version:.*$/, 'uw_version: "2.0"') : line);
      i++;
      continue;
    }

    const fenceLine = line;
    const section = fence[1] as string;
    const variant = /\bvariant=(\S+)/.exec(fence[2] ?? '')?.[1] ?? '';
    const jsonLines: string[] = [];
    i++;
    while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i] as string)) {
      jsonLines.push(lines[i] as string);
      i++;
    }
    const closed = i < lines.length;
    const closeLine = closed ? (lines[i] as string) : null;
    if (closed) i++;

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(jsonLines.join('\n')) as Record<string, unknown>;
    } catch (err) {
      refusals.push(`Section '${section}': JSON does not parse (${(err as Error).message}); repair it before migrating.`);
      continue;
    }

    const rawMeta = parsed['_meta'] as Record<string, unknown> | undefined;
    if (rawMeta === undefined) {
      // A block with no _meta at all carries nothing to reshape.
      out.push(fenceLine, ...jsonLines);
      if (closeLine !== null) out.push(closeLine);
      continue;
    }

    // Normalize either input shape through the flat view; a nested block in a
    // 1.x file is META-V2-IN-V1, but migrating it forward is strictly better
    // than refusing over it.
    const shape = detectMetaShape(rawMeta);
    const flatMeta =
      shape === 'v2'
        ? reshapeMetaV2toV1(
            rawMeta as unknown as UWMetaV2,
            parsed['_overrides'] as UWFieldOverride[] | undefined,
          )
        : (rawMeta as unknown as UWMeta);

    if (typeof flatMeta.source === 'string' && LEGACY_RESOLUTION_TAGS.has(flatMeta.source)) {
      refusals.push(
        `Section '${section}': _meta.source '${flatMeta.source}' is a legacy resolution tag with no recoverable actor. Run 'uwmd migrate --source-tags' first.`,
      );
      continue;
    }

    const entry: ScannedBlock = {
      outIndex: out.length,
      fenceLine,
      jsonLines,
      closed,
      closeLine,
      section,
      variant,
      parsed,
      flatMeta,
      nestedMeta: reshapeMetaV1toV2(flatMeta),
      overrides: flatMeta.field_overrides,
      hadHash: typeof flatMeta.content_hash === 'string',
      priorSignature: flatMeta.signature,
    };
    out.push(entry);
    blocks.push(entry);
  }

  // ── Signature policy ───────────────────────────────────────────────────────
  const signed = blocks.filter((b) => b.priorSignature !== undefined);
  if (signed.length > 0 && !options.stripSignatures && !options.resign) {
    const which = signed.map((b) => `'${b.section}'`).join(', ');
    refusals.push(
      `File contains ${signed.length} signed block(s) (${which}). A signature commits to the v1 content_hash, which migration re-stamps. Pass --resign (with the signing key) or --strip-signatures to state what should happen to them.`,
    );
  }

  if (refusals.length > 0) return refuse(refusals);

  // ── Vocabulary repair + hash re-stamp, chain by chain ──────────────────────
  let restamped = 0;
  const chains = new Map<string, ScannedBlock[]>();
  for (const b of blocks) {
    const key = `${b.section} ${b.variant}`;
    const chain = chains.get(key) ?? [];
    chain.push(b);
    chains.set(key, chain);
  }

  for (const b of blocks) {
    // `manual` leaves SOURCE_TAGS at 2.0 — `user_input` is the method spelling.
    if ((b.nestedMeta.provenance.resolution as string | undefined) === 'manual') {
      b.nestedMeta.provenance.resolution = 'user_input';
      appendNote(b.nestedMeta, "resolution 'manual' rewritten to 'user_input' by uwmd migrate --to-v2");
      notes.push(`Section '${b.section}': resolution 'manual' rewritten to 'user_input'.`);
    }
    for (const o of b.overrides ?? []) {
      if (o.resolution === 'manual') o.resolution = 'user_input';
    }
  }

  for (const chain of chains.values()) {
    chain.sort((a, b) => (a.flatMeta.version ?? 0) - (b.flatMeta.version ?? 0));
    let prevNewHash: string | null = null;
    let prevOldHash: string | null = null;
    for (const b of chain) {
      if (!b.hadHash) continue;
      const integrity = (b.nestedMeta.integrity ?? {}) as NonNullable<UWMetaV2['integrity']>;
      b.nestedMeta.integrity = integrity;
      // Re-link the chain — but only where the old link actually held. A
      // parent_hash that did NOT match its parent's old digest is evidence of
      // a break, and rewriting it to the new digest would silently repair the
      // chain migration was never asked to fix. Broken links carry over
      // verbatim so INT-01 keeps firing on the migrated file.
      if (typeof b.flatMeta.parent_hash === 'string') {
        if (b.flatMeta.parent_hash === prevOldHash && prevNewHash !== null) {
          integrity.parent_hash = prevNewHash;
        } else {
          notes.push(
            `Section '${b.section}': parent_hash did not match the prior block before migration; carried over unchanged (chain stays broken).`,
          );
        }
      }
      // Signature handling before hashing is irrelevant (both are excluded
      // from the digest), but the note it leaves is not — stamp notes first.
      if (b.priorSignature && options.stripSignatures) {
        delete integrity.signature;
        appendNote(b.nestedMeta, `signature stripped at v2 migration (was kid=${b.priorSignature.kid})`);
        notes.push(`Section '${b.section}': signature (kid=${b.priorSignature.kid}) stripped.`);
      }
      delete integrity.content_hash;
      const digestInput = buildContentObject(b, /* forDigest */ true);
      integrity.content_hash = await sha256TextHex(canonicalizeV2(canonicalV2BlockContent(digestInput)));
      restamped++;
      prevNewHash = integrity.content_hash;
      prevOldHash = b.flatMeta.content_hash ?? null;

      if (b.priorSignature && options.resign) {
        const signature = await options.resign({
          section: b.section,
          content_hash: integrity.content_hash,
          actor: b.flatMeta.actor,
          timestamp: b.flatMeta.timestamp,
          prior: b.priorSignature,
        });
        integrity.signature = signature;
        appendNote(b.nestedMeta, `signature re-issued at v2 migration (kid=${signature.kid})`);
        notes.push(`Section '${b.section}': signature re-issued (kid=${signature.kid}).`);
      }
    }
    // Unhashed blocks that carried a signature still need the policy applied.
    for (const b of chain) {
      if (b.hadHash || !b.priorSignature) continue;
      const integrity = (b.nestedMeta.integrity ?? {}) as NonNullable<UWMetaV2['integrity']>;
      b.nestedMeta.integrity = integrity;
      if (options.stripSignatures) {
        delete integrity.signature;
        appendNote(b.nestedMeta, `signature stripped at v2 migration (was kid=${b.priorSignature.kid})`);
        notes.push(`Section '${b.section}': signature (kid=${b.priorSignature.kid}) stripped.`);
      } else if (options.resign) {
        // Nothing to commit to: a signature over an absent content_hash is
        // INT-05. Strip it and say so rather than signing nothing.
        delete integrity.signature;
        appendNote(b.nestedMeta, `signature dropped at v2 migration: block has no content_hash to commit to (was kid=${b.priorSignature.kid})`);
        notes.push(`Section '${b.section}': signature dropped (no content_hash; INT-05 territory).`);
      }
      if (Object.keys(integrity).length === 0) delete b.nestedMeta.integrity;
    }
  }

  // ── Emit ───────────────────────────────────────────────────────────────────
  const emitted: string[] = [];
  let changed = 0;
  for (const item of out) {
    if (typeof item === 'string') {
      emitted.push(item);
      continue;
    }
    changed++;
    emitted.push(item.fenceLine, ...JSON.stringify(buildContentObject(item, false), null, 2).split('\n'));
    if (item.closeLine !== null) emitted.push(item.closeLine);
  }

  return { ok: true, content: emitted.join(eol), changed, restamped, refusals: [], notes };

  function refuse(why: string[]): MigrateToV2Result {
    return { ok: false, content: null, changed: 0, restamped: 0, refusals: why, notes };
  }
}

/** Assemble the final block content: `_meta` first, `_overrides` second, then
 *  the original content keys in their original order. */
function buildContentObject(b: ScannedBlock, forDigest: boolean): Record<string, unknown> {
  const outObj: Record<string, unknown> = { _meta: b.nestedMeta };
  if (b.overrides !== undefined && b.overrides.length > 0) outObj['_overrides'] = b.overrides;
  for (const [k, v] of Object.entries(b.parsed)) {
    if (k === '_meta' || k === '_overrides') continue;
    outObj[k] = v;
  }
  // The digest input is identical to the emitted object — the excluded keys
  // are stripped by canonicalizeV2, not here. The flag exists only to make
  // call sites self-documenting.
  void forDigest;
  return outObj;
}

function appendNote(meta: UWMetaV2, note: string): void {
  const prior = meta.provenance.notes;
  meta.provenance.notes = prior ? `${prior}; ${note}` : note;
}
