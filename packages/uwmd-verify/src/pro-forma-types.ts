// RFC 0092: closed bounded profile contract. Financial support remains gated
// independently of these vocabulary and wire declarations.
import type { ProtocolError } from './protocol.js';
import type { ValidationMessage } from './types.js';

export const PRO_FORMA_REGISTRY = 'uwmd.pro-forma.l1.1' as const;
export const PRO_FORMA_IDENTITIES = Object.freeze([
  'total_net', 'moic', 'xnpv', 'xirr', 'coverage', 'blended_coverage',
  'debt_yield_through', 'ltc_through', 'ltv_through', 'weighted_cost',
  'net_cash_flow', 'final_occupied_sf', 'final_occupancy_rate', 'ltv',
  'declared_ledger_membership',
] as const);
export const PRO_FORMA_FAMILIES = Object.freeze([
  'growth', 'revenue', 'expenses', 'noi', 'ncf', 'debt_service',
  'interest_principal', 'balance_balloon', 'dscr', 'debt_yield', 'ltv',
  'exit', 'equity_sale_proceeds', 'cash_flows', 'irr', 'equity_multiple',
  'cash_on_cash', 'npv', 'unclassified',
] as const);
export type ProFormaIdentity = typeof PRO_FORMA_IDENTITIES[number];
export type ProFormaFamily = typeof PRO_FORMA_FAMILIES[number];
export type ProFormaState = 'verified' | 'failed' | 'unverifiable';

export interface ProFormaAddress {
  section: string;
  variant: string | null;
  /** RFC 6901, resolved before canonicalization. Empty selects the block payload. */
  pointer: string;
}
export interface ProFormaRow {
  address: ProFormaAddress;
  family?: string;
  kind?: 'computed' | 'input' | 'assumption';
}
/** RFC0128: the loan input is the sole authored loan selector. */
export interface ProFormaSelectors {
  over?: string;
  through?: number;
  period?: string;
}
export interface ProFormaRelationship {
  id?: string;
  identity: string;
  procedure_version: '1';
  target: ProFormaAddress;
  inputs: Array<{ role: string; address: ProFormaAddress }>;
  unit: string;
  currency?: string;
  conventions?: Record<string, unknown>;
  selectors?: ProFormaSelectors;
  applicability?: { applicable: boolean; reason?: string };
}
export interface ProFormaLedger {
  universe: Array<{ event: ProFormaAddress; role: string; required: boolean }>;
  bindings: Array<{ event: ProFormaAddress; role: string; target?: ProFormaAddress }>;
  exclusions: Array<{ event: ProFormaAddress; role: string; reason: string }>;
}
export interface ProFormaClaim {
  profile: 'pro-forma';
  level: 'L1';
  convention_registry: string;
  rows: ProFormaRow[];
  relationships: ProFormaRelationship[];
  conventions?: Record<string, unknown>;
  timeline?: Record<string, unknown>;
  ledger?: ProFormaLedger;
}
/** Structural report identity, not a digest or cross-revision identifier. */
export interface ProFormaTarget {
  block_address_kind: 'source' | 'model';
  block_address: number | Array<string | number>;
  section_id: string;
  variant: string | null;
  target_pointer: string;
  period_key: string | null;
  loan_ref: string | null;
}
export interface ProFormaFinding {
  code: string;
  severity: 'error' | 'indeterminate';
  reason: string;
  origins: string[];
  error?: ProtocolError;
}
export interface ProFormaRelationshipResult {
  assertion_key: string;
  identity: string;
  origins: string[];
  declaration: unknown;
  state: ProFormaState;
  reason?: string;
  computed: number | null;
  local_state: ProFormaState;
  findings: unknown[];
  dependencies: string[];
}
export interface ProFormaAssertion {
  key: string;
  target: ProFormaTarget | null;
  address: ProFormaAddress;
  origins: string[];
  row_family: ProFormaFamily;
  stated: number | null;
  state: ProFormaState;
  reasons: string[];
  relationships: number[];
}
export interface ProFormaInput {
  address: ProFormaAddress;
  target: ProFormaTarget | null;
  origins: string[];
  row_family: ProFormaFamily;
  reason: 'input' | 'assumption';
}
export interface ProFormaCounts {
  total: number;
  verified: number;
  failed: number;
  unverifiable: number;
}
export interface ProFormaReport {
  status: 'completed';
  profile: 'pro-forma';
  level: 'L1';
  selection: { operation: 'source' | 'model'; claim: ProFormaTarget };
  assertions: ProFormaAssertion[];
  relationships: ProFormaRelationshipResult[];
  inputs: ProFormaInput[];
  input_count: number;
  coverage: {
    total: number;
    by_verdict: Record<ProFormaState, number>;
    by_row_family: Partial<Record<ProFormaFamily, ProFormaCounts>>;
  };
  gaps: Array<{ event: ProFormaAddress; role: string; required: boolean; reason: string; origins: string[] }>;
  exclusions: Array<{ origin: string; reason: string }>;
  profile_claim_findings: ProFormaFinding[];
  validation: ValidationMessage[];
  exit_code: 0 | 1;
}
export interface ProFormaRefusal {
  status: 'refused';
  error: ProtocolError;
}

