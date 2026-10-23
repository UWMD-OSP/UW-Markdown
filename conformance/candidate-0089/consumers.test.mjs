import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { sha } from './model.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Inventory is deliberately closed: a new current consumer must be classified.
const inventory = {
  'packages/uwmd-batch/src/index.ts': 'whole-source batch document identity',
  'packages/uwmd-lake/src/ingest.ts': 'whole-source ingestion identity; flat result indexes retain their own scope',
  'packages/uwmd-core/src/cli-packages.ts': 'whole-source package member identity',
  'packages/uwmd-core/src/cli.ts': 'whole-source serialization; selected financial results remain separately scoped',
  'packages/uwmd-core/src/source-file.ts': 'whole-source representation loading',
  'packages/uwmd-excel/src/mcpSheet.ts': 'whole-source workbook/MCP optimistic concurrency identity',
  'packages/uwmd-verify/src/bindings.ts': 'whole-source HTTP/MCP edit precondition and returned stamp',
  'packages/uwmd-verify/src/document-signatures.ts': 'whole-source V13 document subject',
  'packages/uwmd-verify/src/index.ts': 'public export, not an additional commitment',
  'packages/uwmd-verify/src/envelope.ts': 'whole-source canonicalization definition',
  'packages/uwmd-verify/src/integrity.ts': 'whole-source V13 check; V9 block and V11 signing inputs stay separately scoped',
  'packages/uwmd-verify/src/lease-up-cash-flows.ts': 'whole-source assembly provenance; selected ledger/result commitments stay scoped',
  'packages/uwmd-verify/src/property-cash-flows.ts': 'forwards the lease-up whole-source identity into assembly provenance; output series retain selected ledger scope',
  'packages/uwmd-verify/src/protocol.ts': 'typed whole-source result fields, not additional computation',
  'packages/uwmd-verify/src/receipts.ts': 'whole-source UWX receipt subject; ordinary receipts retain their own subject policy',
  'packages/uwmd-verify/src/replacement-funding.ts': 'V12 selected payment-vector binding, not a whole-source commitment',
  'packages/uwmd-verify/src/replacement-funding-structure.ts': 'V12 selected binding shape admission, not whole-source identity',
  'packages/uwmd-verify/src/reserve-accounts.ts': 'whole-source verification provenance, not an authored stale-plan binding',
  'packages/uwmd-verify/src/reserve-draw-bindings.ts': 'whole-source once-bound plan subject; no automatic rebinding',
  'packages/uwmd-verify/src/uwcsv.ts': 'whole-source carrier stamp',
  'packages/uwmd-verify/src/uwjson.ts': 'whole-source carrier stamp',
  'packages/uwmd-verify/src/uwxml.ts': 'whole-source carrier stamp',
  'tools/web-editor/src/state.ts': 'whole-source projection into explicitly reduced Lite view',
  'tools/web-editor/src/App.tsx': 'whole-source JSON export',
};
function* sources(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'dist-validator', '.git'].includes(item.name)) continue;
    const path = resolve(directory, item.name);
    if (item.isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx)$/.test(item.name) && !/\.test\.(ts|tsx)$/.test(item.name)) yield path;
  }
}
test('all current source-identity consumers have an explicit commitment scope', () => {
  const results = [];
  for (const group of ['packages', 'tools']) for (const path of sources(resolve(root, group))) {
    const source = readFileSync(path, 'utf8');
    const matches = [...source.matchAll(/computeEnvelopeDigest|toUWEnvelope|stampEnvelopeDigest|verifyEnvelopeDigest|uw-envelope-semantic|source_digest|source_envelope_digest|binding_digest/g)];
    if (!matches.length) continue;
    const name = relative(root, path).replaceAll('\\', '/');
    assert.ok(Object.hasOwn(inventory, name), `unclassified consumer: ${name}`);
    results.push({ path: name, source_sha256: sha(Buffer.from(source)), matches: matches.length, commitment: inventory[name], production_adoption: 'after acceptance, not claimed by this candidate' });
  }
  assert.deepEqual(results.map(row => row.path).sort(), Object.keys(inventory).sort());
  const folder = resolve(root, 'node_modules/.cache/rfc0089-evidence'); mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, 'consumer-inventory.json'), JSON.stringify({ platform: process.platform, results }, null, 2));
});
