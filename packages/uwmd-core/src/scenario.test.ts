import { describe, expect, it } from 'vitest';
import { isScenarioId, SCENARIOS, RETIRED_SCENARIOS } from './scenario.js';

describe('business-plan identity (Format §2.2b)', () => {
  it.each(SCENARIOS)('accepts standard plan %s', value => {
    expect(isScenarioId(value)).toBe(true);
  });
  it.each(['com.example.repositioning', 'org.uwmd.custom_plan', 'com.example.value_add', 'com.example.deep.plan'])('accepts owned extension %s without suffix interpretation', value => {
    expect(isScenarioId(value)).toBe(true);
  });
  it.each([...RETIRED_SCENARIOS, 'entitled_land_acquisition', 'other', '', 'com.plan', 'com.Example.plan', 'com.example.', 'com..plan', 'com.example.two-plans', null, 42, ['value_add'], { plan: 'value_add' }])('does not classify %j as a standard or extension plan', value => {
    expect(isScenarioId(value)).toBe(false);
  });
});
