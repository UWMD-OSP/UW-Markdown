// The standard/starter boundary inside @uwmd/core (RFC 0083, Phase 1).
//
// RFC 0083 §1 names the modules that make up the reference implementation of
// the standard: everything a party needs to read and verify a `.uw.md`. Phase 2
// moves exactly this set into `@uwmd/verify`, which must reach no starter
// module (editor, runner, cascade, defaults, display formatting, agents, the
// Excel emitter, ...). This test walks the static import graph of the set —
// `import`/`export ... from`, side-effect imports, dynamic `import()` and
// `import('...')` types — and fails if any edge leaves it.
//
// Adding a module to the standard side means adding it here; a module that
// cannot join without dragging a starter module along is a boundary decision
// for an RFC, not a list edit.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

/** RFC 0083 §1, as source paths relative to `src/`. */
const STANDARD_MODULES: readonly string[] = Object.freeze([
  // Reader
  'parser.ts', 'yaml-scalar.ts', 'types.ts', 'scenario.ts', 'metadata.ts', 'version.ts',
  'block-roles.ts', 'section-resolution.ts',
  // Validation
  'validator.ts', 'builtin-class-content.ts', 'builtin-class-validation.ts', 'asset-class.ts',
  'period-path.ts', 'periods.ts', 'period-validation.ts', 'lease-up-structure.ts',
  'replacement-funding-structure.ts', 'reserve-accounts-structure.ts', 'gaps-content.ts',
  // Stated-figure verifiers
  'cash-flow-series.ts', 'lease-up.ts', 'lease-up-cash-flows.ts', 'property-cash-flows.ts',
  'waterfall.ts', 'reserve-accounts.ts', 'reserve-draw-bindings.ts', 'replacement-funding.ts',
  'capital-stack.ts', 'property-cash-flow-inputs.ts',
  // Calculation
  'calc/index.ts', 'calc/parser.ts', 'calc/evaluator.ts', 'calc/builtins.ts', 'calc/errors.ts',
  'calc/quantize.ts', 'calc/day-count.ts', 'calc/dependencies.ts', 'calc/dated-flows.ts',
  'calc/stated-precision.ts',
  // Metric dictionary
  'metric-dictionary.ts', 'metric-verification.ts',
  // Receipts, integrity, modules
  'receipts.ts', 'integrity.ts', 'integrity-canonical.ts', 'module-signing.ts', 'modules.ts',
  'module-runtime.ts',
  // Builtin pack manifests (data; RFC 0083 decisions)
  'builtin-packs/index.ts', 'builtin-packs/data-center.ts', 'builtin-packs/hospitality.ts',
  'builtin-packs/industrial.ts', 'builtin-packs/land.ts', 'builtin-packs/manufactured-housing.ts',
  'builtin-packs/mixed-use.ts', 'builtin-packs/multifamily.ts', 'builtin-packs/office.ts',
  'builtin-packs/retail.ts', 'builtin-packs/self-storage.ts', 'builtin-packs/senior-housing.ts',
  'builtin-packs/student-housing.ts',
  // Profiles: representations, portfolio, sensitivity, stochastic, market data, read bindings
  'envelope.ts', 'codec.ts', 'codecs.ts', 'uwjson.ts', 'uwxml.ts', 'uwcsv.ts', 'zip-safety.ts',
  'lite.ts', 'lite-bridge.ts', 'source-representation.ts', 'composition.ts', 'negotiation.ts',
  'deal-package.ts', 'deal-package-context.ts', 'deal-package-zip.ts', 'lease-abstract.ts',
  'portfolio.ts', 'calc/sensitivity.ts', 'calc/stochastic.ts', 'calc/prng.ts', 'market-data.ts',
  'bindings.ts',
  // The normative part of the protocol surface
  'protocol.ts',
]);

const VENDOR_SDK = '@anthropic-ai/sdk';

/** Every module specifier a source file names, static, dynamic or in a type position. */
function moduleSpecifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteralLike(argument)) specifiers.push(argument.text);
      else specifiers.push('<non-literal dynamic import>');
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteralLike(node.argument.literal)) {
      specifiers.push(node.argument.literal.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteralLike(node.moduleReference.expression)) {
      specifiers.push(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

const toSrcPath = (file: string): string => relative(SRC, file).split(sep).join('/');

/** Walk relative imports from `roots`; return every module reached and one edge that reached it. */
function importClosure(roots: readonly string[]): Map<string, string | null> {
  const reached = new Map<string, string | null>(roots.map((root) => [root, null]));
  const queue = [...roots];
  while (queue.length > 0) {
    const from = queue.shift() as string;
    for (const specifier of moduleSpecifiers(resolve(SRC, from))) {
      if (!specifier.startsWith('.')) continue;
      const target = toSrcPath(resolve(SRC, dirname(from), specifier.replace(/\.js$/, '.ts')));
      if (!reached.has(target)) {
        reached.set(target, from);
        queue.push(target);
      }
    }
  }
  return reached;
}

describe('standard module closure (RFC 0083)', () => {
  it('lists only modules that exist, once each', () => {
    expect(new Set(STANDARD_MODULES).size).toBe(STANDARD_MODULES.length);
    for (const path of STANDARD_MODULES) expect(existsSync(resolve(SRC, path)), path).toBe(true);
  });

  it('never imports a module outside the standard set', () => {
    const standard = new Set(STANDARD_MODULES);
    const escapes = [...importClosure(STANDARD_MODULES)]
      .filter(([path]) => !standard.has(path))
      .map(([path, via]) => `${via} -> ${path}`);
    expect(escapes).toEqual([]);
  });

  it('never imports the vendor SDK, statically or dynamically', () => {
    for (const path of STANDARD_MODULES) {
      const vendor = moduleSpecifiers(resolve(SRC, path)).filter((s) => s === VENDOR_SDK || s.startsWith(`${VENDOR_SDK}/`));
      expect(vendor, path).toEqual([]);
    }
  });

  it('has only literal dynamic imports, so the walk is complete', () => {
    for (const path of STANDARD_MODULES) {
      expect(moduleSpecifiers(resolve(SRC, path)), path).not.toContain('<non-literal dynamic import>');
    }
  });

  // Negative controls: the walk sees the edges this PR cut, from their starter side.
  it('detects a starter edge (negative control)', () => {
    const fromStarter = importClosure(['calc-display.ts', 'bindings-edit.ts', 'packs/index.ts', 'cascade.ts']);
    for (const starter of ['format.ts', 'editor.ts', 'runner.ts', 'packs/excel-emit.ts', 'defaults.ts']) {
      expect(fromStarter.has(starter), starter).toBe(true);
      expect(STANDARD_MODULES).not.toContain(starter);
    }
  });

  it('parses every specifier form it relies on (negative control)', () => {
    expect(moduleSpecifiers(resolve(SRC, 'protocol.ts'))).toContain('./lease-up.js'); // import('...') type
    expect(moduleSpecifiers(resolve(SRC, 'gaps.ts'))).toContain('./gaps-content.js');
    expect(moduleSpecifiers(resolve(SRC, 'agents/providers/anthropic.ts'))).toContain(VENDOR_SDK); // dynamic import
  });
});
