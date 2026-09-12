// Synthetic engineering inputs only; metrics come from the existing engine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseUWFile, assemblePropertyCashFlows, datedFlowsOf, xnpvOf, xirrOf,
  quantizeDecimal } from '../packages/uwmd-core/dist/index.js';
const sourceURL = new URL('../docs/examples/property-cash-flow-synthetic.uwx.md', import.meta.url);
const planURL = new URL('../docs/examples/property-cash-flow-plan.json', import.meta.url);
const source = readFileSync(sourceURL, 'utf8');
const planText = readFileSync(planURL, 'utf8');
const candidate = await assemblePropertyCashFlows(parseUWFile(source), JSON.parse(planText));
const flows = datedFlowsOf(candidate.series);
assert.ok(flows);
assert.equal(candidate.series.series[0].date, candidate.plan.acquisition_date);
assert.equal(readFileSync(sourceURL, 'utf8'), source);
assert.equal(readFileSync(planURL, 'utf8'), planText);
const metrics = { anchor: candidate.plan.acquisition_date, discount_rate: 0.08,
  xnpv: quantizeDecimal(xnpvOf(flows, 0.08), 2), xirr: quantizeDecimal(xirrOf(flows), 6) };
const expected = JSON.parse(readFileSync(new URL('../docs/examples/property-cash-flow-metrics.json', import.meta.url), 'utf8'));
assert.deepEqual(metrics, expected);
console.log(JSON.stringify({
  scope: 'Synthetic engineering example; not a real deal or underwriting recommendation.',
  candidate,
  metrics,
}, null, 2));
