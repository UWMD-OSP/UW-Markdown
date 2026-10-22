// Development evidence for #517: SOURCE diagnostic parity across the tracked
// structured corpus. Compare locations and multiplicity, without comparing
// narrative, evidence payloads, issue order, institution policy or tier claims.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectUWSourceRepresentation, validateUWFile } from '../packages/uwmd-verify/dist/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function diagnosticProjection(result) {
  if (!result || typeof result !== 'object') throw new TypeError('Missing diagnostic result');
  if (result.error) return { error: result.error.code ?? 'UNALLOCATED_ERROR' };
  if (!Array.isArray(result.issues)) throw new TypeError('Missing diagnostic list');
  return result.issues.map(issue => [issue.code ?? '', issue.severity ?? '', issue.section ?? '', issue.field ?? ''])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
}

export function diagnosticsAgree(left, right) {
  return JSON.stringify(diagnosticProjection(left)) === JSON.stringify(diagnosticProjection(right));
}

async function main() {
  const files = execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', 'conformance'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/).filter(file => file.endsWith('.uwx.md'));
  if (!files.length) throw new TypeError('No tracked structured fixtures found');
  const child = spawnSync(process.env.PYTHON ?? 'python', ['-B', join(ROOT, 'scripts/python-validation-diagnostics.py')], {
    cwd: ROOT, input: JSON.stringify(files), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new TypeError(`Python diagnostic adapter failed: ${child.stderr}`);
  const python = JSON.parse(child.stdout);
  if (Object.keys(python).length !== files.length) throw new TypeError('Python adapter omitted or added files');
  let differences = 0;
  const originalNow = Date.now;
  Date.now = () => Date.parse('2026-10-22T00:00:00Z');
  try {
    for (const file of files) {
      let reference;
      try {
        const raw = readFileSync(join(ROOT, file), 'utf8');
        detectUWSourceRepresentation(raw, file);
        reference = validateUWFile(raw);
      } catch (error) {
        reference = { error: { code: error.code ?? `INTERNAL:${error.name}` } };
      }
      if (!diagnosticsAgree(reference, python[file])) {
        differences++;
        console.error(JSON.stringify({ file, reference: diagnosticProjection(reference), python: diagnosticProjection(python[file]) }));
      }
    }
  } finally { Date.now = originalNow; }
  console.log(`${files.length} tracked sources; ${differences} diagnostic differences (codes, severity, section, field and counts).`);
  if (differences) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
