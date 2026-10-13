// A lender with only the standard: `@uwmd/verify`, and nothing of `@uwmd/core`
// (no defaults, cascade, display formatting or core barrel). Verification is
// `verifyStatedMetrics` (RFC 0083 §2), which uses only the reader, the
// safe-expression evaluator and the metric dictionary. This file keeps the
// fixture plumbing: discovering examples, the Lite anchor view and the
// statement bindings. The package entry supplies the public API; the
// single-metric comparison `verifyStatedMetric` is module-level, so it comes
// from the same build's `metric-verification.js`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getStatedDecimals, parseUWFile, parseUWLite, verifyStatedMetrics } from '../../packages/uwmd-verify/dist/index.js';
import { verifyStatedMetric } from '../../packages/uwmd-verify/dist/metric-verification.js';

export { verifyStatedMetric };

// Lite anchors are explicitly stated inputs. This maps the published bridge's
// section names only; it supplies no bridge metadata or financial defaults.
function readExample(source, bindings) {
  if (!/^uw_lite_version:/m.test(source)) return { parsed: parseUWFile(source), litePrecision: new Map() };
  const lite = parseUWLite(source);
  if (lite.issues.some(i => i.severity === 'error')) throw new Error('Invalid Lite fixture');
  // An empty structured view over the Lite frontmatter; the anchors below fill it.
  const parsed = {
    frontmatter: { ...lite.frontmatter }, sections: {}, prose: {}, pipeline_log: [],
    custom_calculations: [], custom_scenarios: [], extensions: {}, superseded: {}, raw: source,
  };
  const litePrecision = new Map();
  for (const field of lite.fields) {
    const [head, ...tail] = field.path.split('.');
    const section = bindings.lite_input_sections[head];
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

export function verifyExample(source, dictionary, bindings) {
  const { parsed, litePrecision } = readExample(source, bindings);
  const asset_class = parsed.frontmatter.asset_class;
  // Examples whose class has no dictionary calculations are not counted.
  if (!dictionary.calculations.some(m => m.asset_classes.includes(asset_class))) return null;
  return verifyStatedMetrics(parsed, {
    dictionary,
    bindings: { output_sections: bindings.output_sections, aliases: bindings.aliases },
    statedDecimals: litePrecision,
  });
}

export function verifyExamples(root) {
  const dictionary = JSON.parse(readFileSync(join(root, 'spec/metrics/builtin.json'), 'utf8'));
  const bindings = JSON.parse(readFileSync(join(root, 'conformance/metrics/statement-bindings.json'), 'utf8'));
  const files = readdirSync(join(root, 'examples'), { recursive: true })
    .filter(f => /\.uwx?\.md$/.test(f)).map(f => f.replaceAll('\\', '/')).sort();
  return files.flatMap(file => {
    const result = verifyExample(readFileSync(join(root, 'examples', file), 'utf8'), dictionary, bindings);
    return result ? [{ example: file, ...result }] : [];
  });
}
