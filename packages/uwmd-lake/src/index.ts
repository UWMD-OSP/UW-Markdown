/**
 * `@uwmd/lake` — the RFC 0049 reference PostgreSQL/JSONB lake adapter.
 *
 * This package is **not** part of the UW Markdown protocol and adds no database
 * dependency to `@uwmd/core`. It is a projection target: it reads canonical
 * outputs the standard already defines (envelopes, `block_values` facts,
 * receipts, package manifests) and plans idempotent, parameterized SQL that an
 * adopter executes with their own client.
 *
 * What is canonical and what is a projection:
 *
 *   | Canonical (the record)            | Warehouse projection (an index)   |
 *   |-----------------------------------|-----------------------------------|
 *   | `uw_documents.envelope` jsonb     | every other `uw_documents` column |
 *   | `uw_facts.value_json` jsonb       | `value_number` / `value_text` / … |
 *   | `uw_receipts.receipt` jsonb       | pack / engine / validation counts |
 *   | `uw_packages.manifest` jsonb      | member and link counts            |
 *
 * A query that disagrees with the calc engine is a query against the
 * projection; the JSONB column is the answer of record.
 */

export {
  UWMD_LAKE_SCHEMA_VERSION,
  postgresLakeSchema,
  postgresLakeSchemaStatements,
  LakeError,
} from './schema.js';

export {
  planLakeLoad,
  executeLakeLoad,
  planDocument,
  planFact,
  planReceipt,
  planPackage,
  planSourceEvidence,
  projectShadowColumns,
} from './plan.js';

export type {
  LakeStatement,
  LakeClient,
  LakeDocumentInput,
  LakeFactInput,
  LakeSourceEvidenceInput,
  LakeLoadInput,
  LakeLoadPlan,
} from './plan.js';

export { lakeInputFromEnvelope, readBlockValuesCSV, readBatchFactJSONL } from './ingest.js';

export type { LakeDocumentIdentity } from './ingest.js';
