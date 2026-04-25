// .uw.md parser — extracts frontmatter, section blocks, prose, and pipeline log
// Spec: UW_FORMAT_SPEC_v1.md §2.4 (annotation syntax), §2.7 (update semantics), §2.8 (multi-variant)

import type {
  UWBlock,
  UWFenceAnnotation,
  UWFrontmatter,
  UWMeta,
  ParsedUWFile,
  ParsedSections,
  ParseOptions,
  ConfidenceLevel,
} from './types.js';

// ─── Regex patterns ───────────────────────────────────────────────────────────

// Opening fence: ```json uw:section=<id> [key=value ...]
const FENCE_OPEN_RE = /^```json\s+uw:section=(\S+)(.*)?$/;
// Closing fence: ``` (alone on line, optional trailing whitespace)
const FENCE_CLOSE_RE = /^```\s*$/;
// YAML frontmatter delimiter
const FRONTMATTER_RE = /^---\s*$/;
// Key=value pairs in fence annotation (value is any non-whitespace run)
const KV_RE = /(\w+)=([^\s]+)/g;

// ─── YAML frontmatter parser ──────────────────────────────────────────────────
// Minimal inline parser — handles the scalar types used in .uw.md frontmatter.
// For full YAML support, swap this for js-yaml: yaml.load(yamlText).

function parseYamlFrontmatter(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (!key || key.startsWith('#')) { i++; continue; }

    // Array: next lines are "  - value" items (check BEFORE nested object)
    if (rawVal === '' && i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
      const arr: unknown[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        arr.push(parseScalar(lines[i].trim().slice(2)));
        i++;
      }
      result[key] = arr;
    } else if (rawVal === '' && i + 1 < lines.length && lines[i + 1].startsWith('  ') && !lines[i + 1].trim().startsWith('- ')) {
      // Nested object: next lines are indented key: value pairs (not array items)
      const nested: Record<string, unknown> = {};
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        const nLine = lines[i];
        if (nLine.trim() === '' || nLine.trim().startsWith('#')) { i++; continue; }
        if (nLine.trim().startsWith('- ')) { i++; continue; } // skip list items in nested context
        const nColon = nLine.indexOf(':');
        if (nColon === -1) { i++; continue; }
        const nKey = nLine.slice(0, nColon).trim();
        const nRaw = nLine.slice(nColon + 1).trim();
        nested[nKey] = parseScalar(nRaw);
        i++;
      }
      result[key] = nested;
    } else {
      result[key] = parseScalar(rawVal);
      i++;
    }
  }

  return result;
}

function parseScalar(raw: string): unknown {
  if (raw === '' || raw === 'null' || raw === '~') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === '[]') return [];
  // Quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  // Number
  const num = Number(raw);
  if (!isNaN(num) && raw !== '') return num;
  return raw;
}

// ─── Fence annotation parser ──────────────────────────────────────────────────

function parseFenceAnnotation(sectionId: string, rest: string): UWFenceAnnotation {
  const annotation: UWFenceAnnotation = { section: sectionId };
  KV_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = KV_RE.exec(rest)) !== null) {
    const key = match[1];
    const value = match[2];

    switch (key) {
      case 'v':
        annotation.v = parseInt(value, 10);
        break;
      case 'superseded':
        annotation.superseded = value === 'true';
        break;
      case 'confidence':
        annotation.confidence = value as ConfidenceLevel;
        break;
      default:
        annotation[key] = value;
    }
  }

  return annotation;
}

// ─── Multi-variant section IDs ────────────────────────────────────────────────
// These sections store parallel variants (not superseded — genuinely concurrent).

const MULTI_VARIANT_SECTIONS = new Set([
  'operating_statement',
  'stress_tests',
  'due_diligence',
]);

// Sections routed to dedicated collections rather than the main sections map
const RESERVED_SECTION_IDS = new Set([
  'pipeline_log',
  'custom_calculations',
  'custom_scenarios',
]);

// ─── Main parse function ──────────────────────────────────────────────────────

export function parseUWFile(content: string, options: ParseOptions = {}): ParsedUWFile {
  const { strict = false } = options;
  const lines = content.split('\n');

  const result: ParsedUWFile = {
    frontmatter: {} as UWFrontmatter,
    sections: {},
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: content,
  };

  let i = 0;

  // ── 1. YAML Frontmatter ──────────────────────────────────────────────────────
  if (lines[0]?.trim() === '---') {
    i = 1;
    const yamlLines: string[] = [];
    while (i < lines.length && !FRONTMATTER_RE.test(lines[i])) {
      yamlLines.push(lines[i]);
      i++;
    }
    i++; // move past closing ---
    try {
      result.frontmatter = parseYamlFrontmatter(yamlLines.join('\n')) as UWFrontmatter;
    } catch (err) {
      if (strict) throw new Error(`Frontmatter parse error: ${err}`);
      (result.frontmatter as Record<string, unknown>)._parse_error = String(err);
    }
  }

  // ── 2. Body scan ─────────────────────────────────────────────────────────────
  // Collect prose lines between blocks; route each block to the right collection.

  let proseLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = FENCE_OPEN_RE.exec(line);

    if (!fenceMatch) {
      proseLines.push(line);
      i++;
      continue;
    }

    // ── We hit a section block ─────────────────────────────────────────────────
    const sectionId = fenceMatch[1];
    const restAnnotation = fenceMatch[2] ?? '';
    const annotation = parseFenceAnnotation(sectionId, restAnnotation);
    const lineStart = i + 1; // 1-indexed

    const capturedProse = proseLines.join('\n').trim();
    proseLines = [];

    // Collect JSON lines until closing ```
    i++;
    const jsonLines: string[] = [];
    while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
      jsonLines.push(lines[i]);
      i++;
    }
    const lineEnd = i + 1; // 1-indexed, closing ```
    i++; // move past closing ```

    const rawJson = jsonLines.join('\n');
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch (err) {
      if (strict) {
        throw new Error(`JSON parse error in section ${sectionId} at line ${lineStart}: ${err}`);
      }
      parsed = { _parse_error: String(err), _raw: rawJson };
    }

    const meta = (parsed['_meta'] as UWMeta | undefined) ?? ({} as UWMeta);

    const block: UWBlock = {
      annotation,
      meta,
      content: parsed,
      prose: capturedProse,
      rawJson,
      lineStart,
      lineEnd,
    };

    routeBlock(result, block, sectionId, annotation, capturedProse);
  }

  return result;
}

// ─── Block routing ────────────────────────────────────────────────────────────

function routeBlock(
  result: ParsedUWFile,
  block: UWBlock,
  sectionId: string,
  annotation: UWFenceAnnotation,
  prose: string,
): void {
  // Pipeline log — always append
  if (sectionId === 'pipeline_log') {
    result.pipeline_log.push(block);
    return;
  }

  // Custom sections — always append (order matters; last is newest)
  if (sectionId === 'custom_calculations') {
    result.custom_calculations.push(block);
    return;
  }
  if (sectionId === 'custom_scenarios') {
    result.custom_scenarios.push(block);
    return;
  }

  // Extension sections (x_ prefix)
  if (sectionId.startsWith('x_')) {
    result.extensions[sectionId] = block;
    return;
  }

  // Explicitly superseded block — goes to superseded archive, not current sections
  if (annotation.superseded === true || block.meta?.superseded === true) {
    if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
    result.superseded[sectionId].push(block);
    return;
  }

  // Multi-variant sections — keyed by variant, multiple concurrent instances allowed
  if (MULTI_VARIANT_SECTIONS.has(sectionId)) {
    const variant = annotation.variant ?? 'default';
    const existing = result.sections[sectionId];

    if (!existing || !isMultiVariantMap(existing)) {
      result.sections[sectionId] = { [variant]: block };
    } else {
      const variantMap = existing as { [v: string]: UWBlock };
      const current = variantMap[variant];

      if (!current) {
        variantMap[variant] = block;
      } else {
        // Replace if newer version
        const currentV = current.annotation.v ?? current.meta?.version ?? 1;
        const newV = annotation.v ?? block.meta?.version ?? 1;
        if (newV > currentV) {
          if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
          result.superseded[sectionId].push(current);
          variantMap[variant] = block;
        } else {
          if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
          result.superseded[sectionId].push(block);
        }
      }
    }
    if (!result.prose[sectionId]) result.prose[sectionId] = prose;
    return;
  }

  // Standard single-variant section
  const existing = result.sections[sectionId] as UWBlock | undefined;

  if (!existing) {
    result.sections[sectionId] = block;
    result.prose[sectionId] = prose;
    return;
  }

  // Resolve version conflict: keep higher version as current
  const existingBlock = existing as UWBlock;
  const existingV = existingBlock.annotation.v ?? existingBlock.meta?.version ?? 1;
  const newV = annotation.v ?? block.meta?.version ?? 1;

  if (newV > existingV) {
    if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
    result.superseded[sectionId].push(existingBlock);
    result.sections[sectionId] = block;
    result.prose[sectionId] = prose;
  } else {
    if (!result.superseded[sectionId]) result.superseded[sectionId] = [];
    result.superseded[sectionId].push(block);
  }
}

function isMultiVariantMap(val: unknown): boolean {
  if (typeof val !== 'object' || val === null) return false;
  // A UWBlock has annotation, meta, content — a variant map has string keys pointing to blocks
  return !('annotation' in (val as object));
}

// ─── Convenience: get current block for a section ─────────────────────────────

export function getSection(parsed: ParsedUWFile, sectionId: string): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry) return null;
  if (isMultiVariantMap(entry)) return null; // use getSectionVariant for multi-variant
  return entry as UWBlock;
}

export function getSectionVariant(
  parsed: ParsedUWFile,
  sectionId: string,
  variant: string,
): UWBlock | null {
  const entry = parsed.sections[sectionId];
  if (!entry || !isMultiVariantMap(entry)) return null;
  return (entry as { [v: string]: UWBlock })[variant] ?? null;
}

// ─── Deep get utility (for cross-section checks) ─────────────────────────────
// Resolves dot-path notation: "noi_model.net_operating_income"
// Array indices: "dcf.annual_cash_flows[0].net_cash_flow_levered"

export function deepGet(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
