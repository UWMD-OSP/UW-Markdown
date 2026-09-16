/**
 * The warehouse-side DDL for the RFC 0049 reference adapter.
 *
 * Two rules shape every table here:
 *
 *  1. **The raw canonical JSON is always stored.** Typed columns exist so a
 *     common join or filter can use an index; they are a *projection*, never
 *     the record. An unknown section, an extension key, a null that is not an
 *     absence, and array order all survive because `envelope` / `fact` /
 *     `receipt` / `manifest` hold the untouched JSON alongside the projection.
 *  2. **The digest is the key.** A document is identified by its semantic
 *     digest, a fact by `(semantic_digest, block_ref, scope, pointer)`, a
 *     package member by its byte digest. Nothing is keyed by file path, which
 *     is a convenience column and not durable.
 *
 * This is a reference schema for adopters, not a normative storage contract.
 * UWMD's canonical outputs are the CSV bundle, the `block_values` fact rows,
 * receipts and package manifests; everything below is a warehouse projection
 * of those.
 */

export const UWMD_LAKE_SCHEMA_VERSION = '0.1' as const;

/**
 * Returns the complete DDL as one idempotent script. Every statement is
 * `IF NOT EXISTS`, so re-running it against a loaded warehouse is a no-op.
 *
 * `schema` names the PostgreSQL schema the tables live in. It is validated
 * rather than escaped: a lake schema name is configuration, not user input,
 * and refusing an unexpected one is safer than quoting it.
 */
export function postgresLakeSchema(schema = 'public'): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) {
    throw new LakeError(
      'LAKE_SCHEMA_NAME',
      `Schema name ${JSON.stringify(schema)} is not a plain lowercase PostgreSQL identifier.`,
    );
  }
  const q = (table: string) => `${schema}.${table}`;
  return [
    `-- UW Markdown lake schema ${UWMD_LAKE_SCHEMA_VERSION} (RFC 0049). Canonical JSON is never discarded.`,
    `CREATE SCHEMA IF NOT EXISTS ${schema};`,
    '',
    `CREATE TABLE IF NOT EXISTS ${q('uw_documents')} (`,
    '  semantic_digest   text PRIMARY KEY,',
    '  path              text,',
    '  deal_id           text,',
    '  deal_name         text,',
    '  asset_class       text,',
    '  deal_stage        text,',
    '  currency_code     text,',
    '  format_version    text,',
    '  protocol_version  text,',
    '  document_profile  text,',
    '  valid             boolean,',
    '  error_count       integer,',
    '  warning_count     integer,',
    '  envelope          jsonb NOT NULL,',
    '  loaded_at         timestamptz NOT NULL DEFAULT now()',
    ');',
    `CREATE INDEX IF NOT EXISTS uw_documents_deal_id_idx ON ${q('uw_documents')} (deal_id);`,
    `CREATE INDEX IF NOT EXISTS uw_documents_asset_class_idx ON ${q('uw_documents')} (asset_class, deal_stage);`,
    `CREATE INDEX IF NOT EXISTS uw_documents_envelope_idx ON ${q('uw_documents')} USING gin (envelope jsonb_path_ops);`,
    '',
    `CREATE TABLE IF NOT EXISTS ${q('uw_facts')} (`,
    '  semantic_digest  text NOT NULL,',
    '  block_ref        text NOT NULL,',
    "  scope            text NOT NULL CHECK (scope IN ('annotation', 'meta', 'content')),",
    '  pointer          text NOT NULL,',
    '  json_type        text NOT NULL',
    "                   CHECK (json_type IN ('object', 'array', 'string', 'number', 'boolean', 'null')),",
    '  value_json       jsonb NOT NULL,',
    '  -- Typed shadow columns. NULL means "this fact is not of that type",',
    '  -- never "the value was missing"; value_json is the record.',
    '  value_number     double precision,',
    '  value_text       text,',
    '  value_boolean    boolean,',
    '  value_date       date,',
    '  deal_id          text,',
    '  asset_class      text,',
    '  path             text,',
    '  valid            boolean,',
    '  PRIMARY KEY (semantic_digest, block_ref, scope, pointer)',
    ');',
    `CREATE INDEX IF NOT EXISTS uw_facts_pointer_idx ON ${q('uw_facts')} (pointer);`,
    `CREATE INDEX IF NOT EXISTS uw_facts_number_idx ON ${q('uw_facts')} (pointer, value_number) WHERE value_number IS NOT NULL;`,
    `CREATE INDEX IF NOT EXISTS uw_facts_deal_idx ON ${q('uw_facts')} (deal_id);`,
    '',
    `CREATE TABLE IF NOT EXISTS ${q('uw_receipts')} (`,
    '  receipt_digest   text PRIMARY KEY,',
    '  subject_digest   text NOT NULL,',
    '  receipt_version  text,',
    '  verdict          text,',
    '  pack_id          text,',
    '  pack_version     text,',
    '  engine           text,',
    '  engine_version   text,',
    '  issuer           text,',
    '  issued_at        timestamptz,',
    '  signed           boolean NOT NULL DEFAULT false,',
    '  receipt          jsonb NOT NULL',
    ');',
    `CREATE INDEX IF NOT EXISTS uw_receipts_subject_idx ON ${q('uw_receipts')} (subject_digest);`,
    `CREATE INDEX IF NOT EXISTS uw_receipts_verdict_idx ON ${q('uw_receipts')} (verdict, pack_id);`,
    '',
    `CREATE TABLE IF NOT EXISTS ${q('uw_packages')} (`,
    '  package_id       text PRIMARY KEY,',
    '  package_version  text,',
    '  member_count     integer NOT NULL DEFAULT 0,',
    '  link_count       integer NOT NULL DEFAULT 0,',
    '  manifest         jsonb NOT NULL',
    ');',
    '',
    `CREATE TABLE IF NOT EXISTS ${q('uw_package_members')} (`,
    '  package_id       text NOT NULL',
    `                   REFERENCES ${q('uw_packages')} (package_id) ON DELETE CASCADE,`,
    '  member_id        text NOT NULL,',
    '  role             text,',
    '  media_type       text,',
    '  path             text,',
    '  sha256           text NOT NULL,',
    '  semantic_digest  text,',
    '  document_profile text,',
    '  member           jsonb NOT NULL,',
    '  PRIMARY KEY (package_id, member_id)',
    ');',
    `CREATE INDEX IF NOT EXISTS uw_package_members_sha_idx ON ${q('uw_package_members')} (sha256);`,
    `CREATE INDEX IF NOT EXISTS uw_package_members_semantic_idx ON ${q('uw_package_members')} (semantic_digest);`,
    '',
    '-- Source evidence carries identity and status only. Unapproved source',
    '-- bytes never enter the lake; the loader refuses a payload that has any.',
    `CREATE TABLE IF NOT EXISTS ${q('uw_source_evidence')} (`,
    '  semantic_digest     text NOT NULL,',
    '  evidence_id         text NOT NULL,',
    '  kind                text,',
    '  status              text,',
    '  reference_scheme    text,',
    '  reference_authority text,',
    '  reference_value     text,',
    '  evidence            jsonb NOT NULL,',
    '  PRIMARY KEY (semantic_digest, evidence_id)',
    ');',
    '',
  ].join('\n');
}

export class LakeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'LakeError';
    this.code = code;
  }
}
