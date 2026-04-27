// Tier-3 Calc Host — recursive-descent parser for the safe-expression
// grammar in UW_PROTOCOL_v1.md §VIII.1. Produces an AST that evaluator.ts
// walks. Any input that does not parse against the grammar is rejected
// with CALC-PARSE-001.

import { CalcError } from './errors.js';

// ─── AST ──────────────────────────────────────────────────────────────────────

export type Expr =
  | { kind: 'literal'; value: number | string | boolean | null }
  | { kind: 'ident'; name: string }
  | { kind: 'path'; head: string; segments: string[] }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'unary'; op: '-' | '!'; operand: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'cond'; test: Expr; consequent: Expr; else: Expr };

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '<=' | '>' | '>=';

// ─── Tokens ───────────────────────────────────────────────────────────────────

type TokenKind =
  | 'number' | 'string' | 'ident' | 'bool' | 'null'
  | 'lparen' | 'rparen' | 'lbracket' | 'rbracket'
  | 'comma' | 'dot' | 'qmark' | 'colon'
  | 'plus' | 'minus' | 'star' | 'slash' | 'percent'
  | 'bang'
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'eof';

interface Token {
  kind: TokenKind;
  value: string;
  pos: number;
}

const _KEYWORDS = new Set(['true', 'false', 'null']);
// Maximum input length — guards against accidental enormous inputs.
const MAX_INPUT_LEN = 4096;

function tokenize(input: string): Token[] {
  if (input.length > MAX_INPUT_LEN) {
    throw new CalcError('CALC-LIMIT-001', `Expression exceeds ${MAX_INPUT_LEN} characters.`);
  }

  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    if (c >= '0' && c <= '9') {
      const start = i;
      while (i < input.length && input[i]! >= '0' && input[i]! <= '9') i++;
      if (input[i] === '.' && input[i + 1] && input[i + 1]! >= '0' && input[i + 1]! <= '9') {
        i++;
        while (i < input.length && input[i]! >= '0' && input[i]! <= '9') i++;
      }
      out.push({ kind: 'number', value: input.slice(start, i), pos: start });
      continue;
    }

    if (c === "'") {
      const start = i;
      i++;
      const sb: string[] = [];
      while (i < input.length && input[i] !== "'") {
        sb.push(input[i]!);
        i++;
      }
      if (input[i] !== "'") {
        throw new CalcError('CALC-PARSE-001', `Unterminated string starting at position ${start}.`);
      }
      i++;
      out.push({ kind: 'string', value: sb.join(''), pos: start });
      continue;
    }

    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_') {
      const start = i;
      while (i < input.length) {
        const k = input[i]!;
        if ((k >= 'A' && k <= 'Z') || (k >= 'a' && k <= 'z') || (k >= '0' && k <= '9') || k === '_') i++;
        else break;
      }
      const text = input.slice(start, i);
      if (text === 'true' || text === 'false') out.push({ kind: 'bool', value: text, pos: start });
      else if (text === 'null') out.push({ kind: 'null', value: text, pos: start });
      else out.push({ kind: 'ident', value: text, pos: start });
      continue;
    }

    // Two-char operators first.
    const two = input.slice(i, i + 2);
    if (two === '==') { out.push({ kind: 'eq', value: two, pos: i }); i += 2; continue; }
    if (two === '!=') { out.push({ kind: 'neq', value: two, pos: i }); i += 2; continue; }
    if (two === '<=') { out.push({ kind: 'lte', value: two, pos: i }); i += 2; continue; }
    if (two === '>=') { out.push({ kind: 'gte', value: two, pos: i }); i += 2; continue; }

    switch (c) {
      case '(': out.push({ kind: 'lparen', value: c, pos: i }); i++; continue;
      case ')': out.push({ kind: 'rparen', value: c, pos: i }); i++; continue;
      case '[': out.push({ kind: 'lbracket', value: c, pos: i }); i++; continue;
      case ']': out.push({ kind: 'rbracket', value: c, pos: i }); i++; continue;
      case ',': out.push({ kind: 'comma', value: c, pos: i }); i++; continue;
      case '.': out.push({ kind: 'dot', value: c, pos: i }); i++; continue;
      case '?': out.push({ kind: 'qmark', value: c, pos: i }); i++; continue;
      case ':': out.push({ kind: 'colon', value: c, pos: i }); i++; continue;
      case '+': out.push({ kind: 'plus', value: c, pos: i }); i++; continue;
      case '-': out.push({ kind: 'minus', value: c, pos: i }); i++; continue;
      case '*': out.push({ kind: 'star', value: c, pos: i }); i++; continue;
      case '/': out.push({ kind: 'slash', value: c, pos: i }); i++; continue;
      case '%': out.push({ kind: 'percent', value: c, pos: i }); i++; continue;
      case '!': out.push({ kind: 'bang', value: c, pos: i }); i++; continue;
      case '<': out.push({ kind: 'lt', value: c, pos: i }); i++; continue;
      case '>': out.push({ kind: 'gt', value: c, pos: i }); i++; continue;
    }

    throw new CalcError('CALC-PARSE-001', `Unexpected character '${c}' at position ${i}.`);
  }
  out.push({ kind: 'eof', value: '', pos: input.length });
  return out;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Expr {
    const expr = this.parseExpr();
    this.expect('eof', 'Expected end of expression');
    return expr;
  }

  private peek(): Token { return this.tokens[this.pos]!; }
  private advance(): Token { return this.tokens[this.pos++]!; }
  private match(...kinds: TokenKind[]): boolean {
    return kinds.includes(this.peek().kind);
  }
  private expect(kind: TokenKind, msg: string): Token {
    const tok = this.peek();
    if (tok.kind !== kind) {
      throw new CalcError('CALC-PARSE-001', `${msg} (got '${tok.value || tok.kind}' at ${tok.pos}).`);
    }
    return this.advance();
  }

  // expr := conditional
  private parseExpr(): Expr {
    return this.parseConditional();
  }

  // conditional := comparison ( "?" expr ":" expr )?
  private parseConditional(): Expr {
    const test = this.parseComparison();
    if (this.match('qmark')) {
      this.advance();
      const consequent = this.parseExpr();
      this.expect('colon', "Expected ':' in ternary");
      const alternate = this.parseExpr();
      return { kind: 'cond', test, consequent, else: alternate };
    }
    return test;
  }

  // comparison := additive ( ( "==" | "!=" | "<=" | ">=" | "<" | ">" ) additive )?
  private parseComparison(): Expr {
    const left = this.parseAdditive();
    const tok = this.peek();
    let op: BinaryOp | null = null;
    switch (tok.kind) {
      case 'eq': op = '=='; break;
      case 'neq': op = '!='; break;
      case 'lte': op = '<='; break;
      case 'gte': op = '>='; break;
      case 'lt': op = '<'; break;
      case 'gt': op = '>'; break;
    }
    if (op !== null) {
      this.advance();
      const right = this.parseAdditive();
      return { kind: 'binary', op, left, right };
    }
    return left;
  }

  // additive := multiplicative ( ("+" | "-") multiplicative )*
  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.match('plus', 'minus')) {
      const op: BinaryOp = this.advance().kind === 'plus' ? '+' : '-';
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  // multiplicative := unary ( ("*" | "/" | "%") unary )*
  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.match('star', 'slash', 'percent')) {
      const t = this.advance().kind;
      const op: BinaryOp = t === 'star' ? '*' : t === 'slash' ? '/' : '%';
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  // unary := ( "-" | "!" )? primary
  private parseUnary(): Expr {
    if (this.match('minus')) { this.advance(); return { kind: 'unary', op: '-', operand: this.parsePrimary() }; }
    if (this.match('bang'))  { this.advance(); return { kind: 'unary', op: '!', operand: this.parsePrimary() }; }
    return this.parsePrimary();
  }

  // primary := literal | identifier | call | path | "(" expr ")"
  private parsePrimary(): Expr {
    const tok = this.peek();

    if (tok.kind === 'number') {
      this.advance();
      return { kind: 'literal', value: Number.parseFloat(tok.value) };
    }
    if (tok.kind === 'string') {
      this.advance();
      return { kind: 'literal', value: tok.value };
    }
    if (tok.kind === 'bool') {
      this.advance();
      return { kind: 'literal', value: tok.value === 'true' };
    }
    if (tok.kind === 'null') {
      this.advance();
      return { kind: 'literal', value: null };
    }
    if (tok.kind === 'lparen') {
      this.advance();
      const inner = this.parseExpr();
      this.expect('rparen', "Expected ')'");
      return inner;
    }
    if (tok.kind === 'ident') {
      this.advance();
      // Function call?
      if (this.match('lparen')) {
        this.advance();
        const args: Expr[] = [];
        if (!this.match('rparen')) {
          args.push(this.parseExpr());
          while (this.match('comma')) {
            this.advance();
            args.push(this.parseExpr());
          }
        }
        this.expect('rparen', "Expected ')' to close call");
        return { kind: 'call', name: tok.value, args };
      }
      // Member chain (dot or bracket-string)?
      const segments: string[] = [];
      while (this.match('dot', 'lbracket')) {
        if (this.match('dot')) {
          this.advance();
          const idTok = this.expect('ident', 'Expected identifier after .');
          segments.push(idTok.value);
        } else {
          this.advance();
          const strTok = this.expect('string', "Expected string inside [ ]");
          this.expect('rbracket', "Expected ']'");
          segments.push(strTok.value);
        }
      }
      if (segments.length > 0) return { kind: 'path', head: tok.value, segments };
      return { kind: 'ident', name: tok.value };
    }

    throw new CalcError(
      'CALC-PARSE-001',
      `Unexpected token '${tok.value || tok.kind}' at position ${tok.pos}.`,
    );
  }
}

export function parseExpression(input: string): Expr {
  const tokens = tokenize(input);
  return new Parser(tokens).parse();
}
