import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// RFC 0081 Phase 3 acceptance harness. Run on an unchanged built base, then on
// the built re-authored tree; compare JSON snapshots, never regenerate numerics.
const args = process.argv.slice(2);
const root = resolve(args[args.indexOf('--root') + 1] || '.');
const core = await import(pathToFileURL(resolve(root, 'packages/uwmd-core/dist/index.js')));
const { verifyExamples } = await import(pathToFileURL(resolve(root, 'conformance/metrics/verifier.mjs')));
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const snapshot = { calculations: {}, uses: {}, codes: {}, receipts: {}, baselineValues: {}, lender: verifyExamples(root), conformance: [] };
for (const file of files.filter(f => /\.uwx?\.md$/.test(f) && !/^(docs\/(rfcs|releases|reviews)|spec)\//.test(f))) {
  const source = readFileSync(resolve(root, file), 'utf8');
  if (!source.includes('```json uw:')) continue;
  let parsed;
  try { parsed = core.parseUWFile(source); } catch(error) { snapshot.codes[file] = [{code: error.code, severity: 'error'}]; continue; }
  snapshot.codes[file] = core.validateUWFile(parsed).issues.map(i => ({ code: i.code, severity: i.severity })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const pack = core.getPackForAssetClass(parsed.frontmatter.asset_class);
  snapshot.calculations[file] = Object.fromEntries((pack?.calculations ?? []).map(calc => {
    const result = core.evaluateCalc(calc, { parsed, prior_results: {}, locale: 'en-US' });
    return [calc.id, { ok: result.ok, value: result.value, code: result.error?.proto?.code ?? result.error?.code ?? null }];
  }));
  const entries = parsed.sections.sources_uses;
  for (const [variant, block] of !entries ? [] : entries.annotation ? [['', entries]] : Object.entries(entries)) {
    snapshot.uses[`${file}#${variant}`] = core.deriveSourcesUses(core.blockPayload(block), parsed).usesTotal;
  }
}
for (const file of files.filter(f => /expected-result\.json$/.test(f))) {
  snapshot.baselineValues[file] = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
}
for (const file of files.filter(f => /^conformance\/receipts\/verify\/.*\/receipt\.json$/.test(f))) {
  const dir = dirname(file);
  const deal = files.find(f => dirname(f) === dir && /deal\.uwx?\.md$/.test(f));
  if (!deal) continue;
  const receipt = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  const result = await core.verifyReceipt(receipt, readFileSync(resolve(root, deal), 'utf8'));
  snapshot.receipts[file] = { verdict: result.verdict, codes: result.issues.map(i => i.code).sort(), values: receipt.results };
}
const run = JSON.parse(execFileSync(process.execPath, ['scripts/run-conformance.mjs', '--json'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString());
snapshot.conformance = run.results.map(({ suite, scenario, status }) => ({ suite, scenario, status }));
if (args.includes('--out')) {
  writeFileSync(args[args.indexOf('--out') + 1], JSON.stringify(snapshot, null, 2) + '\n');
  console.log(JSON.stringify({ documents: Object.keys(snapshot.codes).length, calc_baselines: Object.keys(snapshot.baselineValues).length, uses: Object.keys(snapshot.uses).length, receipts: Object.keys(snapshot.receipts).length, lender: snapshot.lender.reduce((a,r) => { for(const k of Object.keys(a)) a[k] += r.counts[k]; return a; }, {verified:0,failed:0,unverifiable:0}), conformance: run.summary }));
} else throw new Error('Use --out <snapshot.json>; compare snapshots after building each tree.');
