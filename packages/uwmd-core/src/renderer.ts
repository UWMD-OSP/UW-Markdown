// .uw.md renderer — converts a ParsedUWFile to output formats
// Formats: json | csv | chat | summary
// PDF and DOCX require dedicated external rendering pipelines.
// Spec: UW_FORMAT_SPEC_v1.md §6.4

import type { ParsedUWFile, UWBlock, ValidationResult } from './types.js';
import { getSection, getSectionVariant, deepGet } from './parser.js';
import { validateUWFile } from './validator.js';
import {
  formatCurrency,
  formatPercent,
  formatRatio,
  formatValue,
  formatPercentCsv,
  formatNumberCsv,
} from './format.js';

export type RenderFormat = 'json' | 'csv' | 'chat' | 'summary' | 'pdf' | 'docx';
export type RenderTier = 'screener' | 'analyst';

export interface RenderOptions {
  format: RenderFormat;
  tier?: RenderTier;
  includeSuperseded?: boolean;  // json only
  maxTokens?: number;           // chat only (approximate, default 12000)
}

export interface RenderResult {
  format: RenderFormat;
  content: string;
  estimatedTokens?: number;     // chat/summary formats
  truncated?: boolean;
}

export class UnsupportedRenderFormatError extends Error {
  readonly code = 'UNSUPPORTED_RENDER_FORMAT';
  readonly format: 'pdf' | 'docx';

  constructor(format: 'pdf' | 'docx') {
    const guidance = format === 'pdf'
      ? 'Use @uwmd/report to generate PDF output.'
      : 'DOCX output is not implemented; use summary, HTML, or PDF output instead.';
    super(`The core renderer does not support '${format}' output. ${guidance}`);
    this.name = 'UnsupportedRenderFormatError';
    this.format = format;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function render(parsed: ParsedUWFile, opts: RenderOptions): RenderResult {
  switch (opts.format) {
    case 'json':    return renderJson(parsed, opts);
    case 'csv':     return renderCsv(parsed);
    case 'chat':    return renderChat(parsed, opts);
    case 'summary': return renderSummary(parsed);
    case 'pdf':
    case 'docx':
      throw new UnsupportedRenderFormatError(opts.format);
    default:
      throw new Error(`Unknown render format: ${opts.format}`);
  }
}

// ─── JSON — full extracted data, no prose ────────────────────────────────────

function renderJson(parsed: ParsedUWFile, opts: RenderOptions): RenderResult {
  const output: Record<string, unknown> = {
    frontmatter: parsed.frontmatter,
    sections: {},
    pipeline_log: parsed.pipeline_log.map(b => b.content),
    custom_calculations: parsed.custom_calculations.map(b => b.content),
    custom_scenarios: parsed.custom_scenarios.map(b => b.content),
    extensions: Object.fromEntries(
      Object.entries(parsed.extensions).map(([k, v]) => [k, v.content])
    ),
  };

  for (const [id, entry] of Object.entries(parsed.sections)) {
    if (isVariantMap(entry)) {
      (output.sections as Record<string, unknown>)[id] = Object.fromEntries(
        Object.entries(entry as Record<string, UWBlock>).map(([v, b]) => [v, b.content])
      );
    } else {
      (output.sections as Record<string, unknown>)[id] = (entry as UWBlock).content;
    }
  }

  if (opts.includeSuperseded) {
    output.superseded = Object.fromEntries(
      Object.entries(parsed.superseded).map(([id, blocks]) => [id, blocks.map(b => b.content)])
    );
  }

  return { format: 'json', content: JSON.stringify(output, null, 2) };
}

// ─── CSV — flat key=value metrics row ────────────────────────────────────────

function renderCsv(parsed: ParsedUWFile): RenderResult {
  const fm = parsed.frontmatter;
  const qm = fm.quick_metrics ?? {};
  const property = getSection(parsed, 'property');
  const debt = getSection(parsed, 'debt_structure');
  const _noi = getSection(parsed, 'noi_model');
  const _valuation = getSection(parsed, 'valuation');

  const pct = (v: unknown) => formatPercentCsv(v);
  const num = (v: unknown) => formatNumberCsv(v);

  const headers = [
    'deal_id', 'deal_name', 'address', 'city', 'state', 'asset_class', 'deal_stage',
    'total_units', 'year_built',
    'purchase_price', 'loan_amount', 'equity_required',
    'noi_underwritten', 'dscr', 'ltv_pct', 'cap_rate_pct', 'debt_yield_pct', 'irr_projected_pct',
    'loan_rate_pct', 'loan_term_years', 'amortization_years', 'io_period_months',
    'exit_cap_rate_pct', 'hold_period_years', 'equity_multiple',
    'flags', 'blocking_flags', 'recommendation',
  ];

  const row = [
    fm.deal_id ?? '',
    `"${fm.deal_name ?? ''}"`,
    `"${fm.property_address ?? ''}"`,
    fm.city ?? '',
    fm.state ?? '',
    fm.asset_class ?? '',
    fm.deal_stage ?? '',
    num(deepGet(property?.content, 'total_units')),
    num(deepGet(property?.content, 'year_built')),
    num(qm.purchase_price),
    num(qm.loan_amount),
    num(qm.equity_required),
    num(qm.noi_underwritten),
    num(qm.dscr),
    pct(qm.ltv),
    pct(qm.cap_rate),
    pct(qm.debt_yield),
    pct(qm.irr_projected),
    pct(deepGet(debt?.content, 'interest_rate') ?? deepGet(debt?.content, 'rate')),
    num(deepGet(debt?.content, 'loan_term_years') ?? deepGet(debt?.content, 'term_years')),
    num(deepGet(debt?.content, 'amortization_years')),
    num(deepGet(debt?.content, 'io_period_months')),
    pct(deepGet(getSection(parsed, 'dcf')?.content, 'assumptions.exit_cap_rate') ?? deepGet(getSection(parsed, 'dcf')?.content, 'exit_cap_rate')),
    num(deepGet(getSection(parsed, 'dcf')?.content, 'assumptions.hold_period_years') ?? deepGet(getSection(parsed, 'dcf')?.content, 'hold_period_years')),
    num(deepGet(getSection(parsed, 'dcf')?.content, 'levered_equity_multiple') ?? deepGet(getSection(parsed, 'dcf')?.content, 'summary.equity_multiple')),
    `"${(fm.flags ?? []).join('; ')}"`,
    `"${(fm.blocking_flags ?? []).join('; ')}"`,
    fm.recommendation ?? '',
  ];

  return {
    format: 'csv',
    content: `${headers.join(',')}\n${row.join(',')}`,
  };
}

// ─── Summary — one-page markdown deal sheet ───────────────────────────────────

function renderSummary(parsed: ParsedUWFile): RenderResult {
  const fm = parsed.frontmatter;
  const qm = fm.quick_metrics ?? {};
  const property = getSection(parsed, 'property');
  const debt = getSection(parsed, 'debt_structure');
  const _noi = getSection(parsed, 'noi_model');
  const dcf = getSection(parsed, 'dcf');
  const dealCtx = getSection(parsed, 'deal_context');
  const validation = validateUWFile(parsed);

  const pct = (v: unknown): string => formatPercent(v);
  const money = (v: unknown): string => formatCurrency(v);
  const num = (v: unknown, dec = 3): string => formatRatio(v, { decimals: dec, suffix: '' });
  const val = (v: unknown): string => formatValue(v);

  const units = deepGet(property?.content, 'total_units');
  const yearBuilt = deepGet(property?.content, 'year_built');
  const assetSubtype = deepGet(property?.content, 'asset_subtype') ?? fm.asset_subtype;
  const buildingClass = deepGet(property?.content, 'building_class');

  const rate = deepGet(debt?.content, 'interest_rate') ?? deepGet(debt?.content, 'rate');
  const termYears = deepGet(debt?.content, 'loan_term_years') ?? deepGet(debt?.content, 'term_years');
  const amYears = deepGet(debt?.content, 'amortization_years');
  const ioPeriod = deepGet(debt?.content, 'io_period_months');
  const loanType = deepGet(debt?.content, 'loan_type') ?? deepGet(debt?.content, 'rate_type');

  const holdPeriod = deepGet(dcf?.content, 'assumptions.hold_period_years') ?? deepGet(dcf?.content, 'hold_period_years');
  const exitCap = deepGet(dcf?.content, 'assumptions.exit_cap_rate') ?? deepGet(dcf?.content, 'exit_cap_rate');
  const equityMult = deepGet(dcf?.content, 'levered_equity_multiple') ?? deepGet(dcf?.content, 'summary.equity_multiple');

  const investmentThesis = deepGet(dealCtx?.content, 'investment_thesis') as string | undefined;
  const valueCreation = deepGet(dealCtx?.content, 'value_creation_strategy') as string | undefined;

  const issueLines = validation.issues.length > 0
    ? validation.issues.map(i => `- **[${i.severity.toUpperCase()}]** ${i.message}`).join('\n')
    : '- No issues found';

  const flagLines = (fm.flags ?? []).length > 0
    ? (fm.flags as string[]).map(f => `- \`${f}\``).join('\n')
    : '- None';

  const blockingLines = (fm.blocking_flags ?? []).length > 0
    ? (fm.blocking_flags as string[]).map(f => `- **\`${f}\`**`).join('\n')
    : '- None';

  const content = `# ${fm.deal_name ?? 'Deal Summary'}
> ${fm.property_address ?? ''} · ${fm.city ?? ''}, ${fm.state ?? ''} · ${val(assetSubtype) !== 'n/a' ? `${assetSubtype} ` : ''}${fm.asset_class ?? ''}${units ? ` · ${units} units` : ''}${yearBuilt ? ` · ${yearBuilt} vintage` : ''}

**Status:** ${fm.deal_stage ?? 'draft'} · **Recommendation:** ${fm.recommendation ?? 'pending'} · **Class:** ${val(buildingClass)}

---

## Key Metrics

| Metric | Value | | Metric | Value |
|---|---|---|---|---|
| Purchase Price | ${money(qm.purchase_price)} | | NOI (UW) | ${money(qm.noi_underwritten)} |
| Loan Amount | ${money(qm.loan_amount)} | | DSCR | ${num(qm.dscr, 3)}x |
| Equity Required | ${money(qm.equity_required)} | | LTV | ${pct(qm.ltv)} |
| Going-in Cap Rate | ${pct(qm.cap_rate)} | | Debt Yield | ${pct(qm.debt_yield)} |
| Levered IRR | ${pct(qm.irr_projected)} | | Equity Multiple | ${num(equityMult, 2)}x |
| Exit Cap Rate | ${pct(exitCap)} | | Hold Period | ${val(holdPeriod)} yrs |

---

## Debt Structure

| | |
|---|---|
| Loan Amount | ${money(qm.loan_amount)} |
| Rate | ${pct(rate)} (${val(loanType)}) |
| Term / Amortization | ${val(termYears)} yr term / ${val(amYears)} yr am |
| IO Period | ${ioPeriod != null ? `${ioPeriod} months` : 'none'} |
| LTV | ${pct(qm.ltv)} |
| Debt Yield | ${pct(qm.debt_yield)} |
${units && qm.loan_amount ? `| Loan per Unit | ${money((qm.loan_amount as number) / (units as number))} |` : ''}
${qm.purchase_price && units ? `| Price per Unit | ${money((qm.purchase_price as number) / (units as number))} |` : ''}

---
${investmentThesis ? `\n## Investment Thesis\n\n${investmentThesis}\n` : ''}
${valueCreation ? `\n## Value Creation Strategy\n\n${valueCreation}\n` : ''}
## Validation

**Overall:** ${validation.overall_status.toUpperCase()}

${issueLines}

### Flags
${flagLines}

### Blocking Flags
${blockingLines}

---

## Stage Readiness

${Object.entries(validation.stage_readiness).map(([stage, ready]) => `- ${ready ? '✓' : '✗'} ${stage}`).join('\n')}

---

*Deal ID: ${fm.deal_id ?? 'n/a'} · Last modified: ${fm.last_modified ?? 'n/a'} · Format: .uw.md v${fm.uw_version ?? '1.1'}*
`;

  return {
    format: 'summary',
    content,
    estimatedTokens: Math.ceil(content.length / 4),
  };
}

// ─── Chat — compressed AI context bundle (<16K tokens) ───────────────────────
// Designed to be dropped as a user message or system context into an AI chat.
// Includes everything needed for instant deal literacy. Sections are compressed
// from full JSON to labeled bullet points to maximize information density.

function renderChat(parsed: ParsedUWFile, opts: RenderOptions): RenderResult {
  const maxTokens = opts.maxTokens ?? 12000;
  const fm = parsed.frontmatter;
  const qm = fm.quick_metrics ?? {};

  const pct = (v: unknown): string => formatPercent(v);
  const money = (v: unknown): string => formatCurrency(v);
  const val = (v: unknown): string => formatValue(v);

  const sections: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  sections.push(`# CRE DEAL CONTEXT — ${fm.deal_name ?? 'Untitled'}
FILE FORMAT: .uw.md v${fm.uw_version ?? '1.1'} | DEAL ID: ${fm.deal_id ?? 'n/a'}
ADDRESS: ${fm.property_address ?? ''}, ${fm.city ?? ''} ${fm.state ?? ''} ${fm.zip ?? ''}
ASSET CLASS: ${fm.asset_class ?? 'n/a'} | STAGE: ${fm.deal_stage ?? 'n/a'} | STATUS: ${fm.status ?? 'n/a'}
RECOMMENDATION: ${fm.recommendation ?? 'pending'}
LAST MODIFIED: ${fm.last_modified ?? 'n/a'}`);

  // ── Quick metrics ──────────────────────────────────────────────────────────
  sections.push(`## KEY METRICS
Purchase Price: ${money(qm.purchase_price)} | Loan: ${money(qm.loan_amount)} | Equity: ${money(qm.equity_required)}
NOI (UW): ${money(qm.noi_underwritten)} | DSCR: ${val(qm.dscr)}x | LTV: ${pct(qm.ltv)}
Cap Rate: ${pct(qm.cap_rate)} | Debt Yield: ${pct(qm.debt_yield)} | IRR (levered): ${pct(qm.irr_projected)}`);

  // ── Pipeline state ─────────────────────────────────────────────────────────
  if (fm.pipeline_state) {
    const ps = fm.pipeline_state as Record<string, string>;
    sections.push(`## PIPELINE STATE
${Object.entries(ps).map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
  }

  // ── Flags ──────────────────────────────────────────────────────────────────
  if ((fm.flags as string[] | undefined)?.length || (fm.blocking_flags as string[] | undefined)?.length) {
    sections.push(`## FLAGS
Active: ${(fm.flags as string[] | undefined)?.join(', ') || 'none'}
Blocking: ${(fm.blocking_flags as string[] | undefined)?.join(', ') || 'none'}`);
  }

  // ── Deal context narrative ──────────────────────────────────────────────────
  const dealCtx = getSection(parsed, 'deal_context');
  if (dealCtx) {
    const thesis = deepGet(dealCtx.content, 'investment_thesis');
    const rationale = deepGet(dealCtx.content, 'acquisition_rationale');
    const valueAdd = deepGet(dealCtx.content, 'value_creation_strategy');
    const holdStrat = deepGet(dealCtx.content, 'hold_strategy');
    const risks = deepGet(dealCtx.content, 'known_risks_user_identified') as unknown[];
    const opps = deepGet(dealCtx.content, 'known_opportunities_user_identified') as unknown[];
    const special = deepGet(dealCtx.content, 'special_circumstances');

    const lines: string[] = ['## DEAL CONTEXT'];
    if (thesis) lines.push(`THESIS: ${thesis}`);
    if (rationale) lines.push(`RATIONALE: ${rationale}`);
    if (valueAdd) lines.push(`VALUE CREATION: ${valueAdd}`);
    if (holdStrat) lines.push(`HOLD STRATEGY: ${holdStrat}`);
    if (special) lines.push(`SPECIAL CIRCUMSTANCES: ${special}`);
    if (risks?.length) lines.push(`IDENTIFIED RISKS: ${(risks as string[]).join('; ')}`);
    if (opps?.length) lines.push(`IDENTIFIED OPPORTUNITIES: ${(opps as string[]).join('; ')}`);

    // Also include prose (user-authored narrative)
    const ctxProse = parsed.prose['deal_context'];
    if (ctxProse && ctxProse.trim().length > 0) {
      lines.push(`\nUSER NARRATIVE:\n${ctxProse.trim()}`);
    }

    if (lines.length > 1) sections.push(lines.join('\n'));
  }

  // ── Property ───────────────────────────────────────────────────────────────
  const property = getSection(parsed, 'property');
  if (property) {
    const c = property.content;
    sections.push(`## PROPERTY
Units: ${val(deepGet(c, 'total_units'))} | Built: ${val(deepGet(c, 'year_built'))} | Renovated: ${val(deepGet(c, 'year_renovated'))}
Class: ${val(deepGet(c, 'building_class'))} | Condition: ${val(deepGet(c, 'condition'))} | Subtype: ${val(deepGet(c, 'asset_subtype'))}
NRA: ${val(deepGet(c, 'total_nra_sqft'))} sqft | Land: ${val(deepGet(c, 'land_area_acres'))} acres | Stories: ${val(deepGet(c, 'stories'))}
Parking: ${val(deepGet(c, 'parking_spaces'))} spaces (${val(deepGet(c, 'parking_type'))}) | Zoning: ${val(deepGet(c, 'zoning'))}
Deferred Maintenance Est: ${money(deepGet(c, 'deferred_maintenance_est'))}
Amenities: ${(deepGet(c, 'amenities') as string[] | undefined)?.join(', ') || 'n/a'}`);
  }

  // ── NOI Model ─────────────────────────────────────────────────────────────
  const noiBlock = getSection(parsed, 'noi_model');
  if (noiBlock) {
    const c = noiBlock.content;
    sections.push(`## NOI MODEL (${noiBlock.meta?.confidence ?? 'n/a'} confidence)
GPR: ${money(deepGet(c, 'gross_potential_rent') ?? deepGet(c, 'scheduled_gross_revenue'))}
Vacancy Loss: ${money(deepGet(c, 'vacancy_loss'))} (${pct(deepGet(c, 'vacancy_rate'))})
Other Income: ${money(deepGet(c, 'other_income'))}
EGI: ${money(deepGet(c, 'effective_gross_income'))}
Total OpEx: ${money(deepGet(c, 'total_operating_expenses'))}
NOI: ${money(deepGet(c, 'net_operating_income'))}
OpEx Ratio: ${val(deepGet(c, 'opex_ratio') ?? (deepGet(c, 'total_operating_expenses') != null && deepGet(c, 'effective_gross_income') != null ? ((deepGet(c, 'total_operating_expenses') as number) / (deepGet(c, 'effective_gross_income') as number)).toFixed(4) : null))}`);
  }

  // ── Debt Structure ────────────────────────────────────────────────────────
  const debtBlock = getSection(parsed, 'debt_structure');
  if (debtBlock) {
    const c = debtBlock.content;
    sections.push(`## DEBT STRUCTURE
Loan: ${money(deepGet(c, 'loan_amount'))} | Type: ${val(deepGet(c, 'loan_type') ?? deepGet(c, 'rate_type'))}
Rate: ${pct(deepGet(c, 'interest_rate') ?? deepGet(c, 'rate'))} | Term: ${val(deepGet(c, 'loan_term_years') ?? deepGet(c, 'term_years'))}yr | Am: ${val(deepGet(c, 'amortization_years'))}yr
IO Period: ${val(deepGet(c, 'io_period_months'))} months | Recourse: ${val(deepGet(c, 'recourse'))}
DSCR (IO): ${val(deepGet(c, 'dscr_io'))} | DSCR (amortizing): ${val(deepGet(c, 'dscr_amortizing') ?? deepGet(c, 'dscr'))}
LTV: ${pct(deepGet(c, 'ltv'))} | Debt Yield: ${pct(deepGet(c, 'debt_yield'))}
Annual DS: ${money(deepGet(c, 'annual_debt_service'))} | Monthly DS: ${money(deepGet(c, 'monthly_debt_service'))}`);
  }

  // ── Valuation ────────────────────────────────────────────────────────────
  const valuationBlock = getSection(parsed, 'valuation');
  if (valuationBlock) {
    const c = valuationBlock.content;
    sections.push(`## VALUATION
Purchase Price: ${money(deepGet(c, 'purchase_price'))}
UW Value: ${money(deepGet(c, 'underwritten_value'))}
Appraised Value: ${money(deepGet(c, 'appraised_value'))} (${val(deepGet(c, 'appraisal_status'))})
Going-in Cap: ${pct(deepGet(c, 'going_in_cap_rate') ?? deepGet(c, 'cap_rate'))}
Price/Unit: ${money(deepGet(c, 'price_per_unit'))} | Price/SF: ${money(deepGet(c, 'price_per_sqft'))}`);
  }

  // ── DCF Summary ──────────────────────────────────────────────────────────
  const dcfBlock = getSection(parsed, 'dcf');
  if (dcfBlock) {
    const c = dcfBlock.content;
    const assumptions = deepGet(c, 'assumptions') as Record<string, unknown> | undefined;
    sections.push(`## DCF / HOLD PERIOD
Hold: ${val(deepGet(c, 'hold_period_years') ?? assumptions?.hold_period_years)} years
Exit Cap: ${pct(deepGet(c, 'exit_cap_rate') ?? assumptions?.exit_cap_rate)}
Rent Growth: ${pct(deepGet(c, 'rent_growth_assumption') ?? assumptions?.annual_rent_growth)}/yr
Levered IRR: ${pct(deepGet(c, 'levered_irr'))} | Unlevered IRR: ${pct(deepGet(c, 'unlevered_irr'))}
Equity Multiple: ${val(deepGet(c, 'levered_equity_multiple') ?? deepGet(c, 'summary.equity_multiple'))}x
Exit Value: ${money(deepGet(c, 'exit_value') ?? deepGet(c, 'terminal_value'))}`);

    // Year-by-year cash flows if present
    const flows = deepGet(c, 'annual_cash_flows') as unknown[] | undefined;
    if (flows?.length) {
      const flowLines = flows.slice(0, 10).map((f, i) => {
        const flow = f as Record<string, unknown>;
        return `  Yr${i + 1}: NOI=${money(flow['noi'] ?? flow['net_operating_income'])} | NCF(L)=${money(flow['net_cash_flow_levered'] ?? flow['levered_cash_flow'])}`;
      });
      sections.push(`### Annual Cash Flows\n${flowLines.join('\n')}`);
    }
  }

  // ── Sources & Uses ───────────────────────────────────────────────────────
  const su = getSection(parsed, 'sources_uses');
  if (su) {
    const c = su.content;
    sections.push(`## SOURCES & USES
Total Sources: ${money(deepGet(c, 'total_sources'))} | Total Uses: ${money(deepGet(c, 'total_uses'))}
Loan: ${money(deepGet(c, 'sources.loan_amount') ?? deepGet(c, 'sources.debt_proceeds'))} | Equity: ${money(deepGet(c, 'sources.equity'))}
Purchase: ${money(deepGet(c, 'uses.purchase_price'))} | Closing Costs: ${money(deepGet(c, 'uses.closing_costs'))} | Reserves: ${money(deepGet(c, 'uses.reserves'))}`);
  }

  // ── Market Analysis (abbreviated) ────────────────────────────────────────
  const market = getSection(parsed, 'market_analysis');
  if (market) {
    const c = market.content;
    const prose = parsed.prose['market_analysis'];
    const marketLines: string[] = ['## MARKET ANALYSIS'];
    const msa = deepGet(c, 'msa') ?? deepGet(c, 'market_name');
    const submarket = deepGet(c, 'submarket');
    const marketVacancy = deepGet(c, 'market_vacancy_rate') ?? deepGet(c, 'submarket_vacancy_rate');
    const askingRent = deepGet(c, 'average_asking_rent') ?? deepGet(c, 'market_asking_rent');
    const rentGrowth = deepGet(c, 'recent_rent_growth') ?? deepGet(c, 'trailing_12mo_rent_growth');
    if (msa) marketLines.push(`MSA: ${msa}${submarket ? ` / ${submarket}` : ''}`);
    if (marketVacancy) marketLines.push(`Market Vacancy: ${pct(marketVacancy)}`);
    if (askingRent) marketLines.push(`Avg Asking Rent: ${money(askingRent)}/mo`);
    if (rentGrowth) marketLines.push(`Recent Rent Growth: ${pct(rentGrowth)}`);
    if (prose?.trim()) marketLines.push(`\n${prose.trim().slice(0, 500)}${prose.trim().length > 500 ? '…' : ''}`);
    sections.push(marketLines.join('\n'));
  }

  // ── Borrower / Sponsor ────────────────────────────────────────────────────
  const sponsor = getSection(parsed, 'borrower_sponsor');
  if (sponsor) {
    const c = sponsor.content;
    sections.push(`## BORROWER / SPONSOR
Name: ${val(deepGet(c, 'name') ?? deepGet(c, 'principal_name') ?? deepGet(c, 'borrower_name'))}
Net Worth: ${money(deepGet(c, 'net_worth'))} | Liquidity: ${money(deepGet(c, 'liquidity'))}
Experience: ${val(deepGet(c, 'years_experience'))} yrs | Prior Deals: ${val(deepGet(c, 'similar_deals_count'))}
Credit Score: ${val(deepGet(c, 'fico_score') ?? deepGet(c, 'credit_score'))}`);
  }

  // ── Validation issues ─────────────────────────────────────────────────────
  const validation = validateUWFile(parsed);
  if (validation.issues.length > 0) {
    const issueLines = validation.issues.map(i =>
      `[${i.severity.toUpperCase()}] ${i.code}${i.section ? ` (${i.section})` : ''}: ${i.message}`
    );
    sections.push(`## VALIDATION ISSUES\n${issueLines.join('\n')}`);
  }

  // ── Custom calculations ───────────────────────────────────────────────────
  if (parsed.custom_calculations.length > 0) {
    const calcLines = parsed.custom_calculations.flatMap(block => {
      const calcs = (deepGet(block.content, 'calculations') as unknown[] | undefined) ?? [block.content];
      return (calcs as Record<string, unknown>[]).map(calc =>
        `${val(calc['label'])}: ${val(calc['result'])} ${val(calc['result_unit'])} — ${val(calc['formula_description'])}`
      );
    });
    sections.push(`## CUSTOM CALCULATIONS\n${calcLines.join('\n')}`);
  }

  // ── Custom scenarios ─────────────────────────────────────────────────────
  if (parsed.custom_scenarios.length > 0) {
    const scenLines = parsed.custom_scenarios.flatMap(block => {
      const scens = (deepGet(block.content, 'scenarios') as unknown[] | undefined) ?? [block.content];
      return (scens as Record<string, unknown>[]).map(s => {
        const res = s['results'] as Record<string, unknown> | undefined;
        return `${val(s['scenario_id'])} (${val(s['type'])}): IRR=${pct(res?.['irr'])} EM=${val(res?.['equity_multiple'])}x DSCR=${val(res?.['dscr'])}`;
      });
    });
    sections.push(`## CUSTOM SCENARIOS\n${scenLines.join('\n')}`);
  }

  // ── Stress tests (abbreviated) ────────────────────────────────────────────
  const stressBlock = getSection(parsed, 'stress_tests')
    ?? getSectionVariant(parsed, 'stress_tests', 'default');
  if (stressBlock) {
    const c = stressBlock.content;
    const scenarios = deepGet(c, 'scenarios') as unknown[] | undefined;
    if (scenarios?.length) {
      const stressLines = scenarios.slice(0, 5).map(s => {
        const sc = s as Record<string, unknown>;
        return `${val(sc['name'])}: DSCR=${val(sc['dscr'])} IRR=${pct(sc['irr'])} Pass=${val(sc['passes_policy'])}`;
      });
      sections.push(`## STRESS TEST RESULTS\n${stressLines.join('\n')}`);
    }
  }

  // ── Risk assessment (abbreviated) ────────────────────────────────────────
  const risk = getSection(parsed, 'risk_assessment');
  if (risk) {
    const c = risk.content;
    sections.push(`## RISK ASSESSMENT
Overall Rating: ${val(deepGet(c, 'overall_rating') ?? deepGet(c, 'risk_rating'))}
Risk Score: ${val(deepGet(c, 'risk_score'))}
Key Risks: ${((deepGet(c, 'key_risks') as string[] | undefined) ?? []).slice(0, 3).join('; ')}`);
  }

  // ── Pipeline log (last 5 entries) ────────────────────────────────────────
  if (parsed.pipeline_log.length > 0) {
    const lastEntries = parsed.pipeline_log.slice(-3);
    const logLines = lastEntries.flatMap(block => {
      const entries = deepGet(block.content, 'entries') as unknown[] | undefined;
      return (entries ?? []).slice(-5).map(e => {
        const entry = e as Record<string, unknown>;
        return `${val(entry['timestamp'])?.slice(0, 19)} ${val(entry['agent_or_actor'])} → ${val(entry['event_type'])} [${val(entry['status'])}]`;
      });
    });
    sections.push(`## PIPELINE LOG (recent)\n${logLines.join('\n')}`);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  sections.push(`---\nDeal ID: ${fm.deal_id ?? 'n/a'} | .uw.md format v${fm.uw_version ?? '1.1'} | This file is the canonical underwriting record for this deal.`);

  // Assemble and check token budget
  let content = sections.join('\n\n');
  const estimatedTokens = Math.ceil(content.length / 4);
  let truncated = false;

  if (estimatedTokens > maxTokens) {
    // Trim to budget by dropping lower-priority sections from the end
    const budget = maxTokens * 4;
    content = `${content.slice(0, budget)}\n\n[TRUNCATED — full data in source .uw.md file]`;
    truncated = true;
  }

  return {
    format: 'chat',
    content,
    estimatedTokens: Math.ceil(content.length / 4),
    truncated,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isVariantMap(val: unknown): boolean {
  if (typeof val !== 'object' || val === null) return false;
  return !('annotation' in (val as object));
}
