// Scenario 1: a valid document verifies.
//
// Parses the document, applies the Format validation rules and recomputes
// every stated metric the metric dictionary defines (Protocol §II.2 items 1
// and 2). Exits 0 when the document is well formed and every expected stated
// metric verifies, 1 otherwise.
//
//   node 01-valid-document.mjs [document.uwx.md]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { parseUWFile, validateUWFile, verifyStatedMetrics } from '@uwmd/verify';

const file = process.argv[2] ?? fileURLToPath(new URL('./deal.uwx.md', import.meta.url));
const parsed = parseUWFile(readFileSync(file, 'utf8'));

const validation = validateUWFile(parsed);
console.log(`Validation: ${validation.overall_status} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`);

const metrics = verifyStatedMetrics(parsed);
for (const entry of metrics.evidence) {
  console.log(`  ${entry.path}: stated ${entry.stated}, recomputed ${entry.computed ?? '-'} -> ${entry.state}`);
}
const { verified, failed, unverifiable } = metrics.counts;
console.log(`Stated metrics: ${verified} verified, ${failed} failed, ${unverifiable} unverifiable`);

const expectedByName = {
  'deal.uwx.md': 9,
  'Agave-Court-Apts-Scottsdale-AZ.uwx.md': 9,
  'Parkview-Apts-Glendale-AZ.uwx.md': 9,
  'parkview-reviewed.uwx.md': 9,
};
const expected = expectedByName[basename(file)] ?? metrics.evidence.length;
const ok = validation.errors.length === 0 && verified === expected && expected > 0
  && failed === 0 && unverifiable === 0;
console.log(ok ? 'VERIFIED' : 'FAILED');
process.exit(ok ? 0 : 1);
