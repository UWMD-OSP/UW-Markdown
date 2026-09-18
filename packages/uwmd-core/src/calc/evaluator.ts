// Tier-3 Calc Host — AST evaluator.
// Variable resolution per §VIII.2; null propagation per §VIII.2.

import { getSection, isBlockedSegment } from '../parser.js';
import type { CalcEvaluationContext } from '../protocol.js';
import { BUILTINS, type CalcValue } from './builtins.js';
import { CalcError } from './errors.js';
import { periodReferencePath, type Expr } from './parser.js';
import { periodReferenceContract, periodSection, resolvePeriodReference } from '../period-path.js';
import { parsePeriodSelector } from '../periods.js';

const MAX_NODES = 1024;
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

export function isForbiddenProperty(segment: string): boolean {
  return FORBIDDEN_PROPERTIES.has(segment);
}

interface EvalState {
  nodes: number;
}

export function evaluate(expr: Expr, ctx: CalcEvaluationContext): CalcValue {
  const state: EvalState = { nodes: 0 };
  return evalNode(expr, ctx, state);
}

function evalNode(expr: Expr, ctx: CalcEvaluationContext, state: EvalState): CalcValue {
  if (++state.nodes > MAX_NODES) {
    throw new CalcError('CALC-LIMIT-001', `Expression exceeds ${MAX_NODES} AST nodes.`);
  }

  switch (expr.kind) {
    case 'literal':
      return expr.value;

    case 'ident': {
      if (isForbiddenProperty(expr.name)) {
        throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${expr.name}'.`);
      }
      const overridden = lookupOverride(expr.name, ctx);
      if (overridden !== undefined) return overridden;
      return resolveIdentifier(expr.name, ctx);
    }

    case 'path': {
      if (isForbiddenProperty(expr.head)) {
        throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${expr.head}'.`);
      }
      for (const seg of expr.segments) {
        if (isForbiddenProperty(seg)) {
          throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${seg}'.`);
        }
      }

      // The whole dotted path is checked first, so `dcf.exit_cap_rate` can be
      // overridden without shadowing everything else under `dcf`.
      const overridden = lookupOverride(
        [expr.head, ...expr.segments].join('.'),
        ctx,
      );
      if (overridden !== undefined) return overridden;

      // Also check period reference path override if a period selector segment exists
      for (let i = 0; i < expr.segments.length; i++) {
        const seg = expr.segments[i]!;
        if (parsePeriodSelector(seg)) {
          const seriesPart = [expr.head, ...expr.segments.slice(0, i)].join('.');
          const rest = expr.segments.slice(i + 1);
          const suffix = rest.length ? `.${rest.join('.')}` : '';
          const altOverride = lookupOverride(`${seriesPart}@${seg}${suffix}`, ctx);
          if (altOverride !== undefined) return altOverride;
          break;
        }
      }

      const head = resolveIdentifier(expr.head, ctx);
      if (head === null || head === undefined) return null;
      let cur: unknown = head;
      for (const seg of expr.segments) {
        if (cur === null || cur === undefined) return null;
        if (typeof cur !== 'object' && typeof cur !== 'function') return null;
        if (Object.prototype.hasOwnProperty.call(cur, seg)) {
          cur = (cur as Record<string, unknown>)[seg];
        } else if (Array.isArray(cur)) {
          const key = parsePeriodSelector(seg);
          if (!key) return null;
          let matched: unknown = undefined;
          for (const item of cur) {
            if (item && typeof item === 'object') {
              if (key.kind === 'year') {
                if (
                  (Object.prototype.hasOwnProperty.call(item, 'year') &&
                    ((item as Record<string, unknown>).year === key.index ||
                      (item as Record<string, unknown>).year === String(key.index))) ||
                  (Object.prototype.hasOwnProperty.call(item, 'period') &&
                    (item as Record<string, unknown>).period === seg)
                ) {
                  matched = item;
                  break;
                }
              } else if (key.kind === 'quarter' || key.kind === 'month') {
                if (
                  Object.prototype.hasOwnProperty.call(item, 'period') &&
                  (item as Record<string, unknown>).period === seg
                ) {
                  matched = item;
                  break;
                }
              } else if (key.kind === 'date') {
                if (
                  (Object.prototype.hasOwnProperty.call(item, 'date') &&
                    (item as Record<string, unknown>).date === key.date) ||
                  (Object.prototype.hasOwnProperty.call(item, 'period') &&
                    (item as Record<string, unknown>).period === seg)
                ) {
                  matched = item;
                  break;
                }
              }
            }
          }
          if (matched === undefined) return null;
          cur = matched;
        } else {
          const key = parsePeriodSelector(seg);
          if (key && key.kind === 'year') {
            const yearKey = `year_${key.index}`;
            if (Object.prototype.hasOwnProperty.call(cur, yearKey)) {
              cur = (cur as Record<string, unknown>)[yearKey];
            } else {
              return null;
            }
          } else {
            return null;
          }
        }
      }
      return coerceCalcValue(cur);
    }

    case 'period_path': {
      if (
        isForbiddenProperty(expr.head) ||
        expr.series.some(isForbiddenProperty) ||
        expr.segments.some(isForbiddenProperty) ||
        isForbiddenProperty(expr.selector)
      ) {
        throw new CalcError('CALC-FORBIDDEN-PROP', 'Access to forbidden property in period path.');
      }
      periodReferenceContract(expr);
      const overridden = lookupOverride(periodReferencePath(expr), ctx);
      if (overridden !== undefined) return overridden;
      const dotPath = [expr.head, ...expr.series, expr.selector, ...expr.segments].join('.');
      const dotOverridden = lookupOverride(dotPath, ctx);
      if (dotOverridden !== undefined) return dotOverridden;
      const value = resolvePeriodReference(ctx.parsed, expr, ctx);
      return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : null;
    }

    case 'call': {
      if (isForbiddenProperty(expr.name)) {
        throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${expr.name}'.`);
      }
      const fn = Object.prototype.hasOwnProperty.call(BUILTINS, expr.name)
        ? BUILTINS[expr.name]
        : undefined;
      if (!fn) {
        throw new CalcError('CALC-RESOLVE-001', `Unknown function '${expr.name}'.`);
      }
      const args = expr.args.map((a) => evalNode(a, ctx, state));
      return fn(args);
    }

    case 'unary': {
      const v = evalNode(expr.operand, ctx, state);
      if (v === null) return null;
      if (expr.op === '-') {
        if (typeof v !== 'number') {
          throw new CalcError('CALC-TYPE-001', `Unary '-' requires number, got ${typeof v}.`);
        }
        return -v;
      }
      // !
      if (typeof v !== 'boolean') {
        throw new CalcError('CALC-TYPE-001', `Unary '!' requires boolean, got ${typeof v}.`);
      }
      return !v;
    }

    case 'binary': {
      // Logical operators short-circuit and propagate null. The right side is
      // only evaluated if the left side does not already determine the answer.
      if (expr.op === '&&' || expr.op === '||') {
        const left = evalNode(expr.left, ctx, state);
        if (left === null) return null;
        if (typeof left !== 'boolean') {
          throw new CalcError('CALC-TYPE-001', `Operator '${expr.op}' requires booleans, got ${typeof left} on left.`);
        }
        // Short-circuit: false && _ = false; true || _ = true.
        if (expr.op === '&&' && left === false) return false;
        if (expr.op === '||' && left === true) return true;
        const right = evalNode(expr.right, ctx, state);
        if (right === null) return null;
        if (typeof right !== 'boolean') {
          throw new CalcError('CALC-TYPE-001', `Operator '${expr.op}' requires booleans, got ${typeof right} on right.`);
        }
        return right;
      }
      return evalBinary(expr.op, evalNode(expr.left, ctx, state), evalNode(expr.right, ctx, state));
    }

    case 'cond': {
      const test = evalNode(expr.test, ctx, state);
      if (test === null) return null;
      if (typeof test !== 'boolean') {
        throw new CalcError('CALC-TYPE-001', `Ternary condition must be boolean, got ${typeof test}.`);
      }
      return test ? evalNode(expr.consequent, ctx, state) : evalNode(expr.else, ctx, state);
    }
  }
}

// ─── Variable resolution ──────────────────────────────────────────────────────

/**
 * An override for this exact path, or `undefined` when there is none.
 *
 * `undefined` rather than `null` is load-bearing: `null` is a legitimate
 * override value meaning "treat this as absent", and collapsing the two would
 * make it impossible to ask what a formula does when an input goes missing.
 */
function lookupOverride(path: string, ctx: CalcEvaluationContext): CalcValue | undefined {
  const overrides = ctx.overrides;
  if (!overrides) return undefined;
  if (!Object.prototype.hasOwnProperty.call(overrides, path)) return undefined;
  return overrides[path] ?? null;
}

function resolveIdentifier(name: string, ctx: CalcEvaluationContext): CalcValue {
  // A blocked head is unresolvable for the same reason a blocked segment is:
  // no document-authored name may reach the prototype chain.
  if (isForbiddenProperty(name) || isBlockedSegment(name)) {
    throw new CalcError('CALC-FORBIDDEN-PROP', `Access to forbidden property '${name}'.`);
  }

  const fm = ctx.parsed.frontmatter as unknown as Record<string, unknown>;
  if (fm && Object.prototype.hasOwnProperty.call(fm, name)) {
    return coerceCalcValue(fm[name]);
  }

  let section = getSection(ctx.parsed, name);
  if (!section && ctx.parsed?.sections) {
    try {
      section = periodSection(ctx.parsed, name, ctx);
    } catch {
      section = null;
    }
  }
  if (section) {
    // Per §VIII.2: identifier maps to the canonical block's content (user data
    // inside the JSON envelope). The parser stores the full envelope on
    // block.content; the user-facing data lives at block.content.content.
    const envelope = section.content as Record<string, unknown> | null | undefined;
    const inner = envelope && typeof envelope === 'object' && Object.prototype.hasOwnProperty.call(envelope, 'content')
      ? envelope.content
      : envelope;
    return coerceCalcValue(inner);
  }

  if (Object.prototype.hasOwnProperty.call(ctx.prior_results, name)) {
    return ctx.prior_results[name] ?? null;
  }

  return null;
}

function coerceCalcValue(v: unknown): CalcValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  // Objects/arrays remain accessible via path traversal — return them as-is so
  // the caller (path walker) can drill in. Convert to null for terminal use.
  return v as unknown as CalcValue;
}

// ─── Binary operator evaluation ───────────────────────────────────────────────

function evalBinary(op: string, l: CalcValue, r: CalcValue): CalcValue {
  switch (op) {
    case '+':
      if (l === null || r === null) return null;
      if (typeof l === 'number' && typeof r === 'number') return l + r;
      if (typeof l === 'string' && typeof r === 'string') return l + r;
      throw new CalcError('CALC-TYPE-001', `'+' requires number+number or string+string.`);

    case '-':
    case '*':
    case '/':
    case '%': {
      if (l === null || r === null) return null;
      if (typeof l !== 'number' || typeof r !== 'number') {
        throw new CalcError('CALC-TYPE-001', `Operator '${op}' requires numbers.`);
      }
      if ((op === '/' || op === '%') && r === 0) {
        throw new CalcError('CALC-DIV-ZERO', 'Division by zero.');
      }
      if (op === '-') return l - r;
      if (op === '*') return l * r;
      if (op === '/') return l / r;
      return l - Math.trunc(l / r) * r; // %
    }

    case '==': return strictEqual(l, r);
    case '!=': return !strictEqual(l, r);

    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (l === null || r === null) return null;
      if (typeof l !== typeof r) {
        throw new CalcError('CALC-TYPE-001', `Comparison '${op}' requires same types.`);
      }
      if (typeof l !== 'number' && typeof l !== 'string') {
        throw new CalcError('CALC-TYPE-001', `Comparison '${op}' requires numbers or strings.`);
      }
      if (op === '<') return (l as number | string) < (r as number | string);
      if (op === '<=') return (l as number | string) <= (r as number | string);
      if (op === '>') return (l as number | string) > (r as number | string);
      return (l as number | string) >= (r as number | string);
    }
  }
  throw new CalcError('CALC-PARSE-001', `Unknown binary operator '${op}'.`);
}

function strictEqual(a: CalcValue, b: CalcValue): boolean {
  if (a === null || b === null) return a === b;
  return a === b;
}
