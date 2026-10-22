import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('a compound INVALID family must be registered before the contract guard passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'uwmd-code-contract-'));
  try {
    for (const path of ['scripts', 'packages/uwmd-verify/src', 'packages/uwmd-core/src', 'docs/rfcs', 'spec']) {
      mkdirSync(join(root, path), { recursive: true });
    }
    writeFileSync(join(root, 'scripts/verify-codes.mjs'), readFileSync(new URL('./verify-codes.mjs', import.meta.url)));
    writeFileSync(join(root, 'packages/uwmd-verify/src/validator.ts'),
      "const issues: ValidationMessage[] = [{code: 'DQ-01'}, {code: 'INVALID-DECISION-001'}];\n");
    writeFileSync(join(root, 'spec/UW_FORMAT_SPEC.md'), '- `INVALID-DECISION-001` — stated invalid decision.\n');
    const protocol = 'Retired agreement/transition codes are not emitted: OLD-99.\n';
    writeFileSync(join(root, 'spec/UW_PROTOCOL.md'), protocol);
    const run = () => spawnSync(process.execPath, [join(root, 'scripts/verify-codes.mjs')], { encoding: 'utf8' });
    const missing = run();
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /unregistered|appear in no protocol/);
    assert.match(missing.stderr, /INVALID-DECISION/);
    writeFileSync(join(root, 'spec/UW_PROTOCOL.md'), `${protocol}| \`INVALID-DECISION-NNN\` | Closed decision vocabulary. |\n`);
    const registered = run();
    assert.equal(registered.status, 0, registered.stderr);
    assert.match(registered.stdout, /2 emitted codes/);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('uwmd-code-contract-'));
    rmSync(root, { recursive: true, force: true });
  }
});
