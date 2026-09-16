import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUWFile, toUWEnvelope } from '@uwmd/core';
import { describe, expect, it } from 'vitest';
import { lakeInputFromEnvelope, readBatchFactJSONL, readBlockValuesCSV } from './ingest.js';

const EXAMPLE = join(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md');
const DIGEST = 'sha256:2b1f1a2f3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7';

describe('lakeInputFromEnvelope', () => {
  it('projects a real document into one document row and its fact table', async () => {
    const envelope = toUWEnvelope(parseUWFile(await readFile(EXAMPLE, 'utf8')));
    const { document, facts } = await lakeInputFromEnvelope(envelope, {
      path: 'parkview.uwx.md',
      deal_id: 'PARKVIEW-1',
      valid: true,
    });

    expect(document.semantic_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(document.envelope).toBe(envelope);
    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      expect(fact.semantic_digest).toBe(document.semantic_digest);
      expect(fact.deal_id).toBe('PARKVIEW-1');
      expect(fact.path).toBe('parkview.uwx.md');
    }
  });

  it('recomputes the digest rather than trusting caller metadata', async () => {
    const envelope = toUWEnvelope(parseUWFile(await readFile(EXAMPLE, 'utf8')));
    const { document } = await lakeInputFromEnvelope(envelope, {
      // A stale digest passed as an extra must not become the primary key.
      deal_id: 'PARKVIEW-1',
    } as never);
    expect(document.semantic_digest).not.toBe(DIGEST);
  });

  it('gives the same envelope the same key on every run', async () => {
    const envelope = toUWEnvelope(parseUWFile(await readFile(EXAMPLE, 'utf8')));
    const [first, second] = await Promise.all([
      lakeInputFromEnvelope(envelope),
      lakeInputFromEnvelope(envelope),
    ]);
    expect(second.document.semantic_digest).toBe(first.document.semantic_digest);
    expect(second.facts).toEqual(first.facts);
  });
});

describe('readBlockValuesCSV', () => {
  const identity = { semantic_digest: DIGEST, deal_id: 'DEAL-1', valid: true };

  it('reads the normative columns and stamps the document identity', () => {
    const facts = readBlockValuesCSV(
      [
        'block_ref,scope,pointer,json_type,value_json',
        '/sections/1/blocks/0,content,/noi,number,1250000',
        '/sections/1/blocks/0,annotation,/label,string,"""Stabilized NOI"""',
      ].join('\n'),
      identity,
    );
    expect(facts).toHaveLength(2);
    expect(facts[0]).toMatchObject({ semantic_digest: DIGEST, deal_id: 'DEAL-1', pointer: '/noi', value_json: '1250000' });
    expect(facts[1].value_json).toBe('"Stabilized NOI"');
  });

  it('handles quoted commas, embedded newlines and CRLF line endings', () => {
    const facts = readBlockValuesCSV(
      'block_ref,scope,pointer,json_type,value_json\r\n/b,content,/note,string,"a, b\nc"\r\n',
      identity,
    );
    expect(facts).toHaveLength(1);
    expect(facts[0].value_json).toBe('a, b\nc');
  });

  it('ignores an unknown extra column so a future bundle revision still loads', () => {
    const facts = readBlockValuesCSV(
      ['block_ref,scope,pointer,json_type,value_json,future_column', '/b,content,/noi,number,1,anything'].join('\n'),
      identity,
    );
    expect(facts[0].value_json).toBe('1');
  });

  it('returns nothing for an empty file or a header alone', () => {
    expect(readBlockValuesCSV('', identity)).toEqual([]);
    expect(readBlockValuesCSV('block_ref,scope,pointer,json_type,value_json\n', identity)).toEqual([]);
  });

  it('refuses a missing column, an unknown scope, an unknown type, and an unterminated quote', () => {
    expect(() => readBlockValuesCSV('block_ref,scope,pointer,json_type\n', identity)).toThrow(/LAKE_CSV_COLUMNS/);
    expect(() =>
      readBlockValuesCSV('block_ref,scope,pointer,json_type,value_json\n/b,elsewhere,/p,number,1', identity),
    ).toThrow(/LAKE_CSV_SCOPE/);
    expect(() =>
      readBlockValuesCSV('block_ref,scope,pointer,json_type,value_json\n/b,content,/p,decimal,1', identity),
    ).toThrow(/LAKE_CSV_JSON_TYPE/);
    expect(() =>
      readBlockValuesCSV('block_ref,scope,pointer,json_type,value_json\n/b,content,/p,string,"open', identity),
    ).toThrow(/LAKE_CSV_QUOTE/);
  });
});

describe('readBatchFactJSONL', () => {
  const line = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      path: 'parkview.uwx.md',
      deal_id: 'DEAL-1',
      asset_class: 'multifamily',
      semantic_digest: DIGEST,
      valid: true,
      block_ref: '/sections/1/blocks/0',
      scope: 'content',
      pointer: '/noi',
      json_type: 'number',
      value_json: '1250000',
      ...overrides,
    });

  it('reads the batch fact table, keeping each line own digest', () => {
    const facts = readBatchFactJSONL(`${line()}\n${line({ pointer: '/egi' })}\n`);
    expect(facts).toHaveLength(2);
    expect(facts[0].semantic_digest).toBe(DIGEST);
    expect(facts[1].pointer).toBe('/egi');
  });

  it('tolerates blank lines and a missing trailing newline', () => {
    expect(readBatchFactJSONL(`\n${line()}\n\n${line({ pointer: '/egi' })}`)).toHaveLength(2);
    expect(readBatchFactJSONL('')).toEqual([]);
  });

  it('refuses a malformed line rather than loading a partial table', () => {
    expect(() => readBatchFactJSONL('{not json}')).toThrow(/LAKE_JSONL_PARSE/);
    expect(() => readBatchFactJSONL('[1,2]')).toThrow(/LAKE_JSONL_SHAPE/);
    expect(() => readBatchFactJSONL(line({ semantic_digest: undefined }))).toThrow(/LAKE_JSONL_FIELD/);
  });

  it('names the offending line number', () => {
    expect(() => readBatchFactJSONL(`${line()}\n{oops}`)).toThrow(/line 2/);
  });
});
