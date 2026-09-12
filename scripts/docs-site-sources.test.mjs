import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rfcCopies, docsVersions } from './docs-site-sources.mjs';

test('new RFCs are discovered without script edits; special routes survive', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-docs-'));
  try {
    const dir = join(root, 'docs/rfcs');
    mkdirSync(dir, { recursive: true });
    for (const file of ['README.md', '0000-template.md', '0041-period-indexed-addressing.md', 'notes.txt']) {
      writeFileSync(join(dir, file), '# Fixture');
    }
    mkdirSync(join(dir, 'not-a-file.md'));
    const before = rfcCopies(root);
    assert.deepEqual(before.map((copy) => copy.to), [
      'about/rfcs/template.md', 'about/rfcs/0041-period-indexed-addressing.md', 'about/rfcs/index.md',
    ]);
    writeFileSync(join(dir, '9999-future-rfc.md'), '# Future RFC');
    assert.ok(rfcCopies(root).some((copy) => copy.to === 'about/rfcs/9999-future-rfc.md'));
    assert.equal(rfcCopies(root).length, before.length + 1);
  } finally {
    // root is the exact directory returned by mkdtempSync, under the OS temp directory.
    rmSync(root, { recursive: true, force: true });
  }
});

test('site versions track independent package and standard versions', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-versions-'));
  try {
    mkdirSync(join(root, 'packages/uwmd-core/src'), { recursive: true });
    writeFileSync(join(root, 'packages/uwmd-core/package.json'), JSON.stringify({ version: '7.4.2' }));
    const path = join(root, 'packages/uwmd-core/src/protocol.ts');
    writeFileSync(path, "export const FORMAT_VERSION = '3.0' as const;\nexport const PROTOCOL_VERSION = '4.1.0' as const;");
    assert.deepEqual(docsVersions(root), { core: '7.4.2', format: '3.0', protocol: '4.1.0' });
    writeFileSync(path, "export const FORMAT_VERSION = '3.0' as const;");
    assert.throws(() => docsVersions(root), /Cannot read PROTOCOL_VERSION/);
  } finally {
    // root is the exact directory returned by mkdtempSync, under the OS temp directory.
    rmSync(root, { recursive: true, force: true });
  }
});
