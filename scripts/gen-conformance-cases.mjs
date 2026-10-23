#!/usr/bin/env node
// Generate the declarative case files the RFC 0004 driver reads.
//
// The cases are derived from the fixture directories rather than hand-written,
// because a case file is a restatement of what is already on disk: which
// fixture, which command, which baseline. Hand-maintaining ~50 of those is a
// standing invitation for one to go stale silently — a case pointing at a
// fixture nobody deletes and nobody runs.
//
// Run: node scripts/gen-conformance-cases.mjs  (or `npm run gen-conformance-cases`)

import { portableOwner, portableVocabulary } from './conformance-targets.mjs';
import { statementHomeSource } from '../conformance/metrics/verifier.mjs';
import { parseUWFile } from '../packages/uwmd-verify/dist/index.js';
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = join(ROOT, 'conformance', 'runner', 'cases');
const CONFORMANCE = join(ROOT, 'conformance');
// RFC 0115: documents restated from bare-payload fixtures and statement-home
// edits, so a document-level Verifier subcommand can read them. Generated and
// checked like the case files; never edited by hand.
const DERIVED = join(ROOT, 'conformance', 'runner', 'derived');

const cases = [];

/**
 * The Format version each case was written for (RFC 0111 D6, Protocol §XII.5):
 * the rule set a Verifier must keep to owe the case. Every case today was
 * written for Format 3.0, the one rule set. A case written for a later rule set
 * will name that version; existing cases keep the one they were written for.
 */
const WRITTEN_FOR_FORMAT_VERSION = '3.0';

const readFileText = (path) => readFileSync(path, 'utf8');

/** Relative POSIX path from the repo root — case files must be portable. */
const rel = (abs) => abs.slice(ROOT.length + 1).replaceAll('\\', '/');

/**
 * `requires_capabilities` (RFC 0030) is *derived*, never hand-listed. A table
 * mapping fixture to capability is one more thing to forget when a fixture
 * lands; the command a case runs already says what it exercises.
 */
function capabilitiesFor(command, args) {
  switch (command) {
    case 'verify':
      return ['integrity', 'document-signature-verification'];
    case 'parse':
      return ['parse'];
    case 'validate':
      return ['validate'];
    case 'calc':
      return ['calc-evaluate'];
    case 'render': {
      const view = args[args.indexOf('--format') + 1];
      return [`render-${view}`];
    }
    // RFC 0115 D2: one capability flag per Verifier obligation, plus `parse`.
    case 'verify-metrics':
    case 'verify-cash-flows':
    case 'verify-property-cash-flows':
    case 'verify-waterfall':
    case 'verify-capital-stack':
    case 'verify-lease-up':
    case 'verify-reserve-accounts':
    case 'verify-reserve-draws':
      return ['parse', command];
    case 'verify-receipt':
      return ['parse', 'verify-receipts'];
    default:
      throw new Error(`capabilitiesFor: no mapping for command '${command}'`);
  }
}

function add(caseKey, command, args, fixtureDir, expect, capabilities) {
  const parts = caseKey.split('/');
  const suite = parts[0] === 'documents-malformed' ? 'documents' : parts[0] === 'replacement-funding' ? 'hedge' : parts[0];
  const scenario = parts[0] === 'documents-malformed' ? `malformed-${parts[1]}` : parts[1];
  const operation = parts[2] ?? command;
  const target = portableOwner(suite, scenario, operation);
  cases.push({
    id: `${target}__${suite}__${scenario}__${operation}`,
    target,
    format_version: WRITTEN_FOR_FORMAT_VERSION,
    requires_capabilities: capabilities ?? capabilitiesFor(command, args),
    command,
    args,
    fixture_dir: rel(fixtureDir),
    expect,
  });
}

const dirs = (base) =>
  existsSync(base)
    ? readdirSync(base)
        .filter((name) => statSync(join(base, name)).isDirectory())
        .sort()
    : [];

// ── Documents: parse, validate, render ─────────────────────────────────────────
//
// One fixture yields four cases. The parsed and validation baselines are
// compared as JSON subsets; the two rendered baselines are text, because they
// ARE text — wrapping a rendered chat transcript in a JSON envelope to satisfy
// a protocol would mean re-baselining every one of them to gain nothing.

const DOCUMENT_FIXTURES = join(CONFORMANCE, 'documents', 'fixtures');
const DOCUMENT_EXPECTED = join(CONFORMANCE, 'documents', 'expected');
for (const file of readdirSync(DOCUMENT_FIXTURES).filter((f) => f.endsWith('.uwx.md')).sort()) {
  const stem = basename(file, '.uwx.md');
  const baseline = (suffix) => rel(join(DOCUMENT_EXPECTED, `${stem}.${suffix}`));

  if (existsSync(join(DOCUMENT_EXPECTED, `${stem}.parsed.json`))) {
    add(`documents/${stem}/parse`, 'parse', [file], DOCUMENT_FIXTURES, {
      kind: 'json-subset',
      file: baseline('parsed.json'),
    });
  }
  if (existsSync(join(DOCUMENT_EXPECTED, `${stem}.validation.json`))) {
    const wanted = JSON.parse(readFileText(join(DOCUMENT_EXPECTED, `${stem}.validation.json`)));
    add(`documents/${stem}/validate`, 'validate', [file, '--json'], DOCUMENT_FIXTURES, {
      kind: 'json-subset',
      file: baseline('validation.json'),
      // The baseline is the deduplicated (code, severity) set, not the raw
      // issue list — pinning message wording would make every copy edit a
      // corpus change. The driver applies the same projection by name.
      project: 'issue-code-severity-set',
      // §II.6a.2: `validate` exits 1 when the document has a validation error
      // (the reference CLI does exactly that, `cli.ts`). Derived from the
      // baseline, never assumed: fixture 09 (RFC 0038) is the first document
      // document whose expected verdict is `errors`, and the hardcoded 0 that
      // stood here ("the fixtures are valid") pinned the corpus against the
      // prose the moment it landed.
      exit_code: hasError(wanted) || wanted.overall_status === 'blocked' ? 1 : 0,
    });
  }
  for (const [view, suffix] of [['chat', 'rendered-chat.txt'], ['summary', 'rendered-summary.md']]) {
    if (existsSync(join(DOCUMENT_EXPECTED, `${stem}.${suffix}`))) {
      add(`documents/${stem}/render-${view}`, 'render', [file, '--format', view], DOCUMENT_FIXTURES, {
        kind: 'text',
        file: baseline(suffix),
        // The baselines are the full RenderResult envelope despite the .txt /
        // .md extensions; the CLI prints the body. Name the field rather than
        // re-baselining every rendered fixture to make the extension honest.
        baseline_field: 'content',
      });
    }
  }
}

// ── Malformed documents: the validator must REPORT, never throw ────────────────
//
// Compared as a subset of the validation response rather than by exit code: a
// malformed fixture that produced no output at all would pass an exit-code
// check, and "refused to parse" is exactly the failure these fixtures exist to
// rule out.

const MALFORMED_DOCUMENTS = join(CONFORMANCE, 'documents', 'malformed');
for (const file of readdirSync(MALFORMED_DOCUMENTS).filter((f) => f.endsWith('.uwx.md')).sort()) {
  const stem = basename(file, '.uwx.md');
  const expected = join(MALFORMED_DOCUMENTS, `${stem}.expected.json`);
  if (!existsSync(expected)) continue;
  const wanted = JSON.parse(readFileText(expected));
  // Some malformed baselines describe integrity findings rather than validator
  // output; only the ones shaped like a ValidationResult are CLI-checkable.
  if (!Array.isArray(wanted.issues)) continue;
  add(`documents-malformed/${stem}`, 'validate', [file, '--json'], MALFORMED_DOCUMENTS, {
    kind: 'json-subset',
    file: rel(expected),
    project: 'issue-code-severity-set',
    exit_code: wanted.overall_status === 'blocked' || hasError(wanted) ? 1 : 0,
  });
}

function hasError(result) {
  return (result.issues ?? []).some((i) => i.severity === 'error');
}

// RFC0097 paired filesystem operation controls. The existing comparator is
// unchanged; native assertions additionally enforce error-only outer transport.
const INSTITUTION_CONFIG = join(CONFORMANCE, 'institution-config');
for (const scenario of dirs(INSTITUTION_CONFIG)) {
  const dir = join(INSTITUTION_CONFIG, scenario);
  const descriptor = JSON.parse(readFileText(join(dir, 'case.json')));
  add(`institution-config/${scenario}/validate`, 'validate', descriptor.args, dir, {
    ...descriptor.expect, file: rel(join(dir, descriptor.expect.file)),
  });
}

// ── Starter editor ────────────────────────────────────────────────────────────
//
// Only the fixtures whose whole story is "apply this operation, get these
// bytes". `parent-hash-stamp` and `stale-parent-rejected` need `applyEditAsync`
// and a volatile hash, which the CLI's synchronous `edit` cannot express; they
// stay covered by the TypeScript runner and are listed in the runner README as
// a known gap rather than quietly dropped.

const EDITOR = join(CONFORMANCE, 'starter/editor', 'fixtures');
const EDITOR_SKIP = new Set(['parent-hash-stamp', 'stale-parent-rejected']);
for (const scenario of dirs(EDITOR)) {
  if (EDITOR_SKIP.has(scenario) || existsSync(join(EDITOR, scenario, 'options.json'))) continue;
  const dir = join(EDITOR, scenario);
  if (!existsSync(join(dir, 'after.uwx.md'))) continue;
  const context = JSON.parse(readFileText(join(dir, 'context.json')));
  const flags = ['--json'];
  for (const [key, flag] of [
    ['actor', '--actor'],
    ['source', '--source'],
    ['confidence', '--confidence'],
    ['agentId', '--agent-id'],
    ['agentVersion', '--agent-version'],
  ]) {
    if (context[key]) flags.push(flag, context[key]);
  }
  // The operation's kind, not the tier, decides which edit capability a host
  // needs — a frontmatter-only editor is a real and conforming partial claim.
  const operationKind = JSON.parse(readFileText(join(dir, 'operation.json'))).kind;
  const EDIT_CAPABILITY = {
    section_replace: 'edit-replace',
    section_supersede: 'edit-supersede',
    frontmatter_set: 'edit-frontmatter',
  };
  const editCapability = EDIT_CAPABILITY[operationKind];
  if (!editCapability) throw new Error(`unmapped edit operation kind '${operationKind}'`);
  add(
    `starter-editor/${scenario}`,
    'edit',
    ['before.uwx.md', 'operation.json', ...flags],
    dir,
    { kind: 'json-field-text', field: 'content', file: 'after.uwx.md' },
    [editCapability],
  );
}

// ── Calculations ────────────────────────────────────────────────────────────

const CALCULATIONS = join(CONFORMANCE, 'calc', 'fixtures');
for (const scenario of dirs(CALCULATIONS)) {
  const dir = join(CALCULATIONS, scenario);
  if (!existsSync(join(dir, 'calc.json')) || !existsSync(join(dir, 'expected-result.json'))) continue;
  const expected = JSON.parse(readFileText(join(dir, 'expected-result.json')));
  // An optional caller context (RFC 0066) reaches the CLI as --calc-context.
  const context = existsSync(join(dir, 'calc-context.json')) ? ['--calc-context', 'calc-context.json'] : [];
  add(`calc/${scenario}`, 'calc', ['deal.uwx.md', 'calc.json', ...context, '--json'], dir, {
    kind: 'json-subset',
    file: 'expected-result.json',
    // The CLI exits 1 when any declaration fails to evaluate; the refusal
    // fixtures are supposed to.
    exit_code: expected.ok === false ? 1 : 0,
  });
}

// RFC 0070 complete-validation contract: independent of structural result.
// RFC 0075's senior-preference and RFC 0076's refusal cases carry the same shape.
for (const scenario of dirs(join(CONFORMANCE, 'hedge')).filter(n => /^00(70|75|76)-/.test(n))) {
  const dir = join(CONFORMANCE, 'hedge', scenario);
  const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
  add(`replacement-funding/${scenario}`, 'validate', ['deal.uwx.md', '--json'], dir, {
    kind: 'json-subset', file: 'expected.json', project: 'replacement-funding',
    exit_code: expected.codes.length > 0 || expected.verification.state === 'failed' || expected.verification.state === 'unverifiable' ? 1 : 0,
  });
}
// RFC 0072: an interoperable validator must retain warning severity and exit 0.
for (const scenario of dirs(join(CONFORMANCE, 'scenario'))) {
  const dir = join(CONFORMANCE, 'scenario', scenario);
  add(`scenario/${scenario}`, 'validate', ['deal.uwx.md', '--json'], dir, {
    kind: 'json-subset', file: 'expected.json', project: 'issue-code-severity-set', exit_code: 0,
  });
}
// Format §5.3 cross-checks (RFC 0086 CC-17): the (code, severity) projection,
// and, unprojected, the coverage subset that tells evaluated from skipped.
for (const scenario of dirs(join(CONFORMANCE, 'cross-checks'))) {
  const dir = join(CONFORMANCE, 'cross-checks', scenario);
  const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
  const exit_code = expected.overall_status === 'errors' ? 1 : 0;
  add(`cross-checks/${scenario}/validate`, 'validate', ['deal.uwx.md', '--json'], dir, {
    kind: 'json-subset', file: 'expected.json', project: 'issue-code-severity-set', exit_code,
  });
  add(`cross-checks/${scenario}/coverage`, 'validate', ['deal.uwx.md', '--json'], dir, {
    kind: 'json-subset', file: 'expected-coverage.json', exit_code,
  });
}
// RFC 0064 separately invoked, read-only custody verification.
for (const scenario of dirs(join(CONFORMANCE, 'reserve-accounts'))) {
  const dir = join(CONFORMANCE, 'reserve-accounts', scenario);
  const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
  add(`reserve-accounts/${scenario}`, 'verify-reserve-accounts', ['deal.uwx.md', '--json'], dir, {
    kind: 'json-subset', file: 'expected.json',
    exit_code: ['failed', 'unverifiable'].includes(expected.state) ? 1 : 0,
  });
}
// RFC 0065 optional draw-to-gross-expenditure binding plans.
for (const scenario of dirs(join(CONFORMANCE, 'reserve-draw-bindings'))) {
  const dir = join(CONFORMANCE, 'reserve-draw-bindings', scenario);
  const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
  const args = ['deal.uwx.md', ...(existsSync(join(dir, 'plan.json')) ? ['plan.json'] : []), '--json'];
  add(`reserve-draw-bindings/${scenario}`, 'verify-reserve-draws', args, dir, {
    kind: 'json-subset', file: 'expected.json',
    exit_code: ['failed', 'unverifiable'].includes(expected.state) ? 1 : 0,
  });
}

// ── RFC 0115: the remaining Verifier obligations ─────────────────────────────
//
// Each case restates a reference check through its portable subcommand. A
// fixture that is already a document is used as it is. A bare-payload fixture
// (`case.json`) and a statement-home edit are restated as a document under
// conformance/runner/derived/, holding exactly the payload the reference
// runner passes to the verifier. Expected files are the fixtures' own; the
// case names the baseline fields it compares, because a document fixture's
// `expected_codes` are validator codes, not verifier codes.

const derived = new Map();
const derive = (suite, scenario, body) => {
  const dir = join(DERIVED, suite, scenario);
  derived.set(join(dir, 'deal.uwx.md'), body);
  return dir;
};
const FENCE = '```';
const fence = (section, payload, variant) =>
  `\n${FENCE}json uw:section=${section}${variant ? ` variant=${variant}` : ''}\n${JSON.stringify(payload, null, 2)}\n${FENCE}\n`;
const restated = (origin, blocks) =>
  `---\nuw_version: "${WRITTEN_FOR_FORMAT_VERSION}"\n---\n\n# Restated from ${origin}\n\nGenerated by scripts/gen-conformance-cases.mjs (RFC 0115). Do not edit.\n${blocks.join('')}`;
const verdictExit = (verdict) => (verdict === 'failed' ? 1 : 0);

/** The `--variant` the reference runner selects for a document fixture: base, else default. */
function referenceVariant(path, section) {
  const entry = parseUWFile(readFileText(path)).sections[section];
  if (!entry) throw new Error(`${rel(path)} has no ${section}`);
  if ('annotation' in entry) return [];
  const variant = ['base', 'default'].find((name) => Object.hasOwn(entry, name));
  if (!variant) throw new Error(`${rel(path)}: no base/default ${section} variant`);
  return ['--variant', variant];
}

for (const scenario of dirs(join(CONFORMANCE, 'capital-stack'))) {
  const dir = join(CONFORMANCE, 'capital-stack', scenario);
  if (!existsSync(join(dir, 'expected.json'))) continue;
  const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
  if (!expected.cs_issues) continue;
  add(`capital-stack/${scenario}/validate`, 'validate', ['deal.uwx.md', '--json'], dir, {
    kind: 'json-subset', file: 'expected.json', project: 'capital-admission', exit_code: 1,
  });
}

const SECTION_VERIFIERS = [
  { suite: 'cash-flow', command: 'verify-cash-flows', section: 'cash_flow_series',
    blocks: (c) => [fence('cash_flow_series', c.series, 'base')] },
  { suite: 'lease-up', command: 'verify-lease-up', section: 'lease_up_schedule',
    // leaseUpContext reads a sqft denominator from property.total_nra_sqft.
    blocks: (c) => [fence('lease_up_schedule', c.schedule),
      ...(c.context?.total_sf != null ? [fence('property', { total_nra_sqft: c.context.total_sf })] : [])] },
  { suite: 'capital-stack', command: 'verify-capital-stack', section: 'capital_stack',
    // capitalStackContext reads NOI, total uses and underwritten value.
    blocks: (c) => [fence('capital_stack', c.stack),
      ...(c.context?.noi != null ? [fence('noi_model', { net_operating_income: c.context.noi })] : []),
      ...(c.context?.total_cost != null ? [fence('sources_uses', { uses: { total: c.context.total_cost } })] : []),
      ...(c.context?.total_value != null ? [fence('valuation', { underwritten_value: c.context.total_value })] : [])] },
  { suite: 'waterfall', command: 'verify-waterfall', section: 'distribution_waterfall',
    // The series sits at the variant the waterfall's cash_flow_ref names; a
    // null series is the unresolved reference (WF-02) reaching the verifier.
    blocks: (c) => {
      const ref = c.waterfall?.cash_flow_ref?.variant;
      if (c.series != null && typeof ref !== 'string') throw new Error('waterfall series without a named cash_flow_ref');
      return [fence('distribution_waterfall', c.waterfall), ...(c.series != null ? [fence('cash_flow_series', c.series, ref)] : [])];
    } },
];

for (const { suite, command, section, blocks } of SECTION_VERIFIERS) {
  for (const scenario of dirs(join(CONFORMANCE, suite))) {
    const dir = join(CONFORMANCE, suite, scenario);
    if (!existsSync(join(dir, 'expected.json'))) continue;
    const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
    if (typeof expected.verdict !== 'string') continue; // validator-code, calc and contrast fixtures
    const expect = (fields) => ({ kind: 'verdict-codes', file: rel(join(dir, 'expected.json')),
      project: 'section-verification', fields, exit_code: verdictExit(expected.verdict) });
    if (existsSync(join(dir, 'case.json'))) {
      const payload = JSON.parse(readFileText(join(dir, 'case.json')));
      const docDir = derive(suite, scenario, restated(rel(join(dir, 'case.json')), blocks(payload)));
      add(`${suite}/${scenario}/${command}`, command, ['deal.uwx.md', '--json'], docDir,
        expect(['verdict', 'expected_code']));
    } else if (existsSync(join(dir, 'deal.uwx.md'))) {
      add(`${suite}/${scenario}/${command}`, command,
        ['deal.uwx.md', ...referenceVariant(join(dir, 'deal.uwx.md'), section), '--json'], dir,
        expect(['verdict']));
    }
  }
}

// §VIII.9.6: the property cash-flow assembly, with its plan. The projection
// reduces a PropertyCashFlowAssembly (or its refusal) to the baseline's fields;
// `metrics` (dated metrics over the candidate, a calc declaration) and
// `absent_validation_codes` (a validator check) stay reference-runner checks.
for (const scenario of dirs(join(CONFORMANCE, 'property-cash-flow-assembly'))) {
  const dir = join(CONFORMANCE, 'property-cash-flow-assembly', scenario);
  const expected = JSON.parse(readFileText(join(dir, 'expected.json')));
  const ignore = ['metrics', 'absent_validation_codes'].filter((k) => k in expected);
  add(`property-cash-flow-assembly/${scenario}/verify-property-cash-flows`, 'verify-property-cash-flows',
    ['deal.uwx.md', 'plan.json', '--json'], dir, {
      kind: 'json-subset', file: 'expected.json', project: 'property-cash-flow-assembly',
      ...(ignore.length ? { ignore } : {}),
      exit_code: expected.error_code ? 1 : 0,
    });
}

// RFC 0099 statement homes: the edited example, verified with the dictionary.
const STATEMENT_HOMES = join(CONFORMANCE, 'metrics', 'statement-homes', 'cases.json');
const METRIC_EXAMPLES = JSON.parse(readFileText(join(CONFORMANCE, 'metrics', 'expected.json')));
JSON.parse(readFileText(STATEMENT_HOMES)).cases.forEach((testCase, i) => {
  const scenario = `statement-home-${testCase.name}`;
  // The exit code follows from the counts: a failed statement exits 1. A case
  // that pins neither leaves the example's own recorded findings unedited.
  const failed = testCase.failed ?? (testCase.expect.some((e) => e.state === 'failed') ? 1
    : testCase.edits.length === 0 ? METRIC_EXAMPLES.find((e) => e.example === testCase.example)?.counts.failed : undefined);
  if (failed === undefined) throw new Error(`${scenario}: cannot restate its exit code`);
  const docDir = derive('metrics', scenario, statementHomeSource(ROOT, testCase));
  add(`metrics/${scenario}/verify-metrics`, 'verify-metrics', ['deal.uwx.md', '--json'], docDir, {
    kind: 'statement-states', file: rel(STATEMENT_HOMES), baseline_pointer: `/cases/${i}`,
    exit_code: failed > 0 ? 1 : 0,
  });
});

// RFC 0115 D4: receipts, as a Verifier without a calculation pack determines them.
for (const id of dirs(join(CONFORMANCE, 'receipts', 'verify'))) {
  const dir = join(CONFORMANCE, 'receipts', 'verify', id);
  const deal = readdirSync(dir).find((f) => /\.uwx?\.md$/.test(f));
  const file = existsSync(join(dir, 'expected-verdict-pack-less.json')) ? 'expected-verdict-pack-less.json' : 'expected-verdict.json';
  const expected = JSON.parse(readFileText(join(dir, file)));
  const inputs = existsSync(join(dir, 'inputs.json')) ? ['--inputs', 'inputs.json'] : [];
  add(`receipts/verify-${id}/verify-receipt`, 'verify-receipt', ['receipt.json', deal, ...inputs, '--json'], dir, {
    kind: 'verdict-codes', file, project: 'receipt-verification', fields: ['verdict', 'expected_codes', 'refused_code', ...(expected.recomputed_ids ? ['recomputed_ids'] : [])],
    exit_code: expected.refused_code || expected.verdict === 'failed' ? 1 : 0,
  });
}

// RFC 0085: independently signed payloads retain signature success at the
// governed root/link boundary. These cases require block signing, not V.13.
for (const id of ['10-missing-declared-parent', '11-null-parent-root']) {
  const fixture = join(CONFORMANCE, 'signing', 'blocks', id);
  add(`signing/block-${id}/verify`, 'verify', [
    'deal.uwx.md', '--integrity', '--signing', '--keystore', '../../keys/keystore.json', '--json',
  ], fixture, { kind: 'json-subset', file: rel(join(fixture, 'cli.expected.json')),
    exit_code: id.startsWith('10-') ? 1 : 0 }, ['integrity', 'signing']);
}

// ── Emit (or, under --check, compare) ───────────────────────────────────────
//
// `--check` exists because these files are generated but committed. A fixture
// added without regenerating them would silently drop out of the v2 driver's
// coverage while every suite still reported green — the exact kind of failure
// that is invisible by construction, so CI has to go looking for it.

// RFC 0084: document authentication is an optional Integrity capability.
const DOCUMENT_SIGNATURES = join(CONFORMANCE, 'document-signatures');
for (const id of dirs(DOCUMENT_SIGNATURES).filter(name => /^\d/.test(name))) {
  const fixture = join(DOCUMENT_SIGNATURES, id);
  const expected = JSON.parse(readFileText(join(fixture, 'expected.json')));
  if (expected.backend === 'none') continue; // Unchecked API seam has no required-authentication CLI equivalent.
  add(`document-signatures/${id}/verify`, 'verify', [
    'deal.uwx.md', '--integrity', '--document-signature', 'signature.json',
    '--keystore', `../keys/${expected.backend === 'empty' ? 'empty.json' : 'keystore.json'}`, '--json',
  ], fixture, { kind: 'json-subset', file: rel(join(fixture, 'cli.expected.json')),
    exit_code: expected.state === 'verified' ? 0 : 1 });
}

const ids = cases.map(c => c.id);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate portable case');
const VOCABULARY = join(ROOT, 'conformance', 'runner', 'vocabulary.json');
const vocabularyBody = `${JSON.stringify(portableVocabulary, null, 2)}\n`;

const wanted = new Map(
  cases.map((c) => [`${c.id.replaceAll('/', '__')}.case.json`, `${JSON.stringify(c, null, 2)}\n`]),
);

if (process.argv.includes('--check')) {
  const onDisk = existsSync(CASES) ? readdirSync(CASES).filter((f) => f.endsWith('.case.json')) : [];
  const problems = [];
  if (!existsSync(VOCABULARY) || readFileText(VOCABULARY) !== vocabularyBody) problems.push('stale: vocabulary.json');
  for (const [name, body] of wanted) {
    if (!onDisk.includes(name)) problems.push(`missing: ${name}`);
    else if (readFileText(join(CASES, name)) !== body) problems.push(`stale: ${name}`);
  }
  for (const name of onDisk) {
    if (!wanted.has(name)) problems.push(`orphaned: ${name}`);
  }
  for (const [path, body] of derived) {
    if (!existsSync(path)) problems.push(`missing: ${rel(path)}`);
    else if (readFileText(path) !== body) problems.push(`stale: ${rel(path)}`);
  }
  const derivedOnDisk = existsSync(DERIVED) ? readdirSync(DERIVED, { recursive: true }).map(String).filter((f) => f.endsWith('.md')) : [];
  for (const name of derivedOnDisk) {
    if (!derived.has(join(DERIVED, name))) problems.push(`orphaned: ${rel(join(DERIVED, name))}`);
  }
  if (problems.length > 0) {
    console.error('conformance/runner/cases or derived/ is out of date. Run: npm run gen-conformance-cases');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(`[PASS] conformance/runner/cases: ${wanted.size} case files and ${derived.size} derived documents are current.`);
  process.exit(0);
}

if (resolve(CASES) !== join(ROOT, 'conformance', 'runner', 'cases')) throw new Error('Case directory escaped workspace');
writeFileSync(VOCABULARY, vocabularyBody, 'utf8');
rmSync(CASES, { recursive: true, force: true });
mkdirSync(CASES, { recursive: true });
for (const [name, body] of wanted) {
  writeFileSync(join(CASES, name), body, 'utf8');
}
if (resolve(DERIVED) !== join(ROOT, 'conformance', 'runner', 'derived')) throw new Error('Derived directory escaped workspace');
rmSync(DERIVED, { recursive: true, force: true });
for (const [path, body] of derived) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, 'utf8');
}

const byTier = {};
for (const c of cases) byTier[c.target] = (byTier[c.target] ?? 0) + 1;
console.log(
  `conformance/runner/cases: wrote ${cases.length} cases (${Object.entries(byTier)
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ')}).`,
);
