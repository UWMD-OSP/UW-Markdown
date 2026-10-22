// Current @uwmd/core -> @uwmd/verify runtime/declaration binding contract.
// The owner's2026-10-17 rule retires the frozen4.0.x superset requirement.
// Current verify exports and the three intentional wrapper bindings remain checked.

import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as verifyBrowser from '@uwmd/verify/browser';
import * as verifyIndex from '@uwmd/verify';
import * as coreBrowser from './browser.js';
import * as coreIndex from './index.js';

/** Core's own wrappers, which shadow verify's export of the same name. */
const OVERRIDES = ['evaluateCalc', 'evaluateModuleCalculations', 'issueReceipt'];

const COMPILER_OPTIONS: ts.CompilerOptions = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2022,
  skipLibCheck: true,
  noEmit: true,
};

/**
 * Declaration exports of a module as `name:value|type`. Memoized per file: each
 * call builds a whole TypeScript program, and several tests read one entry.
 */
const declarationCache = new Map<string, string[]>();
function declarations(file: string): string[] {
  const cached = declarationCache.get(file);
  if (cached) return cached;
  const result = computeDeclarations(file);
  declarationCache.set(file, result);
  return result;
}

function computeDeclarations(file: string): string[] {
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

// The toolkit hosts no agents (the execution half of the Bancroft removal).
// These names left both entries on purpose; the layer registry, its context and
// prompt builders, and the generic writers stay until RFC 0112 decides them.
const REMOVED_RUNTIME = [
  'runBancroftAgent',
  'runBancroftAgentStreaming',
  'WRITE_UW_SECTION_TOOL',
  'WRITE_MULTIPLE_SECTIONS_TOOL',
  'MULTI_SECTION_LAYERS',
  'AgentProviderError',
  'createAnthropicProvider',
  'createReplayProvider',
  'createRecordingProvider',
  'parseAgentCassette',
  'agentRequestFingerprint',
  'CASSETTE_VERSION',
];
const REMOVED_TYPES = [
  'BancroftRunOptions',
  'BancroftRunResult',
  'ProgressEvent',
  'ToolOutput',
  'AgentProvider',
  'AgentRequest',
  'AgentCompletion',
  'AgentToolCall',
  'AgentToolSchema',
  'AgentMessage',
  'AnthropicProviderOptions',
  'AgentCassette',
  'RecordedExchange',
  'RecordingProvider',
  'AgentHostCapability',
];
const RETAINED_RUNTIME = {
  index: ['writeAgentBlock', 'writeErrorEntry', 'buildMeta', 'buildContext', 'buildAgentContext', 'buildAgentPrompt', 'isContextReady', 'getLayerDependencies', 'BANCROFT_LAYERS'],
  browser: ['writeAgentBlock', 'writeErrorEntry', 'buildMeta', 'buildAgentContext', 'buildAgentPrompt', 'isContextReady', 'getLayerDependencies', 'BANCROFT_LAYERS'],
} as const;
const RETAINED_TYPES = {
  index: ['AgentOutput', 'RunOptions', 'RunResult', 'ContextProfile', 'BuildContextOptions', 'ContextResult', 'AgentContext', 'BancroftPrompt', 'LayerDefinition'],
  browser: ['AgentOutput', 'RunOptions', 'RunResult', 'AgentContext', 'BancroftPrompt', 'LayerDefinition'],
} as const;

describe.each(ENTRIES)('@uwmd/core $name entry without agent execution', ({ name, core, file }) => {
  const names = (list: readonly string[]) => list.map((n) => n.split(':')[0]);

  it('exports none of the removed execution runtime names', () => {
    expect(REMOVED_RUNTIME.filter((n) => n in core)).toEqual([]);
  });

  it('declares none of the removed execution names, value or type', () => {
    const declared = new Set(names(declarations(file)));
    expect([...REMOVED_RUNTIME, ...REMOVED_TYPES].filter((n) => declared.has(n))).toEqual([]);
  }, 60_000);

  it('keeps the generic writers, the context builders and the layer registry', () => {
    expect(missing(RETAINED_RUNTIME[name], Object.keys(core))).toEqual([]);
    const declared = names(declarations(file));
    expect(missing(RETAINED_TYPES[name], declared)).toEqual([]);
  }, 60_000);
});

describe('@uwmd/core entries', () => {
  it('export the same wrappers from both entries', () => {
    for (const key of OVERRIDES) {
      expect((coreBrowser as Record<string, unknown>)[key], key).toBe((coreIndex as Record<string, unknown>)[key]);
    }
  });

  it('detect missing runtime/type names in current export coverage (negative control)', () => {
    // Current re-export coverage must detect an omitted runtime/type binding.
    expect(missing(['parseUWFile', 'noSuchExport'], Object.keys(coreIndex))).toEqual(['noSuchExport']);
    expect(missing(['UWBlock:type', 'UWBlock:value'], declarations(ENTRIES[0].file))).toEqual(['UWBlock:value']);
  }, 60_000);
});
