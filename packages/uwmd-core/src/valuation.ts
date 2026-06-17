// Deterministic income-approach footing — when the valuation block carries an
// income_approach with a chosen NOI and applied cap rate, the indicated value
// (and its delta to purchase price) foot from them: value = NOI / cap rate. One
// source of truth so the editor, CLI, and Excel converter never disagree
// (invariant #4); plain arithmetic, not AI math (invariant #1).
//
// Scope is deliberately narrow and self-contained: only the relationships that
// live entirely inside the valuation block are footed. The NOI to capitalize is
// the underwriter's stored choice (`income_approach.noi_used`), not pulled from
// another section, and per-unit / per-sqft values (which need the property
// section) are left as inputs. Blocks without an income_approach (e.g. a flat
// office appraisal block) simply foot nothing.

import { collector, numOrNull, type DerivedField } from './derived.js';

type Row = Record<string, unknown>;

const num = numOrNull;
const isObj = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);

export interface ValuationDerivation {
  fields: DerivedField[];
}

/** Foot a valuation content block. Pure: never mutates `content`. */
export function deriveValuation(content: Row): ValuationDerivation {
  const c = collector();
  const ia = isObj(content['income_approach']) ? content['income_approach'] : null;
  if (!ia) return { fields: c.fields };

  const noi = num(ia['noi_used']);
  const cap = num(ia['cap_rate_applied']);
  if (noi == null || cap == null || cap <= 0) return { fields: c.fields };

  const indicated = noi / cap;
  c.add('income_approach.indicated_value', 'Indicated Value (income approach)', 'currency', indicated);

  const purchase = num(content['purchase_price']);
  if (purchase != null && purchase > 0) {
    c.add(
      'uw_value_vs_purchase_price_pct',
      'UW Value vs. Purchase Price',
      'rate',
      indicated / purchase - 1,
    );
  }

  return { fields: c.fields };
}
