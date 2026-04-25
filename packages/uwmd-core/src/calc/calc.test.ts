// Tier-3 Calc Host tests — grammar coverage, builtins, null propagation,
// error taxonomy, IRR convergence.

import { describe, it, expect } from 'vitest';
import { parseUWFile } from '../parser.js';
import { evaluateCalc, evaluate, parseExpression } from './index.js';
import type { CalcEvaluationContext, ModuleCalcDecl } from '../protocol.js';

const FIXTURE = `---
uw_version: "1.1"
deal_id: "uw_test"
deal_name: "Test"
created: "2026-01-01T00:00:00Z"
last_modified: "2026-01-01T00:00:00Z"
property_address: "1 Test"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
pipeline_state:
  L0_ingestion: complete
  L1_screening: pending
  L2_underwriting: pending
  L4_structuring: pending
  L5_compliance: pending
  L6_risk: pending
  L7_assembly: pending
status: draft
deal_stage: screening
recommendation: null
quick_metrics:
  purchase_price: 5000000
  loan_amount: 3500000
  noi_underwritten: 425000
  dscr: null
  ltv: null
  debt_yield: null
  cap_rate: null
  irr_projected: null
---

\`\`\`json uw:section=noi source=manual confidence=high
{
  "section_id": "noi",
  "_meta": {
    "section_id": "noi",
    "version": 1,
    "timestamp": "2026-01-01T00:00:00Z",
    "source": "manual",
    "actor": "tester",
    "confidence": "high"
  },
  "content": {
    "egi": 800000,
    "operating_expenses": 375000,
    "noi": 425000
  }
}
\`\`\`
`;

function makeCtx(): CalcEvaluationContext {
  return {
    parsed: parseUWFile(FIXTURE),
    prior_results: { revpar: 100, vacancy_rate: 0.05 },
    locale: 'en-US',
  };
}

function decl(id: string, formula: string, unit?: string): ModuleCalcDecl {
  return { id, label: id, formula, deterministic: true, ...(unit ? { unit } : {}) };
}

// ─── Grammar / parser ─────────────────────────────────────────────────────────

describe('parseExpression', () => {
  it('parses literals', () => {
    expect(parseExpression('42')).toEqual({ kind: 'literal', value: 42 });
    expect(parseExpression('3.14')).toEqual({ kind: 'literal', value: 3.14 });
    expect(parseExpression("'hello'")).toEqual({ kind: 'literal', value: 'hello' });
    expect(parseExpression('true')).toEqual({ kind: 'literal', value: true });
    expect(parseExpression('null')).toEqual({ kind: 'literal', value: null });
  });

  it('parses identifiers and dot paths', () => {
    expect(parseExpression('foo')).toEqual({ kind: 'ident', name: 'foo' });
    const path = parseExpression('quick_metrics.purchase_price');
    expect(path.kind).toBe('path');
  });

  it('parses bracket-string member access', () => {
    const ast = parseExpression("foo['bar']");
    expect(ast).toEqual({ kind: 'path', head: 'foo', segments: ['bar'] });
  });

  it('parses calls with multiple args', () => {
    const ast = parseExpression('sum(1, 2, 3)');
    expect(ast.kind).toBe('call');
  });

  it('rejects assignment', () => {
    expect(() => parseExpression('x = 5')).toThrow(/CALC-PARSE/);
  });

  it('rejects unknown operators', () => {
    expect(() => parseExpression('1 ** 2')).toThrow(/CALC-PARSE/);
  });

  it('rejects unterminated strings', () => {
    expect(() => parseExpression("'unclosed")).toThrow(/CALC-PARSE/);
  });
});

// ─── Evaluation ───────────────────────────────────────────────────────────────

describe('evaluate', () => {
  it('arithmetic precedence: 1 + 2 * 3 = 7', () => {
    const ast = parseExpression('1 + 2 * 3');
    expect(evaluate(ast, makeCtx())).toBe(7);
  });

  it('parenthesized: (1 + 2) * 3 = 9', () => {
    expect(evaluate(parseExpression('(1 + 2) * 3'), makeCtx())).toBe(9);
  });

  it('unary minus', () => {
    expect(evaluate(parseExpression('-5 + 3'), makeCtx())).toBe(-2);
  });

  it('comparison + ternary', () => {
    expect(evaluate(parseExpression("1 < 2 ? 'a' : 'b'"), makeCtx())).toBe('a');
  });

  it('null + number = null (propagation)', () => {
    expect(evaluate(parseExpression('quick_metrics.dscr + 1'), makeCtx())).toBe(null);
  });

  it('division by zero → CALC-DIV-ZERO', () => {
    expect(() => evaluate(parseExpression('5 / 0'), makeCtx())).toThrow(/CALC-DIV-ZERO/);
  });

  it('comparing different types → CALC-TYPE-001', () => {
    expect(() => evaluate(parseExpression("1 < 'a'"), makeCtx())).toThrow(/CALC-TYPE/);
  });
});

// ─── Variable resolution ──────────────────────────────────────────────────────

describe('variable resolution', () => {
  it('resolves frontmatter top-level', () => {
    expect(evaluate(parseExpression('asset_class'), makeCtx())).toBe('multifamily');
  });

  it('resolves frontmatter dot-path', () => {
    expect(evaluate(parseExpression('quick_metrics.purchase_price'), makeCtx())).toBe(5000000);
  });

  it('resolves section content', () => {
    expect(evaluate(parseExpression('noi.noi'), makeCtx())).toBe(425000);
  });

  it('resolves prior_results', () => {
    expect(evaluate(parseExpression('revpar'), makeCtx())).toBe(100);
  });

  it('frontmatter shadows section (resolution order)', () => {
    // `asset_class` exists in frontmatter; identifier alone resolves there first.
    expect(evaluate(parseExpression('asset_class'), makeCtx())).toBe('multifamily');
  });

  it('missing path → null (not error)', () => {
    expect(evaluate(parseExpression('nonexistent.foo'), makeCtx())).toBe(null);
  });
});

// ─── Built-in functions ───────────────────────────────────────────────────────

describe('builtins', () => {
  it('sum treats null as 0', () => {
    expect(evaluate(parseExpression('sum(1, 2, null, 3)'), makeCtx())).toBe(6);
  });

  it('avg ignores null; null when no inputs', () => {
    expect(evaluate(parseExpression('avg(2, 4, null)'), makeCtx())).toBe(3);
    expect(evaluate(parseExpression('avg(null, null)'), makeCtx())).toBe(null);
  });

  it('min / max ignore null', () => {
    expect(evaluate(parseExpression('min(5, 2, null, 8)'), makeCtx())).toBe(2);
    expect(evaluate(parseExpression('max(5, 2, null, 8)'), makeCtx())).toBe(8);
  });

  it('coalesce returns first non-null', () => {
    expect(evaluate(parseExpression("coalesce(null, null, 'fallback')"), makeCtx())).toBe('fallback');
    expect(evaluate(parseExpression('coalesce(null, null)'), makeCtx())).toBe(null);
  });

  it('if dispatch', () => {
    expect(evaluate(parseExpression("if(true, 'yes', 'no')"), makeCtx())).toBe('yes');
    expect(evaluate(parseExpression("if(false, 'yes', 'no')"), makeCtx())).toBe('no');
  });

  it('round half-away-from-zero', () => {
    expect(evaluate(parseExpression('round(2.5, 0)'), makeCtx())).toBe(3);
    expect(evaluate(parseExpression('round(-2.5, 0)'), makeCtx())).toBe(-3);
    expect(evaluate(parseExpression('round(1.2345, 2)'), makeCtx())).toBe(1.23);
  });

  it('pmt formula matches Excel', () => {
    // pmt(0.05/12, 360, 100000) ≈ 536.82 (Excel returns -536.82; we return positive)
    const r = evaluate(parseExpression('pmt(0.05 / 12, 360, 100000)'), makeCtx()) as number;
    expect(r).toBeGreaterThan(536);
    expect(r).toBeLessThan(537);
  });

  it('npv basic', () => {
    // npv(0.10, -1000, 600, 600) — at t=0,1,2 with rate 10%
    // = -1000 + 600/1.1 + 600/1.21 ≈ 41.32
    const v = evaluate(parseExpression('npv(0.10, -1000, 600, 600)'), makeCtx()) as number;
    expect(v).toBeCloseTo(41.32, 1);
  });

  it('irr converges on simple cash flows', () => {
    // -1000 at t=0, +600 at t=1, +600 at t=2 → IRR ≈ 13.07%
    const v = evaluate(parseExpression('irr(-1000, 600, 600)'), makeCtx()) as number;
    expect(v).toBeCloseTo(0.1307, 3);
  });

  it('irr throws CALC-IRR-DIVERGE on all-positive flows', () => {
    expect(() => evaluate(parseExpression('irr(100, 200, 300)'), makeCtx())).toThrow(/CALC-IRR-DIVERGE/);
  });

  it('unknown function → CALC-RESOLVE-001', () => {
    expect(() => evaluate(parseExpression('frobulate(1, 2)'), makeCtx())).toThrow(/CALC-RESOLVE/);
  });
});

// ─── evaluateCalc top-level ───────────────────────────────────────────────────

describe('evaluateCalc', () => {
  it('returns CalcResult with display formatting for $', () => {
    const r = evaluateCalc(decl('purchase_price', 'quick_metrics.purchase_price', '$'), makeCtx());
    expect(r.ok).toBe(true);
    expect(r.value).toBe(5000000);
    expect(r.unit).toBe('$');
    expect(r.display).toContain('5,000,000');
  });

  it('captures parse errors into result.error', () => {
    const r = evaluateCalc(decl('bad', '1 + + 2'), makeCtx());
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('CALC-PARSE-001');
    expect(r.value).toBe(null);
  });

  it('captures division-by-zero into result.error', () => {
    const r = evaluateCalc(decl('bad', '1 / 0'), makeCtx());
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('CALC-DIV-ZERO');
  });

  it('DSCR-style derived calc', () => {
    // dscr = noi / (annualized debt service). Use noi.noi and a synthetic monthly pmt × 12.
    // Loan: $3.5M at 6.0% / 30y → annualized service ≈ 251,728.93
    const r = evaluateCalc(
      decl('dscr', 'noi.noi / (pmt(0.06 / 12, 360, 3500000) * 12)', 'x'),
      makeCtx(),
    );
    expect(r.ok).toBe(true);
    expect(r.value as number).toBeGreaterThan(1.6);
    expect(r.value as number).toBeLessThan(1.8);
    expect(r.display).toMatch(/x$/);
  });
});
