// Historical tier names below are intentionally refused negative inputs.
// cli-args.ts — the uwmd CLI's argument/path plumbing. Extracted from cli.ts
// (a top-level script that runs at import time, so it cannot carry a sibling
// unit test itself; its command surface is covered by the @uwmd/cli smoke
// tests). The extractPositionals cases pin the fix for the flag/positional
// divergence: the old inline pass skipped the token after *any* `--` token,
// so a `--flag=value` before a filename silently dropped the filename.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  COMMAND_FLAGS,
  composeOutDir,
  defaultPartsDir,
  extractPositionals,
  flagVocabulary,
  hostConformanceFlag,
  parseFlags,
  readManifestFile,
  replaceUWExtension,
  signingLoadFailureMessage,
  unknownFlagMessage,
} from './cli-args.js';

describe('parseFlags', () => {
  it('parses the three flag forms', () => {
    expect(parseFlags(['--json'])).toEqual({ json: true });
    expect(parseFlags(['--format', 'csv'])).toEqual({ format: 'csv' });
    expect(parseFlags(['--format=csv'])).toEqual({ format: 'csv' });
  });

  it('a bare flag followed by another flag is boolean', () => {
    expect(parseFlags(['--integrity', '--json'])).toEqual({ integrity: true, json: true });
  });

  it('a bare flag at the end of the args is boolean', () => {
    expect(parseFlags(['file.uwx.md', '--dry-run'])).toEqual({ 'dry-run': true });
  });

  it('the = form keeps everything after the first = as the value', () => {
    expect(parseFlags(['--filter=a=b'])).toEqual({ filter: 'a=b' });
    expect(parseFlags(['--empty='])).toEqual({ empty: '' });
  });

  it('a bare flag before a positional consumes it as its value', () => {
    // Long-standing behavior both passes share: flags must follow
    // positionals, or a space-form flag will eat the positional.
    expect(parseFlags(['--stage', 'screening', 'file.uwx.md'])).toEqual({ stage: 'screening' });
  });

  it('non-flag tokens contribute nothing', () => {
    expect(parseFlags(['parse', 'file.uwx.md'])).toEqual({});
  });
});

describe('extractPositionals', () => {
  it('collects non-flag tokens and skips a space-form value', () => {
    expect(extractPositionals(['file.uwx.md', '--format', 'csv'])).toEqual(['file.uwx.md']);
  });

  it('a --flag=value token does not swallow the next token (the fixed bug)', () => {
    // The old inline pass returned [] here, so
    // `uwmd parse --compact=true file.uwx.md` died with a usage error.
    expect(extractPositionals(['--compact=true', 'file.uwx.md'])).toEqual(['file.uwx.md']);
  });

  it('two adjacent bare flags do not consume each other', () => {
    expect(extractPositionals(['--integrity', '--json'])).toEqual([]);
    expect(parseFlags(['--integrity', '--json'])).toEqual({ integrity: true, json: true });
  });

  it('a trailing bare flag still eats a following positional — flags go after positionals', () => {
    // The space form is greedy: `--json file.uwx.md` reads the filename as
    // json's value in BOTH passes. Consistent, and exactly why every usage
    // string puts the file first. Use `--json=true file` to front-load.
    const argv = ['--integrity', '--json', 'file.uwx.md'];
    expect(extractPositionals(argv)).toEqual([]);
    expect(parseFlags(argv)).toEqual({ integrity: true, json: 'file.uwx.md' });
    expect(extractPositionals(['--json=true', 'file.uwx.md'])).toEqual(['file.uwx.md']);
  });

  it('mirrors parseFlags exactly: every token is a flag, a flag value, or positional', () => {
    const argv = ['a.uwx.md', '--stage', 'screening', '--json', '--out=x.json', 'b.uwx.md'];
    expect(parseFlags(argv)).toEqual({ stage: 'screening', json: true, out: 'x.json' });
    expect(extractPositionals(argv)).toEqual(['a.uwx.md', 'b.uwx.md']);
  });

  it('empty args yield empty positionals', () => {
    expect(extractPositionals([])).toEqual([]);
  });
});

describe('replaceUWExtension', () => {
  it('replaces each known UW-family suffix', () => {
    expect(replaceUWExtension('deal.uwx.md', '.uw.json')).toBe('deal.uw.json');
    expect(replaceUWExtension('deal.uw.md', '.uwx.md')).toBe('deal.uwx.md');
    expect(replaceUWExtension('deal.uw.json', '.uw.xml')).toBe('deal.uw.xml');
    expect(replaceUWExtension('deal.uw.xml', '.uw.md')).toBe('deal.uw.md');
    expect(replaceUWExtension('deal.uw.csv.zip', '.uwx.md')).toBe('deal.uwx.md');
  });

  it('matches case-insensitively while preserving the stem', () => {
    expect(replaceUWExtension('Deal.UWX.MD', '.uw.json')).toBe('Deal.uw.json');
  });

  it('appends when no known suffix matches', () => {
    expect(replaceUWExtension('notes.md', '.uw.json')).toBe('notes.md.uw.json');
  });

  it('.uwx.md wins over the shorter .uw.md-style suffixes', () => {
    // 'deal.uwx.md' must not be read as stem 'deal.uwx' + '.md'-adjacent match.
    expect(replaceUWExtension('deal.uwx.md', '.uw.xml')).toBe('deal.uw.xml');
  });
});

describe('hostConformanceFlag', () => {
  it('reads reader or verifier and refuses anything else', () => {
    expect(hostConformanceFlag({ tier: 'reader' })).toBe('reader');
    expect(hostConformanceFlag({ tier: 'verifier' })).toBe('verifier');
    for (const tier of ['tier-3-calc-host', '3', 'analyst', true]) expect(hostConformanceFlag({ tier })).toBeNull();
    expect(hostConformanceFlag({})).toBeUndefined();
  });
});

describe('defaultPartsDir', () => {
  it('is the parts/ sibling of the record', () => {
    const dir = defaultPartsDir(join('some', 'dir', 'deal.uwx.md'));
    expect(dir).toBe(resolve(join('some', 'dir', 'parts')));
    expect(dir.endsWith(`${sep}parts`)).toBe(true);
  });
});

describe('readManifestFile', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'uwmd-cli-args-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('returns the parsed JSON for a readable manifest', () => {
    const path = join(tmp, 'ok.module.json');
    writeFileSync(path, JSON.stringify({ id: 'mod', version: '1.0.0' }));
    expect(readManifestFile(path)).toEqual({ ok: true, manifest: { id: 'mod', version: '1.0.0' } });
  });

  it('returns ok: false with a message instead of throwing, for both missing and malformed files', () => {
    const missing = readManifestFile(join(tmp, 'nope.json'));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.message.length).toBeGreaterThan(0);

    const badPath = join(tmp, 'bad.json');
    writeFileSync(badPath, '{ not json');
    const bad = readManifestFile(badPath);
    expect(bad.ok).toBe(false);
  });
});

describe('flagVocabulary', () => {
  it('resolves a command to its own closed set', () => {
    expect(flagVocabulary('verify', undefined)).toEqual({ command: 'verify', accepted: COMMAND_FLAGS['verify'] });
    expect(flagVocabulary('verify', 'deal.uwx.md')).toEqual({ command: 'verify', accepted: COMMAND_FLAGS['verify'] });
  });

  it('resolves a subcommand when the first positional selects one', () => {
    expect(flagVocabulary('receipt', 'verify')).toEqual({ command: 'receipt verify', accepted: ['json'] });
    expect(flagVocabulary('receipt', 'issue')?.accepted).toEqual(['output', 'issued-at', 'stdout']);
    expect(flagVocabulary('modules', 'list')?.command).toBe('modules list');
  });

  it('is undefined for an unknown command or subcommand, for no command, and for a self-parsing command', () => {
    expect(flagVocabulary(undefined, undefined)).toBeUndefined();
    expect(flagVocabulary('--help', undefined)).toBeUndefined();
    expect(flagVocabulary('nonsense', 'x')).toBeUndefined();
    expect(flagVocabulary('receipt', 'nonsense')).toBeUndefined();
    // verify-cash-flows parses args itself and refuses under its typed JSON contract.
    expect(flagVocabulary('verify-cash-flows', undefined)).toBeUndefined();
    expect(COMMAND_FLAGS['verify-cash-flows']).toEqual(['variant', 'json']);
  });

  it('never reads an inherited object property as a command', () => {
    expect(flagVocabulary('constructor', undefined)).toBeUndefined();
    expect(flagVocabulary('receipt', 'toString')).toBeUndefined();
  });
});

describe('unknownFlagMessage', () => {
  const verify = flagVocabulary('verify', undefined)!;

  it('is undefined when every flag is accepted', () => {
    expect(unknownFlagMessage(verify, {})).toBeUndefined();
    expect(unknownFlagMessage(verify, { integrity: true, json: true, keystore: 'k.json' })).toBeUndefined();
  });

  it('names the unknown flag and the command, and lists the accepted flags', () => {
    const message = unknownFlagMessage(verify, { 'document-signture': 'x.json', keystore: 'k.json' });
    expect(message).toBe(
      'uwmd verify: unknown flag --document-signture. Accepted flags: --validate, --integrity, --policy, --signing, --keystore, --document-signature, --resolved, --parts, --json.',
    );
  });

  it('names every unknown flag, in the order given', () => {
    expect(unknownFlagMessage(flagVocabulary('receipt', 'verify')!, { output: 'x', stdout: true, json: true }))
      .toBe('uwmd receipt verify: unknown flags --output, --stdout. Accepted flags: --json.');
  });

  it('says when the command takes no flags at all', () => {
    expect(unknownFlagMessage(flagVocabulary('diff', undefined)!, { json: true }))
      .toBe('uwmd diff: unknown flag --json. The command takes no flags.');
  });
});

describe('COMMAND_FLAGS', () => {
  // cli.ts is a top-level script, so it is read as text: every flag a usage
  // string promises must be one the router accepts, and every command with a
  // usage string must have a vocabulary. A flag added to one side without the
  // other fails here before it reaches a user.
  const source = readFileSync(new URL('./cli.ts', import.meta.url), 'utf-8');
  const usages = [...source.matchAll(/Usage: uwmd ([^'`]+)/g)].map((m) => m[1]!.trim());

  it('covers every usage string in cli.ts', () => {
    expect(usages.length).toBeGreaterThan(30);
    for (const usage of usages) {
      const [command, next] = usage.split(/\s+/);
      if (command!.startsWith('<')) continue; // the help header, `uwmd <command> <file> [options]`
      const sub = next !== undefined && /^[a-z-]+$/.test(next) ? next : undefined;
      if (next !== undefined && /^<[a-z-]+(\|[a-z-]+)+>$/.test(next)) continue; // `receipt <issue|verify> ...` dispatches, it is not a command
      const key = sub !== undefined && Object.hasOwn(COMMAND_FLAGS, `${command} ${sub}`) ? `${command} ${sub}` : command!;
      expect(COMMAND_FLAGS, `no vocabulary for "${usage}"`).toHaveProperty(key);
      const promised = [...new Set((usage.match(/--[a-z][a-z-]*/g) ?? []).map((flag) => flag.slice(2)))];
      for (const flag of promised) {
        expect(COMMAND_FLAGS[key], `usage "${usage}" promises --${flag}`).toContain(flag);
      }
    }
  });

  it('lists no flag twice', () => {
    for (const [command, accepted] of Object.entries(COMMAND_FLAGS)) {
      expect(new Set(accepted).size, command).toBe(accepted.length);
    }
  });
});

describe('removed 4.2.0 aliases (#412)', () => {
  // No backward compatibility before launch: validate --stage, export --compact
  // and compose --parts are unknown flags, refused like any other (#328).
  it('are no longer in their commands\' vocabularies', () => {
    expect(COMMAND_FLAGS['validate']).not.toContain('stage');
    expect(COMMAND_FLAGS['export']).not.toContain('compact');
    expect(COMMAND_FLAGS['compose']).not.toContain('parts');
  });

  it('are refused as unknown flags', () => {
    for (const [command, flag] of [['validate', 'stage'], ['export', 'compact'], ['compose', 'parts']] as const) {
      const vocabulary = flagVocabulary(command, undefined)!;
      expect(unknownFlagMessage(vocabulary, { [flag]: true }), `${command} --${flag}`).toContain(`unknown flag --${flag}`);
    }
  });

  it('leave the same names on other commands alone', () => {
    expect(COMMAND_FLAGS['parse']).toContain('compact');
    expect(COMMAND_FLAGS['resolve']).toContain('parts');
    expect(COMMAND_FLAGS['init']).toContain('stage');
  });
});

describe('composeOutDir', () => {
  const file = join('deals', 'deal.uwx.md');

  it('defaults to the record\'s parts/ sibling, or takes --out-dir', () => {
    expect(composeOutDir(file, {})).toEqual({ ok: true, dir: defaultPartsDir(file) });
    expect(composeOutDir(file, { 'out-dir': 'frags' })).toEqual({ ok: true, dir: resolve('frags') });
  });

  it('refuses --out-dir without a directory', () => {
    expect(composeOutDir(file, { 'out-dir': true })).toEqual({ ok: false, message: 'uwmd compose: --out-dir needs a directory.' });
    expect(composeOutDir(file, { 'out-dir': '' })).toEqual({ ok: false, message: 'uwmd compose: --out-dir needs a directory.' });
  });
});

describe('signingLoadFailureMessage', () => {
  // Node's own errors for the two cases; the CLI must not print the first raw.
  const missing = Object.assign(
    new Error("Cannot find package '@uwmd/signing' imported from /x/node_modules/@uwmd/core/dist/cli.js"),
    { code: 'ERR_MODULE_NOT_FOUND' },
  );

  it('names the flag or command the user ran and how to install the peer', () => {
    const message = signingLoadFailureMessage('--document-signature', missing);
    expect(message).toMatch(/^--document-signature: the optional @uwmd\/signing package is not installed\./);
    expect(message).toContain('npm i @uwmd/signing');
    expect(message).toContain('npx -p @uwmd/cli -p @uwmd/signing uwmd');
    expect(message).not.toContain('Cannot find package');
    expect(signingLoadFailureMessage('uwmd sign-document', missing)).toMatch(/^uwmd sign-document: the optional/);
  });

  it('reports a present but broken package as a load failure, not as missing', () => {
    const dependencyMissing = Object.assign(
      new Error("Cannot find package '@uwmd/verify' imported from /x/node_modules/@uwmd/signing/dist/index.js"),
      { code: 'ERR_MODULE_NOT_FOUND' },
    );
    expect(signingLoadFailureMessage('--signing', dependencyMissing))
      .toBe("--signing: could not load @uwmd/signing: Cannot find package '@uwmd/verify' imported from /x/node_modules/@uwmd/signing/dist/index.js");
    expect(signingLoadFailureMessage('--signing', new SyntaxError('Unexpected token')))
      .toBe('--signing: could not load @uwmd/signing: Unexpected token');
  });
});
