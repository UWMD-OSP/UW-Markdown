import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// RFC 0081 Phase 3 acceptance harness. Run on an unchanged built base, then on
// the built re-authored tree; compare JSON snapshots, never regenerate numerics.
const args = process.argv.slice(2);
const root = resolve(args[args.indexOf('--root') + 1] || '.');
if (args.includes('--compare')) {
  const before = JSON.parse(readFileSync(args[args.indexOf('--compare')+1], 'utf8'));
  const after = JSON.parse(readFileSync(args[args.indexOf('--compare')+2], 'utf8'));
  const changes = { calculations: [], baselines: [], uses: [], receipts: [], codes: [], removed_cases: [], changed_cases: [] };
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [file, values] of Object.entries(before.calculations)) if (after.calculations[file]) for (const [id, value] of Object.entries(values)) {
    if (!same(value, after.calculations[file][id])) changes.calculations.push({file,id,before:value,after:after.calculations[file][id]});
  }
  for (const [file,value] of Object.entries(before.baselineValues)) if (!same(value,after.baselineValues[file])) changes.baselines.push({file,before:value,after:after.baselineValues[file]});
  for (const [file,value] of Object.entries(before.uses)) if (file in after.uses && !same(value,after.uses[file])) changes.uses.push({file,before:value,after:after.uses[file]});
  for (const [file,value] of Object.entries(before.receipts)) if (!same(value,after.receipts[file])) changes.receipts.push({file,before:value,after:after.receipts[file]});
  for (const [file,value] of Object.entries(before.codes)) if (file in after.codes && !same(value,after.codes[file])) changes.codes.push({file,before:value,after:after.codes[file]});
  const next = new Map(after.conformance.map(c=>[c.suite+'/'+c.scenario,c]));
  for (const value of before.conformance) {const key=value.suite+'/'+value.scenario; const current=next.get(key); if(!current)changes.removed_cases.push(value);else if(!same(value,current))changes.changed_cases.push({before:value,after:current});}
  const lender_identical = same(before.lender,after.lender);
  const totals = after.lender.reduce((a,r) => {for(const k of Object.keys(a))a[k]+=r.counts[k];return a;},{verified:0,failed:0,unverifiable:0});
  const expectedAdditions = new Set(['total_room_revenue','room_revenue_per_key']);
  const unexpectedExamples = changes.calculations.filter(c=>c.file.startsWith('examples/') && !(c.file.endsWith('Saguaro-Select-Hotel-Tempe-AZ.uwx.md') && expectedAdditions.has(c.id) && c.before.value===null));
  const unexpectedUses = changes.uses.filter(c=>c.file.startsWith('examples/'));
  const report={summary:{calc_baselines:Object.keys(after.baselineValues).length,baseline_changes:changes.baselines.length,lender:totals,lender_evidence_identical:lender_identical,receipt_changes:changes.receipts.length,uses_changes:changes.uses.length,calculation_changes:changes.calculations.length,code_documents_changed:changes.codes.length,conformance_before:before.conformance.length,conformance_after:after.conformance.length,conformance_changed:changes.changed_cases.length,conformance_removed:changes.removed_cases.length},changes};
  console.log(JSON.stringify(report,null,2));
  process.exit(!lender_identical || changes.baselines.length || changes.receipts.length || changes.changed_cases.length || unexpectedExamples.length || unexpectedUses.length ? 1 : 0);
}
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
  snapshot.receipts[file] = { verdict: result.verdict, codes: result.issues.map(i => i.code).sort(), values: receipt.computation.results.map(({calc_id,value,unit,computed})=>({calc_id,value,unit,computed})) };
}
const run = args.includes('--no-conformance') ? {results:[], summary:{}} : JSON.parse(execFileSync(process.execPath, ['scripts/run-conformance.mjs', '--json'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString());
snapshot.conformance = run.results.map(({ suite, scenario, status }) => ({ suite, scenario, status }));
if (args.includes('--out')) {
  writeFileSync(args[args.indexOf('--out') + 1], JSON.stringify(snapshot, null, 2) + '\n');
  console.log(JSON.stringify({ documents: Object.keys(snapshot.codes).length, calc_baselines: Object.keys(snapshot.baselineValues).length, uses: Object.keys(snapshot.uses).length, receipts: Object.keys(snapshot.receipts).length, lender: snapshot.lender.reduce((a,r) => { for(const k of Object.keys(a)) a[k] += r.counts[k]; return a; }, {verified:0,failed:0,unverifiable:0}), conformance: run.summary }));
} else throw new Error('Use --out <snapshot.json>; compare snapshots after building each tree.');
