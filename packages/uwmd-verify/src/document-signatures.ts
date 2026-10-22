import { hasBlockShape } from './block-kind.js';
// RFC 0084 / Protocol §V.13: crypto-free authentication of a document snapshot.
import { canonicalize, InvalidUnicodeError } from './integrity-canonical.js';
import { computeEnvelopeDigest, toUWEnvelope, type UWDocumentEnvelope } from './envelope.js';
import { parseUWFile } from './parser.js';
import { UW_SIGNATURE_ALGORITHMS, type UWBlock, type UWSignatureAlgorithm } from './types.js';

export interface DocumentSigningSubject {
  representation: 'uwx-markdown';
  representation_version: '1.0';
  canonicalization: 'uw-envelope-semantic';
  canonicalization_version: '1.0';
  digest: string;
}
export interface UWDocumentSignature {
  kind: 'uwmd-document-signature';
  signature_version: '1';
  subject: DocumentSigningSubject;
  alg: UWSignatureAlgorithm;
  kid: string;
  signed_at: string;
  sig: string;
}
export type DocumentSignatureCode = 'INT-09' | 'INT-10' | 'INT-11' | 'INT-12' | 'INT-13' | 'INT-14' | 'INT-15';
export interface DocumentSignatureIssue { code: DocumentSignatureCode; message: string }
export type DocumentSignatureResult =
  | { state: 'verified'; kid: string; digest: string; issues: DocumentSignatureIssue[] }
  | { state: 'unsigned'; reason: 'missing_signature'; issues: DocumentSignatureIssue[] }
  | { state: 'unverifiable'; reason: 'unknown_kid' | 'no_backend' | 'unsupported_version' | 'backend_error'; issues: DocumentSignatureIssue[] }
  | { state: 'failed'; reason: 'malformed' | 'bad_signature' | 'algorithm_mismatch' | 'subject_mismatch' | 'malformed_source'; issues: DocumentSignatureIssue[] };
export interface DocumentSignatureVerifier {
  verify(payload: string, signature: UWDocumentSignature): Promise<
    { ok: true } | { ok: false; reason: 'unknown_kid' | 'bad_signature' | 'algorithm_mismatch' | 'malformed' }
  >;
}
export class DocumentSigningError extends Error {
  readonly code = 'INT-15' as const;
  constructor(message: string) { super(message); this.name = 'DocumentSigningError'; }
}

/** Only the signature bytes are omitted; key id, algorithm and scope stay bound. */
export function documentSigningPayload(signature: UWDocumentSignature | Omit<UWDocumentSignature, 'sig'>): string {
  if (!instant(signature.signed_at)) throw new DocumentSigningError('Invalid document signing instant.');
  const { sig: _sig, ...input } = signature as UWDocumentSignature;
  return canonicalize(input);
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const closed = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function instant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
}

/** JSON has already parsed successfully; detect duplicate decoded member names. */
function uniqueJsonMembers(json: string): void {
  const stack: (Set<string> | null)[] = [];
  const tokens = /"(?:\\.|[^"\\])*"|[{}\[\]]/g;
  for (const match of json.matchAll(tokens)) {
    const token = match[0];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (json.slice(match.index + token.length).trimStart().startsWith(':')) {
      const keys = stack.at(-1);
      const key = JSON.parse(token) as string;
      if (keys?.has(key)) throw new DocumentSigningError(`Duplicate JSON member '${key}'.`);
      keys?.add(key);
    }
  }
}

function guardBlock(block: UWBlock): void {
  if (!record(block.content) || !record(block.content['_meta']) || !record(block.meta.lifecycle)
    || typeof block.meta.lifecycle.superseded !== 'boolean' || block.meta.section !== block.annotation.section
    || (block.annotation.superseded !== undefined && block.annotation.superseded !== block.meta.lifecycle.superseded)) {
    throw new DocumentSigningError(`Section '${block.annotation.section}' has inconsistent or missing identity/lifecycle metadata.`);
  }
  if (['_parse_error', '_raw'].some(key => Object.hasOwn(block.content, key))) {
    throw new DocumentSigningError('Malformed section JSON.');
  }
  uniqueJsonMembers(block.rawJson);
  const header = block.annotation;
  for (const value of [header.section, header.variant]) {
    if (value !== undefined && ['__proto__', 'constructor', 'prototype'].includes(value)) {
      throw new DocumentSigningError('Unsafe section or variant selection key.');
    }
  }
}

function guardFence(line: string): void {
  const tokens = line.trim().split(/\s+/).slice(2);
  const keys = new Set(['section']);
  for (const token of tokens) {
    const match = /^(\w+)=(\S+)$/.exec(token);
    if (!match || keys.has(match[1]) || ['__proto__', 'constructor', 'prototype'].includes(match[1])) {
      throw new DocumentSigningError('Ambiguous or unsupported fence annotation.');
    }
    keys.add(match[1]);
    if ((match[1] === 'superseded' && !['true', 'false'].includes(match[2]))
      || (match[1] === 'v' && !/^[1-9]\d*$/.test(match[2]))) throw new DocumentSigningError('Malformed fence annotation value.');
  }
}

/** Resolve the source actually supplied, never a filtered parsed object or stamped digest. */
export async function resolveDocumentSigningSubject(source: string): Promise<DocumentSigningSubject> {
  try {
    const scanned: UWBlock[] = [];
    const frontmatterMembers = new Set<string>();
    const lines = source.split(/\r?\n/);
    const parsed = parseUWFile(source, {
      strict: true,
      onFrontmatterMember: path => {
        if (path.some(key => key.split('.').some(segment => ['__proto__', 'constructor', 'prototype'].includes(segment)))) {
          throw new DocumentSigningError('Unsafe frontmatter mapping key.');
        }
        const identity = JSON.stringify(path);
        if (frontmatterMembers.has(identity)) throw new DocumentSigningError(`Duplicate frontmatter member ${identity}.`);
        frontmatterMembers.add(identity);
      },
      onBlock: block => { guardFence(lines[block.lineStart - 1]); guardBlock(block); scanned.push(block); },
    });
    const seen = new Set<string>();
    const extensions = new Set<string>();
    for (const block of scanned) {
      const section = block.annotation.section;
      if (section.startsWith('x_')) {
        if (block.meta.lifecycle.superseded) throw new DocumentSigningError('Historical extension blocks are not representable in the current envelope.');
        if (extensions.has(section)) throw new DocumentSigningError(`Repeated extension '${section}'.`);
        extensions.add(section);
      }
      if (block.meta.lifecycle.superseded || ['pipeline_log', 'custom_calculations', 'custom_scenarios'].includes(section)) continue;
      // Sections represented as maps have an explicit variant/default key;
      // singleton sections have only their section id, regardless of annotation.
      const entry = parsed.sections[section];
      const variantMap = entry && !hasBlockShape(entry);
      const key = JSON.stringify([section, variantMap ? block.annotation.variant ?? 'default' : null]);
      if (seen.has(key)) throw new DocumentSigningError(`Duplicate active selection key ${key}.`);
      seen.add(key);
    }
    const envelope = toUWEnvelope(parsed, { includeSuperseded: true });
    const projected = envelopeBlocks(envelope);
    const counts = new Map<Record<string, unknown>, number>();
    for (const content of projected) counts.set(content, (counts.get(content) ?? 0) + 1);
    // Compare identity of content objects, not hashes: two equal blocks are still two source blocks.
    if (projected.length !== scanned.length || scanned.some(block => counts.get(block.content) !== 1)) {
      throw new DocumentSigningError('The semantic envelope does not account for every source block exactly once.');
    }
    return {
      representation: 'uwx-markdown', representation_version: '1.0',
      canonicalization: 'uw-envelope-semantic', canonicalization_version: '1.0',
      digest: await computeEnvelopeDigest(envelope),
    };
  } catch (error) {
    if (error instanceof DocumentSigningError) throw error;
    throw new DocumentSigningError(`Cannot authenticate source: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function envelopeBlocks(envelope: UWDocumentEnvelope): Record<string, unknown>[] {
  const blocks = Object.values(envelope.sections).flatMap(entry =>
    hasBlockShape(entry) ? [entry as import('./envelope.js').UWEnvelopeBlock] : Object.values(entry));
  return [...blocks, ...envelope.pipeline_log, ...envelope.custom_calculations, ...envelope.custom_scenarios,
    ...Object.values(envelope.extensions), ...Object.values(envelope.superseded).flat()].map(block => block.content);
}

/** Strict shape/encoding check before touching a key store. */
function wellFormed(value: unknown): value is UWDocumentSignature {
  if (!record(value) || !closed(value, ['kind', 'signature_version', 'subject', 'alg', 'kid', 'signed_at', 'sig'])
    || value.kind !== 'uwmd-document-signature' || typeof value.signature_version !== 'string'
    || !record(value.subject) || !closed(value.subject, ['representation', 'representation_version', 'canonicalization', 'canonicalization_version', 'digest'])
    || !Object.values(value.subject).every(v => typeof v === 'string') || !/^sha256:[0-9a-f]{64}$/.test(value.subject.digest as string)
    || !(UW_SIGNATURE_ALGORITHMS as readonly unknown[]).includes(value.alg)
    || typeof value.kid !== 'string' || value.kid.length === 0 || !instant(value.signed_at)
    || typeof value.sig !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value.sig)) return false;
  const length = value.alg === 'es384' ? 128 : 86;
  if (value.sig.length !== length) return false;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return length === 128 || (alphabet.indexOf(value.sig.at(-1)!) & 15) === 0;
}

export async function verifyDocumentSignature(
  source: string, artifact: unknown,
  options: { signatureVerifier?: DocumentSignatureVerifier } = {},
): Promise<DocumentSignatureResult> {
  if (artifact === undefined || artifact === null) return {
    state: 'unsigned', reason: 'missing_signature', issues: [{ code: 'INT-12', message: 'No document signature supplied.' }],
  };
  if (!wellFormed(artifact)) return {
    state: 'failed', reason: 'malformed', issues: [{ code: 'INT-09', message: 'Malformed document-signature artifact.' }],
  };
  // Protocol §V.13.3: admitted artifact encoding precedes version/source checks.
  // Only the current signing input is inspected; signature bytes stay excluded.
  let payload: string;
  try {
    payload = documentSigningPayload(artifact);
  } catch (error) {
    if (!(error instanceof InvalidUnicodeError)) throw error;
    return { state: 'failed', reason: 'malformed', issues: [{ code: 'INT-09', message: 'Document-signature input contains invalid Unicode.' }] };
  }
  const subject = artifact.subject;
  if (artifact.signature_version !== '1' || subject.representation !== 'uwx-markdown' || subject.representation_version !== '1.0'
    || subject.canonicalization !== 'uw-envelope-semantic' || subject.canonicalization_version !== '1.0') return {
    state: 'unverifiable', reason: 'unsupported_version', issues: [{ code: 'INT-14', message: 'Unsupported document-signature version or subject.' }],
  };
  let actual: DocumentSigningSubject;
  try { actual = await resolveDocumentSigningSubject(source); }
  catch (error) { return { state: 'failed', reason: 'malformed_source', issues: [{ code: 'INT-15', message: (error as Error).message }] }; }
  if (actual.digest !== subject.digest) return {
    state: 'failed', reason: 'subject_mismatch', issues: [{ code: 'INT-11', message: 'Document signature describes a different semantic snapshot.' }],
  };
  if (!options.signatureVerifier) return {
    state: 'unverifiable', reason: 'no_backend', issues: [{ code: 'INT-13', message: 'Document signature is present but unchecked.' }],
  };
  try {
    const verdict = await options.signatureVerifier.verify(payload, artifact);
    if (verdict.ok) return { state: 'verified', kid: artifact.kid, digest: actual.digest, issues: [] };
    if (verdict.reason === 'unknown_kid') return {
      state: 'unverifiable', reason: 'unknown_kid', issues: [{ code: 'INT-13', message: `Unknown document signing key '${artifact.kid}'.` }],
    };
    return { state: 'failed', reason: verdict.reason,
      issues: [{ code: verdict.reason === 'malformed' ? 'INT-09' : 'INT-10', message: `Document signature does not verify (${verdict.reason}).` }] };
  } catch {
    return { state: 'unverifiable', reason: 'backend_error', issues: [{ code: 'INT-13', message: 'Document-signature backend failed.' }] };
  }
}
