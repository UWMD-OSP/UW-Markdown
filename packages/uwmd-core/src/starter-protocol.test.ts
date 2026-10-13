import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercent } from './format.js';
import * as indexSurface from './index.js';
import * as browserSurface from './browser.js';
import { deepGet, getSection, parseUWFile } from './parser.js';
import * as protocol from './protocol.js';
import { SOURCE_TAGS } from './protocol.js';
import { BUILTIN_VIEW_MODELS, CASCADE_ORDER, DEFAULT_DATE_FORMAT, DEFAULT_NUMBER_FORMAT } from './starter-protocol.js';

describe('starter-protocol — the split from protocol.ts (RFC 0083)', () => {
  it('protocol.ts no longer carries the starter tables', () => {
    for (const name of ['BUILTIN_VIEW_MODELS', 'CASCADE_ORDER', 'DEFAULT_NUMBER_FORMAT', 'DEFAULT_DATE_FORMAT']) {
      expect(protocol, name).not.toHaveProperty(name);
    }
  });

  it('both public entry points export the starter tables under their old names', () => {
    expect(indexSurface.BUILTIN_VIEW_MODELS).toBe(BUILTIN_VIEW_MODELS);
    expect(indexSurface.CASCADE_ORDER).toBe(CASCADE_ORDER);
    expect(indexSurface.DEFAULT_NUMBER_FORMAT).toBe(DEFAULT_NUMBER_FORMAT);
    expect(indexSurface.DEFAULT_DATE_FORMAT).toBe(DEFAULT_DATE_FORMAT);
    expect(browserSurface.BUILTIN_VIEW_MODELS).toBe(BUILTIN_VIEW_MODELS);
    expect(browserSurface.DEFAULT_NUMBER_FORMAT).toBe(DEFAULT_NUMBER_FORMAT);
    expect(browserSurface.DEFAULT_DATE_FORMAT).toBe(DEFAULT_DATE_FORMAT);
  });
});

describe('starter-protocol — CASCADE_ORDER', () => {
  it('lists exactly the eight cascade steps in the documented order', () => {
    // Seven until RFC 0021 §5 inserted `inherited_assumption` at protocol
    // 1.5.0. Its position is load-bearing in both directions: below
    // `user_input`, so a value entered on the deal always beats an inherited
    // default; above `investor_profile`, because a named ancestor in this
    // deal's composition DAG is more specific than an institution-wide
    // preference set.
    expect([...CASCADE_ORDER]).toEqual([
      'user_override',
      'user_input',
      'inherited_assumption',
      'investor_profile',
      'market_data',
      'asset_class_default',
      'global_default',
      'system_default',
    ]);
  });

  it('every cascade step is present in SOURCE_TAGS', () => {
    for (const step of CASCADE_ORDER) {
      expect(SOURCE_TAGS).toContain(step);
    }
  });
});

describe('BUILTIN_VIEW_MODELS.noi_model reads Format §4.5 paths', () => {
  // The paths come from the §4.5 template in the spec, not from whichever
  // worked example happens to pass. The view model read top-level keys that
  // §4.5 never states, so every NOI card field but NOI resolved to nothing.
  const specPath = fileURLToPath(new URL('../../../spec/UW_FORMAT_SPEC.md', import.meta.url));
  const spec = readFileSync(specPath, 'utf-8');
  const s45 = spec.slice(spec.indexOf('### § 4.5 — NOI Model'));
  const open = s45.indexOf('```json\n') + '```json\n'.length;
  const template = JSON.parse(s45.slice(open, s45.indexOf('\n```', open))) as Record<string, unknown>;

  const vm = BUILTIN_VIEW_MODELS['noi_model']!;
  const hints = [...vm.primary_fields, ...(vm.detail_fields ?? [])];

  it('parses the §4.5 template', () => {
    expect(template['income']).toHaveProperty('gross_potential_rent.value');
  });

  it('every NOI hint names a numeric field of the §4.5 template', () => {
    for (const h of hints) {
      expect(typeof deepGet(template, h.path), `${h.label}: ${h.path}`).toBe('number');
    }
  });

  it('pins each hint to its §4.5 location', () => {
    expect(hints.map((h) => [h.label, h.path])).toEqual([
      ['NOI', 'net_operating_income'],
      ['EGI', 'income.effective_gross_income'],
      ['OpEx', 'expenses.total_operating_expenses'],
      ['OpEx Ratio', 'expenses.expense_ratio'],
      ['GPR', 'income.gross_potential_rent.value'],
      ['Vacancy Loss', 'income.vacancy_credit_loss.value'],
      ['Vacancy Rate', 'income.vacancy_credit_loss.rate_applied'],
      ['Other Income', 'income.other_income.value'],
    ]);
  });

  it('every hint resolves and formats on the document §4.5 conformance fixture', () => {
    const fixture = fileURLToPath(new URL(
      '../../../conformance/documents/fixtures/02-full-multifamily.uwx.md', import.meta.url,
    ));
    const content = getSection(parseUWFile(readFileSync(fixture, 'utf-8')), 'noi_model')!.content;
    for (const h of hints) {
      const v = deepGet(content, h.path);
      expect(Number.isFinite(v), `${h.label}: ${h.path}`).toBe(true);
      const shown = h.kind === 'percent' ? formatPercent(v) : formatCurrency(v);
      expect(shown, h.label).not.toBe('n/a');
    }
  });

  it('a hint on the money object itself would format as n/a, which is why it reads .value', () => {
    const fixture = fileURLToPath(new URL(
      '../../../conformance/documents/fixtures/02-full-multifamily.uwx.md', import.meta.url,
    ));
    const content = getSection(parseUWFile(readFileSync(fixture, 'utf-8')), 'noi_model')!.content;
    expect(formatCurrency(deepGet(content, 'income.gross_potential_rent'))).toBe('n/a');
    expect(formatCurrency(deepGet(content, 'income.gross_potential_rent.value'))).toBe('$655,200');
  });
});
