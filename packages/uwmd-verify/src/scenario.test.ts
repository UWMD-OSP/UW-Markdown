import { describe, expect, it } from 'vitest';
import { isScenarioId, SCENARIOS } from './scenario.js';

/** Plan names RFC 0072 retired; they are ordinary non-standard values now. */
const FORMERLY_RETIRED = ['nnn_single_tenant', 'lihtc_section8', 'build_to_rent', 'distressed_reo'];

describe('business-plan identity (Format §2.2b)', () => {
  it.each(SCENARIOS)('accepts standard plan %s', value => {
    expect(isScenarioId(value)).toBe(true);
  });
  it.each(['com.example.repositioning', 'org.uwmd.custom_plan', 'com.example.value_add', 'com.example.deep.plan'])('accepts owned extension %s without suffix interpretation', value => {
    expect(isScenarioId(value)).toBe(true);
  });
  it.each([...FORMERLY_RETIRED, 'entitled_land_acquisition', 'other', '', 'com.plan', 'com.Example.plan', 'com.example.', 'com..plan', 'com.example.two-plans', null, 42, ['value_add'], { plan: 'value_add' }])('does not classify %j as a standard or extension plan', value => {
    expect(isScenarioId(value)).toBe(false);
  });
});
