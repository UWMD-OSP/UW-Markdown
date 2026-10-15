// Scenario 2: a stated metric that disagrees with the record fails.
//
// `deal.wrong-cap-rate.uwx.md` is `deal.uwx.md` with one change: the stated
// `quick_metrics.cap_rate` is 0.0600 where the record's NOI over price gives
// 0.0542. Under Protocol §II.2 item 2 a stated value that disagrees after
// quantization is a verification failure. This example exits 0 when the
// verifier reports that failure, and 1 if it does not.
//
//   node 02-incorrect-stated-metric.mjs [document.uwx.md]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseUWFile, verifyStatedMetrics } from '@uwmd/verify';

const file = process.argv[2] ?? fileURLToPath(new URL('./deal.wrong-cap-rate.uwx.md', import.meta.url));
const metrics = verifyStatedMetrics(parseUWFile(readFileSync(file, 'utf8')));

const failures = metrics.evidence.filter((entry) => entry.state === 'failed');
for (const entry of failures) {
  console.log(`  ${entry.path}: stated ${entry.stated}, recomputed ${entry.computed} -> failed`);
}
const { verified, failed, unverifiable } = metrics.counts;
console.log(`Stated metrics: ${verified} verified, ${failed} failed, ${unverifiable} unverifiable`);

const detected = failures.length > 0;
console.log(detected ? 'FAILED, as expected: the stated figure does not follow from the record' : 'UNEXPECTED: no stated metric failed');
process.exit(detected ? 0 : 1);
