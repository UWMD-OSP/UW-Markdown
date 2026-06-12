// HTML report renderer — the "lender-ready package" rendering target.
// Implements UW_FORMAT_SPEC_v1.md §7.1 (Tier 1 Lender Package) and §7.2
// (Tier 2 Analyst Credit Memo) as a single self-contained HTML document with
// embedded print CSS, so one template serves web preview, browser print, and
// the @uwmd/report PDF pipeline.
//
// Pure string generation: no DOM, no I/O, no dependencies — browser-safe.
// Every number is read from the file (engine/pack output); nothing is computed
// here beyond simple per-unit display divisions.

import type { ParsedUWFile, UWBlock } from './types.js';
import { getSection, getSectionVariant, deepGet } from './parser.js';
import { validateUWFile } from './validator.js';
import type { RenderTier } from './renderer.js';
import {
  formatCurrency,
  formatPercent,
  formatRatio,
  formatValue,
} from './format.js';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ReportOptions {
  /** 'screener' → §7.1 Lender Package; 'analyst' → §7.2 Credit Memo.
   *  Defaults to the file's frontmatter `tier`, else 'screener'. */
  tier?: RenderTier;
  /** Cover-page "Prepared by" line. Defaults to frontmatter `created_by`. */
  preparedBy?: string;
  /** Cover-page date (ISO string). Defaults to frontmatter `last_modified`. */
  preparedDate?: string;
  /** Emit only the <article> fragment (no <html> shell / <style>). The host
   *  must include REPORT_CSS itself. Used by web tools for live preview. */
  fragment?: boolean;
  /** Replace the standard disclaimer text (§7.1 item 10). */
  disclaimer?: string;
}

export interface ReportResult {
  html: string;
  title: string;
  tier: RenderTier;
  /** Spec section ids that produced content, in render order. */
  sectionsRendered: string[];
  /** Spec section ids skipped because the file has no data for them. */
  sectionsSkipped: string[];
}

const STANDARD_DISCLAIMER =
  'This package was prepared from the deal’s canonical .uw.md underwriting record. ' +
  'All financial metrics are deterministic calculation-engine outputs; narrative sections ' +
  'reflect analyst and agent commentary recorded in the file with full provenance. ' +
  'Figures are presented for lending discussion purposes only and do not constitute an ' +
  'offer, commitment, or appraisal. Values marked unverified are stated by the borrower ' +
  'and have not been independently confirmed.';

/** Render the lender package / credit memo HTML for a parsed .uw.md file. */
export function renderReportHtml(parsed: ParsedUWFile, opts: ReportOptions = {}): ReportResult {
  const fm = parsed.frontmatter;
  const tier: RenderTier = opts.tier ?? ((fm.tier as RenderTier) === 'analyst' ? 'analyst' : 'screener');
  const title = String(fm.deal_name ?? fm.deal_id ?? 'Underwriting Package');

  const builders: Array<[string, (ctx: Ctx) => string | null]> = [
    ['cover', coverPage],
    ['executive_summary', executiveSummary],
    ['property', propertyOverview],
    ['noi_model', proforma],
    ['rent_roll', rentRollSummary],
    ['debt_structure', debtStructure],
    ['sources_uses', sourcesUses],
    ['borrower_sponsor', borrowerSummary],
    ['exit_analysis', exitAnalysis],
  ];
  if (tier === 'analyst') {
    builders.push(
      ['market_analysis', marketAnalysis],
      ['financial_analysis', financialAnalysis],
      ['due_diligence', dueDiligence],
      ['risk_assessment', riskAssessment],
      ['compliance', complianceSummary],
      ['covenants', covenants],
    );
  }
  builders.push(['assumptions', assumptionsDisclosures]);
  if (tier === 'analyst') builders.push(['appendix', appendix]);

  const ctx: Ctx = { parsed, fm, tier, opts };
  const sectionsRendered: string[] = [];
  const sectionsSkipped: string[] = [];
  const body: string[] = [];

  for (const [id, build] of builders) {
    const html = build(ctx);
    if (html) {
      sectionsRendered.push(id);
      body.push(html);
    } else {
      sectionsSkipped.push(id);
    }
  }

  const article =
    `<article class="uwmd-report" data-tier="${esc(tier)}">\n${body.join('\n')}\n</article>`;

  const html = opts.fragment
    ? article
    : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${tier === 'analyst' ? 'Credit Memo' : 'Lender Package'}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
${article}
</body>
</html>`;

  return { html, title, tier, sectionsRendered, sectionsSkipped };
}

// ─── Internal context + tiny html helpers ────────────────────────────────────

interface Ctx {
  parsed: ParsedUWFile;
  fm: Record<string, unknown>;
  tier: RenderTier;
  opts: ReportOptions;
}

function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

const money = (v: unknown): string => formatCurrency(v);
const pct = (v: unknown): string => formatPercent(v);
const ratio = (v: unknown, dec = 2): string => formatRatio(v, { decimals: dec });
const val = (v: unknown): string => formatValue(v);

function has(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '';
}

/** Pull a number that may be stored bare or as `{ value }` (noi_model style). */
function num(obj: unknown, path: string): unknown {
  const direct = deepGet(obj, path);
  if (direct != null && typeof direct === 'object') return deepGet(direct, 'value');
  return direct;
}

function section(id: string, heading: string, inner: string, subtitle?: string): string {
  return `<section class="rpt-section" id="rpt-${esc(id)}">
<header class="rpt-section-head"><h2>${esc(heading)}</h2>${subtitle ? `<p class="rpt-subtitle">${esc(subtitle)}</p>` : ''}</header>
${inner}
</section>`;
}

/** Prose paragraphs from `parsed.prose[id]`. The raw prose carries Markdown
 *  scaffolding we must not reproduce: section headings, `---` dividers, and
 *  pipe tables (the structured data renders those properly). What's left is
 *  escaped and gets minimal inline markup (bold/italic/code). */
function proseHtml(text: string | undefined): string {
  if (!text || !text.trim()) return '';
  const lines = text.split('\n').filter((line) => {
    const t = line.trim();
    if (/^#{1,6}\s/.test(t)) return false;        // markdown headings
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return false; // horizontal rules
    if (/^\|.*\|$/.test(t)) return false;          // pipe-table rows
    if (/^>\s?/.test(t)) return false;             // blockquote callouts
    return true;
  });
  return lines
    .join('\n')
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p class="rpt-prose">${inlineMd(esc(p.trim().replace(/\s*\n\s*/g, ' ')))}</p>`)
    .join('\n');
}

/** Minimal inline markdown on already-escaped text: **bold**, *em*, `code`. */
function inlineMd(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Two-column definition table from [label, displayValue] pairs; rows whose
 *  value is the null display ('n/a') are dropped. */
function kvTable(rows: Array<[string, string]>, cls = ''): string {
  const kept = rows.filter(([, v]) => v !== 'n/a' && v !== '');
  if (kept.length === 0) return '';
  const tr = kept
    .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('');
  return `<table class="rpt-kv ${cls}"><tbody>${tr}</tbody></table>`;
}

interface Col {
  label: string;
  align?: 'left' | 'right' | 'center';
}

/** Data table; `cells` are pre-formatted display strings (escaped here). */
function dataTable(cols: Col[], rows: string[][], opts?: { footRow?: string[] }): string {
  const head = cols
    .map((c) => `<th class="al-${c.align ?? 'left'}">${esc(c.label)}</th>`)
    .join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((cell, i) => `<td class="al-${cols[i]?.align ?? 'left'}">${esc(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  const foot = opts?.footRow
    ? `<tfoot><tr>${opts.footRow.map((cell, i) => `<td class="al-${cols[i]?.align ?? 'left'}">${esc(cell)}</td>`).join('')}</tr></tfoot>`
    : '';
  return `<table class="rpt-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}

function badge(text: string, kind = 'default'): string {
  return `<span class="rpt-badge rpt-badge--${esc(kind)}">${esc(text)}</span>`;
}

function sectionBlock(ctx: Ctx, id: string): UWBlock | null {
  // Sections sometimes parse as a single-variant map (e.g. variant=default);
  // fall back to the 'default' variant the way renderChat does for stress_tests.
  return getSection(ctx.parsed, id) ?? getSectionVariant(ctx.parsed, id, 'default');
}

// ─── §7.1 / 1 — Cover page ────────────────────────────────────────────────────

function coverPage(ctx: Ctx): string {
  const { fm, tier, opts } = ctx;
  const address = [fm.property_address, fm.city, fm.state, fm.zip].filter(has).join(', ');
  const property = sectionBlock(ctx, 'property');
  const units = deepGet(property?.content, 'total_units');
  const sqft = deepGet(property?.content, 'total_nra_sqft');
  const yearBuilt = deepGet(property?.content, 'year_built');
  const qm = (fm.quick_metrics ?? {}) as Record<string, unknown>;

  const date = opts.preparedDate ?? (fm.last_modified as string | undefined);
  const preparedBy = opts.preparedBy ?? (fm.created_by as string | undefined);
  const docName = tier === 'analyst' ? 'Credit Memorandum' : 'Lender Package';

  const factPairs: Array<[string, string]> = [
    ['Asset class', [fm.asset_subtype, fm.asset_class].filter(has).map(String).map(prettyToken).join(' · ')],
    ['Units', has(units) ? val(units) : 'n/a'],
    ['NRA', has(sqft) ? `${Number(sqft).toLocaleString('en-US')} SF` : 'n/a'],
    ['Vintage', has(yearBuilt) ? val(yearBuilt) : 'n/a'],
    ['Purchase price', money(qm.purchase_price)],
    ['Loan amount', money(qm.loan_amount)],
  ];
  const facts = factPairs
    .filter(([, v]) => v !== 'n/a')
    .map(([k, v]) => `<div class="rpt-cover-fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`)
    .join('');

  return `<section class="rpt-cover" id="rpt-cover">
<div class="rpt-cover-rule"></div>
<p class="rpt-cover-doc">${esc(docName)}</p>
<h1>${esc(fm.deal_name ?? 'Untitled Deal')}</h1>
${address ? `<p class="rpt-cover-address">${esc(address)}</p>` : ''}
<div class="rpt-cover-facts">${facts}</div>
<div class="rpt-cover-foot">
${date ? `<p>Prepared ${esc(String(date).slice(0, 10))}</p>` : ''}
${preparedBy ? `<p>Prepared by ${esc(preparedBy)}</p>` : ''}
<p>Deal ID ${esc(fm.deal_id ?? 'n/a')} · .uw.md v${esc(fm.uw_version ?? '1.1')}</p>
</div>
</section>`;
}

function prettyToken(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── §7.1 / 2 — Executive Summary ────────────────────────────────────────────

function executiveSummary(ctx: Ctx): string | null {
  const { fm, parsed } = ctx;
  const qm = (fm.quick_metrics ?? {}) as Record<string, unknown>;
  if (Object.keys(qm).length === 0) return null;

  const cards: Array<[string, string]> = [
    ['Purchase Price', money(qm.purchase_price)],
    ['Loan Amount', money(qm.loan_amount)],
    ['Equity Required', money(qm.equity_required)],
    ['NOI (Underwritten)', money(qm.noi_underwritten)],
    ['DSCR', has(qm.dscr) ? ratio(qm.dscr, 3) : 'n/a'],
    ['LTV', pct(qm.ltv)],
    ['Cap Rate', pct(qm.cap_rate)],
    ['Debt Yield', pct(qm.debt_yield)],
    ['Levered IRR', pct(qm.irr_projected)],
  ];
  const grid = cards
    .filter(([, v]) => v !== 'n/a')
    .map(([k, v]) => `<div class="rpt-metric"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`)
    .join('');

  const dealCtx = sectionBlock(ctx, 'deal_context');
  const thesis = deepGet(dealCtx?.content, 'investment_thesis') as string | undefined;
  const summaryTxt = deepGet(dealCtx?.content, 'deal_summary') as string | undefined;

  const flags = (fm.flags ?? []) as string[];
  const blocking = (fm.blocking_flags ?? []) as string[];
  const validation = validateUWFile(parsed);
  const flagHtml =
    flags.length || blocking.length
      ? `<p class="rpt-flags">${blocking.map((f) => badge(prettyToken(f), 'error')).join(' ')} ${flags.map((f) => badge(prettyToken(f), 'warn')).join(' ')}</p>`
      : '';

  const statusLine = `<p class="rpt-status">Stage: <strong>${esc(prettyToken(String(fm.deal_stage ?? 'draft')))}</strong> · Recommendation: <strong>${esc(prettyToken(String(fm.recommendation ?? 'pending')))}</strong> · Validation: <strong>${esc(validation.overall_status.toUpperCase())}</strong></p>`;

  return section(
    'executive_summary',
    'Executive Summary',
    `${summaryTxt ? proseHtml(summaryTxt) : ''}
<div class="rpt-metric-grid">${grid}</div>
${thesis ? `<h3>Investment Thesis</h3>${proseHtml(thesis)}` : ''}
${statusLine}
${flagHtml}`,
  );
}

// ─── §7.1 / 3 — Property Overview ────────────────────────────────────────────

function propertyOverview(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'property');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['property'];

  const left = kvTable([
    ['Asset class', [deepGet(c, 'asset_subtype'), deepGet(c, 'asset_class')].filter(has).map((x) => prettyToken(String(x))).join(' · ') || 'n/a'],
    ['Year built', val(deepGet(c, 'year_built'))],
    ['Year renovated', val(deepGet(c, 'year_renovated'))],
    ['Building class', val(deepGet(c, 'building_class'))],
    ['Construction', has(deepGet(c, 'construction_type')) ? prettyToken(String(deepGet(c, 'construction_type'))) : 'n/a'],
    ['Stories', val(deepGet(c, 'stories'))],
    ['Condition', has(deepGet(c, 'condition')) ? prettyToken(String(deepGet(c, 'condition'))) : 'n/a'],
  ]);
  const right = kvTable([
    ['Units', val(deepGet(c, 'total_units'))],
    ['NRA (SF)', has(deepGet(c, 'total_nra_sqft')) ? Number(deepGet(c, 'total_nra_sqft')).toLocaleString('en-US') : 'n/a'],
    ['Land area', has(deepGet(c, 'land_area_acres')) ? `${val(deepGet(c, 'land_area_acres'))} acres` : 'n/a'],
    ['Parking', has(deepGet(c, 'parking_spaces')) ? `${val(deepGet(c, 'parking_spaces'))} spaces (${val(deepGet(c, 'parking_ratio'))}/unit)` : 'n/a'],
    ['Zoning', val(deepGet(c, 'zoning'))],
    ['Flood zone', val(deepGet(c, 'flood_zone'))],
    ['Deferred maintenance', has(deepGet(c, 'deferred_maintenance_est')) ? money(deepGet(c, 'deferred_maintenance_est')) : 'n/a'],
  ]);

  const amenities = deepGet(c, 'amenities') as string[] | undefined;
  const amenityHtml = amenities?.length
    ? `<p class="rpt-amenities">${amenities.map((a) => badge(prettyToken(a))).join(' ')}</p>`
    : '';

  return section(
    'property',
    'Property Overview',
    `${proseHtml(prose)}
<div class="rpt-cols">${left}${right}</div>
${amenityHtml}`,
  );
}

// ─── §7.1 / 4 — Proforma / Cash Flow (noi_model) ─────────────────────────────

function proforma(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'noi_model');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['noi_model'];

  const rows: string[][] = [];
  const push = (label: string, value: unknown, indent = false, negative = false) => {
    if (!has(value)) return;
    rows.push([`${indent ? ' ' : ''}${label}`, negative ? `(${money(value)})` : money(value)]);
  };

  push('Gross Potential Rent', num(c, 'income.gross_potential_rent'));
  push('Vacancy / Credit Loss', num(c, 'income.vacancy_credit_loss'), true, true);
  push('Concessions', nonZero(num(c, 'income.concessions')), true, true);
  push('Loss to Lease', nonZero(num(c, 'income.loss_to_lease')), true, true);
  push('Other Income', num(c, 'income.other_income'), true);

  const expenseLabels: Array<[string, string]> = [
    ['real_estate_taxes', 'Real Estate Taxes'],
    ['insurance', 'Insurance'],
    ['management_fees', 'Management Fees'],
    ['payroll_benefits', 'Payroll & Benefits'],
    ['utilities', 'Utilities'],
    ['repairs_maintenance', 'Repairs & Maintenance'],
    ['contract_services', 'Contract Services'],
    ['marketing_advertising', 'Marketing & Advertising'],
    ['administrative', 'Administrative'],
    ['professional_fees', 'Professional Fees'],
    ['cam_expenses', 'CAM Expenses'],
    ['replacement_reserves', 'Replacement Reserves'],
    ['other_expenses', 'Other Expenses'],
  ];
  for (const [key, label] of expenseLabels) {
    push(label, nonZero(num(c, `expenses.${key}`)), true, true);
  }

  const table = dataTable(
    [{ label: 'Line Item' }, { label: 'Underwritten', align: 'right' }],
    rows,
  );
  // EGI / OpEx / NOI rendered as emphasized total rows
  const totals = `<table class="rpt-table rpt-totals"><tbody>
<tr class="rpt-total-row"><td>Effective Gross Income</td><td class="al-right">${esc(money(num(c, 'income.effective_gross_income')))}</td></tr>
<tr class="rpt-total-row"><td>Total Operating Expenses</td><td class="al-right">(${esc(money(num(c, 'expenses.total_operating_expenses')))})</td></tr>
<tr class="rpt-total-row rpt-noi-row"><td>Net Operating Income</td><td class="al-right">${esc(money(deepGet(c, 'net_operating_income')))}</td></tr>
</tbody></table>`;

  const stats = kvTable([
    ['NOI per unit', money(deepGet(c, 'noi_per_unit'))],
    ['NOI per SF', has(deepGet(c, 'noi_per_sqft')) ? formatCurrency(deepGet(c, 'noi_per_sqft'), { decimals: 2 }) : 'n/a'],
    ['NOI margin', pct(deepGet(c, 'noi_margin'))],
    ['Expense ratio', pct(deepGet(c, 'expenses.expense_ratio') ?? deepGet(c, 'expense_ratio'))],
    ['vs. T-12 NOI', has(deepGet(c, 'vs_t12_noi')) ? `${money(deepGet(c, 'vs_t12_noi'))} (${pct(deepGet(c, 'vs_t12_variance_pct'))})` : 'n/a'],
  ], 'rpt-kv--compact');

  return section(
    'noi_model',
    'Proforma / Underwritten Cash Flow',
    `${proseHtml(prose)}
<div class="rpt-cols rpt-cols--proforma">
<div>${table}${totals}</div>
<div>${stats}</div>
</div>`,
  );
}

function nonZero(v: unknown): unknown {
  return typeof v === 'number' && v === 0 ? null : v;
}

// ─── §7.1 / 5 — Rent Roll Summary ────────────────────────────────────────────

function rentRollSummary(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'rent_roll');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['rent_roll'];

  const head = kvTable([
    ['As of', val(deepGet(c, 'as_of_date'))],
    ['Physical occupancy', pct(deepGet(c, 'physical_occupancy_pct'))],
    ['Economic occupancy', pct(deepGet(c, 'economic_occupancy_pct'))],
    ['In-place rent (annual)', money(deepGet(c, 'in_place_rent_annual') ?? deepGet(c, 'total_annual_base_rent'))],
    ['Loss to lease', has(deepGet(c, 'loss_to_lease_pct')) ? pct(deepGet(c, 'loss_to_lease_pct')) : 'n/a'],
    ['Month-to-month units', val(deepGet(c, 'month_to_month_units'))],
    ['WALT', has(deepGet(c, 'walt_years')) ? `${val(deepGet(c, 'walt_years'))} yrs` : 'n/a'],
  ], 'rpt-kv--compact');

  let table = '';
  const unitMix = deepGet(c, 'unit_mix_summary') as Array<Record<string, unknown>> | undefined;
  const tenants = deepGet(c, 'tenants') as Array<Record<string, unknown>> | undefined;

  if (unitMix?.length) {
    table = dataTable(
      [
        { label: 'Unit Type' },
        { label: 'Count', align: 'right' },
        { label: 'Avg SF', align: 'right' },
        { label: 'In-Place', align: 'right' },
        { label: 'Market', align: 'right' },
        { label: 'Occupancy', align: 'right' },
      ],
      unitMix.map((u) => [
        val(u.unit_type),
        val(u.count),
        val(u.avg_sqft),
        money(u.avg_rent_inplace),
        money(u.avg_rent_market),
        pct(u.occupancy_pct),
      ]),
    );
  } else if (tenants?.length) {
    table = dataTable(
      [
        { label: 'Tenant' },
        { label: 'Suite' },
        { label: 'SF', align: 'right' },
        { label: 'Annual Rent', align: 'right' },
        { label: 'Rent PSF', align: 'right' },
        { label: 'Expires', align: 'right' },
      ],
      tenants.map((t) => [
        val(t.tenant_name ?? t.name),
        val(t.suite ?? t.unit),
        has(t.leased_sf ?? t.sqft) ? Number(t.leased_sf ?? t.sqft).toLocaleString('en-US') : 'n/a',
        money(t.annual_base_rent ?? t.annual_rent),
        has(t.rent_psf) ? formatCurrency(t.rent_psf, { decimals: 2 }) : 'n/a',
        val(t.lease_expiration ?? t.lease_end),
      ]),
    );
  }
  if (!table && !head) return null;

  return section('rent_roll', 'Rent Roll Summary', `${proseHtml(prose)}${head}${table}`);
}

// ─── §7.1 / 6 — Debt Structure ───────────────────────────────────────────────

function debtStructure(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'debt_structure');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['debt_structure'];

  const terms = kvTable([
    ['Loan amount', money(deepGet(c, 'loan_amount'))],
    ['Lender', val(deepGet(c, 'lender_name'))],
    ['Loan type', has(deepGet(c, 'loan_type')) ? prettyToken(String(deepGet(c, 'loan_type'))) : 'n/a'],
    ['Rate', `${pct(deepGet(c, 'interest_rate') ?? deepGet(c, 'rate'))} ${has(deepGet(c, 'rate_type')) ? `(${val(deepGet(c, 'rate_type'))})` : ''}`.trim()],
    ['Term / Amortization', `${val(deepGet(c, 'loan_term_years') ?? deepGet(c, 'term_years'))} yr / ${val(deepGet(c, 'amortization_years'))} yr`],
    ['Interest-only period', has(deepGet(c, 'io_period_months')) ? `${val(deepGet(c, 'io_period_months'))} months` : 'n/a'],
    ['Recourse', has(deepGet(c, 'recourse')) ? prettyToken(String(deepGet(c, 'recourse'))) : 'n/a'],
    ['Prepayment', has(deepGet(c, 'prepayment_schedule')) ? `${prettyToken(String(deepGet(c, 'prepayment_type') ?? ''))} ${val(deepGet(c, 'prepayment_schedule'))}`.trim() : has(deepGet(c, 'prepayment_type')) ? prettyToken(String(deepGet(c, 'prepayment_type'))) : 'n/a'],
    ['Origination fee', pct(deepGet(c, 'origination_fee_pct'))],
    ['Annual debt service', money(deepGet(c, 'annual_debt_service'))],
  ]);

  const sizing = kvTable([
    ['LTV', pct(deepGet(c, 'sizing_metrics.ltv') ?? deepGet(c, 'ltv'))],
    ['DSCR (underwritten)', has(deepGet(c, 'sizing_metrics.dscr_underwritten')) ? ratio(deepGet(c, 'sizing_metrics.dscr_underwritten'), 3) : has(deepGet(c, 'dscr')) ? ratio(deepGet(c, 'dscr'), 3) : 'n/a'],
    ['DSCR (in place)', has(deepGet(c, 'sizing_metrics.dscr_inplace')) ? ratio(deepGet(c, 'sizing_metrics.dscr_inplace'), 3) : 'n/a'],
    ['Debt yield', pct(deepGet(c, 'sizing_metrics.debt_yield') ?? deepGet(c, 'debt_yield'))],
    ['Binding constraint', has(deepGet(c, 'sizing_metrics.binding_constraint')) ? prettyToken(String(deepGet(c, 'sizing_metrics.binding_constraint'))).toUpperCase() : 'n/a'],
    ['Max loan @ DSCR', money(deepGet(c, 'sizing_metrics.max_loan_at_dscr'))],
    ['Max loan @ debt yield', money(deepGet(c, 'sizing_metrics.max_loan_at_debt_yield'))],
    ['Balloon (est.)', money(deepGet(c, 'balloon_payment_est'))],
  ], 'rpt-kv--compact');

  return section(
    'debt_structure',
    'Debt Structure',
    `${proseHtml(prose)}<div class="rpt-cols">${terms}${sizing}</div>`,
  );
}

// ─── §7.1 / 7 — Sources & Uses ───────────────────────────────────────────────

const SOURCE_LABELS: Array<[string, string]> = [
  ['senior_loan', 'Senior Loan'],
  ['mezzanine_debt', 'Mezzanine Debt'],
  ['preferred_equity', 'Preferred Equity'],
  ['equity_sponsor', 'Sponsor Equity'],
  ['equity_lp', 'LP Equity'],
  ['seller_financing', 'Seller Financing'],
  ['government_grant', 'Government Grant'],
  ['tax_credit_equity', 'Tax Credit Equity'],
  ['other', 'Other'],
];

const USE_LABELS: Array<[string, string]> = [
  ['purchase_price', 'Purchase Price'],
  ['renovation_budget', 'Renovation Budget'],
  ['renovation_contingency', 'Renovation Contingency'],
  ['operating_reserves', 'Operating Reserves'],
  ['interest_reserve', 'Interest Reserve'],
  ['rate_cap_cost', 'Rate Cap Cost'],
  ['other_reserves', 'Other Reserves'],
];

function sourcesUses(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'sources_uses');
  if (!block) return null;
  const c = block.content;

  const srcRows: string[][] = [];
  for (const [key, label] of SOURCE_LABELS) {
    const v = deepGet(c, `sources.${key}`);
    if (has(v)) srcRows.push([label, money(v)]);
  }
  const sources = dataTable(
    [{ label: 'Sources' }, { label: 'Amount', align: 'right' }],
    srcRows,
    { footRow: ['Total Sources', money(deepGet(c, 'sources.total'))] },
  );

  const useRows: string[][] = [];
  for (const [key, label] of USE_LABELS) {
    const v = deepGet(c, `uses.${key}`);
    if (has(v)) useRows.push([label, money(v)]);
  }
  const closing = deepGet(c, 'uses.closing_costs.total') ?? deepGet(c, 'uses.closing_costs');
  if (has(closing) && typeof closing !== 'object') {
    useRows.splice(1, 0, ['Closing Costs', money(closing)]);
  }
  const uses = dataTable(
    [{ label: 'Uses' }, { label: 'Amount', align: 'right' }],
    useRows,
    { footRow: ['Total Uses', money(deepGet(c, 'uses.total'))] },
  );

  const equity = kvTable([
    ['Total equity', money(deepGet(c, 'equity_metrics.equity_total'))],
    ['Equity % of cost', pct(deepGet(c, 'equity_metrics.equity_pct_of_cost'))],
    ['Loan-to-cost', pct(deepGet(c, 'equity_metrics.loan_to_cost'))],
    ['Equity per unit', money(deepGet(c, 'equity_metrics.equity_per_unit'))],
  ], 'rpt-kv--compact');

  const balanced = deepGet(c, 'sources_uses_balanced');
  const balanceNote = balanced === true
    ? `<p class="rpt-note">${badge('Sources and uses balance', 'ok')}</p>`
    : balanced === false
      ? `<p class="rpt-note">${badge('Sources and uses do not balance', 'error')}</p>`
      : '';

  return section(
    'sources_uses',
    'Sources & Uses',
    `<div class="rpt-cols">${sources}${uses}</div>${equity}${balanceNote}`,
  );
}

// ─── §7.1 / 8 — Borrower Summary ─────────────────────────────────────────────

function borrowerSummary(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'borrower_sponsor');
  if (!block) return null;
  const c = block.content;

  const narrative = deepGet(c, 'sponsor_narrative') as string | undefined;
  const fs = deepGet(c, 'financial_summary');
  const verified = deepGet(c, 'financial_summary.all_figures_verified');

  const finTable = kvTable([
    ['Global net worth', money(deepGet(fs, 'global_net_worth'))],
    ['Global liquidity', money(deepGet(fs, 'global_liquidity'))],
    ['Net worth / loan', has(deepGet(fs, 'nw_to_loan_ratio')) ? ratio(deepGet(fs, 'nw_to_loan_ratio'), 2) : 'n/a'],
    ['Liquidity / loan', pct(deepGet(fs, 'liquidity_to_loan_ratio'))],
    ['Global DSCR', has(deepGet(fs, 'global_dscr')) ? ratio(deepGet(fs, 'global_dscr'), 2) : 'n/a'],
  ], 'rpt-kv--compact');

  const track = deepGet(c, 'track_record');
  const trackTable = kvTable([
    ['Deals completed', val(deepGet(track, 'deals_completed'))],
    ['Total volume', money(deepGet(track, 'total_deal_volume'))],
    ['Avg hold period', has(deepGet(track, 'avg_hold_period_years')) ? `${val(deepGet(track, 'avg_hold_period_years'))} yrs` : 'n/a'],
    ['Defaults / losses', val(deepGet(track, 'deals_in_default_or_loss'))],
  ], 'rpt-kv--compact');

  const principals = deepGet(c, 'principals') as Array<Record<string, unknown>> | undefined;
  const principalTable = principals?.length
    ? dataTable(
        [
          { label: 'Principal' },
          { label: 'Role' },
          { label: 'Ownership', align: 'right' },
          { label: 'Net Worth', align: 'right' },
          { label: 'Liquidity', align: 'right' },
          { label: 'Guarantor', align: 'center' },
        ],
        principals.map((p) => [
          val(p.name),
          has(p.role) ? prettyToken(String(p.role)) : 'n/a',
          pct(p.ownership_pct),
          money(p.net_worth_stated ?? p.net_worth),
          money(p.liquid_assets_stated ?? p.liquidity),
          p.is_guarantor === true ? 'Yes' : p.is_guarantor === false ? 'No' : 'n/a',
        ]),
      )
    : '';

  const verifiedNote = verified === false
    ? `<p class="rpt-note">${badge('Figures stated, not yet verified', 'warn')}</p>`
    : '';

  return section(
    'borrower_sponsor',
    'Borrower Summary',
    `${proseHtml(narrative)}
${principalTable}
<div class="rpt-cols">${finTable}${trackTable}</div>
${verifiedNote}`,
  );
}

// ─── §7.1 / 9 — Exit Analysis ────────────────────────────────────────────────

function exitAnalysis(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'dcf');
  if (!block) return null;
  const c = block.content;
  const exit = deepGet(c, 'exit_analysis');
  const returns = deepGet(c, 'returns');
  if (!has(exit) && !has(returns)) return null;

  const exitTable = kvTable([
    ['Exit year', val(deepGet(exit, 'exit_year'))],
    ['Exit NOI', money(deepGet(exit, 'exit_noi'))],
    ['Exit cap rate', pct(deepGet(exit, 'cap_rate'))],
    ['Gross exit value', money(deepGet(exit, 'exit_value_gross'))],
    ['Disposition costs', money(deepGet(exit, 'disposition_costs'))],
    ['Net exit value', money(deepGet(exit, 'exit_value_net'))],
    ['Loan balance at exit', money(deepGet(exit, 'loan_balance_at_exit'))],
    ['Net proceeds to equity', money(deepGet(exit, 'net_proceeds_to_equity'))],
  ]);

  const returnTable = kvTable([
    ['Levered IRR', pct(deepGet(returns, 'levered_irr'))],
    ['Unlevered IRR', pct(deepGet(returns, 'unlevered_irr'))],
    ['Equity multiple', has(deepGet(returns, 'equity_multiple')) ? ratio(deepGet(returns, 'equity_multiple'), 2) : 'n/a'],
    ['Avg cash-on-cash', pct(deepGet(returns, 'avg_cash_on_cash'))],
    ['NPV', money(deepGet(returns, 'npv'))],
    ['Discount rate', pct(deepGet(returns, 'discount_rate_used'))],
  ], 'rpt-kv--compact');

  return section(
    'exit_analysis',
    'Exit Analysis & Returns',
    `<div class="rpt-cols">${exitTable}${returnTable}</div>`,
  );
}

// ─── §7.1 / 10 — Assumptions & Disclosures ───────────────────────────────────

const SOURCE_BADGE_KIND: Record<string, string> = {
  user_override: 'warn',
  ai_extracted: 'info',
  agent_computed: 'info',
  market_data: 'info',
  scenario_default: 'default',
  wizard_input: 'default',
  underwritten: 'ok',
  investor_profile: 'default',
};

function assumptionsDisclosures(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'assumptions');
  const disclaimer = ctx.opts.disclaimer ?? STANDARD_DISCLAIMER;
  const list = deepGet(block?.content, 'assumptions') as Array<Record<string, unknown>> | undefined;

  let table = '';
  if (list?.length) {
    const rows = list.map((a) => {
      const unit = String(a.unit ?? '');
      const v = unit === 'pct' ? pct(a.value) : unit.startsWith('dollar') ? money(a.value) : val(a.value);
      return [
        String(a.label ?? a.key ?? ''),
        v,
        String(a.source ?? ''),
        String(a.source_detail ?? ''),
      ];
    });
    const head = [
      { label: 'Assumption' },
      { label: 'Value', align: 'right' as const },
      { label: 'Source' },
      { label: 'Basis' },
    ];
    const body = rows
      .map(
        (r) =>
          `<tr><td>${esc(r[0])}</td><td class="al-right">${esc(r[1])}</td><td>${badge(prettyToken(r[2]), SOURCE_BADGE_KIND[r[2]] ?? 'default')}</td><td class="rpt-basis">${esc(r[3])}</td></tr>`,
      )
      .join('');
    table = `<table class="rpt-table"><thead><tr>${head.map((c) => `<th class="al-${c.align ?? 'left'}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  }

  return section(
    'assumptions',
    'Assumptions & Disclosures',
    `${table}
<div class="rpt-disclaimer"><h3>Disclosures</h3><p>${esc(disclaimer)}</p></div>`,
  );
}

// ─── §7.2 — Credit Memo additions ────────────────────────────────────────────

function marketAnalysis(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'market_analysis');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['market_analysis'];

  const stats = kvTable([
    ['Market / submarket', [deepGet(c, 'market'), deepGet(c, 'submarket')].filter(has).join(' — ') || 'n/a'],
    ['Vacancy', pct(deepGet(c, 'vacancy.current_rate') ?? deepGet(c, 'market_vacancy_rate'))],
    ['YoY rent growth', pct(deepGet(c, 'rents.yoy_rent_growth_pct'))],
    ['Avg asking rent', money(deepGet(c, 'rents.avg_asking_per_unit'))],
    ['Under construction', has(deepGet(c, 'supply.units_under_construction')) ? `${val(deepGet(c, 'supply.units_under_construction'))} units` : 'n/a'],
    ['Net absorption (T-12)', val(deepGet(c, 'demand.net_absorption_trailing_12mo'))],
    ['Cap rate range', has(deepGet(c, 'cap_rates.range_low')) ? `${pct(deepGet(c, 'cap_rates.range_low'))} – ${pct(deepGet(c, 'cap_rates.range_high'))}` : 'n/a'],
  ], 'rpt-kv--compact');

  const comps = deepGet(c, 'comparable_sales') as Array<Record<string, unknown>> | undefined;
  const compTable = comps?.length
    ? `<h3>Comparable Sales</h3>${dataTable(
        [
          { label: 'Property' },
          { label: 'Sale Date' },
          { label: 'Size', align: 'right' },
          { label: 'Price', align: 'right' },
          { label: 'Per Unit/SF', align: 'right' },
          { label: 'Cap Rate', align: 'right' },
        ],
        comps.map((s) => [
          val(s.property_name ?? s.address),
          val(s.sale_date),
          val(s.units_or_sqft),
          money(s.sale_price),
          money(s.price_per_unit ?? s.price_per_sqft),
          pct(s.cap_rate),
        ]),
      )}`
    : '';

  return section('market_analysis', 'Market Analysis', `${proseHtml(prose)}${stats}${compTable}`);
}

function financialAnalysis(ctx: Ctx): string | null {
  const dcf = sectionBlock(ctx, 'dcf');
  const stress = sectionBlock(ctx, 'stress_tests') ?? getSectionVariant(ctx.parsed, 'stress_tests', 'default');
  if (!dcf && !stress) return null;

  let flowsTable = '';
  const flows = deepGet(dcf?.content, 'annual_cash_flows') as Array<Record<string, unknown>> | undefined;
  if (flows?.length) {
    flowsTable = `<h3>Annual Cash Flows</h3>${dataTable(
      [
        { label: 'Year', align: 'right' },
        { label: 'EGI', align: 'right' },
        { label: 'OpEx', align: 'right' },
        { label: 'NOI', align: 'right' },
        { label: 'Debt Service', align: 'right' },
        { label: 'Levered CF', align: 'right' },
        { label: 'CoC', align: 'right' },
      ],
      flows.map((f) => [
        val(f.year),
        money(f.effective_gross_income),
        money(f.total_expenses),
        money(f.net_operating_income),
        money(f.annual_debt_service),
        money(f.net_cash_flow_levered),
        pct(f.cash_on_cash_return),
      ]),
    )}`;
  }

  let stressTable = '';
  const scenarios = deepGet(stress?.content, 'scenarios') as Array<Record<string, unknown>> | undefined;
  if (scenarios?.length) {
    stressTable = `<h3>Stress Scenarios</h3>${dataTable(
      [
        { label: 'Scenario' },
        { label: 'NOI', align: 'right' },
        { label: 'DSCR', align: 'right' },
        { label: 'Debt Yield', align: 'right' },
        { label: 'Passes DSCR Floor', align: 'center' },
      ],
      scenarios.map((s) => [
        val(s.label ?? s.name),
        money(s.resulting_noi),
        has(s.resulting_dscr) ? ratio(s.resulting_dscr, 3) : 'n/a',
        pct(s.resulting_debt_yield),
        s.passes_dscr_minimum === true ? 'Pass' : s.passes_dscr_minimum === false ? 'FAIL' : 'n/a',
      ]),
    )}`;
  }

  const breakEven = deepGet(stress?.content, 'break_even');
  const beTable = has(breakEven)
    ? kvTable([
        ['Break-even occupancy', pct(deepGet(breakEven, 'break_even_occupancy_pct'))],
        ['Break-even rent / unit / mo', money(deepGet(breakEven, 'break_even_rent_per_unit_monthly'))],
        ['Occupancy cushion', pct(deepGet(breakEven, 'current_vs_breakeven_occupancy_cushion'))],
      ], 'rpt-kv--compact')
    : '';

  if (!flowsTable && !stressTable) return null;
  return section('financial_analysis', 'Financial Analysis', `${flowsTable}${stressTable}${beTable}`);
}

function dueDiligence(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'due_diligence');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['due_diligence'];

  const reports: Array<[string, string]> = [
    ['appraisal', 'Appraisal'],
    ['environmental', 'Environmental (Phase I)'],
    ['title', 'Title'],
    ['survey', 'Survey'],
    ['inspection', 'Property Inspection'],
    ['seismic', 'Seismic'],
  ];
  const rows = reports
    .filter(([key]) => has(deepGet(c, key)))
    .map(([key, label]) => {
      const status = String(deepGet(c, `${key}.clearance_status`) ?? 'n/a');
      const received = deepGet(c, `${key}.received`) ?? deepGet(c, `${key}.phase1_received`) ?? deepGet(c, `${key}.commitment_received`);
      return `<tr><td>${esc(label)}</td><td class="al-center">${received === true ? 'Received' : received === false ? 'Pending' : 'n/a'}</td><td>${badge(prettyToken(status), status === 'clear' ? 'ok' : status === 'not_reviewed' ? 'default' : 'warn')}</td></tr>`;
    })
    .join('');
  const reportTable = rows
    ? `<table class="rpt-table"><thead><tr><th>Report</th><th class="al-center">Status</th><th>Clearance</th></tr></thead><tbody>${rows}</tbody></table>`
    : '';

  const checklist = deepGet(c, 'checklist');
  const outstanding = deepGet(checklist, 'items_outstanding') as string[] | undefined;
  const checklistHtml = has(checklist)
    ? `${kvTable([
        ['Items received', `${val(deepGet(checklist, 'items_received'))} of ${val(deepGet(checklist, 'total_items_required'))}`],
        ['Ready to close', deepGet(checklist, 'ready_to_close') === true ? 'Yes' : 'No'],
      ], 'rpt-kv--compact')}${
        outstanding?.length
          ? `<p class="rpt-note">Outstanding: ${outstanding.map((i) => badge(prettyToken(i), 'warn')).join(' ')}</p>`
          : ''
      }`
    : '';

  return section('due_diligence', 'Due Diligence Summary', `${proseHtml(prose)}${reportTable}${checklistHtml}`);
}

function riskAssessment(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'risk_assessment');
  if (!block) return null;
  const c = block.content;
  const prose = ctx.parsed.prose['risk_assessment'];

  const risks = deepGet(c, 'top_risks') as string[] | undefined;
  const mitigants = deepGet(c, 'top_mitigants') as string[] | undefined;
  const listHtml = (items: string[] | undefined, title: string): string =>
    items?.length
      ? `<div><h3>${esc(title)}</h3><ul class="rpt-list">${items.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`
      : '';

  const composite = kvTable([
    ['Composite score', val(deepGet(c, 'composite_score'))],
    ['Rating (1–10)', val(deepGet(c, 'composite_rating_1_to_10'))],
    ['Regulatory rating', val(deepGet(c, 'regulatory_rating'))],
    ['Recommendation', has(deepGet(c, 'recommendation')) ? prettyToken(String(deepGet(c, 'recommendation'))) : 'n/a'],
  ], 'rpt-kv--compact');

  return section(
    'risk_assessment',
    'Risk Assessment',
    `${proseHtml(prose)}${composite}<div class="rpt-cols">${listHtml(risks, 'Top Risks')}${listHtml(mitigants, 'Mitigants')}</div>`,
  );
}

function complianceSummary(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'compliance');
  if (!block) return null;
  const c = block.content;

  const table = kvTable([
    ['HVCRE classification', has(deepGet(c, 'hvcre.classification')) ? prettyToken(String(deepGet(c, 'hvcre.classification'))).toUpperCase() : 'n/a'],
    ['CRA eligible', deepGet(c, 'cra.eligible') === true ? `Yes — ${val(deepGet(c, 'cra.cra_category'))}` : deepGet(c, 'cra.eligible') === false ? 'No' : 'n/a'],
    ['BSA/AML risk', has(deepGet(c, 'bsa_aml.overall_bsa_risk')) ? prettyToken(String(deepGet(c, 'bsa_aml.overall_bsa_risk'))) : 'n/a'],
    ['OFAC clear', deepGet(c, 'bsa_aml.ofac_sdn_clear') === true ? 'Yes' : deepGet(c, 'bsa_aml.ofac_sdn_clear') === false ? 'NO' : 'n/a'],
    ['Fair lending review', deepGet(c, 'fair_lending.review_triggered') === true ? 'Triggered' : 'Not triggered'],
  ]);

  const exceptions = deepGet(c, 'policy_exceptions') as unknown[] | undefined;
  const exceptionsHtml = exceptions?.length
    ? `<p class="rpt-note">${badge(`${exceptions.length} policy exception(s)`, 'warn')}</p>`
    : `<p class="rpt-note">${badge('No policy exceptions', 'ok')}</p>`;

  return section('compliance', 'Compliance Summary', `${table}${exceptionsHtml}`);
}

function covenants(ctx: Ctx): string | null {
  const block = sectionBlock(ctx, 'debt_structure');
  const list = deepGet(block?.content, 'covenants') as Array<Record<string, unknown>> | undefined;
  if (!list?.length) return null;

  const table = dataTable(
    [
      { label: 'Covenant' },
      { label: 'Threshold' },
      { label: 'Frequency' },
      { label: 'Cure Period', align: 'right' },
    ],
    list.map((cov) => [
      has(cov.type) ? prettyToken(String(cov.type)) : 'n/a',
      val(cov.threshold),
      has(cov.test_frequency) ? prettyToken(String(cov.test_frequency)) : 'n/a',
      has(cov.cure_period_days) ? `${val(cov.cure_period_days)} days` : 'n/a',
    ]),
  );
  return section('covenants', 'Covenants', table);
}

function appendix(ctx: Ctx): string | null {
  const { parsed } = ctx;
  if (parsed.pipeline_log.length === 0) return null;

  const rows: string[][] = [];
  for (const block of parsed.pipeline_log) {
    const entries = (deepGet(block.content, 'entries') as Array<Record<string, unknown>> | undefined) ?? [];
    for (const e of entries) {
      rows.push([
        String(e.timestamp ?? '').slice(0, 19).replace('T', ' '),
        val(e.agent_or_actor),
        has(e.event_type) ? prettyToken(String(e.event_type)) : 'n/a',
        val(e.status),
      ]);
    }
  }
  if (rows.length === 0) return null;

  return section(
    'appendix',
    'Appendix — Pipeline Log',
    dataTable(
      [{ label: 'Timestamp' }, { label: 'Actor' }, { label: 'Event' }, { label: 'Status' }],
      rows,
    ),
    'Full provenance retained in the source .uw.md file.',
  );
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────
// Exported so fragment-mode hosts (web editor preview) can include it once.

export const REPORT_CSS = `
:root {
  --rpt-ink: #1a2332;
  --rpt-muted: #5b6b7f;
  --rpt-accent: #1e3a5f;
  --rpt-accent-soft: #eef2f7;
  --rpt-rule: #d7dee8;
  --rpt-ok: #1d6f42;
  --rpt-warn: #8a6d1a;
  --rpt-error: #9b2226;
  --rpt-paper: #ffffff;
}
.uwmd-report {
  font-family: "Source Sans 3", "Segoe UI", system-ui, -apple-system, sans-serif;
  color: var(--rpt-ink);
  background: var(--rpt-paper);
  max-width: 52rem;
  margin: 0 auto;
  padding: 2rem 2.5rem;
  font-size: 0.875rem;
  line-height: 1.55;
}
.uwmd-report h1, .uwmd-report h2, .uwmd-report h3 {
  font-family: Georgia, "Times New Roman", serif;
  color: var(--rpt-accent);
  font-weight: 600;
  margin: 0;
}
.uwmd-report h3 { font-size: 0.95rem; margin: 1.1rem 0 0.4rem; }

/* Cover */
.rpt-cover { padding: 5rem 0 3rem; }
.rpt-cover-rule { height: 4px; width: 4.5rem; background: var(--rpt-accent); margin-bottom: 2.25rem; }
.rpt-cover-doc {
  text-transform: uppercase; letter-spacing: 0.22em; font-size: 0.72rem;
  color: var(--rpt-muted); margin: 0 0 0.6rem;
}
.rpt-cover h1 { font-size: 2.1rem; line-height: 1.15; }
.rpt-cover-address { color: var(--rpt-muted); font-size: 1rem; margin: 0.5rem 0 2.5rem; }
.rpt-cover-facts {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
  background: var(--rpt-rule); border: 1px solid var(--rpt-rule); margin-bottom: 3rem;
}
.rpt-cover-fact { background: var(--rpt-paper); padding: 0.7rem 0.9rem; }
.rpt-cover-fact span { display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rpt-muted); }
.rpt-cover-fact strong { font-size: 1rem; font-variant-numeric: tabular-nums; }
.rpt-cover-foot { color: var(--rpt-muted); font-size: 0.78rem; }
.rpt-cover-foot p { margin: 0.15rem 0; }

/* Sections */
.rpt-section { margin: 2.25rem 0; }
.rpt-section-head { border-bottom: 2px solid var(--rpt-accent); padding-bottom: 0.35rem; margin-bottom: 0.9rem; }
.rpt-section-head h2 { font-size: 1.25rem; }
.rpt-subtitle { color: var(--rpt-muted); font-size: 0.78rem; margin: 0.2rem 0 0; }
.rpt-prose { margin: 0.5rem 0; }
.rpt-status, .rpt-note { font-size: 0.82rem; color: var(--rpt-muted); margin: 0.6rem 0 0; }
.rpt-flags { margin: 0.5rem 0 0; }
.rpt-list { margin: 0.3rem 0 0 1.1rem; padding: 0; }
.rpt-list li { margin: 0.25rem 0; }

/* Metric grid */
.rpt-metric-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
  background: var(--rpt-rule); border: 1px solid var(--rpt-rule); margin: 0.9rem 0;
}
.rpt-metric { background: var(--rpt-accent-soft); padding: 0.65rem 0.85rem; }
.rpt-metric span { display: block; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rpt-muted); }
.rpt-metric strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; color: var(--rpt-accent); }

/* Tables */
.uwmd-report table { border-collapse: collapse; width: 100%; margin: 0.6rem 0; font-variant-numeric: tabular-nums; }
.rpt-table th, .rpt-table td { padding: 0.32rem 0.55rem; border-bottom: 1px solid var(--rpt-rule); }
.rpt-table thead th {
  background: var(--rpt-accent); color: #fff; font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.06em; text-align: left; font-weight: 600;
}
.rpt-table tbody tr:nth-child(even) { background: #f7f9fc; }
.rpt-table tfoot td { font-weight: 700; border-top: 2px solid var(--rpt-accent); border-bottom: none; }
.al-right { text-align: right; }
.al-center { text-align: center; }
.al-left { text-align: left; }
.rpt-kv th { text-align: left; font-weight: 600; color: var(--rpt-muted); width: 46%; padding: 0.28rem 0.55rem 0.28rem 0; border-bottom: 1px solid var(--rpt-rule); font-size: 0.8rem; }
.rpt-kv td { padding: 0.28rem 0; border-bottom: 1px solid var(--rpt-rule); }
.rpt-kv--compact th, .rpt-kv--compact td { font-size: 0.78rem; padding-top: 0.22rem; padding-bottom: 0.22rem; }
.rpt-totals { margin-top: -0.4rem; }
.rpt-total-row td { font-weight: 700; padding: 0.32rem 0.55rem; border-bottom: 1px solid var(--rpt-rule); }
.rpt-noi-row td { border-top: 2px solid var(--rpt-accent); font-size: 0.95rem; color: var(--rpt-accent); }
.rpt-basis { font-size: 0.74rem; color: var(--rpt-muted); }

/* Layout */
.rpt-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1.6rem; align-items: start; }
.rpt-cols--proforma { grid-template-columns: 3fr 2fr; }
@media (max-width: 640px) { .rpt-cols, .rpt-cols--proforma { grid-template-columns: 1fr; } }

/* Badges */
.rpt-badge {
  display: inline-block; font-size: 0.66rem; font-weight: 600; letter-spacing: 0.04em;
  padding: 0.12rem 0.5rem; border-radius: 999px; border: 1px solid var(--rpt-rule);
  background: var(--rpt-accent-soft); color: var(--rpt-muted); margin: 0.1rem 0;
}
.rpt-badge--ok { color: var(--rpt-ok); border-color: #bcd9c8; background: #ecf6f0; }
.rpt-badge--warn { color: var(--rpt-warn); border-color: #e4d5a3; background: #faf5e3; }
.rpt-badge--error { color: var(--rpt-error); border-color: #e5b4b6; background: #fbeaeb; }
.rpt-badge--info { color: var(--rpt-accent); border-color: #c3d2e4; background: var(--rpt-accent-soft); }

/* Disclaimer */
.rpt-disclaimer { margin-top: 1.2rem; padding: 0.9rem 1.1rem; background: var(--rpt-accent-soft); border-left: 3px solid var(--rpt-accent); }
.rpt-disclaimer h3 { margin-top: 0; }
.rpt-disclaimer p { font-size: 0.76rem; color: var(--rpt-muted); margin: 0.3rem 0 0; }
.rpt-amenities { margin: 0.6rem 0 0; }

/* Print */
@page { size: letter; margin: 0.75in; }
@media print {
  .uwmd-report { max-width: none; padding: 0; font-size: 10pt; }
  .rpt-cover { page-break-after: always; padding-top: 2.5in; }
  .rpt-section { break-inside: avoid-page; margin: 1.4rem 0; }
  .rpt-section-head { break-after: avoid-page; }
  .rpt-table thead th { background: var(--rpt-accent) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rpt-metric, .rpt-disclaimer, .rpt-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: inherit; text-decoration: none; }
}
`;
