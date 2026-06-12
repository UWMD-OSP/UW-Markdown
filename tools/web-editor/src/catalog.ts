// Editable-field catalogs and display names — the editor's "what is safe to
// touch" registry, ported from the v0.1 vanilla editor.
//
// Why hand-curated rather than reflecting on the JSON: not every leaf number
// is safe to edit (some are sub-totals, some are derived intermediates, some
// are reference data). The protocol's eventual answer is module-declared field
// hints (FieldViewHint); until that surface exists, an allow-list is the safe
// default.

export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  deal_context: 'Deal Context',
  property: 'Property',
  ownership: 'Ownership & Acquisition',
  ownership_acquisition: 'Ownership & Acquisition',
  borrower_sponsor: 'Borrower / Sponsor',
  market_analysis: 'Market Analysis',
  rent_roll: 'Rent Roll',
  operating_statement: 'Operating Statement',
  noi_model: 'NOI Model',
  valuation: 'Valuation',
  debt_structure: 'Debt Structure',
  sources_uses: 'Sources & Uses',
  dcf: 'Discounted Cash Flow',
  stress_tests: 'Stress Tests',
  preliminary_sizing: 'Preliminary Sizing',
  loan_terms_summary: 'Loan Terms Summary',
  due_diligence: 'Due Diligence',
  third_party_reports: 'Third-Party Reports',
  insurance: 'Insurance',
  environmental: 'Environmental',
  legal: 'Legal',
  risk_assessment: 'Risk Assessment',
  compliance: 'Compliance',
  assumptions: 'Assumptions',
  closing_conditions: 'Closing Conditions',
  pipeline_log: 'Pipeline Log',
  validation: 'Validation',
  flags_and_validation: 'Flags & Validation',
  quick_metrics: 'Quick Metrics',
  custom_calculations: 'Custom Calculations',
  custom_scenarios: 'Custom Scenarios',
};

export function displayName(id: string): string {
  return SECTION_DISPLAY_NAMES[id] ?? id;
}

// ─── Frontmatter ─────────────────────────────────────────────────────────────

export const ASSET_CLASSES = [
  'multifamily',
  'office',
  'retail',
  'industrial',
  'self_storage',
  'hospitality',
  'senior_housing',
  'student_housing',
  'mixed_use',
  'land',
] as const;

export const DEAL_STAGES = [
  'screening',
  'term_sheet',
  'full_underwrite',
  'credit_approval',
  'closing',
  'monitoring',
] as const;

export const TIERS = ['screener', 'analyst'] as const;

export type FrontmatterFieldDef =
  | { kind: 'text'; path: string; label: string; nullable?: boolean }
  | { kind: 'enum'; path: string; label: string; options: readonly string[]; nullable?: boolean }
  | { kind: 'list'; path: string; label: string };

export const EDITABLE_FRONTMATTER_FIELDS: readonly FrontmatterFieldDef[] = [
  { kind: 'text', path: 'deal_name', label: 'Deal name' },
  { kind: 'text', path: 'property_address', label: 'Property address' },
  { kind: 'text', path: 'city', label: 'City' },
  { kind: 'text', path: 'state', label: 'State' },
  { kind: 'text', path: 'zip', label: 'ZIP' },
  { kind: 'enum', path: 'asset_class', label: 'Asset class', options: ASSET_CLASSES },
  { kind: 'text', path: 'asset_subtype', label: 'Subtype', nullable: true },
  { kind: 'text', path: 'loan_type', label: 'Loan type', nullable: true },
  { kind: 'text', path: 'scenario', label: 'Scenario', nullable: true },
  { kind: 'text', path: 'status', label: 'Status' },
  { kind: 'enum', path: 'deal_stage', label: 'Deal stage', options: DEAL_STAGES },
  { kind: 'enum', path: 'tier', label: 'Tier', options: TIERS, nullable: true },
  { kind: 'text', path: 'recommendation', label: 'Recommendation', nullable: true },
  { kind: 'list', path: 'flags', label: 'Flags' },
  { kind: 'list', path: 'blocking_flags', label: 'Blocking flags' },
  { kind: 'text', path: 'created_by', label: 'Created by' },
];

export const READONLY_FRONTMATTER_FIELDS: readonly { path: string; label: string }[] = [
  { path: 'uw_version', label: 'Format version' },
  { path: 'deal_id', label: 'Deal ID' },
  { path: 'created', label: 'Created' },
  { path: 'last_modified', label: 'Last modified' },
];

// ─── Numeric section-field allow-list ────────────────────────────────────────

export type NumericFieldKind = 'currency' | 'count' | 'number' | 'rate';

export interface NumericSectionField {
  section_id: string;
  path: string; // dot-path inside block.content
  label: string;
  kind: NumericFieldKind;
}

export const NUMERIC_SECTION_FIELDS: readonly NumericSectionField[] = [
  { section_id: 'property', path: 'total_units', label: 'Total units', kind: 'count' },
  { section_id: 'property', path: 'total_nra_sqft', label: 'Total NRA (sqft)', kind: 'count' },
  { section_id: 'valuation', path: 'purchase_price', label: 'Purchase price', kind: 'currency' },
  { section_id: 'noi_model', path: 'net_operating_income', label: 'NOI', kind: 'currency' },
  { section_id: 'debt_structure', path: 'loan_amount', label: 'Loan amount', kind: 'currency' },
  { section_id: 'debt_structure', path: 'interest_rate', label: 'Interest rate (fraction)', kind: 'rate' },
  { section_id: 'debt_structure', path: 'annual_debt_service', label: 'Annual debt service', kind: 'currency' },
  { section_id: 'sources_uses', path: 'sources.equity_sponsor', label: 'Sponsor equity', kind: 'currency' },
];

export function fieldsForSection(id: string): readonly NumericSectionField[] {
  return NUMERIC_SECTION_FIELDS.filter((f) => f.section_id === id);
}

// ─── Tiny path helpers (UI-side only; edits go through applyEdit) ────────────

export function deepGet(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (next === null || typeof next !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}
