// cli-args.ts — the uwmd CLI's argument/path plumbing. Extracted from cli.ts
// (a top-level script that runs at import time, so it cannot carry a sibling
// unit test itself; its command surface is covered by the @uwmd/cli smoke
// tests). The extractPositionals cases pin the fix for the flag/positional
// divergence: the old inline pass skipped the token after *any* `--` token,
// so a `--flag=value` before a filename silently dropped the filename.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  defaultPartsDir,
  extractPositionals,
  hostTierFlag,
  parseFlags,
  readManifestFile,
  replaceUWExtension,
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

describe('hostTierFlag', () => {
  it('returns a string tier and rejects the boolean form', () => {
    expect(hostTierFlag({ tier: 'analyst' })).toBe('analyst');
    expect(hostTierFlag({ tier: true })).toBeUndefined();
    expect(hostTierFlag({})).toBeUndefined();
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
