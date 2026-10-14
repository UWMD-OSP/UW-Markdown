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
/** Open at the document boundary for extension identifiers. */
export type UWScenarioId = Scenario | (string & {});

/** Standard plan or reverse-DNS extension; no module declaration is required. */
export function isScenarioId(value: unknown): value is UWScenarioId {
  return typeof value === 'string' && (
    (SCENARIOS as readonly string[]).includes(value)
    || /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(value)
  );
}
