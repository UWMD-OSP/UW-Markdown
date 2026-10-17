// Immutable raw evidence verification only; does not execute production observations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const here = new URL('./', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const record = JSON.parse(readFileSync(new URL('frozen/current-replay-afcc/observations.json', here)));
for (const [name, expected] of Object.entries(record.observations)) assert.equal(sha(readFileSync(new URL(`frozen/${name}`, here))), expected, name);
for (const item of record.executions) {
  assert.equal(item.exit_code, 0);
  for (const stream of ['stdout', 'stderr']) {
    const bytes = readFileSync(new URL(`frozen/current-replay-afcc/${item[stream].path}`, here));
    assert.equal(bytes.length, item[stream].bytes);
    assert.equal(sha(bytes), item[stream].sha256);
  }
}
console.log('PASS original and fresh afcc frozen observations/raw streams; no runtime replay');
