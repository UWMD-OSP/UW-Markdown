// A lender with only the standard: `@uwmd/verify`, and nothing of `@uwmd/core`
// (no defaults, cascade, display formatting or core barrel). Verification is
// `verifyStatedMetrics` (RFC 0083 §2), which uses only the reader, the
// safe-expression evaluator and the metric dictionary. This file keeps the
// fixture plumbing: discovering examples and the Lite anchor view. Where a
// document states each metric is the dictionary's `statement_bindings`
// (RFC 0099), read by `verifyStatedMetrics` itself. The package entry supplies the public API; the
// single-metric comparison `verifyStatedMetric` is module-level, so it comes
// from the same build's `metric-verification.js`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FORMAT_VERSION, getStatedDecimals, parseUWFile, parseUWLite, verifyStatedMetrics } from '../../packages/uwmd-verify/dist/index.js';
import { verifyStatedMetric } from '../../packages/uwmd-verify/dist/metric-verification.js';

export { verifyStatedMetric };

// Lite anchors are explicitly stated inputs. This maps the published bridge's
// section names only; it supplies no bridge metadata or financial defaults.
function readExample(source, liteSections) {
  if (!/^uw_lite_version:/m.test(source)) return { parsed: parseUWFile(source), litePrecision: new Map() };
  const lite = parseUWLite(source);
  if (lite.issues.some(i => i.severity === 'error')) throw new Error('Invalid Lite fixture');
  // An empty structured view over the Lite frontmatter; the anchors below fill it.
  // A Lite record that declares no uw_version is Format 3.0, as the bridge
  // compiles it (RFC 0081 D12); that version selects its rule set (RFC 0111).
  const parsed = {
    frontmatter: { uw_version: FORMAT_VERSION, ...lite.frontmatter }, sections: {}, prose: {}, pipeline_log: [],
    custom_calculations: [], custom_scenarios: [], extensions: {}, superseded: {}, raw: source,
  };
  const litePrecision = new Map();
  for (const field of lite.fields) {
    const [head, ...tail] = field.path.split('.');
    const section = liteSections[head];
    if (!section) continue;
    parsed.sections[section] ??= { annotation: { section }, content: {}, meta: {} };
    let payload = parsed.sections[section].content;
    for (const segment of tail.slice(0, -1)) payload = payload[segment] ??= {};
    payload[tail.at(-1)] = field.value;
    // In Lite, the anchored numeric spelling is the value token (§4), not
    // an optional UWX display string. Percent spelling shifts two places.
    const token = field.display_value.replaceAll(',', '').replace(/^[$]\s*/, '').replace(/[%xX]$/, '').trim();
    const places = getStatedDecimals(token);
    if (places !== undefined) litePrecision.set(`${section}.${tail.join('.')}`, places + (field.display_value.endsWith('%') ? 2 : 0));
  }
  return { parsed, litePrecision };
}

export function verifyExample(source, dictionary, liteSections) {
  const { parsed, litePrecision } = readExample(source, liteSections);
  const asset_class = parsed.frontmatter.asset_class;
  // Examples whose class has no dictionary calculations are not counted.
  if (!dictionary.calculations.some(m => m.asset_classes.includes(asset_class))) return null;
  return verifyStatedMetrics(parsed, {
    dictionary,
    statedDecimals: litePrecision,
  });
}

/** The published Lite bridge's section names, for the Lite anchor view. */
export function readLiteSections(root) {
  return JSON.parse(readFileSync(join(root, 'conformance/metrics/lite-input-sections.json'), 'utf8'));
}

/**
 * RFC 0099 statement homes: apply a case's edits to a builtin example and
 * verify the result with the dictionary's own bindings. An edit is scoped to
 * the last block of its section that contains the text, so an identical token
 * elsewhere in the document is left alone. The section `frontmatter` scopes an
 * edit to the YAML frontmatter (RFC 0086: a drifted summary price).
 */
export function verifyStatementHome(root, testCase) {
  const dictionary = JSON.parse(readFileSync(join(root, 'spec/metrics/builtin.json'), 'utf8'));
  return verifyStatedMetrics(parseUWFile(statementHomeSource(root, testCase)), { dictionary });
}

/**
 * The edited example a statement-home case verifies. The portable driver's
 * case generator writes this same text as the case's document (RFC 0115), so
 * the reference runner and the portable driver check one source.
 */
export function statementHomeSource(root, testCase) {
  let source = readFileSync(join(root, 'examples', testCase.example), 'utf8').replaceAll('\r\n', '\n');
  for (const { section, find, replace } of testCase.edits) {
    if (section === 'frontmatter') {
      const start = source.indexOf(find);
      if (!source.startsWith('---\n') || start < 0 || start > source.indexOf('\n---', 3)) throw new Error(`${testCase.name}: the frontmatter does not contain ${JSON.stringify(find)}`);
      source = source.slice(0, start) + replace + source.slice(start + find.length);
      continue;
    }
    const blocks = [...source.matchAll(new RegExp(`^\`\`\`json uw:section=${section}\\b[^\\n]*\\n([\\s\\S]*?)\\n\`\`\``, 'gm'))]
      .filter(m => m[1].includes(find));
    const block = blocks.at(-1);
    if (!block) throw new Error(`${testCase.name}: no ${section} block contains ${JSON.stringify(find)}`);
    const start = block.index + block[0].indexOf(find, block[0].indexOf('\n'));
    source = source.slice(0, start) + replace + source.slice(start + find.length);
  }
  return source;
}

export function verifyExamples(root) {
  const dictionary = JSON.parse(readFileSync(join(root, 'spec/metrics/builtin.json'), 'utf8'));
  const liteSections = readLiteSections(root);
  const files = readdirSync(join(root, 'examples'), { recursive: true })
    .filter(f => /\.uwx?\.md$/.test(f)).map(f => f.replaceAll('\\', '/')).sort();
  return files.flatMap(file => {
    const result = verifyExample(readFileSync(join(root, 'examples', file), 'utf8'), dictionary, liteSections);
    return result ? [{ example: file, ...result }] : [];
  });
}
