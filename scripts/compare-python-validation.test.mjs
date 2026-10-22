import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticProjection, diagnosticsAgree } from './compare-python-validation.mjs';

test('diagnostic parity preserves duplicates and fields while ignoring order and prose', () => {
  const a = { code: 'WF-01', severity: 'error', section: 'distribution_waterfall', field: 'tiers[1].until_lp_irr' };
  const b = { ...a, field: 'tiers[2].until_lp_irr' };
  assert.equal(diagnosticsAgree({ issues: [a, b] }, { issues: [{ ...b, message: 'Independent narrative' }, a] }), true);
  for (const changed of [[a], [a, a], [{ ...a, field: 'tiers' }, b], [{ ...a, severity: 'warning' }, b]])
    assert.equal(diagnosticsAgree({ issues: [a, b] }, { issues: changed }), false);
  assert.equal(diagnosticsAgree({ error: { code: 'SOURCE_CONTENT_MISMATCH' } }, { issues: [] }), false);
  assert.equal(diagnosticsAgree({ error: { code: 'SOURCE_CONTENT_MISMATCH' } }, { error: { code: 'OTHER' } }), false);
  assert.throws(() => diagnosticProjection(undefined), /Missing/);
});
