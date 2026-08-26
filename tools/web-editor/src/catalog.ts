// Editable-field catalogs and display names — the editor's "what is safe to
// touch" registry, ported from the v0.1 vanilla editor.
//
// Why hand-curated rather than reflecting on the JSON: not every leaf number
// is safe to edit (some are sub-totals, some are derived intermediates, some
// are reference data). The protocol's eventual answer is module-declared field
// hints (FieldViewHint); until that surface exists, an allow-list is the safe
// default.

import { SIZE_INTENSIVES } from '@uwmd/core/browser';

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

/** The asset classes this editor knows — mirrors the packs' `asset_classes`. */
export type AssetClass = (typeof ASSET_CLASSES)[number];

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
  /** Asset classes this field belongs to. Omitted means "every class" — the
   *  field is class-independent (year built, parking) and is always offered.
   *  When present, the field is offered only to a deal of one of these classes,
   *  to an unrecognized/unset class, and to `mixed_use` (see
   *  `fieldsForSection`). `catalog.test.ts` pins the coverage direction that
   *  matters: every `property.*` path a class's calc pack reads is offered to
   *  that class, so the quick-edit grid can never omit an input the metric
   *  strip needs. The reverse is not required — a class may also carry a size
   *  figure no metric divides by (senior housing states beds alongside units).
   */
  asset_classes?: readonly AssetClass[];
}

// The size intensive — the denominator of every per-unit metric — is named
// differently by each asset class, so each one is scoped. The scoping now
// derives from the Protocol §XIII registry (RFC 0027): a path is offered to
// exactly the classes whose registry entry names it as primary or secondary,
// so the grid can never drift from the table the packs divide by. Only the
// display label and input kind are the editor's own knowledge.
const SIZE_FIELD_DISPLAY: Record<string, { label: string; kind: NumericFieldKind }> = {
  total_units: { label: 'Total units', kind: 'count' },
  total_nra_sqft: { label: 'Total NRA (sqft)', kind: 'count' },
  rentable_square_feet: { label: 'Rentable area (sqft)', kind: 'count' },
  gross_leasable_area: { label: 'Gross leasable area (sqft)', kind: 'count' },
  net_rentable_square_feet: { label: 'Net rentable area (sqft)', kind: 'count' },
  rentable_units: { label: 'Rentable units', kind: 'count' },
  keys: { label: 'Keys', kind: 'count' },
  total_beds: { label: 'Total beds', kind: 'count' },
  gross_acres: { label: 'Gross acres', kind: 'number' },
  usable_acres: { label: 'Usable acres', kind: 'number' },
  entitled_units: { label: 'Entitled units', kind: 'count' },
};

function sizeIntensiveFields(): NumericSectionField[] {
  const classesByPath = new Map<string, AssetClass[]>();
  for (const [cls, entry] of Object.entries(SIZE_INTENSIVES)) {
    for (const path of [entry.path, ...entry.secondary]) {
      const list = classesByPath.get(path);
      if (list) list.push(cls as AssetClass);
      else classesByPath.set(path, [cls as AssetClass]);
    }
  }
  return [...classesByPath].map(([path, asset_classes]) => {
    const display = SIZE_FIELD_DISPLAY[path] ?? { label: path, kind: 'count' as const };
    return { section_id: 'property', path, label: display.label, kind: display.kind, asset_classes };
  });
}

export const NUMERIC_SECTION_FIELDS: readonly NumericSectionField[] = [
  ...sizeIntensiveFields(),
  // Class-independent: every class may carry these, land included (a parcel can
  // hold an improvement slated for demolition), so neither is scoped.
  { section_id: 'property', path: 'year_built', label: 'Year built', kind: 'count' },
  { section_id: 'property', path: 'parking_spaces', label: 'Parking spaces', kind: 'count' },
  // rent_roll totals (GPR, in-place rent, occupancy) are footed from line items
  // by the RentRollModel surface, not hand-entered — see components/RentRollModel.
  { section_id: 'noi_model', path: 'net_operating_income', label: 'NOI', kind: 'currency' },
  // valuation, debt_structure, and sources_uses are now footed-model surfaces
  // (ValuationModel / DebtModel / SourcesUsesModel): their inputs are edited in
  // the model and their totals foot from those inputs, so they are no longer in
  // this flat numeric grid. The generic field editor (collapsed) remains the
  // escape hatch for any other scalar leaf, with footed totals locked out.
  // dcf assumptions, per-year cash flows, and the exit waterfall are owned by the
  // DcfModel footed surface — its levered CF / cash-on-cash / disposition / net /
  // proceeds totals foot from line items, so they're no longer a flat numeric grid.
  // operating_statement income/expense lines and footed totals (EGI, OpEx, NOI)
  // are owned by the OperatingStatementModel surface — see that component.
];

/** The editable numeric fields for a section, narrowed to an asset class.
 *
 *  The filter is deliberately **opt-out**: showing a spare input is a smaller
 *  harm than hiding one the analyst needs, so a field is dropped only when the
 *  class is known *and* the field explicitly names other classes. Three cases
 *  therefore see the full list — an unset `asset_class`, one this build does
 *  not recognize, and `mixed_use`, whose record may legitimately carry any
 *  use's intensive (its per-component figures live in the `components` section
 *  and are edited there).
 *
 *  Nothing is unreachable either way: `GenericFieldEditor` still surfaces every
 *  scalar leaf in the block, so this only governs the curated quick-edit grid.
 */
export function fieldsForSection(
  id: string,
  assetClass?: string,
): readonly NumericSectionField[] {
  const inSection = NUMERIC_SECTION_FIELDS.filter((f) => f.section_id === id);
  if (!isKnownAssetClass(assetClass) || assetClass === 'mixed_use') return inSection;
  return inSection.filter((f) => !f.asset_classes || f.asset_classes.includes(assetClass));
}

function isKnownAssetClass(value: string | undefined): value is AssetClass {
  return value !== undefined && (ASSET_CLASSES as readonly string[]).includes(value);
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
