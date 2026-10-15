// Pure argument/path plumbing for the uwmd CLI, extracted from cli.ts so it
// can carry a sibling unit test — cli.ts itself is a top-level script (it
// reads process.argv and runs at import time), which is why it never had one.
// Nothing here touches stdout, process.exit, or the filesystem except
// readManifestFile, which returns a result union instead of exiting.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { type DealStage, isConformanceTier, type ConformanceTier, STAGE_REQUIREMENTS, UWX_EXTENSION } from '@uwmd/verify';

/**
 * Parse `--flag`, `--flag value`, and `--flag=value` forms. A bare `--flag`
 * whose next token is another flag (or nothing) is boolean `true`; otherwise
 * it consumes the next token as its value. The `=` form never consumes the
 * next token.
 */
export function parseFlags(rawArgs: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eqIdx = body.indexOf('=');
      if (eqIdx >= 0) {
        flags[body.slice(0, eqIdx)] = body.slice(eqIdx + 1);
        continue;
      }
      const key = body;
      const next = rawArgs[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

/**
 * The non-flag tokens, excluding any token `parseFlags` consumed as a flag's
 * value. Mirrors `parseFlags`' consumption rule exactly: a `--flag=value`
 * token is self-contained and a boolean `--flag` consumes nothing, so in both
 * cases the following token stays positional. (An earlier inline version
 * skipped the next token after *any* `--` token, so
 * `uwmd parse --compact=true file.uwx.md` silently dropped the filename and
 * died with a usage error.)
 */
export function extractPositionals(rawArgs: string[]): string[] {
  const positional: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith('--')) {
      const consumesNext =
        !arg.includes('=') && !!rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--');
      if (consumesNext) i++;
      continue;
    }
    positional.push(arg);
  }
  return positional;
}

/**
 * Swap a UW-family extension for another, matching the longest known suffix
 * case-insensitively while preserving the original casing of the stem. A path
 * with no known suffix gets the extension appended.
 */
export function replaceUWExtension(file: string, extension: string): string {
  const lower = file.toLowerCase();
  for (const suffix of [UWX_EXTENSION, '.uw.csv.zip', '.uw.md', '.uw.json', '.uw.xml']) {
    if (lower.endsWith(suffix)) return `${file.slice(0, -suffix.length)}${extension}`;
  }
  return `${file}${extension}`;
}

/**
 * The modules commands' `--tier` flag as the host's conformance tier:
 * undefined when absent, null when it is not `reader` or `verifier`.
 */
export function hostConformanceFlag(
  flags: Record<string, string | boolean>,
): ConformanceTier | null | undefined {
  const tier = flags['tier'];
  if (tier === undefined) return undefined;
  return isConformanceTier(tier) ? tier : null;
}

/** Where fragments live for a record, unless told otherwise. */
export function defaultPartsDir(file: string): string {
  return resolve(dirname(resolve(file)), 'parts');
}

/** Read and parse a JSON manifest, returning a result union instead of exiting. */
export function readManifestFile(
  path: string,
): { ok: true; manifest: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, manifest: JSON.parse(readFileSync(resolve(path), 'utf-8')) as unknown };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The closed flag vocabulary of every `uwmd` command, keyed by command, or by
 * `command subcommand` where the command dispatches on its first positional.
 * `--version`, `-V` and `version` take no flags at all, so they are listed
 * with an empty set, like `diff` and `summary`.
 *
 * Through CLI 4.1.0 `parseFlags` kept every `--name[=value]` and each command
 * read only the flags it knew, so a misspelled or not-yet-supported flag was
 * silently ignored: `verify deal.uwx.md --document-signture=x --keystore=k`
 * exited 0 with "OK". For a verifier that is a hazard, so the router refuses
 * any flag outside the command's set before it reads a file (the house
 * pattern of closed vocabularies that refuse unknown values; the same
 * refusal `project-lease-up`, `assemble-property` and `verify-cash-flows`
 * already made for themselves). A flag listed here is one the command's code
 * reads; the usage strings in `cli.ts` are held to this table by
 * `cli-args.test.ts`.
 */
export const COMMAND_FLAGS: Readonly<Record<string, readonly string[]>> = {
  parse: ['compact', 'strict'],
  validate: ['institution', 'json', 'stage'],
  verify: ['validate', 'integrity', 'policy', 'signing', 'keystore', 'document-signature', 'resolved', 'parts', 'json'],
  'sign-document': ['key', 'out', 'signed-at'],
  compact: ['output', 'dry-run'],
  diff: [],
  render: ['format', 'profile', 'sections', 'max-tokens', 'no-meta', 'output', 'tier'],
  run: ['agent', 'section', 'context-only', 'prompt', 'live', 'api-key', 'model', 'instructions', 'json-input', 'output'],
  layers: [],
  edit: ['actor', 'source', 'agent-id', 'agent-version', 'confidence', 'output', 'capability-token', 'coord-key', 'json'],
  'project-lease-up': ['json'],
  'verify-reserve-draws': ['json'],
  'verify-reserve-accounts': ['json'],
  // Parses `args` itself and refuses under its typed JSON contract; listed
  // for the record, exempt from the router's gate (see `flagVocabulary`).
  'verify-cash-flows': ['variant', 'json'],
  'assemble-property': ['json'],
  'inspect-property-cash-flows': ['json'],
  calc: ['calc-context', 'json'],
  init: ['name', 'address', 'city', 'state', 'zip', 'asset-class', 'asset-subtype', 'stage', 'scenario', 'tier', 'output'],
  summary: [],
  export: ['output', 'no-superseded', 'compact', 'resolved', 'parts', 'stdout'],
  formats: ['json'],
  convert: ['to', 'projection-report', 'output', 'stdout'],
  report: ['tier', 'prepared-by', 'output', 'stdout'],
  // `scope` always writes JSON; `--json` is accepted so the read-only commands
  // share one spelling.
  scope: ['asset-class', 'market-data', 'output', 'json'],
  refine: ['targets', 'top', 'asset-class', 'market-data', 'calc-context', 'json'],
  compose: ['externalize', 'collection-key', 'collection-path', 'part-prefix', 'out-dir', 'parts', 'in-place', 'output', 'dry-run'],
  resolve: ['parts', 'output', 'json'],
  'market-data validate': ['json'],
  'lease validate': ['json'],
  'lease project': ['compact'],
  'package create': ['output'],
  'package verify': ['json'],
  'package list': ['json'],
  'package to-context': ['output', 'stdout', 'compact'],
  'package validate-context': ['json'],
  'package edges': [],
  'modules validate': ['tier', 'json'],
  'modules list': ['tier', 'json'],
  manifest: [],
  '--version': [],
  '-V': [],
  version: [],
  'portfolio validate': ['json'],
  'portfolio edges': ['entity', 'json'],
  'receipt issue': ['output', 'issued-at', 'stdout'],
  'receipt verify': ['json'],
};

/** Commands that parse `args` themselves under their own closed vocabulary. */
const SELF_PARSING_COMMANDS: ReadonlySet<string> = new Set(['verify-cash-flows']);

export interface FlagVocabulary {
  /** The command as the user names it, with its subcommand when it has one. */
  readonly command: string;
  readonly accepted: readonly string[];
}

/**
 * The vocabulary that governs an invocation: the `command subcommand` entry
 * when the first positional selects one, else the command's own. Undefined
 * for a command the table does not know (the router prints the help text or a
 * usage error for those) and for a self-parsing command.
 */
export function flagVocabulary(
  command: string | undefined,
  subcommand: string | undefined,
): FlagVocabulary | undefined {
  if (command === undefined || SELF_PARSING_COMMANDS.has(command)) return undefined;
  const keyed = subcommand === undefined ? undefined : `${command} ${subcommand}`;
  const key = keyed !== undefined && Object.hasOwn(COMMAND_FLAGS, keyed)
    ? keyed
    : Object.hasOwn(COMMAND_FLAGS, command) ? command : undefined;
  return key === undefined ? undefined : { command: key, accepted: COMMAND_FLAGS[key] };
}

/**
 * The refusal for flags outside a command's vocabulary, naming each unknown
 * flag and the command, or undefined when every flag given is accepted.
 */
export function unknownFlagMessage(
  vocabulary: FlagVocabulary,
  flags: Record<string, string | boolean>,
): string | undefined {
  const unknown = Object.keys(flags).filter((name) => !vocabulary.accepted.includes(name));
  if (unknown.length === 0) return undefined;
  const named = unknown.map((name) => `--${name}`).join(', ');
  const accepted = vocabulary.accepted.length === 0
    ? 'The command takes no flags.'
    : `Accepted flags: ${vocabulary.accepted.map((name) => `--${name}`).join(', ')}.`;
  return `uwmd ${vocabulary.command}: unknown flag${unknown.length > 1 ? 's' : ''} ${named}. ${accepted}`;
}

/**
 * Flags 4.x still accepts only because 4.2.0 offered them, and what to use
 * instead. Each is in `COMMAND_FLAGS` and prints a warning when given; none
 * is advertised in a usage string. Every other unknown or misspelled flag
 * stays refused (#328).
 *
 * - `validate --stage`: 4.2.0's usage string offered it and nothing read it.
 *   It now names one `deal_stage` whose readiness is reported. Readiness is
 *   workflow completeness, never a validation failure (Format §5.1), so the
 *   result and exit status do not change.
 * - `export --compact`: 4.2.0's undocumented alias of `--no-superseded`. It
 *   is not the `compact` command.
 * - `compose --parts`: 4.2.0's help offered it as the fragment directory,
 *   but `compose` read only `--out-dir` and wrote to `./parts`. It is now an
 *   alias of `--out-dir`.
 */
export const DEPRECATED_FLAGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  validate: {
    stage: 'it reports one stage\'s readiness and does not change the result or exit status; every stage\'s readiness is in the report (stage_readiness with --json).',
  },
  export: { compact: 'use --no-superseded, which it means.' },
  compose: { parts: 'use --out-dir, which it means.' },
};

/** One warning per deprecated flag given to `command`, in the order given. */
export function deprecatedFlagWarnings(command: string, flags: Record<string, string | boolean>): string[] {
  const table = Object.hasOwn(DEPRECATED_FLAGS, command) ? DEPRECATED_FLAGS[command] : undefined;
  if (table === undefined) return [];
  return Object.keys(flags)
    .filter((name) => Object.hasOwn(table, name))
    .map((name) => `uwmd ${command}: --${name} is deprecated and will be removed in a future major release; ${table[name]}`);
}

/** The seven `deal_stage` values (Format §2.2), in pipeline order. */
export const DEAL_STAGES = Object.keys(STAGE_REQUIREMENTS) as DealStage[];

/** `validate --stage`'s value checked against the `deal_stage` vocabulary. */
export function requestedStage(
  value: string | boolean,
): { ok: true; stage: DealStage } | { ok: false; message: string } {
  if (typeof value === 'string' && (DEAL_STAGES as string[]).includes(value)) return { ok: true, stage: value as DealStage };
  const given = typeof value === 'string' ? `'${value}' is not a deal_stage` : 'it needs a stage';
  return { ok: false, message: `uwmd validate: --stage ${given}. Use one of: ${DEAL_STAGES.join(', ')}.` };
}

/**
 * The fragment directory for `compose`: `--out-dir`, or its deprecated alias
 * `--parts`, or the record's `parts/` sibling. Two different directories are
 * refused rather than one silently winning.
 */
export function composeOutDir(
  file: string,
  flags: Record<string, string | boolean>,
): { ok: true; dir: string } | { ok: false; message: string } {
  const given: Array<[string, string | boolean]> = (['out-dir', 'parts'] as const)
    .filter((name) => flags[name] !== undefined)
    .map((name) => [name, flags[name] as string | boolean]);
  for (const [name, value] of given) {
    if (typeof value !== 'string' || value === '') return { ok: false, message: `uwmd compose: --${name} needs a directory.` };
  }
  const dirs = [...new Set(given.map(([, value]) => resolve(value as string)))];
  if (dirs.length > 1) {
    return { ok: false, message: `uwmd compose: --out-dir and --parts name different directories (${dirs.join(', ')}). Give only --out-dir.` };
  }
  return { ok: true, dir: dirs[0] ?? defaultPartsDir(file) };
}

/**
 * Why the optional `@uwmd/signing` peer could not be loaded for `usedBy` (the
 * flag or command the user ran). A package that is not installed and one that
 * is installed but fails to load need different repairs, so they read
 * differently; neither repeats Node's resolver message for a missing package.
 */
export function signingLoadFailureMessage(usedBy: string, error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  const missing = (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND')
    && message.includes("'@uwmd/signing'");
  return missing
    ? `${usedBy}: the optional @uwmd/signing package is not installed. Install it beside @uwmd/cli (npm i @uwmd/signing), or with npx: npx -p @uwmd/cli -p @uwmd/signing uwmd …`
    : `${usedBy}: could not load @uwmd/signing: ${message}`;
}
