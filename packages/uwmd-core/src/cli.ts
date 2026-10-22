#!/usr/bin/env node
import { hasBlockShape } from './block-kind.js';
import {
  verifyReserveDrawBindings,
  verifyReserveAccounts,
  verifyReplacementFundingBindings,
  verifyStatedMetrics,
  parseUWFile,
  validateUWFile,
  isScenarioId,
  ASSET_CLASSES,
  isCustomAssetClass,
  STAGE_REQUIREMENTS,
  stringifyUWEnvelope,
  stampEnvelopeDigest,
  toUWEnvelope,
  type UWDocumentEnvelope,
  CORE_CODEC_REGISTRY,
  verifyChain,
  verifyProvenance,
  canonicalBlockSigningInput,
  type BlockSignatureVerifier,
  type DocumentSignatureVerifier,
  type UWDocumentSignature,
  type IntegrityResult,
  type VerifyChainOptions,
  type ConformanceTier,
  type EditOperation,
  type ModuleCalcDecl,
  type CalcEvaluationContext,
  loadModuleManifest,
  createModuleRegistry,
  ModuleRegistryError,
  parseExpression,
  periodReferencePath,
  CalcError,
  projectLeaseUpCashFlows,
  LeaseUpCashFlowProjectionError,
  type LeaseUpCashFlowPlan,
  type PropertyCashFlowPlan,
  assemblePropertyCashFlows,
  PropertyCashFlowAssemblyError,
  inspectPropertyCashFlowInputs,
  type AssetClass,
  type DealFlag,
  type DealStage,
  parseUWPart,
  resolveComposition,
  externalizeSection,
  stringifyUWPart,
  UWPART_EXTENSION,
  type UWPart,
  type ExternalizationResult,
  type ParsedUWFile,
  type UWBlock,
  createDocumentMarketData,
  parseMarketDataDocument,
  assertUWReceipt,
  ReceiptError,
  type UWReceipt,
  detectUWSourceRepresentation,
  UWX_REPRESENTATION_ID,
  UW_LITE_SOURCE_DESCRIPTOR,
  UWX_SOURCE_DESCRIPTOR,
  UWX_EXTENSION,
  parseUWLite,
  compileUWLite,
  UWLiteBridgeError,
  projectUWEnvelopeToLite,
  stringifyUWX,
  UW_LITE_REPRESENTATION_ID,
  verifyReceipt,
  VERIFY_PACKAGE_NAME,
  VERIFY_VERSION,
} from '@uwmd/verify';
import { REFERENCE_IMPLEMENTATION_MANIFEST } from './reference-implementation.js';
// Receipts the CLI issues name `@uwmd/core` as their issuer (RFC 0083).
import { issueReceipt } from './receipt-engine.js';
// uwmd CLI — command-line interface for .uw.md files
// Commands: parse, validate, compact, diff, init, summary, render
// Usage: uwmd <command> <file> [options]

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { InstitutionConfigError, loadInstitutionPolicy } from './institution-config.js';
import { compact, diff } from './compactor.js';
import { generateBlankUWFile, INIT_SCENARIOS, UWInitError } from './init.js';
import { render } from './renderer.js';
import { renderReportHtml } from './report.js';
import { applyEdit, applyEditAsync } from './editor.js';
import type { EditContext, EditResult } from './editor.js';
import type { CapabilityVerifier } from './starter-protocol.js';
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
import { evaluateCalc } from './calc-display.js';
import { parseCalculationContext } from './calculation-context.js';
import { parseCashFlowVerificationArgs, verifyCashFlowDocument } from './cli-cash-flows.js';
import type { RenderFormat, RenderTier } from './renderer.js';
import { buildContext } from './context-profiles.js';
import type { ContextProfile } from './context-profiles.js';
import { rankGaps } from './refinement.js';
import { resolveValue } from './cascade.js';
import { getAssetClassDefaults } from './defaults.js';
import { MULTIFAMILY_PACK, getPackForAssetClass } from './packs/index.js';
import { CORE_VERSION } from './version.js';

import {
  parseFlags,
  extractPositionals,
  composeOutDir,
  flagVocabulary,
  unknownFlagMessage,
  signingLoadFailureMessage,
  replaceUWExtension,
  hostConformanceFlag,
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

function institutionFailure(error: unknown, json: boolean): void {
  // Only failures in the new config preflight get this internal-error boundary.
  // Other CLI commands retain their existing refusal transport unchanged.
  if (!(error instanceof InstitutionConfigError)) {
    console.error(error);
    process.exitCode = 2;
    return;
  }
  if (json) console.log(JSON.stringify({ error: error.proto }, null, 2));
  else console.error(`uwmd: ${error.code}: ${error.message}${error.proto.pointer ? ` [${error.proto.pointer}]` : ''}`);
  process.exitCode = 1;
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
  // `sections` and `superseded` are emitted in the §II.6a.6 conformance
  // projection — `{ meta, content }` per block, one such object per variant
  // for a multi-variant section — NOT as in-memory UWBlocks:
  //
  //   * `meta` is the document's `_meta` verbatim (only the keys it carried).
  //   * `content` is the block minus `_meta` and `_overrides`: the bare
  //     payload (Format §2.4), with `_role` and `_notes` when stated.
  //
  // Reader artifacts (fence annotation, prose, line numbers, rawJson) are
  // deliberately not emitted per section: §II.6a.6 lists them as MUST NOT be
  // required, and emitting them here is how they end up required.
  const projectBlock = (block: UWBlock): { meta: Record<string, unknown>; content: unknown } => {
    const { _meta, _overrides: _ov, ...rest } = block.content;
    return { meta: (_meta as Record<string, unknown> | undefined) ?? {}, content: rest };
  };
  const isBlock = (v: unknown): v is UWBlock =>
    hasBlockShape(v);
  const projectEntry = (entry: UWBlock | { [variant: string]: UWBlock }) =>
    isBlock(entry)
      ? projectBlock(entry)
      : Object.fromEntries(
          Object.entries(entry).map(([variant, block]) => [variant, projectBlock(block)])
        );
  const output = {
    frontmatter: parsed.frontmatter,
    sections: Object.fromEntries(
      Object.entries(parsed.sections).map(([id, entry]) => [id, projectEntry(entry)])
    ),
    prose: parsed.prose,
    pipeline_log: parsed.pipeline_log.map(b => b.content),
    custom_calculations: parsed.custom_calculations,
    custom_scenarios: parsed.custom_scenarios,
    extensions: Object.fromEntries(Object.entries(parsed.extensions).map(([id, block]) => [id, projectBlock(block)])),
    superseded: Object.fromEntries(
      Object.entries(parsed.superseded).map(([id, blocks]) => [id, blocks.map(projectBlock)])
    ),
  };
  console.log(JSON.stringify(output, null, flags['compact'] ? 0 : 2));
}

async function cmdValidate(file: string, flags: Record<string, string | boolean>): Promise<void> {
  if (flags['institution'] !== undefined && typeof flags['institution'] !== 'string') {
    console.error('--institution requires a path.'); process.exit(1);
  }
  const content = readFile(file);
  const detection = detectUWSourceRepresentation(content, file);
  if (detection.representation !== UWX_REPRESENTATION_ID) {
    const lite = parseUWLite(content);
    try { loadInstitutionPolicy(file, flags['institution'] as string | undefined); }
    catch (error) {
      institutionFailure(error, flags['json'] === true); return;
    }
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
    console.log(`\nValidation result: ${result.overall_status.toUpperCase()} - ${basename(file)}\n`);
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
    console.log('\nStage Readiness (workflow completeness): not checked for Lite syntax validation.');
    console.log('Cross-checks: not checked for Lite syntax validation.');
    console.log('Receipt readiness: not checked. Use uwmd receipt issue to evaluate receipt-pack metrics.');
    console.log('Receipt/hash verification: not checked. Use uwmd receipt verify with a prior receipt.');
    console.log('');
    process.exit(errors.length > 0 ? 1 : 0);
  }
  for (const warning of detection.warnings) console.warn(`Warning: ${warning}`);
  const parsed = parseUWFile(content);
  let institution: ReturnType<typeof loadInstitutionPolicy>;
  try { institution = loadInstitutionPolicy(file, flags['institution'] as string | undefined); }
  catch (error) {
    institutionFailure(error, flags['json'] === true); return;
  }
  const structural = validateUWFile(content, institution?.thresholds, undefined, institution);
  const replacement_funding_verification = await verifyReplacementFundingBindings(parsed);
  const result = { ...structural, replacement_funding_verification };
  const fundingRefuses = replacement_funding_verification.state !== 'verified'
    && !(replacement_funding_verification.state === 'not_checked' && replacement_funding_verification.reason === 'not_applicable');

  if (flags['json']) {
    console.log(JSON.stringify(result, null, 2));
    // §II.6a.2: exit 1 on a validation error, in every output mode. This
    // branch returned before the exit line below, so `--json` exited 0 on a
    // document with errors — the human-readable path did not, and the
    // document corpus (fixture 09, RFC 0038) pinned the bug as the baseline.
    process.exit(result.errors.length > 0 || fundingRefuses ? 1 : 0);
  }

  const statusEmoji = {
    clean: '✓',
    warnings: '⚠',
    errors: '✗',
    blocking: '🚫',
  }[result.overall_status];

  console.log(`\n${fundingRefuses ? '✗' : statusEmoji}  Validation result: ${fundingRefuses ? 'REFUSED' : result.overall_status.toUpperCase()} — ${basename(file)}\n`);

  console.log(`Complete validation: ${result.errors.length > 0 || fundingRefuses ? 'refused' : 'passed'}`);
  console.log(`Rule set: Format ${result.rule_set} (the record's declared uw_version, Protocol §XII.5)`);
  console.log(`Structural validation: ${result.overall_status}`);
  console.log(`Replacement funding verification: ${replacement_funding_verification.state}${'reason' in replacement_funding_verification ? ` / ${replacement_funding_verification.reason}` : ''}`);
  for (const issue of replacement_funding_verification.issues) console.log(issue.message);
  console.log('Stage Readiness (workflow completeness):');
  console.log('  Required-section and field checks by stage; incomplete later stages do not by themselves fail validation.');
  for (const [stage, ready] of Object.entries(result.stage_readiness)) {
    console.log(`  ${stage}: ${ready ? 'complete' : 'incomplete'}`);
  }

  // §5.3 coverage (RFC 0037): "checked and clean" is not "never looked".
  const coverage = Object.values(result.coverage);
  const evaluated = coverage.filter((c) => c.status === 'evaluated').length;
  const reasons = new Map<string, number>();
  for (const c of coverage) if (c.status === 'skipped' && c.reason) reasons.set(c.reason, (reasons.get(c.reason) ?? 0) + 1);
  const reasonText = [...reasons].map(([r, n]) => `${n} ${r}`).join(', ');
  console.log(`\nCross-checks: ${evaluated} evaluated, ${coverage.length - evaluated} skipped${reasonText ? ` (${reasonText})` : ''}`);
  if (coverage.length > evaluated) {
    console.log('  Skipped cross-checks were not evaluated; a clean result does not establish their agreement.');
  }
  console.log('\nReceipt readiness: not checked. Use uwmd receipt issue to evaluate receipt-pack metrics.');
  console.log('Receipt/hash verification: not checked. Use uwmd receipt verify with a prior receipt.');

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
  printDealFlags(result.deal_flags);
  console.log('');

  process.exit(result.errors.length > 0 || fundingRefuses ? 1 : 0);
}

/**
 * Format §5.2 deal flags (RFC 0109), under their own heading after the issues:
 * they describe the deal, not the record, and never change the exit status.
 */
function printDealFlags(flags: readonly DealFlag[]): void {
  if (flags.length === 0) return;
  console.log(`\nDeal flags (${flags.length}; Format §5.2 bands, not validation errors):`);
  for (const flag of flags) {
    console.log(`  [${flag.band === 'error' ? 'ERROR BAND' : 'WARN BAND'}] [${flag.section}.${flag.field}] ${flag.code}: ${flag.message}`);
  }
}

/**
 * Load the optional `@uwmd/signing` peer for `usedBy` (the flag or command the
 * user ran), or exit 1 with `signingLoadFailureMessage`.
 */
async function loadOptionalSigning<T>(usedBy: string): Promise<T> {
  try {
    return (await import('@uwmd/signing' as string)) as T;
  } catch (error) {
    console.error(signingLoadFailureMessage(usedBy, error));
    process.exit(1);
  }
}

/**
 * Build the `verifyChain` options from `--signing --keystore=<path>`.
 *
 * `@uwmd/signing` is reached by dynamic import and declared as an optional
 * peer. `@uwmd/core` must not take a crypto dependency to satisfy a flag most invocations never pass, and the
 * layering invariant (core depends on no sibling package) forbids a static
 * import outright.
 */
async function signingOptions(
  flags: Record<string, string | boolean>,
): Promise<VerifyChainOptions> {
  if (!flags['signing'] && !flags['document-signature']) return {};
  if (flags['document-signature'] && (typeof flags['document-signature'] !== 'string' || flags['resolved'])) {
    console.error('--document-signature requires an artifact path and authenticates the supplied source; --resolved cannot be combined with it.');
    process.exit(1);
  }
  const keystore = flags['keystore'];
  if (typeof keystore !== 'string' || keystore.length === 0) {
    console.error('Signature verification requires --keystore=<path> to a JSON key store.');
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
    createDocumentSignatureVerifier(store: never): DocumentSignatureVerifier;
  }
  const usedBy = [flags['signing'] ? '--signing' : undefined, flags['document-signature'] ? '--document-signature' : undefined]
    .filter((flag) => flag !== undefined).join(' and ');
  const signing = await loadOptionalSigning<SigningModule>(usedBy);

  try {
    const store = await signing.loadKeyStoreFile(resolve(keystore));
    return {
      ...(flags['signing'] ? { signatureVerifier: signing.createBlockSignatureVerifier(store as never) } : {}),
      ...(typeof flags['document-signature'] === 'string' ? {
        documentSignature: JSON.parse(readFile(flags['document-signature'])),
        documentSignatureVerifier: signing.createDocumentSignatureVerifier(store as never),
        requireDocumentSignature: true,
      } : {}),
    };
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

async function cmdVerify(file: string, flags: Record<string, string | boolean>): Promise<void> {
  const content = readFile(file);
  // --resolved verifies the assembled record. Without it an externalized
  // section verifies as a directive, which is not the document anyone means.
  const partSources = flags['resolved']
    ? loadPartSourcesDir(flags['parts'] ? resolve(flags['parts'] as string) : defaultPartsDir(file))
    : undefined;
  const parsed = withResolved(parseUWFile(content), file, flags, partSources);

  // No flag set → run all three.
  const onlyValidate = flags['validate'] === true;
  const onlyIntegrity = flags['integrity'] === true;
  const onlyPolicy = flags['policy'] === true;
  const runAll = !onlyValidate && !onlyIntegrity && !onlyPolicy;

  const sections: Record<string, unknown> = {
    replacement_funding_verification: { state: 'not_checked', reason: 'not_invoked', issues: [] },
  };
  let hadError = false;
  let configError: InstitutionConfigError | undefined;

  if (runAll || onlyValidate) {
    let institution: ReturnType<typeof loadInstitutionPolicy>;
    try { institution = loadInstitutionPolicy(file); }
    catch (error) {
      if (!(error instanceof InstitutionConfigError)) {
        institutionFailure(error, flags['json'] === true); return;
      }
      configError = error;
      hadError = true;
      sections['validation'] = { error: error.proto };
      delete sections['replacement_funding_verification'];
    }
    if (configError === undefined) {
      const v = validateUWFile(content, institution?.thresholds, partSources === undefined ? undefined : { parts: partSources.map(part => part.source) }, institution);
      sections['validation'] = v;
      const funding = await verifyReplacementFundingBindings(parsed);
      sections['replacement_funding_verification'] = funding;
      if (v.errors.length > 0 || (funding.state !== 'verified'
        && !(funding.state === 'not_checked' && funding.reason === 'not_applicable'))) hadError = true;
      // Protocol §II.2 item 2: a stated metric that disagrees with its
      // recomputation is a verification failure. One whose inputs are absent is
      // `unverifiable`, which is reported but is not a failure. Through 4.2.0 this
      // check never ran here, so a wrong stated cap rate printed `OK`.
      const metrics = verifyStatedMetrics(parsed);
      sections['stated_metrics'] = metrics;
      if (metrics.counts.failed > 0) hadError = true;
    }
  }
  let chain: IntegrityResult | undefined;
  let prov: IntegrityResult | undefined;
  if (runAll || onlyIntegrity || flags['signing'] || flags['document-signature']) {
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
    if (configError) institutionFailure(configError, false);
    if ('validation' in sections && configError === undefined) {
      const v = sections['validation'] as ReturnType<typeof validateUWFile>;
      console.log(`Rule set: Format ${v.rule_set} (the record's declared uw_version, Protocol §XII.5)`);
      console.log(`Structural validation: ${v.overall_status} (${v.issues.length} issue${v.issues.length === 1 ? '' : 's'})`);
      for (const issue of v.issues) {
        const tag = issue.severity === 'error' ? '[ERROR]' : issue.severity === 'warning' ? '[WARN] ' : '[INFO] ';
        const loc = issue.section ? ` [${issue.section}${issue.field ? `.${issue.field}` : ''}]` : '';
        console.log(`  ${tag}${loc} ${issue.code ? `${issue.code}: ` : ''}${issue.message}`);
      }
      printDealFlags(v.deal_flags);
    }
    const metrics = sections['stated_metrics'] as ReturnType<typeof verifyStatedMetrics> | undefined;
    if (!metrics) {
      if (!configError) console.log('Stated metrics: not checked (validation not requested)');
    } else if (metrics.evidence.length === 0) {
      console.log(`Stated metrics: none stated for asset class '${metrics.asset_class}'`);
    } else {
      const { verified, failed, unverifiable } = metrics.counts;
      console.log(`Stated metrics: ${verified} verified, ${failed} failed, ${unverifiable} unverifiable`);
      for (const item of metrics.evidence) {
        if (item.state === 'failed') console.log(`  [FAILED] ${item.path}: stated ${item.stated}, recomputed ${item.computed}`);
        else if (item.state === 'unverifiable') console.log(`  [UNVERIFIABLE] ${item.path}: ${item.reason ?? 'not checkable'}`);
      }
    }
    const funding = sections['replacement_funding_verification'] as Awaited<ReturnType<typeof verifyReplacementFundingBindings>> | undefined;
    if (funding) {
      console.log(`Replacement funding verification: ${funding.state}${'reason' in funding ? ` / ${funding.reason}` : ''}`);
      for (const issue of funding.issues) console.log(issue.message);
      if (funding.state === 'not_checked' && funding.reason === 'not_invoked') console.log('Validation not requested; no complete binding verification claim.');
    }
    if (chain) {
      const document = chain.document_signature;
      console.log(`Document snapshot authentication: ${document ? document.state : 'not checked'}`);
      if (document) for (const issue of document.issues) console.log(`  ${issue.code}: ${issue.message}`);
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
  // Writers use standard plans or owned extensions.
  const scenario = flags['scenario'];
  if (scenario !== undefined && !isScenarioId(scenario)) {
    console.error(
      `--scenario must be one of the standard plans (${INIT_SCENARIOS.join(', ')}) or a reverse-DNS identifier (e.g. com.example.repositioning); got ${scenario === true ? 'no value' : `'${scenario}'`}.`,
    );
    process.exit(1);
  }
  // The closed vocabularies init writes into frontmatter (#492): a value
  // outside them would produce a record that fails or misleads its readers.
  const closed: [flag: string, allowed: readonly string[]][] = [
    ['asset-class', ASSET_CLASSES],
    ['stage', Object.keys(STAGE_REQUIREMENTS)],
    ['tier', ['screener', 'analyst']],
  ];
  for (const [flag, allowed] of closed) {
    const value = flags[flag];
    // A namespaced custom class (Format §2.2a) is also a lawful asset_class.
    if (flag === 'asset-class' && typeof value === 'string' && isCustomAssetClass(value)) continue;
    if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) {
      console.error(`--${flag} must be one of ${allowed.join(', ')}; got ${value === true ? 'no value' : `'${value}'`}.`);
      process.exit(1);
    }
  }
  let content: string;
  try {
    content = generateBlankUWFile({
      dealName: flags['name'] as string | undefined,
      address: flags['address'] as string | undefined,
      city: flags['city'] as string | undefined,
      state: flags['state'] as string | undefined,
      zip: flags['zip'] as string | undefined,
      assetClass: flags['asset-class'] as AssetClass | undefined,
      assetSubtype: flags['asset-subtype'] as string | undefined,
      dealStage: flags['stage'] as DealStage | undefined,
      scenario: scenario as string | undefined,
      tier: (flags['tier'] as 'screener' | 'analyst' | undefined) ?? 'screener',
    });
  } catch (err) {
    if (!(err instanceof UWInitError)) throw err;
    console.error(err.message);
    process.exit(1);
  }

  // generateBlankUWFile() emits structured UWX content, so the default filename
  // must be .uwx.md: structured content under .uw.md is SOURCE_CONTENT_MISMATCH.
  const filename = (flags['output'] as string | undefined)
    ?? (flags['name']
      ? `${(flags['name'] as string).replace(/\s+/g, '-').toLowerCase()}${UWX_EXTENSION}`
      : `new-deal${UWX_EXTENSION}`);

  const outPath = resolve(filename);
  // A scaffold must never replace an existing record: `init` is the one command
  // a newcomer runs twice, and a deal file holds provenance that cannot be
  // regenerated (invariant 5). Refuse rather than overwrite, as `sign-document`
  // does for its artifact; `wx` closes the race between the check and the write.
  if (existsSync(outPath)) {
    console.error(`Refusing to overwrite existing file: ${outPath}. Choose another --output path.`);
    process.exit(1);
  }
  try {
    writeFileSync(outPath, content, { encoding: 'utf-8', flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      console.error(`Refusing to overwrite existing file: ${outPath}. Choose another --output path.`);
      process.exit(1);
    }
    throw err;
  }
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
  const includeSuperseded = flags['no-superseded'] !== true;
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
        // A refusal, not a crash: the typed error prints without a stack (#409).
        const errors = compilation.report.issues.filter((issue) => issue.severity === 'error');
        const issues = errors.map((issue) => `${issue.code}: ${issue.message}`).join('; ');
        throw new UWLiteBridgeError(
          errors[0]?.code ?? 'LITE_COMPILE_FAILED',
          `UW Lite compilation failed: ${issues}`,
        );
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
// ─── Receipts (RFC 0016 / spec/UW_RECEIPT.md) ─────────────────────────────

async function cmdReceiptIssue(
  file: string,
  flags: Record<string, string | boolean>,
): Promise<void> {
  let receipt: UWReceipt;
  try {
    receipt = await issueReceipt(readFile(file), {
      filename: file,
      issuer: `uwmd-cli@${CORE_VERSION}`,
      ...(typeof flags['issued-at'] === 'string' ? { issued_at: flags['issued-at'] } : {}),
    });
  } catch (error) {
    if (!(error instanceof ReceiptError)) throw error;
    console.error(`Receipt refused [${error.code}]: ${error.message.replace(`[${error.code}] `, '')}`);
    console.error('No receipt was issued. Receipt/hash verification was not performed.');
    process.exit(1);
  }
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
  const uncomputed = receipt.computation.results.filter((r) => !r.computed).map((r) => r.calc_id);
  console.log(
    `Receipt issued for ${basename(file)} → ${basename(outPath)} ` +
      `(${receipt.computation.pack}@${receipt.computation.pack_version})`,
  );
  console.log(`Metric completeness: ${uncomputed.length === 0 ? 'complete' : 'partial'}`);
  console.log(`Computed: ${computed}/${receipt.computation.results.length}`);
  console.log(`Uncomputed: ${uncomputed.length === 0 ? 'none' : uncomputed.join(', ')}`);
  if (uncomputed.length > 0) {
    console.log('Uncomputed metrics evaluated to no value, typically because their structured inputs are absent. The receipt records both computed and uncomputed result statuses.');
    console.log('Missing inputs are a completeness gap; they do not indicate a receipt/hash verification failure.');
  }
  console.log(`Canonicalization: ${receipt.subject.canonicalization}@${receipt.subject.canonicalization_version}`);
  console.log(`Document hash: ${receipt.subject.digest}`);
  console.log(`Results hash: ${receipt.computation.results_digest}`);
  console.log('Receipt/hash verification: not checked against a prior receipt.');
  console.log(
    'A receipt attests that these outputs follow from this record. It does not attest that the inputs are true.',
  );
}

// ─── Modules ──────────────────────────────────────────────────────────────────

/** The modules commands' host tier; any value but reader or verifier is a usage error. */
function moduleHostConformance(flags: Record<string, string | boolean>): ConformanceTier | undefined {
  const tier = hostConformanceFlag(flags);
  if (tier === null) {
    console.error(`--tier must be reader or verifier; got ${JSON.stringify(flags['tier'])}.`);
    process.exit(1);
  }
  return tier;
}

function cmdModulesValidate(files: string[], flags: Record<string, string | boolean>): void {
  const hostConformance = moduleHostConformance(flags);
  const reports = files.map((file) => {
    const read = readManifestFile(file);
    if (!read.ok) {
      return { file, ok: false, errors: [{ category: 'module', code: 'CLI-MOD-READ', message: read.message }] };
    }
    const result = loadModuleManifest(read.manifest, hostConformance ? { hostConformance } : {});
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
    `\n${reports.length - failed}/${reports.length} manifest(s) loaded${hostConformance ? ` against a ${hostConformance} host` : ''}.\n`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

function cmdModulesList(files: string[], flags: Record<string, string | boolean>): void {
  const hostConformance = moduleHostConformance(flags);
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
    registry = createModuleRegistry({ modules: manifests as never, ...(hostConformance ? { hostConformance } : {}) });
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
    requires_conformance: m.requires_conformance,
    requires_profiles: m.requires_profiles ?? [],
    asset_classes: m.asset_classes ?? [],
    calculations: (m.calculations ?? []).length,
    validations: (m.validations ?? []).length,
    sections: (m.sections ?? []).length,
  }));

  if (flags['json']) {
    console.log(JSON.stringify({ modules: rows }, null, 2));
    return;
  }

  console.log(`\n${rows.length} module(s) loaded\n`);
  for (const row of rows) {
    console.log(`  ${row.id}@${row.version} — ${row.name}`);
    console.log(`    conformance: ${row.requires_conformance}; profiles: ${row.requires_profiles.join(', ') || 'none'}`);
    console.log(`    asset classes: ${row.asset_classes.length ? row.asset_classes.join(', ') : 'class-agnostic'}`);
    console.log(
      `    contributes: ${row.calculations} calc, ${row.validations} validation, ` +
        `${row.sections} section`,
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
    console.log(`Receipt verification verdict: ${result.verdict.toUpperCase()}`);
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
    } else {
      console.log('\nReceipt verification failed. The issues above identify the mismatch or recomputation failure.');
      console.log('An uncomputed metric alone is a completeness gap; matching uncomputed statuses can verify.');
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

  const out: Record<string, {
    value: unknown;
    step: string | null;
    source?: string;
    range?: unknown;
    resolved_from?: string;
    citation?: string;
    refused?: { code: string; message: string };
  }> = {};
  for (const path of Object.keys(table.fields)) {
    let r: ReturnType<typeof resolveValue>;
    try {
      r = resolveValue(path, parsed, {
        asset_class: assetClass,
        ...(market ? { market: market.lookup } : {}),
      });
    } catch (e) {
      // RFC 0066: a variant-map section with no selectable block is reported
      // per field, never resolved by fence order or replaced by a default.
      if (!(e instanceof CalcError) || e.proto.code !== 'CALC-RESOLVE-002') throw e;
      out[path] = { value: null, step: null, refused: { code: e.proto.code, message: e.proto.message } };
      continue;
    }
    out[path] = {
      value: r.value,
      step: r.step,
      // Surfaced so a promoted value stays distinguishable in the output: it
      // resolves at the `user_input` step but is tagged `market_data_accepted`.
      source: r.source,
      range: r.range,
      resolved_from: r.resolved_from,
      // The published caveat behind an asset-class default (additive; absent
      // for every other step) — a proxy range stays labelled as one.
      citation: r.citation,
    };
  }

  const payload = {
    deal_id: parsed.frontmatter.deal_id ?? null,
    deal_stage_target: 'scope',
    // The builtin class the defaults table belongs to.
    asset_class: table.asset_class,
    defaults_table: `${table.asset_class}@${table.version}`,
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

function loadCalculationContext(flags: Record<string, string | boolean>, periodOnly = false) {
  const path = flags['calc-context'];
  if (path === undefined) return undefined;
  if (typeof path !== 'string' || !path.trim()) {
    throw new CalcError('CALC-TYPE-001', '--calc-context requires a JSON file path.');
  }
  const context = parseCalculationContext(JSON.parse(readFile(path)));
  if (periodOnly) {
    for (const key of Object.keys(context.overrides ?? {})) {
      const expr = parseExpression(key);
      if (expr.kind !== 'period_path' || periodReferencePath(expr) !== key) {
        throw new CalcError('CALC-TYPE-001', 'refine --calc-context accepts canonical period overrides only; ordinary scalar overrides are not supported.');
      }
    }
  }
  return context;
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
  const periodContext = loadCalculationContext(flags, true);
  const result = rankGaps(parsed, {
    periodContext,
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
  const periodIssues = result.diagnostics.period_inputs ?? [];
  for (const issue of periodIssues) {
    console.log(`Excluded ${issue.output_id}: ${issue.field_path} [${issue.code}] ${issue.message}`);
  }
  const sectionIssues = result.diagnostics.section_inputs ?? [];
  for (const issue of sectionIssues) {
    console.log(`Excluded ${issue.output_id}: ${issue.section} [${issue.code}] ${issue.message}`);
  }
  console.log('');
  if (result.by_voi.length === 0) {
    console.log(periodIssues.length
      ? 'No ranking is available for the affected targets until their period inputs are resolved.'
      : sectionIssues.length
        ? 'No ranking is available for the affected targets until a block of each section can be selected.'
        : 'No gap-driven inputs found among the requested targets.');
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

// Every command accepts a closed set of flags (`COMMAND_FLAGS`). A flag
// outside it is refused here, before any file is read or any work runs:
// through 4.1.0 an unknown flag was silently ignored, so a misspelled
// security flag on `verify` looked like a passed check.
{
  const vocabulary = flagVocabulary(command, positional[0]);
  const refusal = vocabulary === undefined ? undefined : unknownFlagMessage(vocabulary, flags);
  if (refusal !== undefined) {
    console.error(refusal);
    process.exit(1);
  }
}


// ─── Composition (RFC 0021) ──────────────────────────────────────────────────

/** Read each actual part once; retain its filename for existing parse diagnostics. */
function loadPartSourcesDir(dir: string): { filename: string; source: string }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(UWPART_EXTENSION)).sort()
    .map(filename => ({ filename, source: readFileSync(resolve(dir, filename), 'utf-8') }));
}

function loadPartsDir(dir: string, sources = loadPartSourcesDir(dir)): Map<string, UWPart> {
  const parts = new Map<string, UWPart>();
  for (const { filename, source } of sources) {
    const part = parseUWPart(parseUWFile(source), { filename });
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
  const out = composeOutDir(file, flags);
  if (!out.ok) {
    console.error(out.message);
    process.exit(1);
  }

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

  const outDir = out.dir;
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
  partSources?: { filename: string; source: string }[],
): ParsedUWFile {
  if (!flags['resolved']) return parsed;
  const partsDir = flags['parts'] ? resolve(flags['parts'] as string) : defaultPartsDir(file);
  const resolution = resolveComposition(parsed, { parts: loadPartsDir(partsDir, partSources) });
  if (resolution.status !== 'resolved') {
    console.error(`Cannot resolve ${basename(file)} against ${basename(partsDir)}/:`);
    for (const issue of resolution.issues) console.error(`  [${issue.code}] ${issue.message}`);
    process.exit(1);
  }
  return resolution.document;
}

// Top-level async wrapper so commands can await
(async () => {
switch (command) {
  case 'parse':
    if (!positional[0]) { console.error('Usage: uwmd parse <file> [--compact] [--strict]'); process.exit(1); }
    cmdParse(positional[0], flags);
    break;

  case 'validate':
    if (!positional[0]) { console.error('Usage: uwmd validate <file> [--institution <config.json>] [--json]'); process.exit(1); }
    await cmdValidate(positional[0], flags);
    break;

  case 'verify':
    if (!positional[0]) { console.error('Usage: uwmd verify <file> [--validate] [--integrity] [--policy] [--signing --keystore=<path>] [--document-signature=<artifact> --keystore=<path>] [--resolved [--parts <dir>]] [--json]'); process.exit(1); }
    await cmdVerify(positional[0], flags);
    break;
  case 'sign-document': {
    if (!positional[0] || typeof flags['key'] !== 'string' || typeof flags['out'] !== 'string') {
      console.error('Usage: uwmd sign-document <source> --key=<signer.json> --out=<artifact.json>'); process.exit(1);
    }
    if (resolve(positional[0]) === resolve(flags['out']) || resolve(flags['key']) === resolve(flags['out']) || existsSync(resolve(flags['out']))) {
      console.error('Document signature output must be a new file distinct from the source and signing key.'); process.exit(1);
    }
    interface DocumentSigningModule {
      loadDocumentSigningKey(document: unknown): Promise<unknown>;
      signDocument(source: string, key: never, options?: { signedAt?: string }): Promise<UWDocumentSignature>;
    }
    const signing = await loadOptionalSigning<DocumentSigningModule>('uwmd sign-document');
    try {
      const key = await signing.loadDocumentSigningKey(JSON.parse(readFile(flags['key'])));
      const signature = await signing.signDocument(readFile(positional[0]), key as never,
        typeof flags['signed-at'] === 'string' ? { signedAt: flags['signed-at'] } : {});
      writeFileSync(resolve(flags['out']), `${JSON.stringify(signature, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      console.log(`Document snapshot signature written to ${flags['out']}.`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error)); process.exit(1);
    }
    break;
  }

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

    // Capability enforcement (starter guide §XIV, RFC 0011). Same optional-peer
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
      const signing = await loadOptionalSigning<CapabilityModule>('--capability-token');
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

  case 'project-lease-up': {
    if (positional.length !== 2) {
      console.error('Usage: uwmd project-lease-up <file> <plan.json> [--json]');
      process.exit(1);
    }
    const parsed = parseUWFile(readFile(positional[0]!));
    const planText = readFile(positional[1]!);
    try {
      let plan: LeaseUpCashFlowPlan;
      try { plan = JSON.parse(planText) as LeaseUpCashFlowPlan; }
      catch { throw new LeaseUpCashFlowProjectionError('Plan must be valid JSON.', 'plan'); }
      const projection = await projectLeaseUpCashFlows(parsed, plan);
      console.log(JSON.stringify(projection, null, 2));
    } catch (error) {
      if (!(error instanceof LeaseUpCashFlowProjectionError)) throw error;
      if (flags['json']) console.log(JSON.stringify({ error: error.proto }, null, 2));
      else console.error(`${error.message} (${error.proto.pointer})`);
      process.exitCode = 1;
    }
    break;
  }

  case 'verify-reserve-draws': {
    if (positional.length < 1 || positional.length > 2 || Object.keys(flags).some(k => k !== 'json')) {
      console.error('Usage: uwmd verify-reserve-draws <file> [plan.json] [--json]'); process.exit(1);
    }
    const parsed = parseUWFile(readFile(positional[0]!));
    let plan: unknown;
    if (positional[1]) {
      const text = readFile(positional[1]);
      try { plan = JSON.parse(text); }
      catch { plan = { invalid_json: true }; }
    }
    const result = await verifyReserveDrawBindings(parsed, plan);
    if (flags['json']) console.log(JSON.stringify(result, null, 2));
    else { console.log(`Reserve draw binding verification: ${result.state}`); for (const issue of result.issues) console.log(issue.message); }
    process.exitCode = result.state === 'failed' || result.state === 'unverifiable' ? 1 : 0;
    break;
  }
  case 'verify-reserve-accounts': {
    if (!positional[0]) { console.error('Usage: uwmd verify-reserve-accounts <file> [--json]'); process.exit(1); }
    const result = await verifyReserveAccounts(parseUWFile(readFile(positional[0])));
    if (flags['json']) console.log(JSON.stringify(result, null, 2));
    else { console.log(`Reserve account verification: ${result.state}`); for (const issue of result.issues) console.log(issue.message); }
    process.exit(result.state === 'failed' || result.state === 'unverifiable' ? 1 : 0);
    break;
  }
  case 'verify-cash-flows': {
    try {
      const options = parseCashFlowVerificationArgs(args);
      let source: string;
      try { source = readFileSync(resolve(options.file), 'utf8'); }
      catch (error) { throw new CalcError('CALC-CF-SERIES',
        `Cannot read source: ${error instanceof Error ? error.message : String(error)}`, 'source'); }
      const result = verifyCashFlowDocument(source, options.variant);
      if (options.json) console.log(JSON.stringify(result.report, null, 2));
      else {
        const r = result.report;
        console.log(`${r.section} (variant: ${r.variant ?? '(unlabelled)'}): ${r.status}; ${r.checked_metrics.length} stated metrics.`);
        for (const issue of r.verification?.issues ?? [])
          console.log(`  [${issue.code}] ${issue.message}`);
        console.log('This checks stated metrics only; it does not establish economic completeness or verify source facts.');
      }
      process.exitCode = result.exitCode;
    } catch (error) {
      if (!(error instanceof CalcError)) throw error;
      if (args.includes('--json')) console.log(JSON.stringify({ error: error.proto }, null, 2));
      else {
        console.error(`${error.message} (${error.proto.pointer ?? 'cash_flow_series'})`);
        console.error('Usage: uwmd verify-cash-flows <file> [--variant <name>] [--json]');
      }
      process.exitCode = 1;
    }
    break;
  }

  case 'assemble-property': {
    if (positional.length !== 2) {
      console.error('Usage: uwmd assemble-property <file> <plan.json> [--json]');
      process.exit(1);
    }
    const parsed = parseUWFile(readFile(positional[0]!));
    const planText = readFile(positional[1]!);
    try {
      let plan: PropertyCashFlowPlan;
      try { plan = JSON.parse(planText) as PropertyCashFlowPlan; }
      catch { throw new PropertyCashFlowAssemblyError('plan', 'Plan must be valid JSON.', 'plan'); }
      const projection = await assemblePropertyCashFlows(parsed, plan);
      console.log(JSON.stringify(projection, null, 2));
    } catch (error) {
      if (!(error instanceof PropertyCashFlowAssemblyError)) throw error;
      if (flags['json']) console.log(JSON.stringify({ error: error.proto }, null, 2));
      else console.error(`${error.message} (${error.proto.pointer})`);
      process.exitCode = 1;
    }
    break;
  }

  case 'inspect-property-cash-flows': {
    if (positional.length !== 1) {
      console.error('Usage: uwmd inspect-property-cash-flows <file> [--json]');
      process.exit(1);
    }
    const inventory = inspectPropertyCashFlowInputs(parseUWFile(readFile(positional[0]!)));
    if (flags['json']) {
      console.log(JSON.stringify(inventory, null, 2));
    } else {
      console.log(`Lease-up variants: ${inventory.lease_up_schedule.length}`);
      for (const source of inventory.lease_up_schedule)
        console.log(`  ${source.variant ?? '(unlabelled)'}: ${source.shape}; ${source.periods.length} periods`);
      console.log(`Cash-flow variants: ${inventory.cash_flow_series.length}`);
      for (const source of inventory.cash_flow_series)
        console.log(`  ${source.variant ?? '(unlabelled)'}: ${source.shape}; ${source.rows.length} rows; ${source.stated_metrics.length} stated metrics`);
      console.log('This inventories source inputs only; it does not assign categories, dates, zeros, or economic assertions.');
    }
    break;
  }

  case 'calc': {
    if (!positional[0] || !positional[1]) {
      console.error('Usage: uwmd calc <file> <calc.json|formula> [--calc-context <file>]');
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
      ...loadCalculationContext(flags),
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
    // `init` names its file with --output only. Through 4.2.0 a positional was
    // ignored, so `uwmd init my-deal.uwx.md` wrote new-deal.uwx.md and the
    // next command on my-deal.uwx.md found nothing.
    if (positional.length > 0) {
      console.error(`uwmd init: unexpected argument '${positional[0]}'. init takes no file argument; name the new file with --output ${positional[0]}.`);
      process.exit(1);
    }
    cmdInit(flags);
    break;

  case 'summary':
    if (!positional[0]) { console.error('Usage: uwmd summary <file>'); process.exit(1); }
    cmdSummary(positional[0]);
    break;

  case 'export':
    if (!positional[0]) { console.error('Usage: uwmd export <file.uw.md> [--output <file.uw.json>] [--no-superseded] [--resolved [--parts <dir>]] [--stdout]'); process.exit(1); }
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
    if (!positional[0]) { console.error('Usage: uwmd scope <file> [--asset-class multifamily] [--market-data <file>] [--output <file>] [--json]'); process.exit(1); }
    cmdScope(positional[0], flags);
    break;

  case 'refine':
    if (!positional[0]) { console.error('Usage: uwmd refine <file> [--targets dscr,debt_yield] [--top 5] [--asset-class multifamily] [--market-data <file>] [--calc-context <file>] [--json]'); process.exit(1); }
    cmdRefine(positional[0], flags);
    break;

  case 'compose':
    if (!positional[0]) { console.error('Usage: uwmd compose <file> --externalize <section> [--collection-key <k>] [--collection-path <p>] [--part-prefix <p>] [--out-dir <dir>] [--in-place] [--output <file>] [--dry-run]'); process.exit(1); }
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
      if (!target) { console.error('Usage: uwmd package to-context <file.uwpkg.zip> [--output <file.json>] [--stdout] [--compact]'); process.exit(1); }
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
      if (files.length === 0) { console.error('Usage: uwmd modules validate <manifest.json...> [--tier reader|verifier] [--json]'); process.exit(1); }
      cmdModulesValidate(files, flags);
    } else if (sub === 'list') {
      if (files.length === 0) { console.error('Usage: uwmd modules list <manifest.json...> [--tier reader|verifier] [--json]'); process.exit(1); }
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
    // The engine version goes to stderr. stdout is exactly the
    // ImplementationManifest (§II.6a.2), whose schema admits no other field,
    // and stderr is free for diagnostics; the driver ignores it.
    console.error(`${VERIFY_PACKAGE_NAME} ${VERIFY_VERSION}`);
    break;

  case '--version':
  case '-V':
  case 'version':
    // Read from the manifest so `--version` and `manifest` cannot disagree.
    // These used to fall through to `default` and print the help text.
    // `@uwmd/verify` is the engine core is built on and every receipt names
    // (RFC 0083).
    console.log(`@uwmd/core ${REFERENCE_IMPLEMENTATION_MANIFEST.version}`);
    console.log(`${VERIFY_PACKAGE_NAME} ${VERIFY_VERSION}`);
    console.log(`Protocol ${REFERENCE_IMPLEMENTATION_MANIFEST.protocol_version}`);
    console.log(`Format ${REFERENCE_IMPLEMENTATION_MANIFEST.format_version}`);
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

  default: {
    // No command, or an explicit request for help, prints the command list.
    // Any other word is not a command and is refused before any file is read,
    // so a retired or misspelled command (`uwmd run`) never exits 0.
    if (command !== undefined && !['--help', '-h', 'help'].includes(command)) {
      console.error(`uwmd: unknown command '${command}'. Run 'uwmd --help' for the command list.`);
      process.exit(1);
    }
    console.log(`
uwmd — UW Markdown underwriting file toolkit

Commands:
  parse    <file>              Parse file and output JSON
  validate <file>              Run all validation checks
  verify   <file>              Validate + recompute stated metrics + verify integrity (hashes)
                               + provenance (actor/policy); a failed stated metric exits 1
                               --signing --keystore=<path> also checks block signatures (RFC 0010,
                               via the optional @uwmd/signing package)
                               --document-signature=<artifact> --keystore=<path> requires an
                               authenticated semantic snapshot (RFC 0084, via @uwmd/signing)
  sign-document <file> --key=<signer.json> --out=<signature.json>
                               Authenticate a semantic snapshot without computing financials
                               (RFC 0084, via the optional @uwmd/signing package)
  render   <file>              Render to output format (see --format)
  edit     <file> <op.json>    Apply an EditOperation (Tier-2)
  compact  <file>              Strip superseded blocks
  diff     <file-a> <file-b>  Compare two files section by section
  verify-reserve-draws <file> [plan.json] [--json]  Verify stated gross-expenditure draw bindings (read-only)
  verify-reserve-accounts <file> [--json]  Verify stated property reserve balances (read-only)
  verify-cash-flows <file> [--variant <name>] [--json]  Verify stated dated-cash-flow metrics (read-only)
  assemble-property <file> <plan.json>  Assemble declared unlevered pre-tax property cash flows (JSON candidate only)
  inspect-property-cash-flows <file> [--json]  Inventory source inputs needed for an assembly plan (read-only)
  project-lease-up <file> <plan.json>  Project verified lease-up amounts onto explicit cash dates (JSON candidate only)
  calc     <file> <calc.json>  Evaluate a calc declaration or inline formula (Tier-3)
  init                         Generate a blank .uwx.md file (name it with --output <file>)
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
  manifest                     Print this implementation's ImplementationManifest (conformance protocol; @uwmd/verify version on stderr)
  --version, -V                Print the @uwmd/core, @uwmd/verify, Protocol and Format versions

Options (each command accepts only the flags listed for it; an unknown flag exits 1 before any work runs):
  --output <path>    Output file path (compact, init; init refuses an existing file)
  --dry-run          Show what would change without writing (compact)
  --json             JSON output on stdout, nothing else (validate, calc, edit)
  --calc-context <f> JSON sectionVariants/overrides (calc, refine; refine: period overrides only)
  --strict           Throw on parse errors instead of collecting
  --format <f>       Render format: json|csv|chat|summary (render, default: summary)
  --no-superseded    Drop append-only history from the .uw.json export (export)
  --resolved         Resolve externalized sections first (verify, export)
  --signing          Check _meta.integrity.signature on every block (verify; requires --keystore)
  --keystore <path>  JSON key store mapping kid to public key (verify --signing, --document-signature)
  --document-signature <path>  Detached document signature to require (verify; needs --keystore)
  --key <path>       Local signer document: kid, alg and one private key (sign-document)
  --out <path>       New file for the detached document signature (sign-document)
  --signed-at <iso>  Fix the document signing instant (sign-document; default: now)
  --parts <dir>      Fragment directory to read (resolve, --resolved; default: ./parts); deprecated alias of --out-dir (compose)
  --externalize <s>  Section to split into fragments (compose)
  --collection-key <k>  Row identity field (compose, default: unit_id)
  --collection-path <p> Field the rows occupy (compose, default: units)
  --in-place         Overwrite the input record (compose)
  --stdout           Write export/convert output to stdout
  --to <format>       Target: lite|uwx|uw-json|uw-xml|uw-csv-bundle (convert)
  --projection-report Write the UWX-to-Lite omission report as JSON (convert)
  --issued-at <iso>  Fix the receipt issuance timestamp (receipt issue)
  --tier <tier>      Module host conformance tier: reader | verifier (modules; default verifier)
  --max-tokens <n>   Max tokens for chat render (default: 12000)
  --institution <f>  Path to .uw.institution.json config (validate; otherwise adjacent sidecar)
  --name <n>         Deal name (init)
  --address <a>      Property address (init)
  --city <c>         City (init)
  --state <s>        State code (init)
  --asset-class <ac> Asset class (init)
  --stage <s>        Deal stage (init); validate: deprecated, reports that stage's readiness only
  --scenario <s>     A standard business plan or reverse-DNS extension (init)
  --asset-subtype <s> Descriptive subtype; build_to_rent on multifamily (init)
  --tier <t>         screener | analyst (init)
  --actor <n>        Actor name for the edit (edit, default: system)
  --source <s>       _meta.provenance.source pattern (edit, default: manual)
  --agent-id <id>    Agent identifier when source is agent/* (edit)
  --agent-version <v>Agent semver (edit)
  --confidence <c>   Confidence level for new block: high|medium|low (edit)
`);
    process.exit(0);
  }
}
})().catch(err => {
  // A typed refusal (a parse error such as UNSUPPORTED_FORMAT_VERSION, or any
  // error carrying a string `code`) is a message for the user, not a crash:
  // print it without a stack trace. Anything else is a bug; keep the stack.
  if (err instanceof Error && typeof (err as { code?: unknown }).code === 'string') {
    console.error(`uwmd: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
