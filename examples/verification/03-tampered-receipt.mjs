// Scenario 3: a tampered receipt fails.
//
// Issues a receipt for `deal.uwx.md` (UW Receipt), verifies it, then checks
// two tamperings:
//   a. a stated result in the receipt is edited      -> failed, RCP-03
//   b. the record changes after the receipt is issued -> failed, RCP-01
// The receipt is issued at run time, so it always names the engine version
// that verifies it. Exits 0 when the untouched receipt verifies and both
// tamperings fail, 1 otherwise.
//
//   node 03-tampered-receipt.mjs [document.uwx.md] [changed-document.uwx.md]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { issueReceipt, verifyReceipt } from '@uwmd/verify';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const source = readFileSync(process.argv[2] ?? here('./deal.uwx.md'), 'utf8');
const changed = readFileSync(process.argv[3] ?? here('./deal.wrong-cap-rate.uwx.md'), 'utf8');

const receipt = await issueReceipt(source);
const report = (label, verification) => {
  const codes = verification.issues.map((issue) => issue.code).join(', ') || 'none';
  console.log(`${label}: ${verification.verdict} (issues: ${codes})`);
  return verification;
};

const untouched = report('Untouched receipt', await verifyReceipt(receipt, source));

const edited = structuredClone(receipt);
const [first] = edited.computation.results;
first.value += 0.01;
const resultTampered = report(`Receipt with '${first.calc_id}' edited`, await verifyReceipt(edited, source));

const recordTampered = report('Record changed after issuance', await verifyReceipt(receipt, changed));

const ok = untouched.verdict === 'verified'
  && resultTampered.verdict === 'failed' && resultTampered.issues.some((issue) => issue.code === 'RCP-03')
  && recordTampered.verdict === 'failed' && recordTampered.issues.some((issue) => issue.code === 'RCP-01');
console.log(ok ? 'As expected: the receipt verifies, and both tamperings fail' : 'UNEXPECTED verdicts');
process.exit(ok ? 0 : 1);
