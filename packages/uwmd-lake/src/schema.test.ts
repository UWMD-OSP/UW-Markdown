import { describe, expect, it } from 'vitest';
import { LakeError, postgresLakeSchema, UWMD_LAKE_SCHEMA_VERSION } from './schema.js';

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
    expect(ddl).toContain('value_json       jsonb NOT NULL');
    expect(ddl).toContain('receipt          jsonb NOT NULL');
    expect(ddl).toContain('manifest         jsonb NOT NULL');
    expect(ddl).toContain('member           jsonb NOT NULL');
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
    expect(UWMD_LAKE_SCHEMA_VERSION).toBe('0.1');
    expect(ddl).toContain(`lake schema ${UWMD_LAKE_SCHEMA_VERSION}`);
  });
});
