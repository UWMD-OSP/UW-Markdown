// Descriptive business-plan identity — Format §2.2b, RFC 0072.
// No calculation, default, pack or underwriting behavior is selected here.

export const SCENARIOS = Object.freeze([
  'stabilized_acquisition',
  'ground_up_development',
  'value_add',
  'lease_up',
  'house_flip',
  'commercial_flip',
  'property_conversion',
  'land_banking',
] as const);

/** The closed standard business-plan vocabulary. */
export type Scenario = typeof SCENARIOS[number];
/** Open at the document boundary for extensions and lossless legacy reads. */
export type UWScenarioId = Scenario | (string & {});

export const RETIRED_SCENARIOS = Object.freeze([
  'nnn_single_tenant', 'lihtc_section8', 'build_to_rent', 'distressed_reo',
] as const);

/** Standard plan or reverse-DNS extension; no module declaration is required. */
export function isScenarioId(value: unknown): value is UWScenarioId {
  return typeof value === 'string' && (
    (SCENARIOS as readonly string[]).includes(value)
    || /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(value)
  );
}
