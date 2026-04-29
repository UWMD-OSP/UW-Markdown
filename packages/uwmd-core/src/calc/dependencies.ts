// Dependency graph extraction for calc formulas.
// Spec: UW_PROTOCOL_v1.md §X.4 (refinement engine inputs)
//
// Walks the AST of every calc formula and emits the set of input field paths
// it reads. Used by refinement.ts to compute value-of-information rankings:
// which gap, if filled, would tighten the most outputs?
//
// Descriptive, not prescriptive: a formula that references a non-existent
// path is still recorded — the graph reflects what the formula says, not
// what the file currently has.

import type { Expr } from './parser.js';
import { parseExpression } from './parser.js';
import type { ParsedUWFile } from '../types.js';
import type { ModuleManifest, ModuleCalcDecl } from '../protocol.js';

export interface DependencyGraph {
  /** calc id → set of input field paths it reads */
  outputs: Map<string, Set<string>>;
  /** input field path → set of calc ids that read it */
  inputs: Map<string, Set<string>>;
  /** calc id → original formula string */
  formulas: Map<string, string>;
}

/**
 * Walk an Expr AST and return the unique set of `path` and `ident`
 * references — every "leaf" the formula reads. Identifiers are
 * returned as-is (e.g. `purchase_price`); paths are joined with dots
 * (e.g. `noi_model.net_operating_income`).
 */
export function getExprDependencies(expr: Expr): string[] {
  const out = new Set<string>();
  walk(expr, out);
  return [...out];
}

function walk(expr: Expr, acc: Set<string>): void {
  switch (expr.kind) {
    case 'literal':
      return;
    case 'ident':
      acc.add(expr.name);
      return;
    case 'path':
      acc.add([expr.head, ...expr.segments].join('.'));
      return;
    case 'call':
      // Function name is not a dependency; arguments are.
      for (const a of expr.args) walk(a, acc);
      return;
    case 'unary':
      walk(expr.operand, acc);
      return;
    case 'binary':
      walk(expr.left, acc);
      walk(expr.right, acc);
      return;
    case 'cond':
      walk(expr.test, acc);
      walk(expr.consequent, acc);
      walk(expr.else, acc);
      return;
  }
}

export interface ExtractDependencyGraphOptions {
  /** Calc packs to include. Default: caller passes [MULTIFAMILY_PACK] explicitly. */
  packs?: ModuleManifest[];
  /** Whether to include `parsed.custom_calculations[]`. Default: true. */
  includeCustomCalculations?: boolean;
}

/**
 * Build the full dependency graph for a parsed file: every calc declared in
 * the supplied packs plus every entry in `parsed.custom_calculations` that
 * carries a `formula` string.
 *
 * Invalid formulas are skipped silently — the graph is descriptive, not
 * prescriptive. Callers that want strict failure should pre-validate.
 */
export function extractDependencyGraph(
  parsed: ParsedUWFile,
  options: ExtractDependencyGraphOptions = {},
): DependencyGraph {
  const outputs = new Map<string, Set<string>>();
  const inputs = new Map<string, Set<string>>();
  const formulas = new Map<string, string>();

  const decls: ModuleCalcDecl[] = [];
  for (const pack of options.packs ?? []) {
    for (const c of pack.calculations ?? []) decls.push(c);
  }
  if (options.includeCustomCalculations !== false) {
    for (const block of parsed.custom_calculations) {
      const content = block.content as Record<string, unknown>;
      const id = (content.id ?? content.calc_id) as string | undefined;
      const formula = content.formula as string | undefined;
      if (typeof id === 'string' && typeof formula === 'string') {
        decls.push({ id, label: id, formula, deterministic: true });
      }
    }
  }

  for (const decl of decls) {
    let deps: string[];
    try {
      const ast = parseExpression(decl.formula);
      deps = getExprDependencies(ast);
    } catch {
      // Bad formula — skip; refinement engine will note it via diagnostics.
      continue;
    }
    formulas.set(decl.id, decl.formula);
    const set = outputs.get(decl.id) ?? new Set<string>();
    for (const d of deps) {
      set.add(d);
      const rev = inputs.get(d) ?? new Set<string>();
      rev.add(decl.id);
      inputs.set(d, rev);
    }
    outputs.set(decl.id, set);
  }

  return { outputs, inputs, formulas };
}
