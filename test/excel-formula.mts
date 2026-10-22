// Test-only evaluator for the Excel formula subset the calc emitter writes
// (@uwmd/core `emitCalcExcelFormula`). It applies Excel's own semantics where
// they differ from the calc engine's, which is the point: a blank named cell is
// 0 in arithmetic and "" in a text comparison, an error propagates through
// operators, `IF` is lazy, `AND`/`OR` evaluate every argument, `ISBLANK` is
// true only for a reference to an empty cell and `ISNA` never propagates.
// Parity tests compare its result with `evaluateCalc` instead of trusting that
// the emitted text means what the emitter intended (invariant 4).
//
// Not a spreadsheet engine: anything outside the subset throws, so a new
// emitted construct fails loudly rather than evaluating by accident.

import { quantizeDecimal } from '@uwmd/verify';

export type XlError = { error: '#N/A' | '#DIV/0!' | '#VALUE!' | '#NUM!' };
export type XlValue = number | string | boolean | null | XlError;
/** A named cell's value: `null` is an empty cell. */
export type XlCells = Readonly<Record<string, number | string | boolean | null | XlError>>;

export function isXlError(value: unknown): value is XlError {
  return !!value && typeof value === 'object' && 'error' in value;
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|"((?:[^"]|"")*)"|([A-Za-z_][A-Za-z0-9_.]*)|(<>|<=|>=|[-+*/^&=<>(),]))/y;
  let pos = 0;
  while (pos < text.length) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m || m.index !== pos || m[0].length === 0) {
      if (text.slice(pos).trim() === '') break;
      throw new Error(`excel-formula: cannot tokenize at "${text.slice(pos, pos + 20)}"`);
    }
    if (m[1] !== undefined) tokens.push({ kind: 'num', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ kind: 'str', value: m[2].replace(/""/g, '"') });
    else if (m[3] !== undefined) tokens.push({ kind: 'name', value: m[3] });
    else tokens.push({ kind: 'op', value: m[4]! });
    pos = re.lastIndex;
  }
  return tokens;
}

type Node =
  | { kind: 'lit'; value: number | string | boolean }
  | { kind: 'ref'; name: string }
  | { kind: 'call'; name: string; args: Node[] }
  | { kind: 'neg'; operand: Node }
  | { kind: 'bin'; op: string; left: Node; right: Node };

function parse(text: string): Node {
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];
  const opAt = (): string | null => {
    const t = peek();
    return t?.kind === 'op' ? t.value : null;
  };
  const isOp = (value: string) => opAt() === value;
  const expect = (value: string) => {
    if (!isOp(value)) throw new Error(`excel-formula: expected "${value}" in ${text}`);
    i++;
  };
  const level = (ops: readonly string[], next: () => Node) => (): Node => {
    let left = next();
    for (let op = opAt(); op !== null && ops.includes(op); op = opAt()) {
      i++;
      left = { kind: 'bin', op, left, right: next() };
    }
    return left;
  };
  const atom = (): Node => {
    const t = tokens[i++];
    if (!t) throw new Error(`excel-formula: unexpected end of ${text}`);
    if (t.kind === 'num' || t.kind === 'str') return { kind: 'lit', value: t.value };
    if (t.kind === 'name') {
      if (isOp('(')) {
        i++;
        const args: Node[] = [];
        if (!isOp(')')) {
          for (;;) {
            args.push(comparison());
            if (!isOp(',')) break;
            i++;
          }
        }
        expect(')');
        return { kind: 'call', name: t.value.toUpperCase(), args };
      }
      if (t.value === 'TRUE' || t.value === 'FALSE') return { kind: 'lit', value: t.value === 'TRUE' };
      return { kind: 'ref', name: t.value };
    }
    if (t.value === '(') {
      const inner = comparison();
      expect(')');
      return inner;
    }
    if (t.value === '-') return { kind: 'neg', operand: atom() };
    if (t.value === '+') return atom();
    throw new Error(`excel-formula: unexpected "${t.value}" in ${text}`);
  };
  const power = level(['^'], atom);
  const product = level(['*', '/'], power);
  const sum = level(['+', '-'], product);
  const concat = level(['&'], sum);
  const comparison: () => Node = level(['=', '<>', '<', '<=', '>', '>='], concat);
  const root = comparison();
  if (i !== tokens.length) throw new Error(`excel-formula: trailing input in ${text}`);
  return root;
}

const NA: XlError = { error: '#N/A' };
const VALUE: XlError = { error: '#VALUE!' };

function toNumber(value: XlValue): number | XlError {
  if (isXlError(value)) return value;
  if (value === null) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return value.trim() !== '' && Number.isFinite(n) ? n : VALUE;
}

function toBoolean(value: XlValue): boolean | XlError {
  if (isXlError(value)) return value;
  if (value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return VALUE;
}

function finite(n: number): number | XlError {
  return Number.isFinite(n) ? n : { error: '#NUM!' };
}

// Excel orders numbers < text < logicals, compares text case-insensitively,
// and reads an empty cell as 0 against a number and as "" against text.
function compare(op: string, a: XlValue, b: XlValue): boolean | XlError {
  if (isXlError(a)) return a;
  if (isXlError(b)) return b;
  if (a === null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
  if (b === null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
  const rank = (v: number | string | boolean) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  const key = (v: number | string | boolean) => (typeof v === 'string' ? v.toLowerCase() : v);
  const c = rank(a) !== rank(b) ? rank(a) - rank(b) : key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  switch (op) {
    case '=': return c === 0;
    case '<>': return c !== 0;
    case '<': return c < 0;
    case '<=': return c <= 0;
    case '>': return c > 0;
    default: return c >= 0;
  }
}

function evalNode(node: Node, cells: XlCells): XlValue {
  switch (node.kind) {
    case 'lit':
      return node.value;
    case 'ref': {
      if (!Object.prototype.hasOwnProperty.call(cells, node.name)) {
        throw new Error(`excel-formula: no cell named ${node.name}`);
      }
      return cells[node.name] ?? null;
    }
    case 'neg': {
      const n = toNumber(evalNode(node.operand, cells));
      return isXlError(n) ? n : -n;
    }
    case 'bin': {
      const left = evalNode(node.left, cells);
      const right = evalNode(node.right, cells);
      if (['=', '<>', '<', '<=', '>', '>='].includes(node.op)) return compare(node.op, left, right);
      if (node.op === '&') throw new Error('excel-formula: & is outside the emitted subset');
      const a = toNumber(left);
      if (isXlError(a)) return a;
      const b = toNumber(right);
      if (isXlError(b)) return b;
      switch (node.op) {
        case '+': return finite(a + b);
        case '-': return finite(a - b);
        case '*': return finite(a * b);
        case '/': return b === 0 ? { error: '#DIV/0!' } : finite(a / b);
        default: throw new Error(`excel-formula: operator ${node.op} is outside the emitted subset`);
      }
    }
    case 'call':
      return call(node, cells);
  }
}

function call(node: Extract<Node, { kind: 'call' }>, cells: XlCells): XlValue {
  const { name, args } = node;
  const arg = (k: number) => evalNode(args[k]!, cells);
  const numbers = (): number[] | XlError => {
    const out: number[] = [];
    for (let k = 0; k < args.length; k++) {
      const v = arg(k);
      if (isXlError(v)) return v;
      // A referenced empty cell is skipped; a literal or computed value counts.
      if (v === null) continue;
      const n = toNumber(v);
      if (isXlError(n)) return n;
      out.push(n);
    }
    return out;
  };
  switch (name) {
    case 'IF': {
      const test = toBoolean(arg(0));
      if (isXlError(test)) return test;
      if (test) return args.length > 1 ? arg(1) : true;
      return args.length > 2 ? arg(2) : false;
    }
    case 'AND':
    case 'OR': {
      const values: boolean[] = [];
      for (let k = 0; k < args.length; k++) {
        const v = arg(k);
        if (v === null) continue;
        const b = toBoolean(v);
        if (isXlError(b)) return b;
        values.push(b);
      }
      if (values.length === 0) return VALUE;
      return name === 'AND' ? values.every(Boolean) : values.some(Boolean);
    }
    case 'NOT': {
      const b = toBoolean(arg(0));
      return isXlError(b) ? b : !b;
    }
    case 'ISBLANK':
      return args[0]!.kind === 'ref' && arg(0) === null;
    case 'ISNA': {
      const v = arg(0);
      return isXlError(v) && v.error === '#N/A';
    }
    case 'NA':
      return NA;
    case 'ROUND': {
      const x = toNumber(arg(0));
      if (isXlError(x)) return x;
      const d = toNumber(arg(1));
      if (isXlError(d)) return d;
      return quantizeDecimal(x, Math.trunc(d));
    }
    case 'SUM': {
      const ns = numbers();
      return isXlError(ns) ? ns : ns.reduce((acc, n) => acc + n, 0);
    }
    case 'MIN':
    case 'MAX': {
      const ns = numbers();
      if (isXlError(ns)) return ns;
      return ns.length === 0 ? 0 : name === 'MIN' ? Math.min(...ns) : Math.max(...ns);
    }
    case 'ABS': case 'SQRT': case 'LN': case 'EXP': {
      const x = toNumber(arg(0));
      if (isXlError(x)) return x;
      if (name === 'ABS') return Math.abs(x);
      if (name === 'SQRT') return x < 0 ? { error: '#NUM!' } : Math.sqrt(x);
      if (name === 'LN') return x <= 0 ? { error: '#NUM!' } : Math.log(x);
      return finite(Math.exp(x));
    }
    case 'POWER': {
      const a = toNumber(arg(0));
      if (isXlError(a)) return a;
      const b = toNumber(arg(1));
      if (isXlError(b)) return b;
      return finite(a ** b);
    }
    default:
      throw new Error(`excel-formula: function ${name} is outside the emitted subset`);
  }
}

/**
 * Evaluate an emitted formula (with or without the leading `=`) against named
 * cells. Every name the formula references must be present in `cells`.
 */
export function evaluateExcelFormula(formula: string, cells: XlCells): XlValue {
  return evalNode(parse(formula.replace(/^=/, '')), cells);
}
