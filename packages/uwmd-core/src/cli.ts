#!/usr/bin/env node
// uwmd CLI — command-line interface for .uw.md files
// Commands: parse, validate, compact, diff, init, summary, render
// Usage: uwmd <command> <file> [options]

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { parseUWFile } from './parser.js';
import { validateUWFile } from './validator.js';
import { compact, diff } from './compactor.js';
import { migrateSourceTags } from './migrate-source-tags.js';
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
import { applyEdit, applyEditAsync } from './editor.js';
import { verifyChain, verifyProvenance, canonicalBlockSigningInput } from './integrity.js';
import { migrateToV2 } from './migrate-to-v2.js';
import type {
  BlockSignatureVerifier,
  IntegrityResult,
  VerifyChainOptions,
} from './integrity.js';
import type { EditContext, EditResult } from './editor.js';
import type { CapabilityVerifier, EditOperation, ModuleCalcDecl, CalcEvaluationContext, ViewerTier } from './protocol.js';
import { REFERENCE_IMPLEMENTATION_MANIFEST } from './protocol.js';
import { loadModuleManifest, createModuleRegistry, ModuleRegistryError } from './modules.js';
import {
  cmdLeaseValidate,
  cmdLeaseProject,
  cmdPackageCreate,
  cmdPackageVerify,
  cmdPackageList,
  cmdPackageToContext,
  cmdPackageContextValidate,
  cmdPackageEdges,
} from './cli-packages.js';
import { cmdPortfolioValidate, cmdPortfolioEdges } from './cli-portfolio.js';
import { evaluateCalc } from './calc/index.js';
import { buildAgentContext, buildAgentPrompt, isContextReady, BANCROFT_LAYERS } from './context.js';
import { runBancroftAgent } from './agents/bancroft.js';
import type { AssetClass, DealStage, InstitutionConfig } from './types.js';
import type { RenderFormat, RenderTier } from './renderer.js';
import { buildContext } from './context-profiles.js';
import type { ContextProfile } from './context-profiles.js';
import { rankGaps } from './refinement.js';
import { resolveValue } from './cascade.js';
import {
  parseUWPart,
  resolveComposition,
  externalizeSection,
  stringifyUWPart,
  UWPART_EXTENSION,
} from './composition.js';
import type { UWPart, ExternalizationResult } from './composition.js';
import type { ParsedUWFile } from './types.js';
import { createDocumentMarketData, parseMarketDataDocument } from './market-data.js';
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

import {
  parseFlags,
  extractPositionals,
  replaceUWExtension,
  hostTierFlag,
  defaultPartsDir,
  readManifestFile,
} from './cli-args.js';

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
  // The whole ParsedUWFile minus `raw` (which is just the input echoed back).
  // Four fields — custom_calculations, custom_scenarios, extensions, and the
  // full `superseded` blocks — used to be dropped here, so a caller that
  // trusted `uwmd parse` to be "the parsed file" silently lost every custom
  // calculation and every x_* extension in the document.
  //
  // `superseded_blocks` is kept alongside `superseded` for compatibility: it
  // carries only each prior block's `content`, where `superseded` carries the
  // whole block. New callers should read `superseded`.
  const output = {
    frontmatter: parsed.frontmatter,
    sections: Object.fromEntries(
      Object.entries(parsed.sections).map(([id, block]) => [id, block])
    ),
    prose: parsed.prose,
    pipeline_log: parsed.pipeline_log.map(b => b.content),
    custom_calculations: parsed.custom_calculations,
    custom_scenarios: parsed.custom_scenarios,
    extensions: parsed.extensions,
    superseded: parsed.superseded,
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

/**
 * Build the `verifyChain` options from `--signing --keystore=<path>`.
 *
 * `@uwmd/signing` is reached by dynamic import and declared as an optional peer
 * - the same arrangement `@anthropic-ai/sdk` gets. `@uwmd/core` must not take a
 * crypto dependency to satisfy a flag most invocations never pass, and the
 * layering invariant (core depends on no sibling package) forbids a static
 * import outright.
 */
async function signingOptions(
  flags: Record<string, string | boolean>,
): Promise<VerifyChainOptions> {
  if (!flags['signing']) return {};
  const keystore = flags['keystore'];
  if (typeof keystore !== 'string' || keystore.length === 0) {
    console.error('--signing requires --keystore=<path> to a JSON key store.');
    process.exit(1);
  }

  // Structurally typed rather than `typeof import('@uwmd/signing')`: a type
  // import would make core's build depend on signing's declarations, and
  // signing already depends on core's. That cycle is the layering invariant
  // reasserting itself, so the seam stays a two-function shape core states
  // itself and signing satisfies.
  interface SigningModule {
    loadKeyStoreFile(path: string): Promise<unknown>;
    createBlockSignatureVerifier(store: never): BlockSignatureVerifier;
  }
  let signing: SigningModule;
  try {
    signing = (await import('@uwmd/signing' as string)) as SigningModule;
  } catch {
    console.error(
      '--signing needs the optional @uwmd/signing package. Install it with `npm i @uwmd/signing`.',
    );
    process.exit(1);
  }

  try {
    const store = await signing.loadKeyStoreFile(resolve(keystore));
    return { signatureVerifier: signing.createBlockSignatureVerifier(store as never) };
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

async function cmdVerify(file: string, flags: Record<string, string | boolean>): Promise<void> {
  const content = readFile(file);
  // --resolved verifies the assembled record. Without it an externalized
  // section verifies as a directive, which is not the document anyone means.
  const parsed = withResolved(parseUWFile(content), file, flags);

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
  if (runAll || onlyIntegrity || flags['signing']) {
    chain = await verifyChain(parsed, await signingOptions(flags));
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
      if (chain.signatures_present > 0) {
        const checked = flags['signing']
          ? `${chain.signatures_verified} verified`
          : 'not checked (pass --signing --keystore=<path>)';
        console.log(`Signatures: ${chain.signatures_present} present, ${checked}`);
      }
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

function cmdMigrateSourceTags(file: string, flags: Record<string, string | boolean>): void {
  const content = readFile(file);
  const result = migrateSourceTags(content);

  for (const source of result.unmapped) {
    console.error(`[unmapped] _meta.source '${source}' was left in place — rewrite it by hand.`);
  }

  if (result.changed === 0) {
    console.log(`No legacy _meta.source values found in ${basename(file)} — nothing to migrate.`);
    return;
  }

  if (flags['dry-run']) {
    console.log(`Would migrate ${result.changed} block(s) in ${basename(file)} (RFC 0031 actor/resolution split).`);
    return;
  }

  const outPath = flags['output'] ? resolve(flags['output'] as string) : resolve(file);
  writeFileSync(outPath, result.content, 'utf-8');
  console.log(`Migrated ${result.changed} block(s). Wrote to: ${outPath}`);
}

async function cmdMigrateToV2(file: string, flags: Record<string, string | boolean>): Promise<void> {
  const content = readFile(file);

  // --resign needs the optional @uwmd/signing package plus the key holder's
  // private key. The engine stays crypto-free; the callback closes over the
  // loaded key (the same dynamic-import arrangement as `verify --signing`).
  let resign: import('./migrate-to-v2.js').MigrateToV2Options['resign'];
  if (flags['resign']) {
    const keyPath = flags['key'];
    if (typeof keyPath !== 'string' || keyPath.length === 0) {
      console.error('--resign requires --key=<private.jwk.json> (a JWK private key file).');
      process.exit(1);
    }
    const kid = flags['kid'];
    const alg = (flags['alg'] as string | undefined) ?? 'ed25519';
    if (typeof kid !== 'string' || kid.length === 0) {
      console.error('--resign requires --kid=<key id> (stamped into the new signatures).');
      process.exit(1);
    }
    // Structurally typed rather than `typeof import('@uwmd/signing')` — same
    // layering reasoning as the `--signing` seam above: signing depends on
    // core's declarations, so a type import here would close the cycle.
    interface ResignSigningModule {
      importPrivateKey(alg: string, material: { jwk: JsonWebKey }): Promise<unknown>;
      signPayload(payload: string, key: unknown): Promise<string>;
    }
    let signing: ResignSigningModule;
    try {
      signing = (await import('@uwmd/signing' as string)) as ResignSigningModule;
    } catch {
      console.error('--resign needs the optional @uwmd/signing package. Install it with `npm i @uwmd/signing`.');
      process.exit(1);
    }
    const jwk = JSON.parse(readFile(keyPath)) as JsonWebKey;
    const privateKey = await signing.importPrivateKey(alg, { jwk });
    const key = { kid, alg: alg as 'ed25519' | 'es256' | 'es384', privateKey };
    resign = async (req) => {
      const signedAt = new Date().toISOString();
      const payload = canonicalBlockSigningInput({
        content_hash: req.content_hash,
        section: req.section,
        actor: req.actor,
        timestamp: req.timestamp,
        kid: key.kid,
        signed_at: signedAt,
      });
      return { alg: key.alg, kid: key.kid, sig: await signing.signPayload(payload, key), signed_at: signedAt };
    };
  }

  const result = await migrateToV2(content, {
    stripSignatures: flags['strip-signatures'] === true,
    resign,
  });

  for (const note of result.notes) console.error(`[migrate] ${note}`);
  if (!result.ok) {
    for (const why of result.refusals) console.error(`[refused] ${why}`);
    process.exit(1);
  }

  if (result.changed === 0 && result.restamped === 0) {
    console.log(`Nothing to migrate in ${basename(file)}.`);
    return;
  }

  if (flags['dry-run']) {
    console.log(
      `Would migrate ${basename(file)} to uw_version "2.0": ${result.changed} block(s) reshaped, ${result.restamped} hash(es) re-stamped (RFC 0009).`,
    );
    return;
  }

  const outPath = flags['output'] ? resolve(flags['output'] as string) : resolve(file);
  writeFileSync(outPath, result.content as string, 'utf-8');
  console.log(
    `Migrated to uw_version "2.0": ${result.changed} block(s) reshaped, ${result.restamped} hash(es) re-stamped. Wrote to: ${outPath}`,
  );
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
  const requestedFormat = flags['format'] as string | undefined;
  if (requestedFormat !== undefined && requestedFormat !== '2.0' && requestedFormat !== '1.1') {
    console.error(`--format must be '2.0' (default, nested _meta) or '1.1' (legacy flat shape); got '${requestedFormat}'.`);
    process.exit(1);
  }
  const content = generateBlankUWFile({
    formatVersion: requestedFormat as '2.0' | '1.1' | undefined,
    dealName: flags['name'] as string | undefined,
    address: flags['address'] as string | undefined,
    city: flags['city'] as string | undefined,
    state: flags['state'] as string | undefined,
    zip: flags['zip'] as string | undefined,
    assetClass: flags['asset-class'] as AssetClass | undefined,
    dealStage: flags['stage'] as DealStage | undefined,
    tier: (flags['tier'] as 'screener' | 'analyst' | undefined) ?? 'screener',
  });

  // generateBlankUWFile() emits structured UWX content, so the default filename
  // must be .uwx.md. Writing it as .uw.md produced a file the format spec
  // forbids and detectUWSourceRepresentation() flags as legacy on the next load.
  const filename = (flags['output'] as string | undefined)
    ?? (flags['name']
      ? `${(flags['name'] as string).replace(/\s+/g, '-').toLowerCase()}${UWX_EXTENSION}`
      : `new-deal${UWX_EXTENSION}`);

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
  // --resolved exports the assembled record. Exporting the directive instead
  // would ship a document whose rent roll is a list of filenames.
  const loaded = flags['resolved']
    ? toUWEnvelope(withResolved(parseUWFile(readFile(file)), file, flags))
    : await loadEnvelope(file);
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

/**
 * Swap a known UW source extension for `extension`, appending if none matches.
 *
 * `.uwx.md` must be in this list. Without it a UWX input fell through to the
 * append branch, so `uwmd export deal.uwx.md` wrote `deal.uwx.md.uw.json`
 * rather than `deal.uw.json`. (`.uw.md` does not match a `.uwx.md` filename —
 * the suffixes genuinely differ — so it was silently a no-op, not a mis-match.)
 */
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
    // Two independent losses, reported separately. A record whose only loss is
    // an externalized section omits zero *paths*, so folding these together
    // would print "omitted 0 advanced path(s)" over a missing rent roll.
    if (projection.report.omitted_paths.length > 0) {
      console.warn(
        `Warning: Lite projection omitted ${projection.report.omitted_paths.length} advanced path(s).`,
      );
    }
    if (projection.report.externalized_sections.length > 0) {
      console.warn(
        `Warning: Lite projection omitted ${projection.report.externalized_sections.length} externalized section(s), unresolved here: ${projection.report.externalized_sections.join(', ')}.`,
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

// ─── Modules ──────────────────────────────────────────────────────────────────

function cmdModulesValidate(files: string[], flags: Record<string, string | boolean>): void {
  const hostTier = hostTierFlag(flags);
  const reports = files.map((file) => {
    const read = readManifestFile(file);
    if (!read.ok) {
      return { file, ok: false, errors: [{ category: 'module', code: 'CLI-MOD-READ', message: read.message }] };
    }
    const result = loadModuleManifest(read.manifest, hostTier ? { hostTier } : {});
    return { file, ok: result.ok, errors: result.errors };
  });

  if (flags['json']) {
    console.log(JSON.stringify({ modules: reports }, null, 2));
    process.exit(reports.every((r) => r.ok) ? 0 : 1);
  }

  for (const report of reports) {
    if (report.ok) {
      console.log(`\nOK - ${basename(report.file)}`);
      continue;
    }
    console.log(`\nERRORS - ${basename(report.file)}`);
    for (const error of report.errors) {
      // The pointer is what makes this actionable: it names the exact
      // declaration that failed, not just the manifest.
      const at = 'pointer' in error && error.pointer ? ` [${error.pointer}]` : '';
      console.log(`  ${error.code}${at} ${error.message}`);
    }
  }
  const failed = reports.filter((r) => !r.ok).length;
  console.log(
    `\n${reports.length - failed}/${reports.length} manifest(s) loaded${hostTier ? ` against ${hostTier}` : ''}.\n`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

function cmdModulesList(files: string[], flags: Record<string, string | boolean>): void {
  const hostTier = hostTierFlag(flags);
  const manifests: unknown[] = [];
  for (const file of files) {
    const read = readManifestFile(file);
    if (!read.ok) {
      console.error(`Cannot read ${basename(file)}: ${read.message}`);
      process.exit(1);
    }
    manifests.push(read.manifest);
  }

  let registry: ReturnType<typeof createModuleRegistry>;
  try {
    registry = createModuleRegistry({ modules: manifests as never, ...(hostTier ? { hostTier } : {}) });
  } catch (e) {
    // Registry construction is all-or-nothing: a bad manifest means there is no
    // registry to list, so report why rather than printing a partial one.
    if (e instanceof ModuleRegistryError) {
      console.error('Registry refused to load:');
      for (const error of e.errors) console.error(`  ${error.code} ${error.message}`);
    } else {
      console.error(e instanceof Error ? e.message : String(e));
    }
    process.exit(1);
  }

  const rows = registry.modules.map((m) => ({
    id: m.id,
    name: m.name,
    version: m.version,
    requires_tier: m.requires_tier,
    asset_classes: m.asset_classes ?? [],
    calculations: (m.calculations ?? []).length,
    validations: (m.validations ?? []).length,
    sections: (m.sections ?? []).length,
    agent_layers: (m.agent_layers ?? []).length,
  }));

  if (flags['json']) {
    console.log(JSON.stringify({ modules: rows }, null, 2));
    return;
  }

  console.log(`\n${rows.length} module(s) loaded\n`);
  for (const row of rows) {
    console.log(`  ${row.id}@${row.version} — ${row.name}`);
    console.log(`    tier: ${row.requires_tier}`);
    console.log(`    asset classes: ${row.asset_classes.length ? row.asset_classes.join(', ') : 'class-agnostic'}`);
    console.log(
      `    contributes: ${row.calculations} calc, ${row.validations} validation, ` +
        `${row.sections} section, ${row.agent_layers} agent layer`,
    );
  }
  console.log('');
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

  // Default output path: swap the source extension for .report.html. Routed
  // through replaceUWExtension so every UW source extension is handled in one
  // place — the inline .uw.md check this replaced missed .uwx.md entirely.
  const outPath = flags['output']
    ? resolve(flags['output'] as string)
    : resolve(replaceUWExtension(file, '.report.html'));

  if (flags['stdout']) {
    process.stdout.write(result.html);
    return;
  }

  writeFileSync(outPath, result.html, 'utf-8');
  const label = result.tier === 'analyst' ? 'credit memo' : 'lender package';
  console.log(`Rendered ${label} → ${basename(outPath)} (${result.sectionsRendered.length} sections${result.sectionsSkipped.length ? `, skipped: ${result.sectionsSkipped.join(', ')}` : ''})`);
  console.log('For PDF output, use @uwmd/report (uwmd-report) or print this HTML from a browser.');
}

/**
 * Load `--market-data <file>` into a cascade-ready lookup, or return null when
 * the flag is absent. Exits with a message rather than throwing, so a bad
 * observation set is a usage error rather than a stack trace.
 */
function loadMarketData(flags: Record<string, string | boolean>): {
  lookup: ReturnType<typeof createDocumentMarketData>;
  identity: { document_id: string; as_of: string; provider: string; geo: string };
} | null {
  const path = flags['market-data'] as string | undefined;
  if (!path) return null;
  try {
    const doc = parseMarketDataDocument(parseUWFile(readFile(path)));
    return {
      lookup: createDocumentMarketData(doc),
      identity: {
        document_id: doc.document_id,
        as_of: doc.as_of,
        provider: doc.provider,
        geo: doc.geo,
      },
    };
  } catch (e) {
    console.error(`Market data: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

function cmdMarketDataValidate(file: string, flags: Record<string, string | boolean>): void {
  const parsed = parseUWFile(readFile(file));
  try {
    const doc = parseMarketDataDocument(parsed);
    if (flags['json']) {
      process.stdout.write(`${JSON.stringify({ valid: true, ...doc }, null, 2)}\n`);
    } else {
      console.log(`OK  ${doc.document_id}`);
      console.log(`    as of ${doc.as_of} — ${doc.provider}`);
      console.log(`    ${doc.geo}${doc.asset_class ? ` — ${doc.asset_class}` : ''}`);
      console.log(`    ${doc.observations.length} observation(s):`);
      for (const o of doc.observations) {
        console.log(`      ${o.field_path} = ${String(o.value)} ${o.unit}${o.confidence ? ` (${o.confidence})` : ''}`);
        console.log(`        basis: ${o.basis}`);
      }
      // Restated on every run because it is the thing people forget.
      console.log('\n    Attributable, not verified: this says the observations');
      console.log('    are traceable, not that they are accurate or current.');
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (flags['json']) {
      process.stdout.write(`${JSON.stringify({ valid: false, error: message }, null, 2)}\n`);
    } else {
      console.error(`INVALID  ${file}`);
      console.error(`         ${message}`);
    }
    process.exit(1);
  }
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

  const market = loadMarketData(flags);

  const out: Record<string, { value: unknown; step: string; source?: string; range?: unknown; resolved_from?: string }> = {};
  for (const path of Object.keys(table.fields)) {
    const r = resolveValue(path, parsed, {
      asset_class: assetClass,
      ...(market ? { market: market.lookup } : {}),
    });
    out[path] = {
      value: r.value,
      step: r.step,
      // Surfaced so a promoted value stays distinguishable in the output: it
      // resolves at the `user_input` step but is tagged `market_data_accepted`.
      source: r.source,
      range: r.range,
      resolved_from: r.resolved_from,
    };
  }

  const payload = {
    deal_id: parsed.frontmatter.deal_id ?? null,
    deal_stage_target: 'scope',
    asset_class: assetClass,
    defaults_table: `${assetClass}@${table.version}`,
    ...(market ? { market_data: market.identity } : {}),
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

  // With `--market-data`, a field the observation set covers is no longer a
  // gap the cascade cannot fill, so it drops out of the VOI ranking. That is
  // the point: the ranking should tell you what is still worth diligencing.
  const market = loadMarketData(flags);
  const result = rankGaps(parsed, {
    targets,
    top,
    packs: [pack],
    ...(market ? { cascadeContext: { asset_class: assetClass, market: market.lookup } } : {}),
  });

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
const positional = extractPositionals(args);


// ─── Composition (RFC 0021) ──────────────────────────────────────────────────

/** Load every `.uwpart.md` in a directory, keyed by `part_id`. */
function loadPartsDir(dir: string): Map<string, UWPart> {
  const parts = new Map<string, UWPart>();
  if (!existsSync(dir)) return parts;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(UWPART_EXTENSION)).sort()) {
    const path = resolve(dir, file);
    const part = parseUWPart(parseUWFile(readFileSync(path, 'utf-8')), { filename: file });
    if (parts.has(part.part_id)) {
      console.error(`Duplicate part_id '${part.part_id}' in ${dir}`);
      process.exit(1);
    }
    parts.set(part.part_id, part);
  }
  return parts;
}

function cmdCompose(file: string, flags: Record<string, string | boolean>): void {
  const section = flags['externalize'];
  if (typeof section !== 'string') {
    console.error('Usage: uwmd compose <file> --externalize <section> [--collection-key <k>] [--collection-path <p>]');
    process.exit(1);
  }
  const collectionKey = (flags['collection-key'] as string) ?? 'unit_id';
  const collectionPath = (flags['collection-path'] as string) ?? 'units';

  const parsed = parseUWFile(readFile(file));
  let result: ExternalizationResult;
  try {
    result = externalizeSection(parsed, {
      section,
      collectionKey,
      collectionPath,
      ...(flags['part-prefix'] ? { partIdPrefix: flags['part-prefix'] as string } : {}),
    });
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const outDir = flags['out-dir'] ? resolve(flags['out-dir'] as string) : defaultPartsDir(file);
  const recordPath = flags['in-place']
    ? resolve(file)
    : flags['output']
      ? resolve(flags['output'] as string)
      : resolve(replaceUWExtension(file, '.externalized.uwx.md'));

  const recordText = stringifyUWX(toUWEnvelope(result.document));

  if (flags['dry-run']) {
    console.log(`Would write ${result.parts.length} fragment(s) to ${outDir}:`);
    for (const part of result.parts) console.log(`  ${part.part_id}${UWPART_EXTENSION}`);
    console.log(`Would write the record to ${recordPath}`);
    return;
  }

  mkdirSync(outDir, { recursive: true });
  for (const part of result.parts) {
    writeFileSync(resolve(outDir, `${part.part_id}${UWPART_EXTENSION}`), stringifyUWPart(part), 'utf-8');
  }
  writeFileSync(recordPath, recordText, 'utf-8');

  console.log(`Externalized ${section} → ${result.parts.length} fragment(s) in ${basename(outDir)}/`);
  console.log(`Record written to ${basename(recordPath)}`);
  // Externalizing is a packaging decision, not a model change — worth saying,
  // because the file looks dramatically different afterwards.
  console.log('The resolved record has the same semantic digest as the original.');
}

function cmdResolve(file: string, flags: Record<string, string | boolean>): void {
  const partsDir = flags['parts'] ? resolve(flags['parts'] as string) : defaultPartsDir(file);
  const parsed = parseUWFile(readFile(file));
  let parts: Map<string, UWPart>;
  try {
    parts = loadPartsDir(partsDir);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  const resolution = resolveComposition(parsed, { parts });

  if (flags['json']) {
    process.stdout.write(
      `${JSON.stringify(
        {
          status: resolution.status,
          externalized: resolution.externalized,
          parts_available: parts.size,
          issues: resolution.issues,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    console.log(`${resolution.status === 'resolved' ? 'RESOLVED' : 'UNRESOLVED'}  ${basename(file)}`);
    console.log(`    ${parts.size} fragment(s) available in ${basename(partsDir)}/`);
    console.log(`    externalized section(s): ${resolution.externalized.join(', ') || '(none)'}`);
    for (const issue of resolution.issues) {
      console.log(`    [${issue.code}] ${issue.message}`);
    }
    if (resolution.status === 'unresolved') {
      // The rule worth restating: under-resolution is never a smaller answer.
      console.log('\n    Sections stay externalized rather than resolving partially —');
      console.log('    a collection missing rows would still total and still validate.');
    }
  }

  if (flags['output'] && resolution.status === 'resolved') {
    const outPath = resolve(flags['output'] as string);
    writeFileSync(outPath, stringifyUWX(toUWEnvelope(resolution.document)), 'utf-8');
    if (!flags['json']) console.log(`    resolved record → ${basename(outPath)}`);
  }

  if (resolution.status !== 'resolved') process.exit(1);
}

/**
 * Resolve a record's externalized sections before another command reads it.
 *
 * Returns the record unchanged when `--resolved` was not requested, so callers
 * can apply it unconditionally. Exits when resolution fails: verifying or
 * exporting a partially-resolved record would report on a document that does
 * not exist.
 */
function withResolved(
  parsed: ParsedUWFile,
  file: string,
  flags: Record<string, string | boolean>,
): ParsedUWFile {
  if (!flags['resolved']) return parsed;
  const partsDir = flags['parts'] ? resolve(flags['parts'] as string) : defaultPartsDir(file);
  const resolution = resolveComposition(parsed, { parts: loadPartsDir(partsDir) });
  if (resolution.status !== 'resolved') {
    console.error(`Cannot resolve ${basename(file)} against ${basename(partsDir)}/:`);
    for (const issue of resolution.issues) console.error(`  [${issue.code}] ${issue.message}`);
    process.exit(1);
  }
  return resolution.document;
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
    if (!positional[0]) { console.error('Usage: uwmd verify <file> [--validate] [--integrity] [--policy] [--signing --keystore=<path>] [--resolved] [--json]'); process.exit(1); }
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

  case 'migrate': {
    // `--emit-v2-shape` is the RFC 0009 writer-flag spelling; on the CLI it is
    // a synonym for `--to-v2` (both run the whole-file conversion).
    const toV2 = flags['to-v2'] === true || flags['emit-v2-shape'] === true;
    if (!positional[0] || (!flags['source-tags'] && !toV2)) {
      console.error(
        'Usage: uwmd migrate <file> --source-tags [--output <file>] [--dry-run]\n' +
          '       uwmd migrate <file> --to-v2 [--strip-signatures | --resign --key <private.jwk.json> --kid <id> [--alg ed25519|es256|es384]] [--output <file>] [--dry-run]',
      );
      process.exit(1);
    }
    if (flags['source-tags'] && toV2) {
      console.error('Run --source-tags and --to-v2 as separate passes (--source-tags first).');
      process.exit(1);
    }
    if (toV2) await cmdMigrateToV2(positional[0], flags);
    else cmdMigrateSourceTags(positional[0], flags);
    break;
  }

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
      console.error('Usage: uwmd edit <file> <operation.json> [--actor <name>] [--source <pattern>] [--agent-id <id>] [--agent-version <v>] [--confidence high|medium|low] [--output <file>] [--capability-token <jwt> --coord-key <keystore.json>]');
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

    // Capability enforcement (Protocol §XIV, RFC 0011). Same optional-peer
    // dynamic-import arrangement as `--signing` above: core takes no crypto
    // dependency to satisfy a flag most invocations never pass.
    let result: EditResult;
    const capToken = flags['capability-token'];
    if (typeof capToken === 'string' && capToken.length > 0) {
      const coordKey = flags['coord-key'];
      if (typeof coordKey !== 'string' || coordKey.length === 0) {
        console.error('--capability-token requires --coord-key=<path> to the coordinator\'s JSON key store.');
        process.exit(1);
      }
      interface CapabilityModule {
        loadKeyStoreFile(path: string): Promise<unknown>;
        createCapabilityVerifier(store: never): CapabilityVerifier;
      }
      let signing: CapabilityModule;
      try {
        signing = (await import('@uwmd/signing' as string)) as CapabilityModule;
      } catch {
        console.error('--capability-token needs the optional @uwmd/signing package. Install it with `npm i @uwmd/signing`.');
        process.exit(1);
      }
      try {
        const store = await signing.loadKeyStoreFile(resolve(coordKey));
        ctx.capability_token = capToken;
        result = await applyEditAsync(fileContent, parsedFile, op, ctx, undefined, {
          capabilityVerifier: signing.createCapabilityVerifier(store as never),
        });
      } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
      }
    } else {
      result = applyEdit(fileContent, parsedFile, op, ctx);
    }
    // --json reports the edit instead of performing it: the conformance driver
    // needs the resulting content, and a driver that rewrote fixtures as a side
    // effect of reading them would corrupt the corpus it is testing.
    if (flags['json']) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
    }
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
    // Under --json, stdout is exactly one JSON document — the conformance CLI
    // protocol (§II.6a) depends on that, and printing the human lines first
    // would make every calc response unparseable.
    if (flags['json']) {
      console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    } else {
      for (const r of results) {
        if (r.ok) {
          console.log(`${r.calc_id} = ${r.display ?? String(r.value)}`);
        } else {
          console.log(`${r.calc_id} ERROR [${r.error?.code}] ${r.error?.message}`);
        }
      }
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
    if (!positional[0]) { console.error('Usage: uwmd export <file.uw.md> [--output <file.uw.json>] [--no-superseded] [--resolved] [--stdout]'); process.exit(1); }
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
    if (!positional[0]) { console.error('Usage: uwmd scope <file> [--asset-class multifamily] [--market-data <file>] [--output <file>]'); process.exit(1); }
    cmdScope(positional[0], flags);
    break;

  case 'refine':
    if (!positional[0]) { console.error('Usage: uwmd refine <file> [--targets dscr,debt_yield] [--top 5] [--market-data <file>] [--json]'); process.exit(1); }
    cmdRefine(positional[0], flags);
    break;

  case 'compose':
    if (!positional[0]) { console.error('Usage: uwmd compose <file> --externalize <section> [--collection-key <k>] [--collection-path <p>] [--out-dir <dir>] [--in-place] [--dry-run]'); process.exit(1); }
    cmdCompose(positional[0], flags);
    break;

  case 'resolve':
    if (!positional[0]) { console.error('Usage: uwmd resolve <file> [--parts <dir>] [--output <file>] [--json]'); process.exit(1); }
    cmdResolve(positional[0], flags);
    break;

  case 'market-data': {
    const sub = positional[0];
    if (sub === 'validate') {
      if (!positional[1]) { console.error('Usage: uwmd market-data validate <file> [--json]'); process.exit(1); }
      cmdMarketDataValidate(positional[1], flags);
    } else {
      console.error('Usage: uwmd market-data validate <file> [--json]');
      process.exit(1);
    }
    break;
  }

  case 'lease': {
    const sub = positional[0];
    if (sub === 'validate') {
      if (!positional[1]) { console.error('Usage: uwmd lease validate <abstract.json> [--json]'); process.exit(1); }
      cmdLeaseValidate(positional[1], flags);
    } else if (sub === 'project') {
      if (!positional[1]) { console.error('Usage: uwmd lease project <abstract.json> [--compact]'); process.exit(1); }
      cmdLeaseProject(positional[1], flags);
    } else {
      console.error('Usage: uwmd lease <validate|project> <abstract.json>');
      process.exit(1);
    }
    break;
  }

  case 'package': {
    const sub = positional[0];
    const target = positional[1];
    if (sub === 'create') {
      if (!target) { console.error('Usage: uwmd package create <manifest.json> [--output <file.uwpkg.zip>]'); process.exit(1); }
      await cmdPackageCreate(target, flags);
    } else if (sub === 'verify') {
      if (!target) { console.error('Usage: uwmd package verify <file.uwpkg.zip> [--json]'); process.exit(1); }
      await cmdPackageVerify(target, flags);
    } else if (sub === 'list') {
      if (!target) { console.error('Usage: uwmd package list <file.uwpkg.zip> [--json]'); process.exit(1); }
      cmdPackageList(target, flags);
    } else if (sub === 'to-context') {
      if (!target) { console.error('Usage: uwmd package to-context <file.uwpkg.zip> [--output <file.json>] [--stdout]'); process.exit(1); }
      cmdPackageToContext(target, flags);
    } else if (sub === 'validate-context') {
      if (!target) { console.error('Usage: uwmd package validate-context <file.uwpkg.context.json> [--json]'); process.exit(1); }
      cmdPackageContextValidate(target, flags);
    } else if (sub === 'edges') {
      if (!target) { console.error('Usage: uwmd package edges <file.uwpkg.zip>'); process.exit(1); }
      cmdPackageEdges(target);
    } else {
      console.error('Usage: uwmd package <create|verify|list|to-context|validate-context|edges> ...');
      process.exit(1);
    }
    break;
  }

  case 'modules': {
    const sub = positional[0];
    const files = positional.slice(1);
    if (sub === 'validate') {
      if (files.length === 0) { console.error('Usage: uwmd modules validate <manifest.json...> [--tier <viewer-tier>] [--json]'); process.exit(1); }
      cmdModulesValidate(files, flags);
    } else if (sub === 'list') {
      if (files.length === 0) { console.error('Usage: uwmd modules list <manifest.json...> [--tier <viewer-tier>] [--json]'); process.exit(1); }
      cmdModulesList(files, flags);
    } else {
      console.error('Usage: uwmd modules <validate|list> <manifest.json...>');
      process.exit(1);
    }
    break;
  }

  case 'manifest':
    // The conformance CLI protocol's identity call (§II.6a). Emitted with no
    // surrounding prose so a driver can read it without a parser.
    console.log(JSON.stringify(REFERENCE_IMPLEMENTATION_MANIFEST, null, 2));
    break;

  case 'portfolio': {
    const sub = positional[0];
    const target = positional[1];
    if (sub === 'validate') {
      if (!target) { console.error('Usage: uwmd portfolio validate <sidecar.uwportfolio.json> [--json]'); process.exit(1); }
      cmdPortfolioValidate(target, flags);
    } else if (sub === 'edges') {
      if (!target) { console.error('Usage: uwmd portfolio edges <sidecar.uwportfolio.json> [--entity <id>] [--json]'); process.exit(1); }
      cmdPortfolioEdges(target, flags);
    } else {
      console.error('Usage: uwmd portfolio <validate|edges> <sidecar.uwportfolio.json>');
      process.exit(1);
    }
    break;
  }

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
                               --signing --keystore=<path> also checks block signatures (RFC 0010,
                               via the optional @uwmd/signing package)
  render   <file>              Render to output format (see --format)
  run      <file>              Invoke a Bancroft agent (see --agent)
  edit     <file> <op.json>    Apply an EditOperation (Tier-2)
  compact  <file>              Strip superseded blocks
  diff     <file-a> <file-b>  Compare two files section by section
  migrate  <file> --source-tags  Rewrite legacy _meta.source values into the actor/resolution split (RFC 0031)
  migrate  <file> --to-v2        Convert the whole file to the v2 nested _meta shape, uw_version "2.0" (RFC 0009;
                                 re-stamps hashes; signed blocks need --resign or --strip-signatures)
  calc     <file> <calc.json>  Evaluate a calc declaration or inline formula (Tier-3)
  init                         Generate a blank .uwx.md file
  summary  <file>              Print quick metrics to terminal
  export   <file>              Export a digested UW JSON 1.0 document
  compose  <file>              Externalize a section into .uwpart.md fragments (RFC 0021)
  resolve  <file>              Resolve externalized sections from a parts directory (RFC 0021)
  formats                       List registered machine representations
  convert  <file>              Convert Lite/UWX/JSON/XML/CSV bundle representations
  report   <file>              Render the lender package / credit memo HTML (§7.1/§7.2)
  scope    <file>              Resolve every required input via the fallback cascade and emit a triage view
  refine   <file>              Rank gaps by value-of-information for stated calc targets
  receipt  issue|verify         Issue or verify a detached verification receipt (RFC 0016)
  modules  validate|list        Validate module manifest files, or list the registry they form
  lease    validate|project     Validate a lease abstract, or project it to a rent-roll row (RFC 0018)
  package  create|verify|...    Build, verify, list, or project a UW Deal Package (RFC 0018)
  portfolio validate|edges      Validate a .uwportfolio.json sidecar, or list its entity edges (RFC 0015)
  manifest                     Print this implementation's ImplementationManifest (conformance protocol)
  layers                       List Bancroft agent layers

Options:
  --output <path>    Output file path (compact, init)
  --dry-run          Show what would change without writing (compact)
  --json             JSON output on stdout, nothing else (validate, calc, edit)
  --strict           Throw on parse errors instead of collecting
  --format <f>       Render format: json|csv|chat|summary (render, default: summary)
  --no-superseded    Drop append-only history from the .uw.json export (export)
  --resolved         Resolve externalized sections first (verify, export)
  --signing          Check _meta.signature on every block (verify; requires --keystore)
  --keystore <path>  JSON key store mapping kid to public key (verify --signing)
  --parts <dir>      Fragment directory (compose, resolve, --resolved; default: ./parts)
  --externalize <s>  Section to split into fragments (compose)
  --collection-key <k>  Row identity field (compose, default: unit_id)
  --collection-path <p> Field the rows occupy (compose, default: units)
  --in-place         Overwrite the input record (compose)
  --stdout           Write export/convert output to stdout
  --to <format>       Target: lite|uwx|uw-json|uw-xml|uw-csv-bundle (convert)
  --projection-report Write the UWX-to-Lite omission report as JSON (convert)
  --issued-at <iso>  Fix the receipt issuance timestamp (receipt issue)
  --tier <tier>      Host viewer tier to load modules against (modules)
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
