#!/usr/bin/env node
// uwmd CLI — command-line interface for .uw.md files
// Commands: parse, validate, compact, diff, init, summary, render
// Usage: uwmd <command> <file> [options]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { compact, diff } from './compactor.js';
import { generateBlankUWFile } from './init.js';
import { render } from './renderer.js';
import { renderReportHtml } from './report.js';
import { stringifyUWEnvelope } from './uwjson.js';
import {
  stampEnvelopeDigest,
  toUWEnvelope,
  type UWDocumentEnvelope,
} from './envelope.js';
import { CORE_CODEC_REGISTRY } from './codecs.js';
import { writeAgentBlock, buildMeta } from './runner.js';
import { applyEdit } from './editor.js';
import { verifyChain, verifyProvenance } from './integrity.js';
import type { IntegrityResult } from './integrity.js';
import type { EditContext } from './editor.js';
import type { EditOperation, ModuleCalcDecl, CalcEvaluationContext } from './protocol.js';
import { evaluateCalc } from './calc/index.js';
import { buildAgentContext, buildAgentPrompt, isContextReady, BANCROFT_LAYERS } from './context.js';
import { runBancroftAgent } from './agents/bancroft.js';
import type { AssetClass, DealStage, InstitutionConfig } from './types.js';
import type { RenderFormat, RenderTier } from './renderer.js';
import { buildContext } from './context-profiles.js';
import type { ContextProfile } from './context-profiles.js';
import { rankGaps } from './refinement.js';
import { resolveValue } from './cascade.js';
import { getAssetClassDefaults } from './defaults.js';
import { MULTIFAMILY_PACK, getPackForAssetClass } from './packs/index.js';
import { issueReceipt, verifyReceipt, assertUWReceipt } from './receipts.js';
import type { UWReceipt } from './receipts.js';
import { CORE_VERSION } from './version.js';
import {
  detectUWSourceRepresentation,
  migrateLegacyUWMarkdown,
  UWX_REPRESENTATION_ID,
  UW_LITE_SOURCE_DESCRIPTOR,
  UWX_SOURCE_DESCRIPTOR,
  UWX_EXTENSION,
} from './source-representation.js';
import { parseUWLite } from './lite.js';
import {
  compileUWLite,
  projectUWEnvelopeToLite,
  stringifyUWX,
} from './lite-bridge.js';
import { UW_LITE_REPRESENTATION_ID } from './source-representation.js';

const [, , command, ...args] = process.argv;

function readFile(path: string): string {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    console.error(`Error: file not found: ${resolved}`);
    process.exit(1);
  }
  return readFileSync(resolved, 'utf-8');
}

function loadInstitutionConfig(path: string | undefined): InstitutionConfig | undefined {
  if (!path) return undefined;
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf-8')) as InstitutionConfig;
  } catch {
    console.error(`Warning: could not load institution config: ${path}`);
    return undefined;
  }
}

function parseFlags(rawArgs: string[]): Record<string, string | boolean> {
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

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdParse(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const detection = detectUWSourceRepresentation(content, file);
  if (detection.representation !== UWX_REPRESENTATION_ID) {
    const lite = parseUWLite(content);
    console.log(
      JSON.stringify(
        {
          representation: lite.representation,
          representation_version: lite.representation_version,
          frontmatter: lite.frontmatter,
          fields: lite.fields,
          issues: lite.issues,
        },
        null,
        flags['compact'] ? 0 : 2,
      ),
    );
    return;
  }
  for (const warning of detection.warnings) console.warn(`Warning: ${warning}`);
  const parsed = parseUWFile(content, { strict: flags['strict'] === true });
  const output = {
    frontmatter: parsed.frontmatter,
    sections: Object.fromEntries(
      Object.entries(parsed.sections).map(([id, block]) => [id, block])
    ),
    prose: parsed.prose,
    pipeline_log: parsed.pipeline_log.map(b => b.content),
    superseded_blocks: Object.fromEntries(
      Object.entries(parsed.superseded).map(([id, blocks]) => [id, blocks.map(b => b.content)])
    ),
  };
  console.log(JSON.stringify(output, null, flags['compact'] ? 0 : 2));
}

function cmdValidate(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const detection = detectUWSourceRepresentation(content, file);
  if (detection.representation !== UWX_REPRESENTATION_ID) {
    const lite = parseUWLite(content);
    const errors = lite.issues.filter((issue) => issue.severity === 'error');
    const warnings = lite.issues.filter((issue) => issue.severity === 'warning');
    const result = {
      representation: lite.representation,
      overall_status: errors.length > 0 ? 'errors' : warnings.length > 0 ? 'warnings' : 'clean',
      issues: lite.issues,
      errors,
      warnings,
    };
    if (flags['json']) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`\n${result.overall_status.toUpperCase()} - ${basename(file)}\n`);
    if (result.issues.length === 0) {
      console.log('No Lite syntax issues found.');
    } else {
      for (const issue of result.issues) {
        const location = issue.line ? ` line ${issue.line}` : '';
        const field = issue.field_path ? ` [${issue.field_path}]` : '';
        console.log(
          `  [${issue.severity.toUpperCase()}]${location}${field} ${issue.code}: ${issue.message}`,
        );
      }
    }
    console.log('');
    process.exit(errors.length > 0 ? 1 : 0);
  }
  for (const warning of detection.warnings) console.warn(`Warning: ${warning}`);
  const parsed = parseUWFile(content);
  const instCfg = loadInstitutionConfig(flags['institution'] as string | undefined);
  const result = validateUWFile(parsed, instCfg?.thresholds);

  if (flags['json']) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const statusEmoji = {
    clean: '✓',
    warnings: '⚠',
    errors: '✗',
    blocking: '🚫',
  }[result.overall_status];

  console.log(`\n${statusEmoji}  ${result.overall_status.toUpperCase()} — ${basename(file)}\n`);

  console.log('Stage Readiness:');
  for (const [stage, ready] of Object.entries(result.stage_readiness)) {
    console.log(`  ${ready ? '✓' : '✗'}  ${stage}`);
  }

  if (result.issues.length > 0) {
    console.log(`\nIssues (${result.issues.length}):`);
    for (const issue of result.issues) {
      const prefix = issue.severity === 'error' ? '[ERROR]' : issue.severity === 'warning' ? '[WARN] ' : '[INFO] ';
      const location = issue.section ? ` [${issue.section}${issue.field ? `.${issue.field}` : ''}]` : '';
      console.log(`  ${prefix}${location} ${issue.message}`);
    }
  } else {
    console.log('\nNo issues found.');
  }
  console.log('');

  process.exit(result.errors.length > 0 ? 1 : 0);
}

async function cmdVerify(file: string, flags: Record<string, string | boolean>): Promise<void> {
  const content = readFile(file);
  const parsed = parseUWFile(content);

  // No flag set → run all three.
  const onlyValidate = flags['validate'] === true;
  const onlyIntegrity = flags['integrity'] === true;
  const onlyPolicy = flags['policy'] === true;
  const runAll = !onlyValidate && !onlyIntegrity && !onlyPolicy;

  const sections: Record<string, unknown> = {};
  let hadError = false;

  if (runAll || onlyValidate) {
    const v = validateUWFile(parsed);
    sections['validation'] = v;
    if (v.errors.length > 0) hadError = true;
  }
  let chain: IntegrityResult | undefined;
  let prov: IntegrityResult | undefined;
  if (runAll || onlyIntegrity) {
    chain = await verifyChain(parsed);
    sections['integrity'] = chain;
    if (!chain.ok) hadError = true;
  }
  if (runAll || onlyPolicy) {
    prov = verifyProvenance(parsed);
    sections['provenance'] = prov;
    if (!prov.ok) hadError = true;
  }

  if (flags['json']) {
    console.log(JSON.stringify({ ok: !hadError, ...sections }, null, 2));
  } else {
    console.log(`\n${hadError ? '✗' : '✓'}  ${hadError ? 'FAIL' : 'OK'} — ${basename(file)}\n`);
    if ('validation' in sections) {
      const v = sections['validation'] as ReturnType<typeof validateUWFile>;
      console.log(`Validation: ${v.overall_status} (${v.issues.length} issue${v.issues.length === 1 ? '' : 's'})`);
      for (const issue of v.issues) {
        const tag = issue.severity === 'error' ? '[ERROR]' : issue.severity === 'warning' ? '[WARN] ' : '[INFO] ';
        const loc = issue.section ? ` [${issue.section}${issue.field ? `.${issue.field}` : ''}]` : '';
        console.log(`  ${tag}${loc} ${issue.code ? `${issue.code}: ` : ''}${issue.message}`);
      }
    }
    if (chain) {
      console.log(`\nIntegrity: ${chain.ok ? 'ok' : 'FAIL'} — chains_with_hashes=${chain.chains_with_hashes}, chains_verified=${chain.chains_verified}`);
      for (const issue of chain.issues) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.code}${issue.section ? ` [${issue.section}]` : ''}: ${issue.message}`);
      }
    }
    if (prov) {
      console.log(`\nProvenance: ${prov.ok ? 'ok' : 'FAIL'} (${prov.issues.length} issue${prov.issues.length === 1 ? '' : 's'})`);
      for (const issue of prov.issues) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.code}${issue.section ? ` [${issue.section}]` : ''}: ${issue.message}`);
      }
    }
    console.log('');
  }
  process.exit(hadError ? 1 : 0);
}

function cmdCompact(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const parsed = parseUWFile(content);
  const totalSuperseded = Object.values(parsed.superseded).reduce((n, arr) => n + arr.length, 0);

  if (totalSuperseded === 0) {
    console.log(`No superseded blocks found in ${basename(file)} — nothing to compact.`);
    return;
  }

  const compacted = compact(parsed);

  if (flags['dry-run']) {
    console.log(`Would remove ${totalSuperseded} superseded block(s) from ${basename(file)}.`);
    console.log(`Original: ${content.length} bytes → Compacted: ${compacted.length} bytes`);
    return;
  }

  const outPath = flags['output']
    ? resolve(flags['output'] as string)
    : resolve(file);

  writeFileSync(outPath, compacted, 'utf-8');
  console.log(`Compacted ${totalSuperseded} superseded block(s). Wrote to: ${outPath}`);
}

function cmdDiff(fileA: string, fileB: string): void {
  const contentA = readFile(fileA);
  const contentB = readFile(fileB);
  const parsedA = parseUWFile(contentA);
  const parsedB = parseUWFile(contentB);
  const diffs = diff(parsedA, parsedB);

  const changed = diffs.filter(d => d.status !== 'unchanged');
  if (changed.length === 0) {
    console.log('No differences found between sections.');
    return;
  }

  console.log(`\nDiff: ${basename(fileA)} → ${basename(fileB)}\n`);
  for (const d of changed) {
    const icon = d.status === 'added' ? '+' : d.status === 'removed' ? '-' : '~';
    console.log(`  ${icon}  ${d.sectionId} (${d.status})`);
    if (d.changedFields?.length) {
      for (const f of d.changedFields) {
        console.log(`       · ${f}`);
      }
    }
  }
  console.log('');
}

function cmdInit(flags: Record<string, string | boolean>): void {
  const content = generateBlankUWFile({
    dealName: flags['name'] as string | undefined,
    address: flags['address'] as string | undefined,
    city: flags['city'] as string | undefined,
    state: flags['state'] as string | undefined,
    zip: flags['zip'] as string | undefined,
    assetClass: flags['asset-class'] as AssetClass | undefined,
    dealStage: flags['stage'] as DealStage | undefined,
    tier: (flags['tier'] as 'screener' | 'analyst' | undefined) ?? 'screener',
  });

  const filename = (flags['output'] as string | undefined)
    ?? (flags['name'] ? `${(flags['name'] as string).replace(/\s+/g, '-').toLowerCase()}.uw.md` : 'new-deal.uw.md');

  const outPath = resolve(filename);
  writeFileSync(outPath, content, 'utf-8');
  console.log(`Created: ${outPath}`);
}

function cmdSummary(file: string): void {
  const content = readFile(file);
  const parsed = parseUWFile(content);
  const fm = parsed.frontmatter;
  const qm = fm.quick_metrics ?? {};

  const fmt = (v: unknown, unit = ''): string =>
    v == null ? 'n/a' : `${typeof v === 'number' ? v.toLocaleString() : v}${unit}`;

  const pctFmt = (v: unknown): string =>
    v == null ? 'n/a' : `${((v as number) * 100).toFixed(2)}%`;

  console.log(`
─────────────────────────────────────────────────
  ${fm.deal_name ?? 'Untitled'}
  ${fm.property_address ?? ''}, ${fm.city ?? ''} ${fm.state ?? ''}
  ${fm.asset_class ?? ''} · ${fm.deal_stage ?? 'draft'}
─────────────────────────────────────────────────
  Purchase Price:   $${fmt(qm.purchase_price)}
  Loan Amount:      $${fmt(qm.loan_amount)}
  Equity Required:  $${fmt(qm.equity_required)}
  UW NOI:           $${fmt(qm.noi_underwritten)}
  DSCR:             ${fmt(qm.dscr)}x
  LTV:              ${pctFmt(qm.ltv)}
  Cap Rate:         ${pctFmt(qm.cap_rate)}
  Debt Yield:       ${pctFmt(qm.debt_yield)}
  Projected IRR:    ${pctFmt(qm.irr_projected)}
─────────────────────────────────────────────────
  Deal ID:    ${fm.deal_id ?? 'n/a'}
  Flags:      ${(fm.flags ?? []).length > 0 ? (fm.flags ?? []).join(', ') : 'none'}
  Blocking:   ${(fm.blocking_flags ?? []).length > 0 ? (fm.blocking_flags ?? []).join(', ') : 'none'}
─────────────────────────────────────────────────
  Sections present: ${Object.keys(parsed.sections).length}
  Pipeline log entries: ${parsed.pipeline_log.length}
  Superseded blocks: ${Object.values(parsed.superseded).reduce((n, a) => n + a.length, 0)}
─────────────────────────────────────────────────
`);
}

async function cmdExport(file: string, flags: Record<string, string | boolean>): Promise<void> {
  const includeSuperseded = !(flags['no-superseded'] === true || flags['compact'] === true);
  const loaded = await loadEnvelope(file);
  const envelope = includeSuperseded ? loaded : { ...loaded, superseded: {} };
  const text = stringifyUWEnvelope(await stampEnvelopeDigest(envelope));

  // Default output path: swap the .uw.md suffix for .uw.json (fall back to appending).
  const outPath = flags['output']
    ? resolve(flags['output'] as string)
    : resolve(replaceUWExtension(file, '.uw.json'));

  if (flags['stdout']) {
    process.stdout.write(text);
    return;
  }

  writeFileSync(outPath, text, 'utf-8');
  console.log(`Exported ${basename(file)} → ${basename(outPath)} (.uw.json sibling)`);
}

const FORMAT_ALIASES: Record<string, string> = {
  json: 'uw-json',
  xml: 'uw-xml',
  csv: 'uw-csv-bundle',
  'csv-bundle': 'uw-csv-bundle',
  'uw-json': 'uw-json',
  lite: 'uw-lite-markdown',
  uw: 'uw-lite-markdown',
  uwx: 'uwx-markdown',
  'uw-lite': 'uw-lite-markdown',
  'uw-lite-markdown': 'uw-lite-markdown',
  'uwx-markdown': 'uwx-markdown',
  'uw-xml': 'uw-xml',
  'uw-csv-bundle': 'uw-csv-bundle',
};

async function loadEnvelope(file: string): Promise<UWDocumentEnvelope> {
  const lower = file.toLowerCase();
  if (lower.endsWith('.uw.md') || lower.endsWith(UWX_EXTENSION)) {
    const content = readFile(file);
    const detection = detectUWSourceRepresentation(content, file);
    if (detection.representation !== UWX_REPRESENTATION_ID) {
      const compilation = compileUWLite(parseUWLite(content));
      if (!compilation.ok) {
        const issues = compilation.report.issues
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join('; ');
        throw new Error(`UW Lite compilation failed: ${issues}`);
      }
      return compilation.envelope;
    }
    for (const warning of detection.warnings) console.warn(`Warning: ${warning}`);
    return toUWEnvelope(parseUWFile(content));

  }
  const sourceCodec = CORE_CODEC_REGISTRY.findByFileName(file);
  if (!sourceCodec || !sourceCodec.descriptor.directions.includes('read')) {
    throw new Error(`Cannot detect a readable UW representation for ${file}.`);
  }
  const input = sourceCodec.descriptor.id === 'uw-csv-bundle'
    ? new Uint8Array(readFileSync(resolve(file)))
    : readFile(file);
  return sourceCodec.decode(input);
}

function replaceUWExtension(file: string, extension: string): string {
  const lower = file.toLowerCase();
  for (const suffix of ['.uw.csv.zip', '.uw.md', '.uw.json', '.uw.xml']) {
    if (lower.endsWith(suffix)) return `${file.slice(0, -suffix.length)}${extension}`;
  }
  return `${file}${extension}`;
}

async function cmdConvert(file: string, flags: Record<string, string | boolean>): Promise<void> {
  const requested = flags['to'];
  if (typeof requested !== 'string') {
    throw new Error(
      'convert requires --to uw-lite-markdown|uwx-markdown|uw-json|uw-xml|uw-csv-bundle.',
    );
  }
  const targetId = FORMAT_ALIASES[requested.toLowerCase()] ?? requested;
  const envelope = await loadEnvelope(file);
  let encoded: string | Uint8Array;
  let extension: string;
  if (targetId === UWX_REPRESENTATION_ID) {
    encoded = stringifyUWX(envelope);
    extension = UWX_EXTENSION;
  } else if (targetId === UW_LITE_REPRESENTATION_ID) {
    const projection = projectUWEnvelopeToLite(envelope);
    encoded = projection.content;
    extension = '.uw.md';
    if (projection.report.lossy) {
      console.warn(
        `Warning: Lite projection omitted ${projection.report.omitted_paths.length} advanced path(s).`,
      );
    }
    if (typeof flags['projection-report'] === 'string') {
      writeFileSync(
        resolve(flags['projection-report']),
        JSON.stringify(projection.report, null, 2),
        'utf-8',
      );
    }
  } else {
    const target = CORE_CODEC_REGISTRY.get(targetId);
    if (!target.descriptor.directions.includes('write')) {
      throw new Error(`Representation ${targetId} is not writable.`);
    }
    const targetEncoded = await target.encode(envelope);
    if (typeof targetEncoded !== 'string' && !(targetEncoded instanceof Uint8Array)) {
      throw new Error(`Representation ${targetId} did not produce file-compatible output.`);
    }
    encoded = targetEncoded;
    extension = target.descriptor.file_extensions[0];
  }
  if (typeof encoded !== 'string' && !(encoded instanceof Uint8Array)) {
    throw new Error(`Representation ${targetId} did not produce file-compatible output.`);
  }
  if (flags['stdout']) {
    process.stdout.write(typeof encoded === 'string' ? encoded : Buffer.from(encoded));
    return;
  }
  const outPath = flags['output']
    ? resolve(flags['output'] as string)
    : resolve(replaceUWExtension(file, extension));
  writeFileSync(outPath, encoded, 'utf-8');
  console.log(`Converted ${basename(file)} → ${basename(outPath)} (${targetId})`);
}
// ─── Receipts (RFC 0016 / spec/UW_RECEIPT_v1.md) ─────────────────────────────

async function cmdReceiptIssue(
  file: string,
  flags: Record<string, string | boolean>,
): Promise<void> {
  const receipt = await issueReceipt(readFile(file), {
    filename: file,
    issuer: `uwmd-cli@${CORE_VERSION}`,
    ...(typeof flags['issued-at'] === 'string' ? { issued_at: flags['issued-at'] } : {}),
  });
  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;

  if (flags['stdout']) {
    process.stdout.write(serialized);
    return;
  }
  const outPath = flags['output']
    ? resolve(flags['output'] as string)
    : resolve(`${file.replace(/\.(uw|uwx)\.md$/i, '')}.receipt.json`);
  writeFileSync(outPath, serialized, 'utf-8');

  const computed = receipt.computation.results.filter((r) => r.computed).length;
  console.log(
    `Issued receipt for ${basename(file)} → ${basename(outPath)} ` +
      `(${receipt.computation.pack}@${receipt.computation.pack_version}, ` +
      `${computed}/${receipt.computation.results.length} outputs computed)`,
  );
  console.log(
    'A receipt attests that these outputs follow from this record. It does not attest that the inputs are true.',
  );
}

async function cmdReceiptVerify(
  file: string,
  receiptPath: string,
  flags: Record<string, string | boolean>,
): Promise<void> {
  let receipt: UWReceipt;
  try {
    const raw = JSON.parse(readFileSync(resolve(receiptPath), 'utf-8')) as unknown;
    assertUWReceipt(raw);
    receipt = raw;
  } catch (e) {
    console.error(`Not a readable receipt: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  const result = await verifyReceipt(receipt, readFile(file), { filename: file });

  if (flags['json']) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Verdict: ${result.verdict.toUpperCase()}`);
    for (const issue of result.issues) {
      const detail =
        issue.expected !== undefined || issue.actual !== undefined
          ? ` (expected ${issue.expected ?? '—'}, got ${issue.actual ?? '—'})`
          : '';
      console.log(`  [${issue.code}] ${issue.message}${detail}`);
    }
    if (result.verdict === 'verified') {
      console.log(
        '\nThis record is unchanged since issuance and its stated outputs follow deterministically\n' +
          'from its contents. It is NOT a statement that the inputs are true, complete, or approved.',
      );
    } else if (result.verdict === 'unverifiable') {
      console.log('\nThis verifier could not decide. That is not a negative result.');
    }
  }

  // 0 verified, 1 failed, 3 unverifiable — so scripts can tell the third state apart.
  if (result.verdict === 'failed') process.exit(1);
  if (result.verdict === 'unverifiable') process.exit(3);
}

function cmdFormats(flags: Record<string, string | boolean>): void {
  const descriptors = [
    UW_LITE_SOURCE_DESCRIPTOR,
    UWX_SOURCE_DESCRIPTOR,
    ...CORE_CODEC_REGISTRY.list(),
  ];
  if (flags['json']) {
    console.log(JSON.stringify(descriptors, null, 2));
    return;
  }
  console.log('Registered UW representations:\n');
  for (const descriptor of descriptors) {
    console.log(
      `  ${descriptor.id.padEnd(16)} ${descriptor.fidelity.padEnd(6)} ${descriptor.directions.join('/').padEnd(10)} ${descriptor.media_types[0]}`,
    );
  }
}
function cmdReport(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const parsed = parseUWFile(content);
  const result = renderReportHtml(parsed, {
    tier: flags['tier'] as RenderTier | undefined,
    preparedBy: flags['prepared-by'] as string | undefined,
  });

  // Default output path: swap the .uw.md suffix for .report.html.
  const outPath = flags['output']
    ? resolve(flags['output'] as string)
    : resolve(file.endsWith('.uw.md') ? `${file.slice(0, -'.uw.md'.length)}.report.html` : `${file}.report.html`);

  if (flags['stdout']) {
    process.stdout.write(result.html);
    return;
  }

  writeFileSync(outPath, result.html, 'utf-8');
  const label = result.tier === 'analyst' ? 'credit memo' : 'lender package';
  console.log(`Rendered ${label} → ${basename(outPath)} (${result.sectionsRendered.length} sections${result.sectionsSkipped.length ? `, skipped: ${result.sectionsSkipped.join(', ')}` : ''})`);
  console.log('For PDF output, use @uwmd/report (uwmd-report) or print this HTML from a browser.');
}

function cmdScope(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const parsed = parseUWFile(content);
  const assetClass =
    (flags['asset-class'] as string | undefined) ??
    (parsed.frontmatter.asset_class as string | undefined) ??
    'multifamily';

  const table = getAssetClassDefaults(assetClass);
  if (!table) {
    console.error(`No published asset-class default table for '${assetClass}'.`);
    process.exit(1);
  }

  const out: Record<string, { value: unknown; step: string; range?: unknown; resolved_from?: string }> = {};
  for (const path of Object.keys(table.fields)) {
    const r = resolveValue(path, parsed);
    out[path] = {
      value: r.value,
      step: r.step,
      range: r.range,
      resolved_from: r.resolved_from,
    };
  }

  const payload = {
    deal_id: parsed.frontmatter.deal_id ?? null,
    deal_stage_target: 'scope',
    asset_class: assetClass,
    defaults_table: `${assetClass}@${table.version}`,
    resolved: out,
  };
  const text = JSON.stringify(payload, null, 2);
  if (flags['output']) {
    writeFileSync(resolve(flags['output'] as string), text, 'utf-8');
    console.log(`Scope view written to ${flags['output']} (${Object.keys(out).length} fields)`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

function cmdRefine(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const parsed = parseUWFile(content);
  const targets = flags['targets']
    ? (flags['targets'] as string).split(',').map(s => s.trim()).filter(Boolean)
    : undefined;
  const top = flags['top'] ? Number.parseInt(flags['top'] as string, 10) : 10;

  const assetClass =
    (flags['asset-class'] as string | undefined) ??
    (parsed.frontmatter.asset_class as string | undefined) ??
    'multifamily';
  const pack = getPackForAssetClass(assetClass) ?? MULTIFAMILY_PACK;

  const result = rankGaps(parsed, { targets, top, packs: [pack] });

  if (flags['json']) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  console.log('\n─── Refinement ranking ───');
  console.log(`graph_size=${result.diagnostics.graph_size} resolved=${result.diagnostics.resolved} perturbations=${result.diagnostics.perturbations}`);
  if (result.diagnostics.non_monotonic.length > 0) {
    console.log(`⚠  Non-monotonic outputs: ${result.diagnostics.non_monotonic.map(w => w.output_id).join(', ')}`);
  }
  console.log('');
  if (result.by_voi.length === 0) {
    console.log('No gap-driven inputs found among the requested targets.');
    return;
  }
  result.by_voi.forEach((g, i) => {
    console.log(`${i + 1}. ${g.field_path}`);
    console.log(`   range:    [${g.prior_range.low} … ${g.prior_range.central} … ${g.prior_range.high}]`);
    console.log(`   voi:      ${g.total_voi.toFixed(4)}`);
    console.log(`   touches:  ${g.affected_outputs.map(o => o.output_id).join(', ')}`);
    if (g.question_template) console.log(`   ask:      "${g.question_template}"`);
    console.log('');
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

const flags = parseFlags(args);
// Positional args: non-flag tokens that don't immediately follow a --flag
const positional: string[] = [];
for (let _i = 0; _i < args.length; _i++) {
  const a = args[_i];
  if (a.startsWith('--')) { _i++; continue; } // skip flag + its value
  positional.push(a);
}

// Top-level async wrapper so `run --live` can use await
(async () => {
switch (command) {
  case 'parse':
    if (!positional[0]) { console.error('Usage: uwmd parse <file> [--compact] [--strict]'); process.exit(1); }
    cmdParse(positional[0], flags);
    break;

  case 'validate':
    if (!positional[0]) { console.error('Usage: uwmd validate <file> [--stage <stage>] [--institution <config.json>] [--json]'); process.exit(1); }
    cmdValidate(positional[0], flags);
    break;

  case 'verify':
    if (!positional[0]) { console.error('Usage: uwmd verify <file> [--validate] [--integrity] [--policy] [--json]'); process.exit(1); }
    await cmdVerify(positional[0], flags);
    break;

  case 'compact':
    if (!positional[0]) { console.error('Usage: uwmd compact <file> [--output <file>] [--dry-run]'); process.exit(1); }
    cmdCompact(positional[0], flags);
    break;

  case 'diff':
    if (!positional[0] || !positional[1]) { console.error('Usage: uwmd diff <file-a> <file-b>'); process.exit(1); }
    cmdDiff(positional[0], positional[1]);
    break;

  case 'render': {
    if (!positional[0]) { console.error('Usage: uwmd render <file> [--format <json|csv|chat|summary>] [--profile <summary|live|compact|full|relevant>] [--sections a,b,c] [--max-tokens 12000] [--no-meta] [--output <file>] [--tier screener|analyst]'); process.exit(1); }
    const content = readFile(positional[0]);
    const parsedFile = parseUWFile(content);

    if (flags['profile']) {
      const profile = flags['profile'] as ContextProfile;
      const validProfiles = ['summary', 'live', 'compact', 'full', 'relevant'] as const;
      if (!validProfiles.includes(profile as (typeof validProfiles)[number])) {
        console.error(`Unknown profile '${profile as string}'. Valid: ${validProfiles.join(' | ')}`);
        process.exit(1);
      }
      const sectionsList = flags['sections']
        ? (flags['sections'] as string).split(',').map(s => s.trim()).filter(Boolean)
        : undefined;
      const result = buildContext(parsedFile, profile, {
        sections: sectionsList,
        maxTokens: flags['max-tokens'] ? Number.parseInt(flags['max-tokens'] as string, 10) : undefined,
        includeMeta: flags['no-meta'] ? false : undefined,
      });
      if (flags['output']) {
        writeFileSync(resolve(flags['output'] as string), result.content, 'utf-8');
        console.log(`Rendered profile=${profile} → ${flags['output']}${result.truncated ? ' [TRUNCATED]' : ''} (~${result.tokenEstimate} tokens)`);
      } else {
        process.stdout.write(`${result.content}\n`);
        process.stderr.write(`(~${result.tokenEstimate} tokens, profile=${profile}${result.truncated ? ', truncated' : ''})\n`);
      }
      break;
    }

    const fmt = (flags['format'] as string | undefined) ?? 'summary';
    const result = render(parsedFile, {
      format: fmt as RenderFormat,
      tier: flags['tier'] as RenderTier | undefined,
      maxTokens: flags['max-tokens'] ? Number.parseInt(flags['max-tokens'] as string, 10) : undefined,
    });
    if (flags['output']) {
      writeFileSync(resolve(flags['output'] as string), result.content, 'utf-8');
      console.log(`Rendered ${fmt} → ${flags['output']}${result.truncated ? ' [TRUNCATED]' : ''}${result.estimatedTokens ? ` (~${result.estimatedTokens} tokens)` : ''}`);
    } else {
      process.stdout.write(`${result.content}\n`);
      if (result.estimatedTokens) process.stderr.write(`(~${result.estimatedTokens} tokens)\n`);
    }
    break;
  }

  case 'run': {
    if (!positional[0]) {
      console.error('Usage: uwmd run <file> --agent <agent_id> [--section <id>] [--context-only] [--output <file>]');
      process.exit(1);
    }
    const agentId = flags['agent'] as string | undefined;
    if (!agentId) { console.error('--agent <agent_id> is required (e.g. --agent L1, --agent L2-CRE-11)'); process.exit(1); }
    const fileContent = readFile(positional[0]);
    const parsedFile = parseUWFile(fileContent);
    const ctx = buildAgentContext(parsedFile, agentId);

    if (flags['context-only']) {
      // Print the context that would be sent to the agent — useful for debugging
      console.log(`\n─── Agent: ${agentId} — ${ctx.layer.name} ───`);
      console.log(`Reads: ${ctx.layer.reads.join(', ') || 'all'}`);
      console.log(`Writes: ${ctx.layer.writes.join(', ')}`);
      console.log(`Sections available: ${Object.keys(ctx.sections).join(', ')}`);
      console.log(`Missing required: ${ctx.missingRequired.join(', ') || 'none'}`);
      console.log(`Missing optional: ${ctx.missingOptional.join(', ') || 'none'}`);
      console.log(`Blocking flags: ${ctx.blockingFlags.join(', ') || 'none'}`);
      console.log(`Context ready: ${isContextReady(ctx)}`);
      console.log(`\n── Chat context (~${ctx.chatTokenEstimate} tokens) ──\n`);
      console.log(ctx.chatContext);
      break;
    }

    if (flags['prompt']) {
      // Print the system prompt + user message that would be sent to Claude
      const { systemPrompt, userMessage, outputSchemaDescription } = buildAgentPrompt(ctx);
      console.log('=== SYSTEM PROMPT ===\n');
      console.log(systemPrompt);
      console.log('\n=== OUTPUT SCHEMA ===\n');
      console.log(outputSchemaDescription);
      console.log('\n=== USER MESSAGE ===\n');
      console.log(userMessage);
      break;
    }

    if (!isContextReady(ctx)) {
      console.error(`Cannot run ${agentId}: context not ready.`);
      if (ctx.blockingFlags.length) console.error(`  Blocking flags: ${ctx.blockingFlags.join(', ')}`);
      if (ctx.missingRequired.length) console.error(`  Missing required sections: ${ctx.missingRequired.join(', ')}`);
      process.exit(1);
    }

    // --live: actually call Claude and write the result back to the file
    if (flags['live']) {
      const apiKey = (flags['api-key'] as string | undefined) ?? process.env['ANTHROPIC_API_KEY'];
      if (!apiKey) {
        console.error('--live requires ANTHROPIC_API_KEY env var or --api-key flag');
        process.exit(1);
      }
      console.log(`\nRunning ${agentId} — ${ctx.layer.name} against ${basename(positional[0])}`);
      console.log(`Model: ${(flags['model'] as string | undefined) ?? 'claude-sonnet-4-6'}\n`);

      const result = await runBancroftAgent(fileContent, agentId, {
        apiKey,
        model: flags['model'] as string | undefined,
        userInstructions: flags['instructions'] as string | undefined,
        onProgress: (evt) => {
          const icons: Record<string, string> = { context_built: '●', calling_claude: '⟳', parsing_output: '◆', writing_block: '✎', complete: '✓', error: '✗' };
          console.log(`  ${icons[evt.stage] ?? '·'} [${evt.stage}] ${evt.message}`);
        },
      });

      if (!result.success) {
        console.error(`\nAgent failed: ${result.error}`);
        process.exit(1);
      }

      const outPath = flags['output'] ? resolve(flags['output'] as string) : resolve(positional[0]);
      writeFileSync(outPath, result.updatedContent, 'utf-8');
      console.log(`\nWrote: ${result.sectionsWritten.join(', ')} → ${basename(outPath)}`);
      console.log(`Tokens: ${result.tokensUsed.input} in / ${result.tokensUsed.output} out | ${result.durationMs}ms`);
      break;
    }

    // When --section and --json-input are provided, write a block from stdin
    const sectionId = flags['section'] as string | undefined;
    if (sectionId && flags['json-input']) {
      const jsonInput = readFile(flags['json-input'] as string);
      let blockContent: Record<string, unknown>;
      try {
        blockContent = JSON.parse(jsonInput) as Record<string, unknown>;
      } catch (err) {
        console.error(`Could not parse JSON input: ${err}`);
        process.exit(1);
      }

      const runResult = writeAgentBlock(fileContent, parsedFile, { sectionId, content: blockContent }, {
        agentId,
        actor: 'system',
        inputSections: ctx.layer.reads,
      });

      const outPath = flags['output'] ? resolve(flags['output'] as string) : resolve(positional[0]);
      writeFileSync(outPath, runResult.content, 'utf-8');
      console.log(`Wrote ${sectionId} v${runResult.newBlock.version} to ${basename(outPath)} [${runResult.supersededPriorBlock ? 'superseded prior' : 'new section'}]`);
      break;
    }

    // No JSON input — print instructions for how to use this command
    console.log(`\nAgent: ${agentId} — ${ctx.layer.name}`);
    console.log(`Context ready: ${isContextReady(ctx)}\n`);
    console.log('To write a block from agent output:');
    console.log(`  uwmd run ${positional[0]} --agent ${agentId} --section <id> --json-input <output.json> [--output <file>]`);
    console.log('\nTo inspect the context this agent would receive:');
    console.log(`  uwmd run ${positional[0]} --agent ${agentId} --context-only`);
    console.log('\nTo view the system + user prompts:');
    console.log(`  uwmd run ${positional[0]} --agent ${agentId} --prompt`);
    break;
  }

  case 'layers':
    console.log('\nBancroft agent layers:\n');
    for (const layer of BANCROFT_LAYERS) {
      console.log(`  ${layer.id.padEnd(4)} ${layer.name.padEnd(22)} reads: ${(layer.reads[0] === '*' ? ['all'] : layer.reads).slice(0, 3).join(', ')}${layer.reads.length > 3 ? '…' : ''}`);
    }
    console.log('');
    break;

  case 'edit': {
    if (!positional[0] || !positional[1]) {
      console.error('Usage: uwmd edit <file> <operation.json> [--actor <name>] [--source <pattern>] [--agent-id <id>] [--agent-version <v>] [--confidence high|medium|low] [--output <file>]');
      process.exit(1);
    }
    const fileContent = readFile(positional[0]);
    const opJson = readFile(positional[1]);
    let op: EditOperation;
    try {
      op = JSON.parse(opJson) as EditOperation;
    } catch (err) {
      console.error(`Could not parse operation JSON: ${err}`);
      process.exit(1);
    }
    const parsedFile = parseUWFile(fileContent);
    const ctx: EditContext = {
      actor: (flags['actor'] as string | undefined) ?? 'system',
      source: (flags['source'] as string | undefined) ?? 'manual',
      agentId: (flags['agent-id'] as string | undefined) ?? null,
      agentVersion: (flags['agent-version'] as string | undefined) ?? null,
      confidence: (flags['confidence'] as 'high' | 'medium' | 'low' | undefined) ?? 'medium',
    };
    const result = applyEdit(fileContent, parsedFile, op, ctx);
    if (!result.ok || !result.content) {
      console.error(`Edit rejected: [${result.error?.code}] ${result.error?.message}`);
      if (result.error?.pointer) console.error(`  pointer: ${result.error.pointer}`);
      process.exit(1);
    }
    const outPath = flags['output'] ? resolve(flags['output'] as string) : resolve(positional[0]);
    writeFileSync(outPath, result.content, 'utf-8');
    const summary = op.kind === 'frontmatter_set'
      ? `frontmatter.${op.path}`
      : op.kind === 'pipeline_log_append'
        ? 'pipeline_log entry'
        : `${op.section_id} v${result.newVersion}${result.supersededPriorBlock ? ' [superseded prior]' : ''}`;
    console.log(`Applied ${op.kind} (${summary}) → ${basename(outPath)}`);
    break;
  }

  case 'calc': {
    if (!positional[0] || !positional[1]) {
      console.error('Usage: uwmd calc <file> <calc.json|formula>');
      process.exit(1);
    }
    const fileContent = readFile(positional[0]!);
    const parsed = parseUWFile(fileContent);

    // Second arg is either a JSON file path or a raw formula string.
    let decls: ModuleCalcDecl[];
    const argTwo = positional[1]!;
    if (existsSync(resolve(argTwo))) {
      const raw = JSON.parse(readFileSync(resolve(argTwo), 'utf-8'));
      decls = Array.isArray(raw) ? raw : [raw];
    } else {
      decls = [{ id: 'inline', label: 'inline', formula: argTwo, deterministic: true }];
    }

    const ctx: CalcEvaluationContext = {
      parsed,
      prior_results: {},
      locale: 'en-US',
    };

    const results = decls.map((d) => evaluateCalc(d, ctx));
    for (const r of results) {
      if (r.ok) {
        console.log(`${r.calc_id} = ${r.display ?? String(r.value)}`);
      } else {
        console.log(`${r.calc_id} ERROR [${r.error?.code}] ${r.error?.message}`);
      }
    }
    if (flags['json']) {
      console.log(JSON.stringify(results, null, 2));
    }
    if (results.some((r) => !r.ok)) process.exit(1);
    break;
  }

  case 'init':
    cmdInit(flags);
    break;

  case 'summary':
    if (!positional[0]) { console.error('Usage: uwmd summary <file>'); process.exit(1); }
    cmdSummary(positional[0]);
    break;

  case 'export':
    if (!positional[0]) { console.error('Usage: uwmd export <file.uw.md> [--output <file.uw.json>] [--no-superseded] [--stdout]'); process.exit(1); }
    await cmdExport(positional[0], flags);
    break;

  case 'formats':
    cmdFormats(flags);
    break;

  case 'convert':
    if (!positional[0]) { console.error('Usage: uwmd convert <file.uw.md|file.uwx.md|file.uw.json|file.uw.xml|file.uw.csv.zip> --to lite|uwx|uw-json|uw-xml|uw-csv-bundle [--projection-report <file>] [--output <file>] [--stdout]'); process.exit(1); }
    await cmdConvert(positional[0], flags);
    break;
  case 'report':
    if (!positional[0]) { console.error('Usage: uwmd report <file.uw.md> [--tier screener|analyst] [--prepared-by <name>] [--output <file.html>] [--stdout]'); process.exit(1); }
    cmdReport(positional[0], flags);
    break;

  case 'scope':
    if (!positional[0]) { console.error('Usage: uwmd scope <file> [--asset-class multifamily] [--output <file>]'); process.exit(1); }
    cmdScope(positional[0], flags);
    break;

  case 'refine':
    if (!positional[0]) { console.error('Usage: uwmd refine <file> [--targets dscr,debt_yield] [--top 5] [--json]'); process.exit(1); }
    cmdRefine(positional[0], flags);
    break;

  case 'receipt': {
    const sub = positional[0];
    if (sub === 'issue') {
      if (!positional[1]) { console.error('Usage: uwmd receipt issue <file> [--output <file.receipt.json>] [--issued-at <iso>] [--stdout]'); process.exit(1); }
      await cmdReceiptIssue(positional[1], flags);
    } else if (sub === 'verify') {
      if (!positional[1] || !positional[2]) { console.error('Usage: uwmd receipt verify <file> <receipt.json> [--json]'); process.exit(1); }
      await cmdReceiptVerify(positional[1], positional[2], flags);
    } else {
      console.error('Usage: uwmd receipt <issue|verify> ...');
      process.exit(1);
    }
    break;
  }

  default:
    console.log(`
uwmd — UW Markdown underwriting file toolkit

Commands:
  parse    <file>              Parse file and output JSON
  validate <file>              Run all validation checks
  verify   <file>              Validate + verify integrity (hashes) + provenance (actor/policy)
  render   <file>              Render to output format (see --format)
  run      <file>              Invoke a Bancroft agent (see --agent)
  edit     <file> <op.json>    Apply an EditOperation (Tier-2)
  compact  <file>              Strip superseded blocks
  diff     <file-a> <file-b>  Compare two files section by section
  calc     <file> <calc.json>  Evaluate a calc declaration or inline formula (Tier-3)
  init                         Generate a blank .uwx.md file
  summary  <file>              Print quick metrics to terminal
  export   <file>              Export a digested UW JSON 1.0 document
  formats                       List registered machine representations
  convert  <file>              Convert Lite/UWX/JSON/XML/CSV bundle representations
  report   <file>              Render the lender package / credit memo HTML (§7.1/§7.2)
  scope    <file>              Resolve every required input via the fallback cascade and emit a triage view
  refine   <file>              Rank gaps by value-of-information for stated calc targets
  receipt  issue|verify         Issue or verify a detached verification receipt (RFC 0016)
  layers                       List Bancroft agent layers

Options:
  --output <path>    Output file path (compact, init)
  --dry-run          Show what would change without writing (compact)
  --json             JSON output (validate)
  --strict           Throw on parse errors instead of collecting
  --format <f>       Render format: json|csv|chat|summary (render, default: summary)
  --no-superseded    Drop append-only history from the .uw.json export (export)
  --stdout           Write export/convert output to stdout
  --to <format>       Target: lite|uwx|uw-json|uw-xml|uw-csv-bundle (convert)
  --projection-report Write the UWX-to-Lite omission report as JSON (convert)
  --issued-at <iso>  Fix the receipt issuance timestamp (receipt issue)
  --max-tokens <n>   Max tokens for chat render (default: 12000)
  --institution <f>  Path to .uw.institution.json config (validate)
  --name <n>         Deal name (init)
  --address <a>      Property address (init)
  --city <c>         City (init)
  --state <s>        State code (init)
  --asset-class <ac> Asset class (init)
  --stage <s>        Deal stage (init)
  --tier <t>         screener | analyst (init)
  --live             Actually call Claude (run command)
  --api-key <k>      Anthropic API key (run --live, or use ANTHROPIC_API_KEY)
  --model <m>        Claude model (run --live, default: claude-sonnet-4-6)
  --instructions <i> Extra instructions for the agent (run --live)
  --actor <n>        Actor name for the edit (edit, default: system)
  --source <s>       _meta.source pattern (edit, default: manual)
  --agent-id <id>    Agent identifier when source is agent/* (edit)
  --agent-version <v>Agent semver (edit)
  --confidence <c>   Confidence level for new block: high|medium|low (edit)
`);
    process.exit(0);
}
})().catch(err => { console.error(err); process.exit(1); });
