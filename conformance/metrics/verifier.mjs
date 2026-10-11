// A lender with only the standard: no packs, defaults, cascade, or core barrel.
// The reader and safe-expression evaluator are the only implementation services.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseUWFile, blockPayload } from '../../packages/uwmd-core/dist/parser.js';
import { resolveSectionBlock } from '../../packages/uwmd-core/dist/section-resolution.js';
import { parseUWLite } from '../../packages/uwmd-core/dist/lite.js';
import { parseExpression } from '../../packages/uwmd-core/dist/calc/parser.js';
import { evaluateDeclared } from '../../packages/uwmd-core/dist/calc/evaluator.js';
import { compareStatedMetric, getStatedDecimals } from '../../packages/uwmd-core/dist/calc/stated-precision.js';
import { jsonStatedDecimals, quickMetricDecimals } from './numeric-tokens.mjs';

export function verifyStatedMetric(metric, parsed, stated, sectionVariants, statedDecimals) {
  try {
    if (metric.null_semantics === 'finite_stated_number') {
      const block = resolveSectionBlock(parsed, 'property', { sectionVariants });
      const raw = block ? get(blockPayload(block), metric.path) : undefined;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return { state: 'unverifiable', reason: 'missing_or_invalid_size', computed: null };
      }
    }
    const value = evaluateDeclared(parseExpression(metric.formula), {
      parsed, prior_results: {}, locale: 'en-US', ...(sectionVariants ? { sectionVariants } : {}),
    }, metric.section_roles);
    if (value === null) return { state: 'unverifiable', reason: 'missing_or_null_input', computed: null };
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { state: 'unverifiable', reason: 'nonfinite_or_nonnumeric_result', computed: null };
    }
    if (typeof stated !== 'number' || !Number.isFinite(stated)) {
      return { state: 'unverifiable', reason: 'no_numeric_statement', computed: null };
    }
    return compareStatedMetric(value, stated, statedDecimals, metric);
  } catch (error) {
    return { state: 'unverifiable', reason: error.proto?.code ?? error.code ?? 'evaluation_error', computed: null };
  }
}

// Lite anchors are explicitly stated inputs. This maps the published bridge's
// section names only; it supplies no bridge metadata or financial defaults.
function readExample(source, bindings) {
  if (!/^uw_lite_version:/m.test(source)) return { parsed: parseUWFile(source), litePrecision: new Map() };
  const lite = parseUWLite(source);
  if (lite.issues.some(i => i.severity === 'error')) throw new Error('Invalid Lite fixture');
  const parsed = parseUWFile(source);
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

function get(object, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], object);
}

function blocks(entry) {
  if (!entry) return [];
  return entry.annotation ? [[undefined, entry]] : Object.entries(entry);
}

export function verifyExample(source, dictionary, bindings) {
  const { parsed, litePrecision } = readExample(source, bindings);
  const asset_class = parsed.frontmatter.asset_class;
  const calculations = dictionary.calculations.filter(m => m.asset_classes.includes(asset_class));
  if (!calculations.length) return null;
  const statements = [];
  for (const metric of calculations) {
    const quick = parsed.frontmatter.quick_metrics?.[metric.id];
    if (typeof quick === 'number') statements.push({ metric, path: `quick_metrics.${metric.id}`, stated: quick, statedDecimals: quickMetricDecimals(source, metric.id, quick) });
    const paths = [...bindings.output_sections.map(s => `${s}.${metric.id}`), ...(bindings.aliases[metric.id] ?? [])];
    for (const path of new Set(paths)) {
      const [section, ...tail] = path.split('.');
      for (const [variant, block] of blocks(parsed.sections[section])) {
        const stated = get(blockPayload(block), tail.join('.'));
        if (typeof stated !== 'number') continue;
        statements.push({ metric, path: `${section}${variant ? `[${variant}]` : ''}.${tail.join('.')}`, stated, statedDecimals: litePrecision.get(path) ?? jsonStatedDecimals(block, tail.join('.'), stated),
          ...(variant ? { sectionVariants: { [section]: variant } } : {}) });
      }
    }
  }
  for (const metric of dictionary.size_intensives.filter(m => m.asset_classes.includes(asset_class))) {
    for (const [variant, block] of blocks(parsed.sections.property)) {
      const stated = get(blockPayload(block), metric.path);
      if (typeof stated === 'number') statements.push({ metric, path: `property${variant ? `[${variant}]` : ''}.${metric.path}`, stated, statedDecimals: litePrecision.get(`property.${metric.path}`) ?? jsonStatedDecimals(block, metric.path, stated),
        ...(variant ? { sectionVariants: { property: variant } } : {}) });
    }
  }
  const evidence = statements.map(({ metric, path, stated, sectionVariants, statedDecimals }) => ({
    id: metric.id, path, stated, ...(statedDecimals !== undefined ? { stated_decimals: statedDecimals } : {}), ...verifyStatedMetric(metric, parsed, stated, sectionVariants, statedDecimals),
  }));
  const counts = { verified: 0, failed: 0, unverifiable: 0 };
  for (const item of evidence) counts[item.state]++;
  return { asset_class, counts, evidence };
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
