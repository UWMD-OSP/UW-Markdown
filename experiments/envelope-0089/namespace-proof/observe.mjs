import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { decodeNamespaceXml } from './reader.mjs';
import { jcs, sha } from '../codec-study/independent.mjs';
const vectors = JSON.parse(readFileSync(0, 'utf8'));
const rows = [];
for (const row of vectors) {
  let result;
  try {
    const value = decodeNamespaceXml(row.text);
    if (jcs(value) !== jcs(row.model)) throw new TypeError('complete decoded model mismatch');
    result = { accepted: true, complete_model_jcs_sha256: sha(Buffer.from(jcs(value))), semantic_digest: value.semantic_digest };
  } catch (error) { result = { accepted: false, error_name: error.name, error_message: error.message }; }
  if (result.accepted !== row.expected_accepted) throw new TypeError(`namespace outcome mismatch ${row.case}/${row.vector}: ${JSON.stringify(result)}`);
  rows.push({ case: row.case, vector: row.vector, input_sha256: sha(Buffer.from(row.text)), ...result });
}
const require = createRequire(import.meta.url);
const dependencies = Object.fromEntries(Object.keys(require.cache).sort().map(path => {
  const label = path.replaceAll('\\', '/').split('/node_modules/').at(-1);
  if (label === path) throw new TypeError('unclassified dependency');
  return [label, sha(readFileSync(path))];
}));
console.log(JSON.stringify({ rows, dependencies }));
