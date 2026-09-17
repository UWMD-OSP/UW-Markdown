import { describe, expect, it } from 'vitest';
import {
  executeLakeLoad,
  planDocument,
  planFact,
  planLakeLoad,
  planPackage,
  planReceipt,
  planSourceEvidence,
  projectShadowColumns,
  type LakeClient,
  type LakeFactInput,
} from './plan.js';
import { LakeError } from './schema.js';

const DIGEST = 'sha256:2b1f1a2f3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7';

const FACT: LakeFactInput = {
  semantic_digest: DIGEST,
  block_ref: '/sections/3/blocks/0',
  scope: 'content',
  pointer: '/noi',
  json_type: 'number',
  value_json: '1250000',
  deal_id: 'DEAL-1',
};

const RECEIPT = {
  receipt_version: '1.1',
  subject: { representation: 'uwx', representation_version: '2.0', canonicalization: 'envelope', canonicalization_version: '1.0', digest: DIGEST },
  computation: { pack_id: 'org.uwmd.multifamily', pack_version: '1.2.0', engine: '@uwmd/core', engine_version: '2.10.0', results: [] },
  // The shape UW_RECEIPT_v1 actually defines. A receipt states its validation
  // counts; it carries no verdict, because a verdict is what verifying one
  // produces (§5). An earlier fixture invented `computation.verdict`, which is
  // why a permanently-NULL projection column went unnoticed until a real
  // PostgreSQL load ran the corpus.
  policy: { policy_set: 'builtin', policy_set_version: '1.0', validation: { errors: 0, warnings: 5 } },
  issued_at: '2026-09-15T00:00:00Z',
  issuer: 'uwmd-cli',
  signature: null,
};

const MANIFEST = {
  package_version: '1.0',
  package_id: 'pkg-alpha',
  members: [
    { id: 'deal', path: 'deal.uwx.md', role: 'primary', media_type: 'text/markdown', sha256: 'sha256:aa', semantic_digest: DIGEST, document_profile: 'deal' },
    { id: 'market', path: 'market.uwx.md', role: 'supporting', media_type: 'text/markdown', sha256: 'sha256:bb' },
  ],
  links: [{ type: 'derives_from', from: 'deal', to: 'market' }],
  vendor_extension: { keep: true },
};

describe('planDocument', () => {
  it('stores the envelope verbatim and projects the rest', () => {
    const statement = planDocument('public', {
      semantic_digest: DIGEST,
      envelope: { unknown_section: { survives: [1, null, 'yes'] } },
      deal_id: 'DEAL-1',
      currency_code: 'USD',
      valid: true,
    });
    expect(statement.sql).toContain('ON CONFLICT (semantic_digest) DO UPDATE SET');
    expect(statement.params[0]).toBe(DIGEST);
    expect(statement.params[2]).toBe('DEAL-1');
    expect(statement.params[6]).toBe('USD');
    expect(JSON.parse(statement.params[13] as string)).toEqual({
      unknown_section: { survives: [1, null, 'yes'] },
    });
  });

  it('never inlines a value into the SQL text', () => {
    const statement = planDocument('public', { semantic_digest: DIGEST, envelope: {}, deal_name: "O'Hare Logistics" });
    expect(statement.sql).not.toContain("O'Hare");
    expect(statement.params).toContain("O'Hare Logistics");
  });

  it('refuses a row without a digest or without the canonical JSON', () => {
    expect(() => planDocument('public', { semantic_digest: '', envelope: {} })).toThrow(/LAKE_DOCUMENT_DIGEST/);
    expect(() => planDocument('public', { semantic_digest: DIGEST, envelope: null })).toThrow(/LAKE_DOCUMENT_ENVELOPE/);
  });
});

describe('planFact', () => {
  it('upserts on the durable tuple', () => {
    expect(planFact('public', FACT).sql).toContain(
      'ON CONFLICT (semantic_digest, block_ref, scope, pointer) DO UPDATE SET',
    );
  });

  it('carries the shadow projection alongside the raw value', () => {
    const { params } = planFact('public', FACT);
    expect(params[5]).toBe('1250000');
    expect(params[6]).toBe(1250000);
    expect(params[7]).toBeNull();
  });

  it('refuses a fact that cannot be keyed', () => {
    expect(() => planFact('public', { ...FACT, semantic_digest: '' })).toThrow(/LAKE_FACT_DIGEST/);
  });

  it('stores a container fact as NULL, because the canonical row has no value of its own', () => {
    // flattenEnvelopeBlockValues, block_values.csv and @uwmd/batch's JSONL all
    // emit value_json '' for an object or an array: the children are the
    // content. '' is not JSON, so passing it verbatim made a jsonb column
    // refuse 21% of the conformance corpus.
    for (const json_type of ['object', 'array'] as const) {
      const { params } = planFact('public', { ...FACT, json_type, value_json: '' });
      expect(params[5]).toBeNull();
    }
  });

  it('keeps a container value that a producer does state', () => {
    const { params } = planFact('public', { ...FACT, json_type: 'object', value_json: '{"a":1}' });
    expect(params[5]).toBe('{"a":1}');
  });

  it('refuses a scalar with no value rather than nulling it', () => {
    for (const json_type of ['string', 'number', 'boolean', 'null'] as const) {
      expect(() => planFact('public', { ...FACT, json_type, value_json: '' })).toThrow(/LAKE_FACT_VALUE/);
    }
  });
});

describe('projectShadowColumns', () => {
  it('populates exactly the column the declared type names', () => {
    expect(projectShadowColumns({ json_type: 'number', value_json: '12.5' })).toEqual({
      value_number: 12.5, value_text: null, value_boolean: null, value_date: null,
    });
    expect(projectShadowColumns({ json_type: 'boolean', value_json: 'true' })).toEqual({
      value_number: null, value_text: null, value_boolean: true, value_date: null,
    });
    expect(projectShadowColumns({ json_type: 'string', value_json: '"Class A"' })).toEqual({
      value_number: null, value_text: 'Class A', value_boolean: null, value_date: null,
    });
  });

  it('narrows an ISO calendar date into value_date without losing value_text', () => {
    expect(projectShadowColumns({ json_type: 'string', value_json: '"2026-03-31"' })).toEqual({
      value_number: null, value_text: '2026-03-31', value_boolean: null, value_date: '2026-03-31',
    });
    expect(projectShadowColumns({ json_type: 'string', value_json: '"2026-02-30"' }).value_date).toBeNull();
  });

  it('never sniffs a numeric-looking string into value_number', () => {
    const projected = projectShadowColumns({ json_type: 'string', value_json: '"0.0551"' });
    expect(projected.value_number).toBeNull();
    expect(projected.value_text).toBe('0.0551');
  });

  it('leaves objects, arrays, nulls and unparseable values entirely unprojected', () => {
    for (const fact of [
      { json_type: 'object', value_json: '{"a":1}' },
      { json_type: 'array', value_json: '[1,2]' },
      { json_type: 'null', value_json: 'null' },
      { json_type: 'number', value_json: 'not json' },
    ] as const) {
      expect(projectShadowColumns(fact)).toEqual({
        value_number: null, value_text: null, value_boolean: null, value_date: null,
      });
    }
  });
});

describe('planReceipt', () => {
  it('keys by the canonical hash of the receipt and indexes the joinable fields', async () => {
    const statement = await planReceipt('public', RECEIPT);
    expect(statement.params[1]).toBe(DIGEST);
    expect(statement.params[3]).toBe('org.uwmd.multifamily');
    expect(statement.params[4]).toBe('1.2.0');
    expect(statement.params[5]).toBe('@uwmd/core');
    expect(statement.params[9]).toBe(false);
    expect(statement.params[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('projects the validation counts the receipt states, and nothing it does not', async () => {
    const statement = await planReceipt('public', RECEIPT);
    expect(statement.params[10]).toBe(0);
    expect(statement.params[11]).toBe(5);
    // There is no verdict column to project into.
    expect(statement.sql).not.toContain('verdict');
  });

  it('leaves the counts null when a receipt states none, rather than guessing zero', async () => {
    const statement = await planReceipt('public', { ...RECEIPT, policy: { policy_set: 'builtin' } });
    expect(statement.params[10]).toBeNull();
    expect(statement.params[11]).toBeNull();
  });

  it('gives byte-identical receipts the same key and a re-issue a different one', async () => {
    const first = await planReceipt('public', RECEIPT);
    const again = await planReceipt('public', { ...RECEIPT });
    const reissued = await planReceipt('public', { ...RECEIPT, issued_at: '2026-09-16T00:00:00Z' });
    expect(again.params[0]).toBe(first.params[0]);
    expect(reissued.params[0]).not.toBe(first.params[0]);
  });

  it('marks a signed receipt', async () => {
    const statement = await planReceipt('public', { ...RECEIPT, signature: { alg: 'ed25519', value: 'x' } });
    expect(statement.params[9]).toBe(true);
  });

  it('refuses a receipt with no subject digest to join on', async () => {
    await expect(planReceipt('public', { ...RECEIPT, subject: {} })).rejects.toThrow(/LAKE_RECEIPT_SUBJECT/);
  });
});

describe('planPackage', () => {
  it('emits the package before its members and joins members by byte digest', () => {
    const [pkg, deal, market] = planPackage('public', MANIFEST);
    expect(pkg.sql).toContain('INSERT INTO public.uw_packages');
    expect(pkg.params[2]).toBe(2);
    expect(pkg.params[3]).toBe(1);
    expect(deal.sql).toContain('INSERT INTO public.uw_package_members');
    expect(deal.params[5]).toBe('sha256:aa');
    expect(deal.params[6]).toBe(DIGEST);
    expect(market.params[6]).toBeNull();
  });

  it('keeps unknown manifest keys in the stored JSON', () => {
    const [pkg] = planPackage('public', MANIFEST);
    expect(JSON.parse(pkg.params[4] as string).vendor_extension).toEqual({ keep: true });
  });

  it('refuses a member that has no byte digest', () => {
    expect(() => planPackage('public', { ...MANIFEST, members: [{ id: 'x' }] })).toThrow(
      /LAKE_PACKAGE_MEMBER_DIGEST/,
    );
  });
});

describe('planSourceEvidence', () => {
  it('records identity and status', () => {
    const statement = planSourceEvidence('public', {
      semantic_digest: DIGEST,
      evidence_id: 'rent-roll',
      kind: 'rent_roll',
      status: 'approved',
      reference: { scheme: 'uwmd.source', authority: 'example.com', value: 'rr-2026-03' },
    });
    expect(statement.params.slice(2, 7)).toEqual([
      'rent_roll', 'approved', 'uwmd.source', 'example.com', 'rr-2026-03',
    ]);
  });

  it('refuses a payload carrying source bytes, however deeply nested', () => {
    expect(() =>
      planSourceEvidence('public', {
        semantic_digest: DIGEST,
        evidence_id: 'rent-roll',
        attachment: { nested: { data_base64: 'UExFQVNFTk8=' } },
      }),
    ).toThrow(LakeError);
    expect(() =>
      planSourceEvidence('public', { semantic_digest: DIGEST, evidence_id: 'rr', content: 'raw bytes' }),
    ).toThrow(/LAKE_SOURCE_BYTES/);
  });

  it('allows an explicitly absent byte field', () => {
    expect(() =>
      planSourceEvidence('public', { semantic_digest: DIGEST, evidence_id: 'rr', content: null }),
    ).not.toThrow();
  });
});

describe('planLakeLoad', () => {
  const input = {
    documents: [{ semantic_digest: DIGEST, envelope: { a: 1 } }],
    facts: [FACT],
    receipts: [RECEIPT],
    packages: [MANIFEST],
    source_evidence: [{ semantic_digest: DIGEST, evidence_id: 'rr', status: 'approved' }],
  };

  it('counts what it planned', async () => {
    const plan = await planLakeLoad(input);
    expect(plan.counts).toEqual({
      documents: 1, facts: 1, receipts: 1, packages: 1, package_members: 2, source_evidence: 1,
    });
    expect(plan.statements).toHaveLength(7);
  });

  it('orders packages ahead of their members so the foreign key holds', async () => {
    const plan = await planLakeLoad(input);
    const order = plan.statements.map((statement) => statement.sql.split('\n')[0]);
    expect(order[0]).toContain('uw_documents');
    expect(order[1]).toContain('uw_facts');
    expect(order[2]).toContain('uw_receipts');
    expect(order[3]).toContain('uw_packages');
    expect(order[4]).toContain('uw_package_members');
    expect(order[5]).toContain('uw_package_members');
    expect(order[6]).toContain('uw_source_evidence');
  });

  it('is deterministic — the same input plans the same statements', async () => {
    const [first, second] = await Promise.all([planLakeLoad(input), planLakeLoad(input)]);
    expect(second.statements).toEqual(first.statements);
  });

  it('plans nothing for an empty input', async () => {
    const plan = await planLakeLoad({});
    expect(plan.statements).toHaveLength(0);
    expect(plan.schema).toBe('public');
  });

  it('refuses an injected schema name', async () => {
    await expect(planLakeLoad({ schema: 'public"; DROP TABLE uw_facts; --' })).rejects.toThrow(
      /LAKE_SCHEMA_NAME/,
    );
  });
});

describe('executeLakeLoad', () => {
  it('runs every statement in order against an adopter client', async () => {
    const seen: string[] = [];
    const client: LakeClient = {
      query: async (sql) => {
        seen.push(sql.split('\n')[0]);
      },
    };
    const plan = await planLakeLoad({ documents: [{ semantic_digest: DIGEST, envelope: {} }], facts: [FACT] });
    expect(await executeLakeLoad(plan, client)).toBe(2);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toContain('uw_documents');
  });

  it('loading the same plan twice issues identical statements — idempotency is the upsert, not a guard', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const client: LakeClient = { query: async (sql, params) => void calls.push({ sql, params }) };
    const plan = await planLakeLoad({ facts: [FACT] });
    await executeLakeLoad(plan, client);
    await executeLakeLoad(plan, client);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0].sql).toContain('DO UPDATE SET');
  });

  it('does not swallow a client failure', async () => {
    const client: LakeClient = {
      query: async () => {
        throw new Error('connection reset');
      },
    };
    const plan = await planLakeLoad({ facts: [FACT] });
    await expect(executeLakeLoad(plan, client)).rejects.toThrow('connection reset');
  });
});
