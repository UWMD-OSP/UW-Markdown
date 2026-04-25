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
import { writeAgentBlock, buildMeta } from './runner.js';
import { applyEdit } from './editor.js';
import type { EditContext } from './editor.js';
import type { EditOperation, ModuleCalcDecl, CalcEvaluationContext } from './protocol.js';
import { evaluateCalc } from './calc/index.js';
import { buildAgentContext, buildAgentPrompt, isContextReady, BANCROFT_LAYERS } from './context.js';
import { runBancroftAgent } from './agents/bancroft.js';
import type { AssetClass, DealStage, InstitutionConfig } from './types.js';
import type { RenderFormat, RenderTier } from './renderer.js';

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
      const key = arg.slice(2);
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
      const location = issue.section ? ` [${issue.section}${issue.field ? '.' + issue.field : ''}]` : '';
      console.log(`  ${prefix}${location} ${issue.message}`);
    }
  } else {
    console.log('\nNo issues found.');
  }
  console.log('');

  process.exit(result.errors.length > 0 ? 1 : 0);
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

  case 'compact':
    if (!positional[0]) { console.error('Usage: uwmd compact <file> [--output <file>] [--dry-run]'); process.exit(1); }
    cmdCompact(positional[0], flags);
    break;

  case 'diff':
    if (!positional[0] || !positional[1]) { console.error('Usage: uwmd diff <file-a> <file-b>'); process.exit(1); }
    cmdDiff(positional[0], positional[1]);
    break;

  case 'render': {
    if (!positional[0]) { console.error('Usage: uwmd render <file> --format <json|csv|chat|summary> [--output <file>] [--tier screener|analyst] [--max-tokens 12000]'); process.exit(1); }
    const fmt = (flags['format'] as string | undefined) ?? 'summary';
    const content = readFile(positional[0]);
    const parsedFile = parseUWFile(content);
    const result = render(parsedFile, {
      format: fmt as RenderFormat,
      tier: flags['tier'] as RenderTier | undefined,
      maxTokens: flags['max-tokens'] ? parseInt(flags['max-tokens'] as string, 10) : undefined,
    });
    if (flags['output']) {
      writeFileSync(resolve(flags['output'] as string), result.content, 'utf-8');
      console.log(`Rendered ${fmt} → ${flags['output']}${result.truncated ? ' [TRUNCATED]' : ''}${result.estimatedTokens ? ` (~${result.estimatedTokens} tokens)` : ''}`);
    } else {
      process.stdout.write(result.content + '\n');
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

  default:
    console.log(`
uwmd — .uw.md underwriting file toolkit

Commands:
  parse    <file>              Parse file and output JSON
  validate <file>              Run all validation checks
  render   <file>              Render to output format (see --format)
  run      <file>              Invoke a Bancroft agent (see --agent)
  edit     <file> <op.json>    Apply an EditOperation (Tier-2)
  compact  <file>              Strip superseded blocks
  diff     <file-a> <file-b>  Compare two files section by section
  calc     <file> <calc.json>  Evaluate a calc declaration or inline formula (Tier-3)
  init                         Generate a blank .uw.md file
  summary  <file>              Print quick metrics to terminal
  layers                       List Bancroft agent layers

Options:
  --output <path>    Output file path (compact, init)
  --dry-run          Show what would change without writing (compact)
  --json             JSON output (validate)
  --strict           Throw on parse errors instead of collecting
  --format <f>       Render format: json|csv|chat|summary (render, default: summary)
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
