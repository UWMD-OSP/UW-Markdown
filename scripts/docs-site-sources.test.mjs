import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rfcCopies, docsVersions, docsNpmPackages, docsPublishedGeneration, docsSiteVersions } from './docs-site-sources.mjs';

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

    // template.md without 0000- prefix also maps to about/rfcs/template.md
    writeFileSync(join(dir, 'template.md'), '# Template');
    const templateCopy = rfcCopies(root).find((copy) => copy.from === 'docs/rfcs/template.md');
    assert.equal(templateCopy?.to, 'about/rfcs/template.md');
    assert.equal(templateCopy?.title, 'RFC Template');
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

test('the npm list names the published generation, never a prepared one', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-npm-'));
  const write = (text) => writeFileSync(join(root, 'CHANGELOG.md'), text);
  const ORIGINAL = ['@uwmd/core', '@uwmd/cli', '@uwmd/signing', '@uwmd/batch'];
  try {
    // Release-prepared 2.18.0: wider scope, but nothing published yet.
    write([
      '## [Unreleased]', '',
      '## [2.18.0] - 2026-11-01', '', '### Added', '- modules', '',
      '## [2.17.0] - 2026-10-03', '', '### Released', '- core, CLI, signing, batch', '',
      '### Released contract — Protocol 2.21.0', '',
      '## [2.16.0] - 2026-10-02', '', '### Released', '',
    ].join('\n'));
    assert.equal(docsPublishedGeneration(root), '2.17.0');
    assert.deepEqual(docsNpmPackages(root), ORIGINAL);

    // Post-publication reconciliation adds `### Released`; the modules now count.
    write(['## [2.18.0] - 2026-11-01', '', '### Released', '', '## [2.17.0] - 2026-10-03', '', '### Released', ''].join('\n'));
    assert.equal(docsPublishedGeneration(root), '2.18.0');
    assert.ok(docsNpmPackages(root).includes('@uwmd/module-hospitality'));
    assert.ok(!docsNpmPackages(root).includes('@uwmd/excel'));

    // A heading that merely starts with "Released" is not the publication marker.
    write(['## [2.17.0] - 2026-10-03', '', '### Released contract — Protocol 2.21.0', ''].join('\n'));
    assert.throws(() => docsPublishedGeneration(root), /Cannot find a released generation/);
  } finally {
    // root is the exact directory returned by mkdtempSync, under the OS temp directory.
    rmSync(root, { recursive: true, force: true });
  }
});

test('a prepared-but-unpublished core version is kept apart from publication state', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-site-versions-'));
  const ORIGINAL = ['@uwmd/core', '@uwmd/cli', '@uwmd/signing', '@uwmd/batch'];
  const manifest = (version) =>
    writeFileSync(join(root, 'packages/uwmd-core/package.json'), JSON.stringify({ version }));
  try {
    mkdirSync(join(root, 'packages/uwmd-core/src'), { recursive: true });
    writeFileSync(join(root, 'packages/uwmd-core/src/protocol.ts'),
      "export const FORMAT_VERSION = '2.0' as const;\nexport const PROTOCOL_VERSION = '2.22.0' as const;");
    writeFileSync(join(root, 'CHANGELOG.md'), [
      '## [2.18.0] - 2026-11-01', '', '### Added', '',
      '## [2.17.0] - 2026-10-03', '', '### Released', '',
    ].join('\n'));

    // Release-prepared tree: the source carries 2.18.0, npm still serves 2.17.0's scope.
    manifest('2.18.0');
    assert.deepEqual(docsSiteVersions(root), {
      format: '2.0', protocol: '2.22.0', core: '2.18.0',
      published: '2.17.0', npm: ORIGINAL, unpublishedSource: true,
    });

    // Published tree: source and publication agree.
    manifest('2.17.0');
    const published = docsSiteVersions(root);
    assert.equal(published.published, '2.17.0');
    assert.equal(published.unpublishedSource, false);
  } finally {
    // root is the exact directory returned by mkdtempSync, under the OS temp directory.
    rmSync(root, { recursive: true, force: true });
  }
});
