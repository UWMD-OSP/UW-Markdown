import { describe, expect, it } from 'vitest';
import {
  LakeError,
  postgresLakeSchema,
  postgresLakeSchemaStatements,
  UWMD_LAKE_SCHEMA_VERSION,
} from './schema.js';

describe('postgresLakeSchema', () => {
  const ddl = postgresLakeSchema();

  it('declares every table RFC 0049 names', () => {
    for (const table of [
      'uw_documents',
      'uw_facts',
      'uw_receipts',
      'uw_packages',
      'uw_package_members',
      'uw_source_evidence',
    ]) {
      expect(ddl).toContain(`CREATE TABLE IF NOT EXISTS public.${table} (`);
    }
  });

  it('keeps the raw canonical JSON on every table that projects it', () => {
    expect(ddl).toContain('envelope          jsonb NOT NULL');
    expect(ddl).toContain('receipt          jsonb NOT NULL');
    expect(ddl).toContain('manifest         jsonb NOT NULL');
    expect(ddl).toContain('member           jsonb NOT NULL');
  });

  it('lets only a container omit its value_json', () => {
    // The canonical fact table represents an object or an array by its
    // flattened children and leaves the container's own value empty, so a
    // NOT NULL jsonb column made 21% of real corpus facts unloadable.
    expect(ddl).toContain('value_json       jsonb');
    expect(ddl).not.toContain('value_json       jsonb NOT NULL');
    expect(ddl).toContain("CHECK (value_json IS NOT NULL OR json_type IN ('object', 'array'))");
  });

  it('projects no receipt verdict, because no receipt carries one', () => {
    // A verdict is what verifying a receipt produces (UW_RECEIPT_v1 §5), not a
    // field the receipt states. The column was NULL for every real receipt and
    // led the (verdict, pack_id) index with a dead column.
    expect(ddl).not.toMatch(/^\s+verdict\s+text/m);
    expect(ddl).not.toContain('uw_receipts_verdict_idx');
    expect(ddl).toContain('validation_errors   integer');
    expect(ddl).toContain('validation_warnings integer');
    expect(ddl).toContain('uw_receipts_pack_idx');
  });

  it('keys a fact by the durable tuple, not by path', () => {
    expect(ddl).toContain('PRIMARY KEY (semantic_digest, block_ref, scope, pointer)');
    // `path` exists as a convenience column but is not part of any key.
    expect(ddl).not.toContain('PRIMARY KEY (path');
  });

  it('is re-runnable: every object is created IF NOT EXISTS', () => {
    const creates = ddl.split('\n').filter((line) => line.startsWith('CREATE '));
    expect(creates.length).toBeGreaterThan(0);
    for (const line of creates) expect(line).toContain('IF NOT EXISTS');
  });

  it('qualifies every table with the requested schema', () => {
    const scoped = postgresLakeSchema('uwmd_lake');
    expect(scoped).toContain('CREATE SCHEMA IF NOT EXISTS uwmd_lake;');
    expect(scoped).toContain('CREATE TABLE IF NOT EXISTS uwmd_lake.uw_facts (');
    expect(scoped).not.toContain('public.uw_facts');
  });

  it('refuses a schema name that is not a plain identifier rather than quoting it', () => {
    for (const name of ['public; DROP TABLE uw_facts', 'Mixed', '1lake', '']) {
      expect(() => postgresLakeSchema(name)).toThrow(LakeError);
      expect(() => postgresLakeSchema(name)).toThrow(/LAKE_SCHEMA_NAME/);
    }
  });

  it('pins the schema version', () => {
    expect(UWMD_LAKE_SCHEMA_VERSION).toBe('0.2');
    expect(ddl).toContain(`lake schema ${UWMD_LAKE_SCHEMA_VERSION}`);
  });
});

describe('postgresLakeSchemaStatements', () => {
  it('splits into single commands a LakeClient can actually send', () => {
    // A client handed a values array -- pg and postgres.js both, even when it
    // is empty -- uses the extended query protocol, which carries exactly one
    // command. The one-string form is for psql, not for query(sql, []).
    const statements = postgresLakeSchemaStatements('uwmd_lake');
    expect(statements.length).toBeGreaterThan(1);
    for (const statement of statements) {
      expect(statement.trimEnd().endsWith(';')).toBe(true);
      // Exactly one command: no *code* line but the last ends a statement.
      // Comment prose may contain a semicolon and some of it does.
      const lines = statement.split('\n');
      for (const line of lines.slice(0, -1)) {
        if (line.trimStart().startsWith('--')) continue;
        expect(line.trimEnd().endsWith(';')).toBe(false);
      }
    }
  });

  it('never ends a statement on a comment line', () => {
    for (const statement of postgresLakeSchemaStatements('uwmd_lake')) {
      expect(statement.split('\n').at(-1)?.trimStart().startsWith('--')).toBe(false);
    }
  });

  it('creates a package before the members that reference it', () => {
    const statements = postgresLakeSchemaStatements();
    const packages = statements.findIndex((s) => s.includes('CREATE TABLE IF NOT EXISTS public.uw_packages ('));
    const members = statements.findIndex((s) => s.includes('CREATE TABLE IF NOT EXISTS public.uw_package_members ('));
    expect(packages).toBeGreaterThanOrEqual(0);
    expect(packages).toBeLessThan(members);
  });

  it('is the source of truth the script is joined from', () => {
    for (const statement of postgresLakeSchemaStatements('uwmd_lake')) {
      expect(postgresLakeSchema('uwmd_lake')).toContain(statement);
    }
  });

  it('refuses a schema name that is not a plain identifier', () => {
    expect(() => postgresLakeSchemaStatements('public; DROP TABLE uw_facts')).toThrow(/LAKE_SCHEMA_NAME/);
  });
});
