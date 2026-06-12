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
  { section_id: 'property', path: 'year_built', label: 'Year built', kind: 'count' },
  { section_id: 'property', path: 'parking_spaces', label: 'Parking spaces', kind: 'count' },
  { section_id: 'rent_roll', path: 'in_place_rent_annual', label: 'In-place rent (annual)', kind: 'currency' },
  { section_id: 'rent_roll', path: 'gross_potential_rent_annual', label: 'GPR (annual)', kind: 'currency' },
  { section_id: 'rent_roll', path: 'physical_occupancy_pct', label: 'Physical occupancy (fraction)', kind: 'rate' },
  { section_id: 'rent_roll', path: 'economic_occupancy_pct', label: 'Economic occupancy (fraction)', kind: 'rate' },
  { section_id: 'valuation', path: 'purchase_price', label: 'Purchase price', kind: 'currency' },
  { section_id: 'valuation', path: 'income_approach.cap_rate_applied', label: 'Cap rate applied (fraction)', kind: 'rate' },
  { section_id: 'valuation', path: 'value_used_for_ltv', label: 'Value used for LTV', kind: 'currency' },
  { section_id: 'noi_model', path: 'net_operating_income', label: 'NOI', kind: 'currency' },
  { section_id: 'debt_structure', path: 'loan_amount', label: 'Loan amount', kind: 'currency' },
  { section_id: 'debt_structure', path: 'interest_rate', label: 'Interest rate (fraction)', kind: 'rate' },
  { section_id: 'debt_structure', path: 'annual_debt_service', label: 'Annual debt service', kind: 'currency' },
  { section_id: 'debt_structure', path: 'amortization_years', label: 'Amortization (years)', kind: 'count' },
  { section_id: 'debt_structure', path: 'loan_term_years', label: 'Loan term (years)', kind: 'count' },
  { section_id: 'debt_structure', path: 'io_period_months', label: 'IO period (months)', kind: 'count' },
  { section_id: 'sources_uses', path: 'sources.equity_sponsor', label: 'Sponsor equity', kind: 'currency' },
  { section_id: 'sources_uses', path: 'sources.senior_loan', label: 'Senior loan', kind: 'currency' },
  { section_id: 'sources_uses', path: 'uses.purchase_price', label: 'Purchase price (use)', kind: 'currency' },
  { section_id: 'dcf', path: 'assumptions.revenue_growth_rate', label: 'Revenue growth (fraction)', kind: 'rate' },
  { section_id: 'dcf', path: 'assumptions.expense_growth_rate', label: 'Expense growth (fraction)', kind: 'rate' },
  { section_id: 'dcf', path: 'assumptions.exit_cap_rate', label: 'Exit cap rate (fraction)', kind: 'rate' },
  { section_id: 'dcf', path: 'assumptions.discount_rate', label: 'Discount rate (fraction)', kind: 'rate' },
  { section_id: 'dcf', path: 'hold_period_years', label: 'Hold period (years)', kind: 'count' },
  { section_id: 'operating_statement', path: 'income.gross_potential_rent', label: 'GPR', kind: 'currency' },
  { section_id: 'operating_statement', path: 'income.effective_gross_income', label: 'EGI', kind: 'currency' },
  { section_id: 'operating_statement', path: 'expenses.total_operating_expenses', label: 'Total OpEx', kind: 'currency' },
  { section_id: 'operating_statement', path: 'net_operating_income', label: 'NOI', kind: 'currency' },
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

/** Read a number that may be stored bare or wrapped as `{ value, ... }`
 *  (the noi_model convention that preserves rationale/source alongside). */
export function getNumeric(content: unknown, path: string): number | undefined {
  const raw = deepGet(content, path);
  if (typeof raw === 'number') return raw;
  if (raw !== null && typeof raw === 'object' && typeof (raw as { value?: unknown }).value === 'number') {
    return (raw as { value: number }).value;
  }
  return undefined;
}

/** Write a number respecting the `{ value, ... }` wrapper if present —
 *  editing a wrapped field updates `.value` and keeps rationale/source. */
export function setNumeric(content: Record<string, unknown>, path: string, value: number): void {
  const existing = deepGet(content, path);
  if (
    existing !== null &&
    typeof existing === 'object' &&
    !Array.isArray(existing) &&
    'value' in (existing as Record<string, unknown>)
  ) {
    deepSet(content, `${path}.value`, value);
  } else {
    deepSet(content, path, value);
  }
}
