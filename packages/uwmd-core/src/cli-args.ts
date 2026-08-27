// Pure argument/path plumbing for the uwmd CLI, extracted from cli.ts so it
// can carry a sibling unit test — cli.ts itself is a top-level script (it
// reads process.argv and runs at import time), which is why it never had one.
// Nothing here touches stdout, process.exit, or the filesystem except
// readManifestFile, which returns a result union instead of exiting.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { ViewerTier } from './protocol.js';
import { UWX_EXTENSION } from './source-representation.js';

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

/** The `--tier` flag as a ViewerTier, or undefined for absent/boolean forms. */
export function hostTierFlag(flags: Record<string, string | boolean>): ViewerTier | undefined {
  const tier = flags['tier'];
  return typeof tier === 'string' ? (tier as ViewerTier) : undefined;
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
