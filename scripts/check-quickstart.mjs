// Execute the public tutorial's main path with the pinned npm CLI and current source.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const guide = readFileSync(join(root, 'tools/docs-site/tutorials/quickstart.md'), 'utf8');
const main = guide.split('<!-- quickstart:start -->')[1]?.split('<!-- quickstart:end -->')[0];
assert.ok(main, 'Quickstart main-path markers are required');
const commandsIn = part => [...part.matchAll(/```bash\r?\n([\s\S]*?)\r?\n```/g)]
  .flatMap(match => match[1].split(/\r?\n/)).filter(line => line.trim());
const mainCommands = commandsIn(main);
assert.equal(mainCommands.length, 8);
const commands = [...mainCommands, ...commandsIn(guide.split('<!-- quickstart:end -->')[1])];
assert.equal(commands.length, 11);

/** The tutorial uses single-line argv commands, never shell operators. */
function commandWords(line) {
  const words = [];
  let word = '', quote = null;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (char === '"' || char === "'") quote = char;
    else if (/\s/.test(char)) { if (word) { words.push(word); word = ''; } }
    else word += char;
  }
  assert.equal(quote, null, 'Unclosed command quote');
  if (word) words.push(word);
  return words;
}

const npmBin = process.env.npm_execpath ? dirname(process.env.npm_execpath)
  : join(dirname(process.execPath), 'node_modules/npm/bin');
const npx = join(npmBin, 'npx-cli.js');
assert.ok(existsSync(npx), `npm's npx entry is required: ${npx}`);
const cache = join(root, 'node_modules/.cache');
mkdirSync(cache, { recursive: true });
const study = mkdtempSync(join(cache, 'quickstart-executable-'));
const evidence = [];
for (const mode of ['published', 'source']) {
  const cwd = join(study, mode);
  mkdirSync(cwd);
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  for (const [index, command] of commands.entries()) {
    const words = commandWords(command);
    const executable = words.shift();
    let args;
    if (executable === 'node') args = words;
    else if (executable === 'npm') args = [join(npmBin, 'npm-cli.js'), ...words];
    else {
      assert.equal(executable, 'npx');
      assert.deepEqual(words.slice(0, 2), ['--yes', '@uwmd/cli@4.3.0']);
      args = mode === 'published' ? [npx, ...words]
        : [join(root, 'packages/uwmd-cli/bin/uwmd.mjs'), ...words.slice(2)];
    }
    const run = spawnSync(process.execPath, args, {
      cwd, encoding: 'utf8', timeout: 120_000,
      env: { ...process.env, npm_config_user_agent: 'UWMD-quickstart/1.0', NO_COLOR: '1' },
    });
    const stem = `${index + 1}`.padStart(2, '0');
    writeFileSync(join(cwd, `${stem}.stdout`), run.stdout ?? '');
    writeFileSync(join(cwd, `${stem}.stderr`), run.stderr ?? '');
    evidence.push({ mode, command, exit: run.status });
    writeFileSync(join(study, 'commands.json'), JSON.stringify(evidence, null, 2));
    assert.equal(run.status, 0, `${mode}: ${command}\n${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
    if (words.includes('summary')) {
      assert.match(run.stdout, /Synthetic Ten-Unit Example/);
      assert.match(run.stdout, /\$74,000/);
      assert.match(run.stdout, /60\.00%/);
    }
  }
  const trackedFixture = execFileSync('git', ['show', 'HEAD:docs/downloads/tutorials/quickstart.uwx.md'], { cwd: root });
  assert.deepEqual(readFileSync(join(cwd, 'quickstart.uwx.md')), trackedFixture, 'Pinned fixture bytes must equal the tracked Git blob, independent of checkout line endings');
  const receipt = JSON.parse(readFileSync(join(cwd, 'quickstart.receipt.json'), 'utf8'));
  assert.equal(receipt.computation.results.length, 8);
  assert.ok(receipt.computation.results.every(result => result.computed));
  assert.equal(JSON.parse(readFileSync(join(cwd, 'quickstart.uw.json'), 'utf8')).frontmatter.deal_id, 'uw_SYNTHETIC_QUICKSTART');
  assert.match(readFileSync(join(cwd, 'quickstart.uw.md'), 'utf8'), /Synthetic Ten-Unit Example/);
  const projection = JSON.parse(readFileSync(join(cwd, 'lite-omissions.json'), 'utf8'));
  assert.ok(projection.lossy && projection.omitted_paths.length > 0);
  console.log(`[PASS] ${mode}: all ${commands.length} documented commands; eight computed receipt outputs; full JSON and loss-reported Lite conversion`);
}
console.log(`Quickstart evidence: ${resolve(study)}`);
