// The public surface of @uwmd/core across the @uwmd/verify split (RFC 0083 §3).
//
// Core re-exports verify's whole surface and adds the starter products, so no
// existing import of `@uwmd/core` or `@uwmd/core/browser` breaks. Two checks:
//
//   1. Superset of 4.0.x. Every runtime name and every declaration export
//      (as name:value|type) that core's two entries had at 96b86155 — 4.0.1
//      plus Phase 1 — is still there, with the same kind
//      (`fixtures/public-surface-4.0.json`, captured from that build).
//   2. Verify is fully re-exported. Every `@uwmd/verify` export is a core
//      export, from both entries, and is the same binding — except the three
//      names core deliberately overrides with its own wrappers.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as verifyBrowser from '@uwmd/verify/browser';
import * as verifyIndex from '@uwmd/verify';
import * as coreBrowser from './browser.js';
import * as coreIndex from './index.js';

interface Surface {
  runtime: string[];
  declarations: string[];
}
const BASELINE = JSON.parse(
  readFileSync(new URL('./fixtures/public-surface-4.0.json', import.meta.url), 'utf8'),
) as { index: Surface; browser: Surface };

/** Core's own wrappers, which shadow verify's export of the same name. */
const OVERRIDES = ['evaluateCalc', 'evaluateModuleCalculations', 'issueReceipt'];

const COMPILER_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
  skipLibCheck: true,
  noEmit: true,
};

/** Declaration exports of a module as `name:value|type`, as the fixture records them. */
function declarations(file: string): string[] {
  const program = ts.createProgram([file], COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  if (!source) throw new Error(`no source file ${file}`);
  const symbol = checker.getSymbolAtLocation(source);
  if (!symbol) throw new Error(`${file} is not a module`);
  return checker.getExportsOfModule(symbol).map((s) => {
    const target = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
    const kind = [];
    if (target.flags & ts.SymbolFlags.Value) kind.push('value');
    if (target.flags & ts.SymbolFlags.Type) kind.push('type');
    return `${s.name}:${kind.join('|')}`;
  }).sort();
}

const missing = (expected: readonly string[], actual: readonly string[]): string[] => {
  const have = new Set(actual);
  return expected.filter((name) => !have.has(name));
};

const ENTRIES = [
  { name: 'index', core: coreIndex, verify: verifyIndex, file: fileURLToPath(new URL('./index.ts', import.meta.url)) },
  { name: 'browser', core: coreBrowser, verify: verifyBrowser, file: fileURLToPath(new URL('./browser.ts', import.meta.url)) },
] as const;

describe.each(ENTRIES)('@uwmd/core $name entry', ({ name, core, verify, file }) => {
  const coreExports = core as Record<string, unknown>;
  const verifyExports = verify as Record<string, unknown>;

  it('keeps every 4.0.x runtime export (superset)', () => {
    expect(missing(BASELINE[name].runtime, Object.keys(core))).toEqual([]);
  });

  it('keeps every 4.0.x declaration export, with the same kind (superset)', () => {
    expect(missing(BASELINE[name].declarations, declarations(file))).toEqual([]);
  }, 60_000);

  it('re-exports every @uwmd/verify runtime export', () => {
    expect(missing(Object.keys(verify), Object.keys(core))).toEqual([]);
  });

  it('re-exports every @uwmd/verify declaration export', () => {
    // Resolve the specifier as core's own source does, to verify's declarations.
    const specifier = name === 'index' ? '@uwmd/verify' : '@uwmd/verify/browser';
    const verifyFile = ts.resolveModuleName(specifier, file, COMPILER_OPTIONS, ts.sys).resolvedModule?.resolvedFileName;
    expect(verifyFile, specifier).toMatch(/\.d\.ts$/);
    expect(missing(declarations(verifyFile as string), declarations(file))).toEqual([]);
  }, 60_000);

  it("re-exports verify's bindings, overriding exactly the three wrapped names", () => {
    const overridden = Object.keys(verify).filter((key) => coreExports[key] !== verifyExports[key]);
    expect(overridden.sort()).toEqual([...OVERRIDES].sort());
    for (const key of OVERRIDES) expect(typeof coreExports[key], key).toBe('function');
  });
});

describe('@uwmd/core entries', () => {
  it('export the same wrappers from both entries', () => {
    for (const key of OVERRIDES) {
      expect((coreBrowser as Record<string, unknown>)[key], key).toBe((coreIndex as Record<string, unknown>)[key]);
    }
  });

  it('add only names, never drop one, relative to the baseline (negative control)', () => {
    // The comparison itself must fail on a dropped name.
    expect(missing(['parseUWFile', 'noSuchExport'], Object.keys(coreIndex))).toEqual(['noSuchExport']);
    expect(missing(['UWBlock:type', 'UWBlock:value'], declarations(ENTRIES[0].file))).toEqual(['UWBlock:value']);
  }, 60_000);
});
