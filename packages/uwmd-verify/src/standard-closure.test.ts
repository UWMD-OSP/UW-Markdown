// The standard/starter boundary: `@uwmd/verify` is closed (RFC 0083).
//
// RFC 0083 §1 names the modules that make up the reference implementation of
// the standard: everything a party needs to read and verify a `.uw.md`. Phase 1
// drew that line inside `@uwmd/core`; Phase 2 moved exactly this set here. This
// package must reach no starter module (editor, runner, cascade, defaults,
// display formatting, agents, the Excel emitter, ...), and none of those exist
// in it, so the line is now a package boundary: every source file here may
// import only another source file of this package, a package in
// EXTERNAL_ALLOWED (its runtime dependencies) or a single reviewed site in
// EXTERNAL_SITES. This test parses every source file — `import`/`export ...
// from`, side-effect imports, dynamic `import()` and `import('...')` types —
// and fails on any other edge, on a source file missing from the inventory
// below, and on an `@uwmd/*` dependency in package.json.
//
// Adding a module means adding it to STANDARD_MODULES; a module that cannot
// join without a starter module is a boundary decision for an RFC, not a list
// edit.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

/** RFC 0083 §1, as source paths relative to `src/`. The two entries are listed separately. */
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

/** The package entries: they re-export the standard modules and import nothing else. */
const ENTRIES: readonly string[] = Object.freeze(['index.ts', 'browser.ts']);

const VENDOR_SDK = '@anthropic-ai/sdk';

/** Packages any standard module may import: the representation codecs' runtime dependencies. */
const EXTERNAL_ALLOWED: ReadonlySet<string> = new Set(['fast-xml-parser', 'fflate']);

/**
 * Single reviewed sites, by file. `integrity.ts` `sha256BytesHex` loads
 * `node:crypto` by a dynamic import guarded by a runtime check for Node
 * (`process.versions.node`) and uses Web Crypto everywhere else, so the
 * browser entry never evaluates it. Any other `node:` import, static or
 * dynamic, fails.
 */
const EXTERNAL_SITES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'integrity.ts': Object.freeze(['node:crypto']),
});

/** The non-relative specifiers of a standard module that neither list allows. */
function externalViolations(path: string, specifiers: readonly string[]): string[] {
  return specifiers
    .filter((s) => !s.startsWith('.'))
    .filter((s) => !EXTERNAL_ALLOWED.has(s) && !(EXTERNAL_SITES[path] ?? []).includes(s))
    .map((s) => `${path} -> ${s}`);
}

/**
 * The relative specifiers of `path` that leave this package's `src/` or name no
 * source file in it. A deep path into another package (`../../uwmd-core/...`)
 * is the edge this catches.
 */
function relativeViolations(path: string, specifiers: readonly string[]): string[] {
  return specifiers
    .filter((s) => s.startsWith('.'))
    .filter((s) => {
      const target = toSrcPath(resolve(SRC, dirname(path), s.replace(/\.js$/, '.ts')));
      return target.startsWith('..') || !existsSync(resolve(SRC, target));
    })
    .map((s) => `${path} -> ${s}`);
}

/** Every non-test TypeScript source under `src/`, as a path relative to it. */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = resolve(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [toSrcPath(path)] : [];
  });
}

/** Every module specifier a source file names, static, dynamic or in a type position. */
function moduleSpecifiers(file: string): string[] {
  return specifiersIn(file, readFileSync(file, 'utf8'));
}

function specifiersIn(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
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
    } else if (ts.isCallExpression(node) && isRequireCallee(node.expression)) {
      // CommonJS loading inside ESM: `require('x')` and `require.resolve('x')`.
      // The specifier is checked like any import; a computed one fails closed.
      const [argument] = node.arguments;
      specifiers.push(argument && ts.isStringLiteralLike(argument) ? argument.text : '<non-literal require>');
    } else if (ts.isIdentifier(node) && node.text === 'createRequire') {
      // `createRequire` builds a loader for any path or package, so no specifier
      // it is later called with can be checked: the identifier itself is the edge.
      specifiers.push('<createRequire>');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

/** `require` or `require.resolve` as a call's callee. */
function isRequireCallee(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === 'require';
  return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
    && callee.expression.text === 'require' && callee.name.text === 'resolve';
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

const PACKAGE_JSON = JSON.parse(readFileSync(resolve(SRC, '../package.json'), 'utf8')) as Record<string, unknown>;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

describe('standard module closure (RFC 0083)', () => {
  it('lists only modules that exist, once each', () => {
    expect(new Set(STANDARD_MODULES).size).toBe(STANDARD_MODULES.length);
    for (const path of [...STANDARD_MODULES, ...ENTRIES]) expect(existsSync(resolve(SRC, path)), path).toBe(true);
  });

  it('is the whole package: every source file is a listed module or an entry', () => {
    const listed = new Set([...STANDARD_MODULES, ...ENTRIES]);
    expect(sourceFiles().filter((path) => !listed.has(path))).toEqual([]);
  });

  it('never imports a module outside the standard set', () => {
    const standard = new Set(STANDARD_MODULES);
    const escapes = [...importClosure([...STANDARD_MODULES, ...ENTRIES])]
      .filter(([path]) => !standard.has(path) && !ENTRIES.includes(path))
      .map(([path, via]) => `${via} -> ${path}`);
    expect(escapes).toEqual([]);
  });

  it('imports only its own source files through relative paths', () => {
    const violations = sourceFiles().flatMap((path) => relativeViolations(path, moduleSpecifiers(resolve(SRC, path))));
    expect(violations).toEqual([]);
  });

  it('imports no package or node: builtin outside the allow-lists', () => {
    const violations = sourceFiles().flatMap((path) => externalViolations(path, moduleSpecifiers(resolve(SRC, path))));
    expect(violations).toEqual([]);
    // Each reviewed site is still present; a stale entry would widen the list silently.
    for (const [path, allowed] of Object.entries(EXTERNAL_SITES)) {
      for (const specifier of allowed) expect(moduleSpecifiers(resolve(SRC, path)), path).toContain(specifier);
    }
  });

  it('refuses a new node: or package import (negative control)', () => {
    const evaluator = readFileSync(resolve(SRC, 'calc/evaluator.ts'), 'utf8');
    const planted = `import { readFileSync } from 'node:fs';\n${evaluator}`;
    expect(externalViolations('calc/evaluator.ts', specifiersIn('calc/evaluator.ts', planted)))
      .toEqual(['calc/evaluator.ts -> node:fs']);
    expect(externalViolations('calc/evaluator.ts', specifiersIn('calc/evaluator.ts', `const m = await import('node:crypto');`)))
      .toEqual(['calc/evaluator.ts -> node:crypto']);
    expect(externalViolations('receipts.ts', ['lodash', 'fflate'])).toEqual(['receipts.ts -> lodash']);
    expect(externalViolations('integrity.ts', ['node:crypto', 'node:fs'])).toEqual(['integrity.ts -> node:fs']);
    // Any other package, including the starter toolkit itself.
    expect(externalViolations('receipts.ts', ['@uwmd/core', '@uwmd/core/browser']))
      .toEqual(['receipts.ts -> @uwmd/core', 'receipts.ts -> @uwmd/core/browser']);
  });

  it('refuses require() and createRequire reaching outside the package (negative control)', () => {
    // CommonJS loading is invisible to an import-only walk, so each form is an edge.
    const required = specifiersIn('receipts.ts', [
      `const fs = require('node:fs');`,
      `const lodash = require('lodash');`,
      `const where = require.resolve('@uwmd/core');`,
      `const core = require('../../uwmd-core/src/editor.js');`,
      `const own = require('./parser.js');`,
      'const dynamic = require(name);',
    ].join('\n'));
    expect(required).toEqual([
      'node:fs', 'lodash', '@uwmd/core', '../../uwmd-core/src/editor.js', './parser.js', '<non-literal require>',
    ]);
    expect(externalViolations('receipts.ts', required)).toEqual([
      'receipts.ts -> node:fs', 'receipts.ts -> lodash', 'receipts.ts -> @uwmd/core', 'receipts.ts -> <non-literal require>',
    ]);
    expect(relativeViolations('receipts.ts', required)).toEqual(['receipts.ts -> ../../uwmd-core/src/editor.js']);
    // createRequire is an edge however it is reached, even without a node:module import.
    const viaBuiltin = `const { createRequire } = process.getBuiltinModule('module');\nconst load = createRequire(import.meta.url);\nload('lodash');`;
    expect(externalViolations('receipts.ts', specifiersIn('receipts.ts', viaBuiltin)))
      .toEqual(['receipts.ts -> <createRequire>', 'receipts.ts -> <createRequire>']);
    expect(externalViolations('receipts.ts', specifiersIn('receipts.ts', `import { createRequire } from 'node:module';`)))
      .toEqual(['receipts.ts -> node:module', 'receipts.ts -> <createRequire>']);
    // A property or method that is merely named `require` is not a loader.
    expect(specifiersIn('x.ts', `const rule = { require: true }; policy.require('x');`)).toEqual([]);
  });

  it('refuses a relative path out of the package or to a missing module (negative control)', () => {
    const planted = `import { applyEdit } from '../../uwmd-core/src/editor.js';\nexport type { T } from './no-such-module.js';\nimport { parseUWFile } from './parser.js';`;
    expect(relativeViolations('bindings.ts', specifiersIn('bindings.ts', planted))).toEqual([
      'bindings.ts -> ../../uwmd-core/src/editor.js',
      'bindings.ts -> ./no-such-module.js',
    ]);
    expect(relativeViolations('calc/index.ts', ['../format.js', '../parser.js'])).toEqual(['calc/index.ts -> ../format.js']);
  });

  it('never imports the vendor SDK, statically or dynamically', () => {
    for (const path of sourceFiles()) {
      const vendor = moduleSpecifiers(resolve(SRC, path)).filter((s) => s === VENDOR_SDK || s.startsWith(`${VENDOR_SDK}/`));
      expect(vendor, path).toEqual([]);
    }
  });

  it('has only literal dynamic imports, so the walk is complete', () => {
    for (const path of sourceFiles()) {
      expect(moduleSpecifiers(resolve(SRC, path)), path).not.toContain('<non-literal dynamic import>');
    }
  });

  it('parses every specifier form it relies on (negative control)', () => {
    expect(moduleSpecifiers(resolve(SRC, 'protocol.ts'))).toContain('./lease-up.js'); // import('...') type
    expect(moduleSpecifiers(resolve(SRC, 'integrity.ts'))).toContain('node:crypto'); // dynamic import
    expect(moduleSpecifiers(resolve(SRC, 'browser.ts'))).toEqual(['./index.js']); // export * from
    expect(specifiersIn('x.ts', `const sdk = await import('${VENDOR_SDK}');`)).toEqual([VENDOR_SDK]);
    expect(specifiersIn('x.ts', `import '${VENDOR_SDK}/shims';`)).toEqual([`${VENDOR_SDK}/shims`]);
  });

  it('declares no @uwmd/* dependency in package.json', () => {
    // The package is the bottom of the graph: `@uwmd/core` depends on it at an
    // exact version, never the reverse.
    for (const field of DEPENDENCY_FIELDS) {
      const names = Object.keys((PACKAGE_JSON[field] ?? {}) as Record<string, string>);
      expect(names.filter((name) => name.startsWith('@uwmd/')), field).toEqual([]);
    }
  });

  it('declares exactly the allowed packages as runtime dependencies and no peers', () => {
    expect(Object.keys((PACKAGE_JSON.dependencies ?? {}) as Record<string, string>).sort()).toEqual([...EXTERNAL_ALLOWED].sort());
    expect(PACKAGE_JSON.peerDependencies).toBeUndefined();
    expect(PACKAGE_JSON.optionalDependencies).toBeUndefined();
  });
});
