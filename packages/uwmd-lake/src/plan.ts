/**
 * Turns UWMD's existing canonical outputs into a deterministic, idempotent
 * sequence of parameterized PostgreSQL statements.
 *
 * The adapter never opens a connection and never imports a driver. It returns
 * `{ sql, params }` pairs; the adopter hands them to whatever client they
 * already have (`pg`, `postgres.js`, a pool, a migration runner). That is what
 * keeps PostgreSQL out of `@uwmd/core`'s dependency graph and out of the
 * protocol — the lake is a projection target, not a participant in validation.
 *
 * Idempotency is by digest, not by load order: every statement is an
 * `INSERT ... ON CONFLICT ... DO UPDATE`, so loading the same bundle twice
 * leaves the same rows. A re-load of a *changed* document produces a different
 * semantic digest and therefore a new row, which is the intended behavior: the
 * lake accumulates versions rather than overwriting history.
 */

import { sha256Hex } from '@uwmd/core';
import { LakeError } from './schema.js';

/** One parameterized statement. `params` positions match `$1..$n` in `sql`. */
export interface LakeStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/**
 * The structural slice of a database client the adapter needs. Both `pg` and
 * `postgres.js` wrappers satisfy it with a one-line adapter, and a test double
 * satisfies it with an array push.
 */
export interface LakeClient {
  query(sql: string, params: readonly unknown[]): Promise<unknown>;
}

/**
 * A document row. `envelope` is the complete canonical envelope and is stored
 * verbatim; every other field is a projection for indexing. Only
 * `semantic_digest` and `envelope` are required, because a warehouse row that
 * cannot be keyed is worse than a refusal.
 */
export interface LakeDocumentInput {
  semantic_digest: string;
  envelope: unknown;
  path?: string | null;
  deal_id?: string | null;
  deal_name?: string | null;
  asset_class?: string | null;
  deal_stage?: string | null;
  currency_code?: string | null;
  format_version?: string | null;
  protocol_version?: string | null;
  document_profile?: string | null;
  valid?: boolean | null;
  error_count?: number | null;
  warning_count?: number | null;
}

/**
 * One `block_values` fact. This is exactly the row shape `@uwmd/batch` writes
 * to `uwmd-facts.jsonl` and the CSV bundle writes to `block_values.csv`,
 * declared structurally so the adapter depends on neither.
 */
export interface LakeFactInput {
  semantic_digest: string;
  block_ref: string;
  scope: 'annotation' | 'meta' | 'content';
  pointer: string;
  json_type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  value_json: string;
  deal_id?: string | null;
  asset_class?: string | null;
  path?: string | null;
  valid?: boolean | null;
}

/** Identity and status of a source artifact. Never its bytes. */
export interface LakeSourceEvidenceInput {
  semantic_digest: string;
  evidence_id: string;
  kind?: string | null;
  status?: string | null;
  reference?: { scheme?: string; authority?: string; value?: string } | null;
  [key: string]: unknown;
}

export interface LakeLoadInput {
  documents?: readonly LakeDocumentInput[];
  facts?: readonly LakeFactInput[];
  /** Receipt JSON as issued. Read structurally; unknown fields are preserved. */
  receipts?: readonly Record<string, unknown>[];
  /** Deal package manifests as authored. */
  packages?: readonly Record<string, unknown>[];
  source_evidence?: readonly LakeSourceEvidenceInput[];
  /** Target PostgreSQL schema. Defaults to `public`. */
  schema?: string;
}

export interface LakeLoadPlan {
  readonly schema_version: string;
  readonly schema: string;
  readonly statements: readonly LakeStatement[];
  readonly counts: {
    readonly documents: number;
    readonly facts: number;
    readonly receipts: number;
    readonly packages: number;
    readonly package_members: number;
    readonly source_evidence: number;
  };
}

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/** Fields that would smuggle source bytes into the lake. */
const BYTE_BEARING_KEYS = ['bytes', 'content', 'content_base64', 'data_base64', 'body', 'blob'];

/**
 * Builds the complete load plan. Ordering is deterministic and dependency-safe:
 * documents, then facts, then receipts, then each package before its members,
 * then source evidence. Running the statements in order inside one transaction
 * satisfies the `uw_package_members` foreign key.
 */
export async function planLakeLoad(input: LakeLoadInput): Promise<LakeLoadPlan> {
  const schema = input.schema ?? 'public';
  if (!SCHEMA_PATTERN.test(schema)) {
    throw new LakeError(
      'LAKE_SCHEMA_NAME',
      `Schema name ${JSON.stringify(schema)} is not a plain lowercase PostgreSQL identifier.`,
    );
  }
  const statements: LakeStatement[] = [];

  for (const document of input.documents ?? []) statements.push(planDocument(schema, document));
  for (const fact of input.facts ?? []) statements.push(planFact(schema, fact));
  for (const receipt of input.receipts ?? []) statements.push(await planReceipt(schema, receipt));

  let members = 0;
  for (const manifest of input.packages ?? []) {
    const planned = planPackage(schema, manifest);
    statements.push(...planned);
    members += planned.length - 1;
  }
  for (const evidence of input.source_evidence ?? []) statements.push(planSourceEvidence(schema, evidence));

  return {
    schema_version: '0.1',
    schema,
    statements,
    counts: {
      documents: input.documents?.length ?? 0,
      facts: input.facts?.length ?? 0,
      receipts: input.receipts?.length ?? 0,
      packages: input.packages?.length ?? 0,
      package_members: members,
      source_evidence: input.source_evidence?.length ?? 0,
    },
  };
}

/**
 * Runs a plan's statements in order against an adopter-supplied client.
 * The adapter does not open the transaction: whether the load is atomic is the
 * adopter's call, and silently wrapping it would hide a partial load.
 */
export async function executeLakeLoad(plan: LakeLoadPlan, client: LakeClient): Promise<number> {
  for (const statement of plan.statements) {
    await client.query(statement.sql, statement.params);
  }
  return plan.statements.length;
}

// ─── Per-table planning ──────────────────────────────────────────────────────

export function planDocument(schema: string, document: LakeDocumentInput): LakeStatement {
  const digest = requireText(
    document.semantic_digest,
    'LAKE_DOCUMENT_DIGEST',
    'A document row needs a non-empty semantic_digest.',
  );
  if (document.envelope === undefined || document.envelope === null) {
    throw new LakeError(
      'LAKE_DOCUMENT_ENVELOPE',
      `Document ${digest} has no envelope; a typed projection without the canonical JSON is not loadable.`,
    );
  }
  return {
    sql: [
      `INSERT INTO ${schema}.uw_documents (`,
      '  semantic_digest, path, deal_id, deal_name, asset_class, deal_stage,',
      '  currency_code, format_version, protocol_version, document_profile,',
      '  valid, error_count, warning_count, envelope',
      ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      'ON CONFLICT (semantic_digest) DO UPDATE SET',
      '  path = EXCLUDED.path, deal_id = EXCLUDED.deal_id, deal_name = EXCLUDED.deal_name,',
      '  asset_class = EXCLUDED.asset_class, deal_stage = EXCLUDED.deal_stage,',
      '  currency_code = EXCLUDED.currency_code, format_version = EXCLUDED.format_version,',
      '  protocol_version = EXCLUDED.protocol_version, document_profile = EXCLUDED.document_profile,',
      '  valid = EXCLUDED.valid, error_count = EXCLUDED.error_count,',
      '  warning_count = EXCLUDED.warning_count, envelope = EXCLUDED.envelope',
    ].join('\n'),
    params: [
      digest,
      nullable(document.path),
      nullable(document.deal_id),
      nullable(document.deal_name),
      nullable(document.asset_class),
      nullable(document.deal_stage),
      nullable(document.currency_code),
      nullable(document.format_version),
      nullable(document.protocol_version),
      nullable(document.document_profile),
      document.valid ?? null,
      document.error_count ?? null,
      document.warning_count ?? null,
      JSON.stringify(document.envelope),
    ],
  };
}

export function planFact(schema: string, fact: LakeFactInput): LakeStatement {
  const digest = requireText(
    fact.semantic_digest,
    'LAKE_FACT_DIGEST',
    'A fact row needs a non-empty semantic_digest.',
  );
  const shadow = projectShadowColumns(fact);
  return {
    sql: [
      `INSERT INTO ${schema}.uw_facts (`,
      '  semantic_digest, block_ref, scope, pointer, json_type, value_json,',
      '  value_number, value_text, value_boolean, value_date,',
      '  deal_id, asset_class, path, valid',
      ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      'ON CONFLICT (semantic_digest, block_ref, scope, pointer) DO UPDATE SET',
      '  json_type = EXCLUDED.json_type, value_json = EXCLUDED.value_json,',
      '  value_number = EXCLUDED.value_number, value_text = EXCLUDED.value_text,',
      '  value_boolean = EXCLUDED.value_boolean, value_date = EXCLUDED.value_date,',
      '  deal_id = EXCLUDED.deal_id, asset_class = EXCLUDED.asset_class,',
      '  path = EXCLUDED.path, valid = EXCLUDED.valid',
    ].join('\n'),
    params: [
      digest,
      fact.block_ref,
      fact.scope,
      fact.pointer,
      fact.json_type,
      fact.value_json,
      shadow.value_number,
      shadow.value_text,
      shadow.value_boolean,
      shadow.value_date,
      nullable(fact.deal_id),
      nullable(fact.asset_class),
      nullable(fact.path),
      fact.valid ?? null,
    ],
  };
}

export async function planReceipt(
  schema: string,
  receipt: Record<string, unknown>,
): Promise<LakeStatement> {
  const subject = asRecord(receipt.subject);
  const subjectDigest = requireText(
    subject?.digest,
    'LAKE_RECEIPT_SUBJECT',
    'A receipt needs subject.digest to join to anything.',
  );
  const computation = asRecord(receipt.computation);
  const policy = asRecord(receipt.policy);
  // A receipt carries no self-identifier, so the canonical hash of the receipt
  // JSON is its key. Two byte-identical receipts collapse to one row; a
  // re-issued receipt (new issued_at or signature) is a distinct row.
  const receiptDigest = await sha256Hex(receipt);
  return {
    sql: [
      `INSERT INTO ${schema}.uw_receipts (`,
      '  receipt_digest, subject_digest, receipt_version, verdict, pack_id, pack_version,',
      '  engine, engine_version, issuer, issued_at, signed, receipt',
      ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      'ON CONFLICT (receipt_digest) DO UPDATE SET',
      '  subject_digest = EXCLUDED.subject_digest, receipt_version = EXCLUDED.receipt_version,',
      '  verdict = EXCLUDED.verdict, pack_id = EXCLUDED.pack_id, pack_version = EXCLUDED.pack_version,',
      '  engine = EXCLUDED.engine, engine_version = EXCLUDED.engine_version,',
      '  issuer = EXCLUDED.issuer, issued_at = EXCLUDED.issued_at,',
      '  signed = EXCLUDED.signed, receipt = EXCLUDED.receipt',
    ].join('\n'),
    params: [
      receiptDigest,
      subjectDigest,
      text(receipt.receipt_version),
      text(receipt.verdict) ?? text(computation?.verdict) ?? text(policy?.verdict),
      text(computation?.pack_id) ?? text(policy?.pack_id) ?? text(computation?.pack),
      text(computation?.pack_version),
      text(computation?.engine),
      text(computation?.engine_version),
      text(receipt.issuer),
      text(receipt.issued_at),
      receipt.signature !== null && receipt.signature !== undefined,
      JSON.stringify(receipt),
    ],
  };
}

/** Returns the package statement first, then one statement per member. */
export function planPackage(schema: string, manifest: Record<string, unknown>): LakeStatement[] {
  const packageId = requireText(
    manifest.package_id,
    'LAKE_PACKAGE_ID',
    'A package manifest needs a non-empty package_id.',
  );
  const members = Array.isArray(manifest.members) ? manifest.members : [];
  const links = Array.isArray(manifest.links) ? manifest.links : [];
  const statements: LakeStatement[] = [
    {
      sql: [
        `INSERT INTO ${schema}.uw_packages (package_id, package_version, member_count, link_count, manifest)`,
        'VALUES ($1, $2, $3, $4, $5)',
        'ON CONFLICT (package_id) DO UPDATE SET',
        '  package_version = EXCLUDED.package_version, member_count = EXCLUDED.member_count,',
        '  link_count = EXCLUDED.link_count, manifest = EXCLUDED.manifest',
      ].join('\n'),
      params: [
        packageId,
        text(manifest.package_version),
        members.length,
        links.length,
        JSON.stringify(manifest),
      ],
    },
  ];

  for (const entry of members) {
    const member = asRecord(entry);
    const memberId = requireText(
      member?.id,
      'LAKE_PACKAGE_MEMBER_ID',
      `Package ${packageId} has a member without an id.`,
    );
    const sha256 = requireText(
      member?.sha256,
      'LAKE_PACKAGE_MEMBER_DIGEST',
      `Package ${packageId} member ${memberId} has no sha256; the byte digest is a member's identity.`,
    );
    statements.push({
      sql: [
        `INSERT INTO ${schema}.uw_package_members (`,
        '  package_id, member_id, role, media_type, path, sha256, semantic_digest, document_profile, member',
        ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        'ON CONFLICT (package_id, member_id) DO UPDATE SET',
        '  role = EXCLUDED.role, media_type = EXCLUDED.media_type, path = EXCLUDED.path,',
        '  sha256 = EXCLUDED.sha256, semantic_digest = EXCLUDED.semantic_digest,',
        '  document_profile = EXCLUDED.document_profile, member = EXCLUDED.member',
      ].join('\n'),
      params: [
        packageId,
        memberId,
        text(member?.role),
        text(member?.media_type),
        text(member?.path),
        sha256,
        text(member?.semantic_digest),
        text(member?.document_profile),
        JSON.stringify(member),
      ],
    });
  }
  return statements;
}

export function planSourceEvidence(schema: string, evidence: LakeSourceEvidenceInput): LakeStatement {
  const digest = requireText(
    evidence.semantic_digest,
    'LAKE_EVIDENCE_DIGEST',
    'A source-evidence row needs a non-empty semantic_digest.',
  );
  const evidenceId = requireText(
    evidence.evidence_id,
    'LAKE_EVIDENCE_ID',
    `Source evidence for ${digest} needs a non-empty evidence_id.`,
  );
  assertNoSourceBytes(evidence, `${digest}/${evidenceId}`);
  const reference = evidence.reference ?? null;
  return {
    sql: [
      `INSERT INTO ${schema}.uw_source_evidence (`,
      '  semantic_digest, evidence_id, kind, status,',
      '  reference_scheme, reference_authority, reference_value, evidence',
      ') VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      'ON CONFLICT (semantic_digest, evidence_id) DO UPDATE SET',
      '  kind = EXCLUDED.kind, status = EXCLUDED.status,',
      '  reference_scheme = EXCLUDED.reference_scheme,',
      '  reference_authority = EXCLUDED.reference_authority,',
      '  reference_value = EXCLUDED.reference_value, evidence = EXCLUDED.evidence',
    ].join('\n'),
    params: [
      digest,
      evidenceId,
      nullable(evidence.kind),
      nullable(evidence.status),
      text(reference?.scheme),
      text(reference?.authority),
      text(reference?.value),
      JSON.stringify(evidence),
    ],
  };
}

// ─── Projection helpers ──────────────────────────────────────────────────────

/**
 * Derives the typed shadow columns from a fact's declared JSON type.
 *
 * Only `json_type` decides which column is populated — the adapter never
 * sniffs a string that looks like a number into `value_number`, because a
 * warehouse that guesses types is a warehouse that answers a filter
 * differently from the calc engine. A string that is an ISO calendar date also
 * lands in `value_date`, which is the one narrowing the schema documents.
 */
export function projectShadowColumns(fact: Pick<LakeFactInput, 'json_type' | 'value_json'>): {
  value_number: number | null;
  value_text: string | null;
  value_boolean: boolean | null;
  value_date: string | null;
} {
  const empty = { value_number: null, value_text: null, value_boolean: null, value_date: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fact.value_json);
  } catch {
    // A fact whose value_json will not parse still loads: value_json is stored
    // verbatim by the caller and the projection simply stays empty.
    return empty;
  }
  switch (fact.json_type) {
    case 'number':
      return typeof parsed === 'number' && Number.isFinite(parsed)
        ? { ...empty, value_number: parsed }
        : empty;
    case 'boolean':
      return typeof parsed === 'boolean' ? { ...empty, value_boolean: parsed } : empty;
    case 'string':
      if (typeof parsed !== 'string') return empty;
      return { ...empty, value_text: parsed, value_date: isIsoDate(parsed) ? parsed : null };
    default:
      return empty;
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertNoSourceBytes(value: unknown, where: string): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoSourceBytes(item, where);
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (BYTE_BEARING_KEYS.includes(key) && item !== null && item !== undefined) {
      throw new LakeError(
        'LAKE_SOURCE_BYTES',
        `Source evidence ${where} carries a "${key}" field. The lake stores evidence identity and status, never unapproved source bytes.`,
      );
    }
    assertNoSourceBytes(item, where);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nullable(value: string | null | undefined): string | null {
  return value ?? null;
}

function requireText(value: unknown, code: string, message: string): string {
  const found = text(value);
  if (found === null) throw new LakeError(code, message);
  return found;
}
